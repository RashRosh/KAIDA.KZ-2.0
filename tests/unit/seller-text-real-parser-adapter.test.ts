import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextInputParserError } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import {
  C2_MODEL_IDENTITY, chatCompletionsUrl, parseWithRealModel,
} from '../../src/modules/seller-text-input/parsers/real-seller-text-parser';
import {
  type RealParserConfig, isSellerTextInputEnabledFor, readRealParserConfig, readSellerTextInputMode,
} from '../../src/modules/seller-text-input/seller-text-input.config';
import { createStubState, stubFetch } from '../support/c2-replay-stub';

// REPLAY adapter tests (contract §9.1): the real adapter talks HTTP semantics to an in-process stub that serves saved
// C2 answers. Not a real model.
const KEY = 'k'.repeat(40);
const config = (over: Partial<RealParserConfig> = {}): RealParserConfig => ({
  url: new URL('http://127.0.0.1:9/'), apiKey: KEY, timeoutMs: 2000, concurrency: 1, allowlist: new Set(), ...over,
});
const SAVED = 'Привет, актуальные цены на сегодня. Морковь по 570 за килограмм. Перец 1740 за кг. Огурцы 970 за кг.';

async function failure(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof TextInputParserError) return [error.code, error.reason];
    throw error;
  }
  throw new Error('expected a parser failure');
}

afterEach(() => vi.restoreAllMocks());

describe('real adapter with the replay stub', () => {
  it('turns a saved C2 answer into draft lines', async () => {
    const result = await parseWithRealModel(SAVED, config(), { fetch: stubFetch(createStubState(KEY)) });
    expect(result.lines.map((l) => [l.title, l.price, l.unit])).toEqual([
      ['Морковь', '570', { code: 'kg' }], ['Перец', '1740', { code: 'kg' }], ['Огурцы', '970', { code: 'kg' }],
    ]);
  });

  it('sends the key only as a bearer header and the pinned model identity', async () => {
    const seen: Request[] = [];
    const state = createStubState(KEY);
    const inner = stubFetch(state);
    await parseWithRealModel(SAVED, config(), {
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push(new Request(input, init));
        return inner(input, init);
      }) as typeof fetch,
    });
    const request = seen[0]!;
    expect(request.url).toBe('http://127.0.0.1:9/v1/chat/completions');
    expect(request.headers.get('authorization')).toBe(`Bearer ${KEY}`);
    const body = await request.text();
    expect(body).not.toContain(KEY);
    expect(JSON.parse(body)).toMatchObject({ model: C2_MODEL_IDENTITY, max_tokens: 2048, temperature: 0, stream: false });
  });

  it('a wrong key is refused by the endpoint and creates nothing', async () => {
    expect(await failure(parseWithRealModel(SAVED, config({ apiKey: 'x'.repeat(40) }), { fetch: stubFetch(createStubState(KEY)) })))
      .toEqual(['TEXT_INPUT_FAILED', 'http_401']);
  });

  it.each([
    ['[stub:fail]', 'http_500'],
    ['[stub:wrong-model]', 'model_identity'],
    ['[stub:no-array]', 'no_array'],
    ['[stub:length]', 'token_limit'],
    ['[stub:oversize]', 'oversize'],
    ['[stub:many]', 'too_many_claims'],
    ['Текст без сохранённого ответа', 'http_422'],
  ])('%s is an answer-level failure: %s', async (text, reason) => {
    expect(await failure(parseWithRealModel(text, config(), { fetch: stubFetch(createStubState(KEY)) })))
      .toEqual(['TEXT_INPUT_FAILED', reason]);
  });

  it.each([
    ['not JSON', 'nope', 'not_json'],
    ['no content', JSON.stringify({ model: C2_MODEL_IDENTITY, choices: [{ message: {} }] }), 'envelope'],
    ['no choices', JSON.stringify({ model: C2_MODEL_IDENTITY }), 'envelope'],
  ])('envelope %s is an answer-level failure', async (_name, body, reason) => {
    const fetchBody = (async () => new Response(body, { status: 200 })) as unknown as typeof fetch;
    expect(await failure(parseWithRealModel(SAVED, config(), { fetch: fetchBody }))).toEqual(['TEXT_INPUT_FAILED', reason]);
  });

  it('unreachable service fails without a retry', async () => {
    const calls = vi.fn(async () => { throw new TypeError('fetch failed'); });
    expect(await failure(parseWithRealModel(SAVED, config(), { fetch: calls as unknown as typeof fetch })))
      .toEqual(['TEXT_INPUT_FAILED', 'unreachable']);
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('times out at the configured limit', async () => {
    const state = createStubState(KEY);
    state.slowMs = 3000;
    expect(await failure(parseWithRealModel(`${SAVED} [stub:slow]`, config({ timeoutMs: 1000 }), { fetch: stubFetch(state) })))
      .toEqual(['TEXT_INPUT_TIMEOUT', 'timeout']);
  });

  it('answers busy when the concurrency slots are taken', async () => {
    const state = createStubState(KEY);
    state.slowMs = 300;
    const slow = parseWithRealModel(`${SAVED} [stub:slow]`, config(), { fetch: stubFetch(state) });
    expect(await failure(parseWithRealModel(SAVED, config(), { fetch: stubFetch(state) }))).toEqual(['TEXT_INPUT_BUSY', 'busy']);
    await slow;
    expect(state.calls).toBe(1);
  });

  it('keeps a base path of the configured URL', () => {
    expect(chatCompletionsUrl(new URL('https://example.invalid/kaida')).href).toBe('https://example.invalid/kaida/v1/chat/completions');
  });
});

