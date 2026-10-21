import { readFileSync } from 'node:fs';

import { buildC2Messages } from '../../src/modules/seller-text-input/real-parser/c2-messages';
import { C2_MODEL_IDENTITY } from '../../src/modules/seller-text-input/parsers/real-seller-text-parser';

// REPLAY stub of the inference service (contract §9): answers with the SAVED C2 model output of PR #187 for the 28
// control messages, plus a few hand-written answers for test scenarios (marked below; they are not model output).
// It is not a model and proves nothing about real-model quality.
//
// Directives in the seller text (removed before the answer lookup): [stub:fail-once] HTTP 500 on the first call for
// that exact text; [stub:fail] always 500; [stub:slow] waits 5 s; [stub:wrong-model]; [stub:no-array];
// [stub:length] finish_reason=length; [stub:oversize]; [stub:many] 61 claims. [e2e:*] tags only make texts unique.

type Row = { condition: string; input: string; raw_output: string };

const control = JSON.parse(readFileSync(new URL('../fixtures/seller-text-real-parser/control28.json', import.meta.url), 'utf8')) as {
  raw_and_cards: Row[];
};

// Hand-written test answers (NOT model output): the contract §11.2 scenario text and test-only texts.
export const STUB_EXTRA_ANSWERS: Record<string, unknown[]> = {
  'Сегодня есть куриное филе по 2400 за килограмм, бёдра по 1800, пельмени наши, пачка пол кило — 1400 тенге. Хотя нет, филе уже 2500, сметана закончилась.': [
    { product: 'куриное филе', status: 'have', price: '2400', per: 'за килограмм', size: null, only: false, text: 'куриное филе по 2400 за килограмм' },
    { product: 'бёдра', status: 'have', price: '1800', per: null, size: null, only: false, text: 'бёдра по 1800' },
    { product: 'пельмени наши', status: 'have', price: '1400', per: 'пачка', size: 'пол кило', only: false, text: 'пельмени наши, пачка пол кило — 1400 тенге' },
    { product: 'филе', status: 'fix', price: '2500', per: null, size: null, only: false, text: 'Хотя нет, филе уже 2500' },
    { product: 'сметана', status: 'none', price: null, per: null, size: null, only: false, text: 'сметана закончилась' },
  ],
  'Груша-дичка 900 за кг': [
    { product: 'Груша-дичка', status: 'have', price: '900', per: 'за кг', size: null, only: false, text: 'Груша-дичка 900 за кг' },
  ],
  'Баранина 4500 за кг\nКурага пачка 500 г 1200': [
    { product: 'Баранина', status: 'have', price: '4500', per: 'за кг', size: null, only: false, text: 'Баранина 4500 за кг' },
    { product: 'Курага', status: 'have', price: '1200', per: 'пачка', size: '0,5 кг', only: false, text: 'Курага пачка 500 г 1200' },
  ],
};

export function stubAnswerKey(text: string): string {
  return text.replace(/\[(?:stub|e2e):[a-z0-9-]+\]/gi, '').trim();
}

const savedAnswers = new Map<string, string>();
for (const row of control.raw_and_cards) if (row.condition === 'C2') savedAnswers.set(row.input.trim(), row.raw_output);
for (const [text, claims] of Object.entries(STUB_EXTRA_ANSWERS)) savedAnswers.set(text, JSON.stringify(claims));

export type StubState = { calls: number; failedOnce: Set<string>; apiKey: string | null; slowMs: number };

export function createStubState(apiKey: string | null = null): StubState {
  return { calls: 0, failedOnce: new Set(), apiKey, slowMs: 5000 };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function completion(content: string, model = C2_MODEL_IDENTITY, finish = 'stop') {
  return json(200, { id: 'stub', object: 'chat.completion', model, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finish }] });
}

export async function handleStubRequest(request: Request, state: StubState): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== 'POST' || !url.pathname.endsWith('/v1/chat/completions')) return json(404, { error: 'not found' });
  if (state.apiKey !== null && request.headers.get('authorization') !== `Bearer ${state.apiKey}`) return json(401, { error: 'unauthorized' });
  state.calls += 1;
  const body = await request.json() as { model?: string; messages?: { role: string; content: string }[] };
  const messages = body.messages ?? [];
  const text = messages.at(-1)?.content ?? '';
  // The app must send exactly the pinned C2 prompt and demonstrations, then the seller text.
  if (body.model !== C2_MODEL_IDENTITY || JSON.stringify(messages) !== JSON.stringify(buildC2Messages(text))) {
    return json(400, { error: 'not the C2 request' });
  }
  if (text.includes('[stub:fail]')) return json(500, { error: 'stub failure' });
  if (text.includes('[stub:fail-once]') && !state.failedOnce.has(text)) {
    state.failedOnce.add(text);
    return json(500, { error: 'stub failure once' });
  }
  if (text.includes('[stub:slow]')) await new Promise((resolve) => setTimeout(resolve, state.slowMs));
  if (text.includes('[stub:wrong-model]')) return completion('[]', 'Qwen/Qwen3-4B@other');
  if (text.includes('[stub:no-array]')) return completion('Извините, не могу помочь.');
  if (text.includes('[stub:length]')) return completion('[{"product": "Морковь"', C2_MODEL_IDENTITY, 'length');
  if (text.includes('[stub:oversize]')) return completion(`[${'{"product":"x"},'.repeat(5000)}{}]`);
  if (text.includes('[stub:many]')) {
    return completion(JSON.stringify(Array.from({ length: 61 }, () => ({ product: 'Морковь', status: 'have', price: null, per: null, size: null, only: false, text: 'Морковь' }))));
  }
  const answer = savedAnswers.get(stubAnswerKey(text));
  if (answer === undefined) return json(422, { error: 'no saved answer for this text' });
  return completion(answer);
}

// fetch-compatible function for in-process tests (no network).
export function stubFetch(state: StubState): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    if (init?.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const response = handleStubRequest(request, state);
    if (!init?.signal) return response;
    return Promise.race([response, new Promise<never>((_, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })]);
  }) as typeof fetch;
}
