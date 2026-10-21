import { C2_DEMOS, C2_LEDGER_PROMPT } from './c2-assets';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

// Python `json.dumps(value, ensure_ascii=False[, sort_keys=True])`: separators ", " and ": ", non-ASCII kept. String
// escaping of JSON.stringify equals Python's for this mode (", \, control characters as \b \t \n \f \r or \u00xx).
export function pythonJsonDumps(value: unknown, sortKeys = false): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' || typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => pythonJsonDumps(v, sortKeys)).join(', ')}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  if (sortKeys) entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}: ${pythonJsonDumps(v, sortKeys)}`).join(', ')}}`;
}

// build_messages("C2", message): system = ledger prompt; six demonstrations as user/assistant turns; the seller text
// verbatim as the final user turn. Nothing else about the Seller is sent.
export function buildC2Messages(sellerText: string): ChatMessage[] {
  const messages: ChatMessage[] = [{ role: 'system', content: C2_LEDGER_PROMPT }];
  for (const [msg, claims] of C2_DEMOS) {
    messages.push({ role: 'user', content: msg });
    messages.push({ role: 'assistant', content: pythonJsonDumps(claims) });
  }
  messages.push({ role: 'user', content: sellerText });
  return messages;
}

// Recorded in control_C2.manifest.json: sha256(json.dumps(build_messages("C2", "<проба>"), ensure_ascii=False,
// sort_keys=True)). Equality proves the prompt, demonstrations and their serialization match the evidenced run.
export const C2_PROMPT_PROBE_SHA256 = '6a9b2a23a1481040688e9c07bef3c9dd83e97bc2cfa6ad3c942b915381fdde3e';
export const C2_PROMPT_PROBE_TEXT = '<проба>';