describe('configuration and endpoint access (§8)', () => {
  const base = { SELLER_TEXT_INPUT: 'real', SELLER_TEXT_INPUT_ALLOWLIST: '+77000000001' };

  it.each([
    ['loopback without key', { SELLER_TEXT_PARSER_URL: 'http://127.0.0.1:8000' }, 'real'],
    ['localhost without key', { SELLER_TEXT_PARSER_URL: 'http://localhost:8000' }, 'real'],
    ['public https with key', { SELLER_TEXT_PARSER_URL: 'https://tunnel.example.invalid', SELLER_TEXT_PARSER_API_KEY: KEY }, 'real'],
    ['public https without key', { SELLER_TEXT_PARSER_URL: 'https://tunnel.example.invalid' }, 'off'],
    ['public http even with key', { SELLER_TEXT_PARSER_URL: 'http://10.0.0.5:8000', SELLER_TEXT_PARSER_API_KEY: KEY }, 'off'],
    ['short key', { SELLER_TEXT_PARSER_URL: 'https://tunnel.example.invalid', SELLER_TEXT_PARSER_API_KEY: 'short' }, 'off'],
    ['credentials in URL', { SELLER_TEXT_PARSER_URL: 'https://u:p@tunnel.example.invalid', SELLER_TEXT_PARSER_API_KEY: KEY }, 'off'],
    ['no URL', {}, 'off'],
    ['timeout too large', { SELLER_TEXT_PARSER_URL: 'http://127.0.0.1:8000', SELLER_TEXT_PARSER_TIMEOUT_MS: '999999' }, 'off'],
  ])('%s → %s', (_name, env, mode) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(readSellerTextInputMode({ ...base, ...env })).toBe(mode);
    for (const call of error.mock.calls) {
      expect(String(call[0])).not.toContain(KEY);
      expect(String(call[0])).not.toContain('tunnel.example.invalid');
    }
  });

  it('defaults: 60 s timeout, one slot', () => {
    const parsed = readRealParserConfig({ ...base, SELLER_TEXT_PARSER_URL: 'http://127.0.0.1:8000' });
    expect(parsed).toMatchObject({ timeoutMs: 60000, concurrency: 1, apiKey: null });
  });

  it('only allowlisted users (ID or login phone) see the real channel; fake is for everybody', () => {
    const env = { ...base, SELLER_TEXT_PARSER_URL: 'http://127.0.0.1:8000', SELLER_TEXT_INPUT_ALLOWLIST: '+77000000001, user-2' };
    expect(isSellerTextInputEnabledFor({ id: 'user-1', phoneE164: '+77000000001' }, env)).toBe(true);
    expect(isSellerTextInputEnabledFor({ id: 'user-2', phoneE164: '+77000000002' }, env)).toBe(true);
    expect(isSellerTextInputEnabledFor({ id: 'user-3', phoneE164: '+77000000003' }, env)).toBe(false);
    expect(isSellerTextInputEnabledFor(null, env)).toBe(false);
    expect(isSellerTextInputEnabledFor({ id: 'user-3', phoneE164: '+77000000003' }, { SELLER_TEXT_INPUT: 'fake' })).toBe(true);
    expect(isSellerTextInputEnabledFor({ id: 'user-1', phoneE164: '+77000000001' }, { ...env, SELLER_TEXT_INPUT: 'off' })).toBe(false);
  });
});
