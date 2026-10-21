import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  C2_PROMPT_PROBE_SHA256, C2_PROMPT_PROBE_TEXT, buildC2Messages, pythonJsonDumps,
} from '../../src/modules/seller-text-input/real-parser/c2-messages';
import { claimsFromAnswer, reduceClaims } from '../../src/modules/seller-text-input/real-parser/c2-reducer';

// Deterministic replay (contract §9.1): the saved C1/C2 answers of PR #187 go through the TypeScript port and must give
// exactly the cards the Python reducer (script 2.2) assembled. Same input + deterministic code → equality is required.
const FIXTURES = join(__dirname, '../fixtures/seller-text-real-parser');
const sha256 = (data: Buffer | string) => createHash('sha256').update(data).digest('hex');

type Row = {
  condition: string; id: string; input: string; raw_output: string; format_ok: boolean;
  assembled: { items: unknown[]; rejected: unknown[]; trace: unknown[] };
};

const control = readFileSync(join(FIXTURES, 'control28.json'));
const rows = (JSON.parse(control.toString('utf8')) as { raw_and_cards: Row[] }).raw_and_cards
  .filter((row) => row.condition === 'C1' || row.condition === 'C2');

describe('C2 reference fixtures', () => {
  it('are the verified bytes', () => {
    expect(sha256(readFileSync(join(FIXTURES, 'kaida_extract_exp.py'))))
      .toBe('695d930faf7fa6b6f83594aa9674d8c9edb272065582ab017f4204183ba8a593');
    expect(sha256(control)).toBe('d5e04ceb3ea1563e26e20fcc5e5e28eacf0a9869cdde9c55e6dcec2a3529c260');
    expect(rows).toHaveLength(56);
  });
});

describe('C2 messages', () => {
  it('reproduce the recorded prompt probe hash of the evidenced run', () => {
    expect(sha256(pythonJsonDumps(buildC2Messages(C2_PROMPT_PROBE_TEXT), true))).toBe(C2_PROMPT_PROBE_SHA256);
  });

  it('send the seller text verbatim as the last user turn and nothing else about the seller', () => {
    const messages = buildC2Messages('Морковь 570 за кг');
    expect(messages).toHaveLength(14);
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Морковь 570 за кг' });
  });
});

describe('C2 reducer port parity with script 2.2', () => {
  it.each(rows.map((row) => [`${row.condition} ${row.id}`, row] as const))('%s', (_name, row) => {
    const parsed = claimsFromAnswer(row.raw_output);
    if ('error' in parsed) {
      expect(row.format_ok).toBe(false);
      expect(row.assembled.items).toEqual([]);
      return;
    }
    expect(reduceClaims(parsed.claims, row.input)).toEqual(row.assembled);
  });
});
