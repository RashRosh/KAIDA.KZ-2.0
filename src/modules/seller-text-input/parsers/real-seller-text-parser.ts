import {
  type SellerTextParseResult,
  TextInputParserError,
} from '../contracts/seller-text-input.contract';
import { claimsToParseResult } from '../real-parser/c2-pipeline';
import { buildC2Messages } from '../real-parser/c2-messages';
import { claimsFromAnswer } from '../real-parser/c2-reducer';
import type { RealParserConfig } from '../seller-text-input.config';

// seller-ai-text-real-parser §5–§6.2: the app owns prompt, limits, parsing, reducer and safeguards; the inference
// service only generates text for the pinned C2 configuration over an OpenAI-compatible chat-completions endpoint.

export const C2_MODEL_ID = 'Qwen/Qwen3-4B';
export const C2_MODEL_REVISION = '1cfa9a7208912126459214e8b04321603b3df60c';
// The service must report exactly this identity; any other model or revision is a different configuration.
export const C2_MODEL_IDENTITY = `${C2_MODEL_ID}@${C2_MODEL_REVISION}`;
export const C2_MAX_NEW_TOKENS = 2048;
export const MAX_RESPONSE_BYTES = 64 * 1024;
export const MAX_CLAIMS = 60;

let inFlight = 0;

export function realParserInFlight(): number {
  return inFlight;
}

const fail = (reason: string) => new TextInputParserError('TEXT_INPUT_FAILED', reason);

async function readLimited(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw fail('oversize');
    }
    chunks.push(value);
  }
  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
}

export function chatCompletionsUrl(base: URL): URL {
  const withSlash = new URL(base.href.endsWith('/') ? base.href : `${base.href}/`);
  return new URL('v1/chat/completions', withSlash);
}

// Answer-level validation (§6.2): any failure here rejects the whole request; nothing is created.
export function contentFromEnvelope(body: string): string {
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw fail('not_json');
  }
  const envelope = json as { model?: unknown; choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] };
  const choice = Array.isArray(envelope?.choices) ? envelope.choices[0] : undefined;
  const content = choice?.message?.content;
  if (typeof content !== 'string') throw fail('envelope');
  if (envelope.model !== C2_MODEL_IDENTITY) throw fail('model_identity');
  if (choice?.finish_reason === 'length') throw fail('token_limit');
  return content;
}

export function claimsFromContent(content: string): unknown[] {
  const parsed = claimsFromAnswer(content);
  if ('error' in parsed) throw fail(parsed.error.startsWith('json_error') ? 'invalid_json' : 'no_array');
  if (parsed.claims.length > MAX_CLAIMS) throw fail('too_many_claims');
  return parsed.claims;
}

// One chat-completions call for the C2 messages of `text`: → the raw response body (≤ 64 KiB). No retry.
export async function fetchC2CompletionBody(
  text: string,
  config: Pick<RealParserConfig, 'url' | 'apiKey' | 'timeoutMs'>,
  dependencies: { fetch?: typeof fetch } = {},
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (config.apiKey) headers.authorization = `Bearer ${config.apiKey}`;
  try {
    const response = await (dependencies.fetch ?? fetch)(chatCompletionsUrl(config.url), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: C2_MODEL_IDENTITY,
        messages: buildC2Messages(text),
        max_tokens: C2_MAX_NEW_TOKENS,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw fail(`http_${response.status}`);
    }
    return await readLimited(response);
  } catch (error) {
    if (error instanceof TextInputParserError) throw error;
    if (controller.signal.aborted) throw new TextInputParserError('TEXT_INPUT_TIMEOUT', 'timeout');
    throw fail(error instanceof TypeError && /decode|utf/i.test(error.message) ? 'not_utf8' : 'unreachable');
  } finally {
    clearTimeout(timer);
  }
}

export async function parseWithRealModel(
  text: string,
  config: RealParserConfig,
  dependencies: { fetch?: typeof fetch } = {},
): Promise<SellerTextParseResult> {
  if (inFlight >= config.concurrency) throw new TextInputParserError('TEXT_INPUT_BUSY', 'busy');
  inFlight += 1;
  try {
    const body = await fetchC2CompletionBody(text, config, dependencies);
    return claimsToParseResult(claimsFromContent(contentFromEnvelope(body)), text);
  } finally {
    inFlight -= 1;
  }
}
