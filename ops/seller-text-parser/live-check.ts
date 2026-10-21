import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { TextInputParserError } from '../../src/modules/seller-text-input/contracts/seller-text-input.contract';
import { claimsFromAnswer, reduceClaims } from '../../src/modules/seller-text-input/real-parser/c2-reducer';
import {
  C2_MODEL_IDENTITY, fetchC2CompletionBody, parseWithRealModel,
} from '../../src/modules/seller-text-input/parsers/real-seller-text-parser';
import { readRealParserConfig } from '../../src/modules/seller-text-input/seller-text-input.config';

// seller-ai-text-real-parser §9.2–§9.3 operator tool. Talks to the configured inference service exactly as the app
// does (same messages, limits, key handling). Synthetic text only. Prints identifiers, timings and counts; the
// control-28 mode writes model answers to files under --out (synthetic benchmark text, not seller data).
//
//   smoke                 5 synthetic messages through the full app parser (§9.2)
//   control28 --out DIR   the 28 control messages: raw answers in script-2.2 row format + comparison with the saved
//                         C2 run (§9.3). Score with: python -I tests/fixtures/seller-text-real-parser/kaida_extract_exp.py
//                         score DIR/live_C2.jsonl --split test --errors 28
//   saved --out DIR       the SAVED C2 answers in the same format, no network: proves the scorer reproduces 25/28

const CONTROL = new URL('../../tests/fixtures/seller-text-real-parser/control28.json', import.meta.url);
const SMOKE = [
  ['single item', 'Морковь 570 за кг'],
  ['multi item', 'Картошка 300 за кг, лук 250 за кг, капуста 200 за кг'],
  ['package', 'Пельмени домашние, пачка 800 г — 2100 тенге'],
  ['out of stock', 'Сметаны сегодня нет, творог 1800 за кг'],
  ['unpriced', 'Есть укроп и петрушка, цену уточню'],
] as const;

type Row = { condition: string; id: string; input: string; raw_output: string; assembled: { items: Fact[] } };
type Fact = { title: string; price: string | null; unit: { code: string } | null; pack: unknown; available: boolean | null };

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const facts = (items: Fact[]) => items.map((i) => [i.title.toLowerCase(), i.price, i.unit?.code ?? null, i.pack, i.available]);

function config() {
  const parsed = readRealParserConfig(process.env);
  if ('invalid' in parsed) throw new Error(`Parser configuration is invalid: ${parsed.invalid}`);
  return parsed;
}

function outDir(): string {
  const i = process.argv.indexOf('--out');
  if (i < 0 || !process.argv[i + 1]) throw new Error('--out DIR is required');
  mkdirSync(process.argv[i + 1]!, { recursive: true });
  return process.argv[i + 1]!;
}

function controlRows(): Row[] {
  return (JSON.parse(readFileSync(CONTROL, 'utf8')) as { raw_and_cards: Row[] }).raw_and_cards.filter((r) => r.condition === 'C2');
}

function scriptRow(row: Row, raw: string, extra: Record<string, unknown>) {
  return { key: `C2|${C2_MODEL_IDENTITY}|${row.id}|None`, fp: extra.fp, cond: 'C2', model: C2_MODEL_IDENTITY, id: row.id,
    msg_sha: sha(row.input).slice(0, 16), seed: null, batch_size: 1, raw, ...extra };
}

async function smoke() {
  const cfg = config();
  let failed = 0;
  for (const [name, text] of SMOKE) {
    const started = Date.now();
    try {
      const result = await parseWithRealModel(text, cfg);
      console.log(JSON.stringify({ case: name, ok: true, ms: Date.now() - started, drafts: result.lines.length,
        skipped: result.skipped.length, notices: (result.notices ?? []).length }));
    } catch (error) {
      failed += 1;
      console.log(JSON.stringify({ case: name, ok: false, ms: Date.now() - started,
        code: error instanceof TextInputParserError ? `${error.code}:${error.reason}` : 'unexpected' }));
    }
  }
  console.log(failed === 0 ? 'SMOKE PASS (integration only; not a quality result)' : `SMOKE FAIL: ${failed} of ${SMOKE.length}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

async function control28() {
  const cfg = config();
  const dir = outDir();
  const rows: unknown[] = [];
  const comparison: unknown[] = [];
  for (const row of controlRows()) {
    const started = Date.now();
    let raw = '';
    let finish: unknown = null;
    let model: unknown = null;
    let error: string | null = null;
    try {
      const body = JSON.parse(await fetchC2CompletionBody(row.input, cfg)) as { model?: unknown; choices?: { message?: { content?: unknown }; finish_reason?: unknown }[] };
      model = body.model;
      raw = String(body.choices?.[0]?.message?.content ?? '');
      finish = body.choices?.[0]?.finish_reason ?? null;
    } catch (e) {
      error = e instanceof TextInputParserError ? `${e.code}:${e.reason}` : 'unexpected';
    }
    const seconds = (Date.now() - started) / 1000;
    rows.push(scriptRow(row, raw, { fp: 'live', hit_limit: finish === 'length', seconds, model_reported: model }));
    const parsed = claimsFromAnswer(raw);
    const liveFacts = 'error' in parsed ? null : facts(reduceClaims(parsed.claims, row.input).items);
    comparison.push({
      id: row.id, error, seconds, identity_ok: model === C2_MODEL_IDENTITY, raw_byte_equal: raw === row.raw_output,
      facts_equal: JSON.stringify(liveFacts) === JSON.stringify(facts(row.assembled.items)),
      saved_facts: facts(row.assembled.items), live_facts: liveFacts,
    });
    console.log(JSON.stringify({ id: row.id, error, seconds, identity_ok: model === C2_MODEL_IDENTITY }));
  }
  writeFileSync(join(dir, 'live_C2.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(dir, 'comparison.json'), JSON.stringify(comparison, null, 1));
  const c = comparison as { error: string | null; raw_byte_equal: boolean; facts_equal: boolean; identity_ok: boolean }[];
  console.log(JSON.stringify({
    messages: c.length, errors: c.filter((x) => x.error).length, identity_ok: c.filter((x) => x.identity_ok).length,
    raw_byte_equal: c.filter((x) => x.raw_byte_equal).length, facts_equal_to_saved_c2: c.filter((x) => x.facts_equal).length,
  }));
}

function saved() {
  const dir = outDir();
  const rows = controlRows().map((row) => scriptRow(row, row.raw_output, { fp: 'saved-c2', hit_limit: false, seconds: 0 }));
  writeFileSync(join(dir, 'live_C2.jsonl'), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`wrote ${rows.length} saved C2 rows to ${join(dir, 'live_C2.jsonl')}`);
}

const mode = process.argv[2];
const run = mode === 'smoke' ? smoke : mode === 'control28' ? control28 : mode === 'saved' ? async () => saved() : null;
if (!run) {
  console.error('usage: live-check.ts smoke | control28 --out DIR | saved --out DIR');
  process.exitCode = 2;
} else {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'live check failed');
    process.exitCode = 1;
  });
}
