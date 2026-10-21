# Seller AI text input — real parser (integration slice 2) — Slice Contract

**Status:** DRAFT for PO review (revision 2, 2026-10-21). Not approved; implementation and merge not authorized.

**Capability:** Feature Map `S17` (text channel only), Execution Plan `S-AI-INPUT`. Continues the closed
[integration slice 1](../seller-ai-text-input/SLICE_CONTRACT.md) (`v0.0.80-seller-ai-text-input`).

**Base:** `main` at `fb90beeb` (closure of slice 1; application code identical to `v0.0.80`).

**Configuration record:** [C2_CONFIGURATION.md](C2_CONFIGURATION.md) — model, revision, prompt, demonstrations,
generation settings, script version and hashes of the researched run, generated from the verified script.

**Research evidence:** open PR #187 (`docs/research/ai-text-2026-10-17/`). No new model research, comparison or
model choice is made by this contract.

## 1. User task

An authenticated Seller writes or pastes a free-text product list. The configured real text parser — the researched
C2 configuration served by an inference service — turns it into **private offer drafts**. The Seller reviews them on
the existing review screen, corrects anything in the existing `CardEditor`, and publishes each card through the
existing «Проверить и опубликовать» → confirm path. Nothing is published automatically; the model never writes an
Offer or a catalog Product.

## 2. What the evidence supports

| Item | Recorded fact | Consequence |
| --- | --- | --- |
| Configuration | `Qwen/Qwen3-4B` @ `1cfa9a7208912126459214e8b04321603b3df60c`, float16, greedy, thinking off, 2048 new tokens, batch 1, torch 2.11.0+cu128 / transformers 5.16.1, one Tesla T4; ledger prompt + six demonstrations; reducer from script 2.2 (`695d930f…`). Run manifest, log, scores and raw answers located in PO Drive; script, prompt and bench hashes re-verified 2026-10-21 | This configuration is reused as is. Any other model, quantization or prompt is a different configuration and outside this slice. |
| Result | 28 synthetic, templated messages: format 28/28, content 25/28 (core 22/25), products 79/81, prices 63/63, units 77/79, packs 79/79, unflagged wrong cards 1/81 | Historical regression evidence. Not real-seller accuracy, not production readiness, not a calibrated confidence. |
| Known C2 errors | `price_null_01`: grapes and apples omitted by the model; `REAL_04`: cucumbers given the neighbour’s «за кг» without a flag; `slang_noise_00`: unit written in mixed alphabets not recognised (flagged) | Drive the safeguards in §6.3 and the residual risks in §13. |
| What the reducer already checks | Price is accepted only when a number is bound by **position** to a mention of that product in the same clause (`attach_numbers`/`bind_price`); otherwise the price is dropped and flagged `price_not_bound`. Weak or cross-clause bindings are kept but flagged. Quotes must be substrings of the message. Corrections («700 нет… 650») keep the later value. Unit is taken only from the model’s `per` words; pack only from `size`, without unit conversion except «пол кило/литра» = 0.5 kg/l | The port keeps these rules. Position binding is a heuristic, not proof that a value belongs to a product (§6.3). |
| Not covered | Catalog lookup, DB, UI, confirmation, real messages, service deployment, latency of C2 (not recorded; earlier set on the same GPU ≈ 2.1 s/message, hard prompts 4.5–26 s) | Measured in the smoke test (§9.2); not assumed. |

## 3. Closed contracts and boundaries kept

| Contract / rule | Kept as |
| --- | --- |
| Slice 1 (`seller-ai-text-input`) | Same screens, API path, draft mapping, review, editor and publish path; changes are additive (§7). `fake` mode stays and remains the CI parser. |
| `PROJECT_RULES` §12 | Model output becomes drafts only; publication only via existing `createCardChangeSet` + confirm. No change to `SellerChangeSet`, S12 batch or confirm semantics. |
| Drafts / card contracts | Drafts may be incomplete; server publish validation stays authoritative. `cardCreateBodySchema` is strict and the editor sends `draftId`, not the draft payload, so `aiHints` cannot reach a published offer — proven end to end in §9.1. |
| Catalog (`resolve-product`, S15B) | Exact resolution only. Ambiguous → no automatic choice; not found → seller title, `productId` null. No `product_candidate`, no catalog writes. The model never sees or emits product IDs. |
| `PROJECT_RULES` §10.1 | The parser improves on the manual path. Service down or misconfigured → manual entry unaffected. |
| Data residency (Feature Map “AI Input”) | Production seller data is processed only in Kazakhstan. Foreign infrastructure is allowed for testing with synthetic or PO-authored text only. |
| Issue #75 | Applied where touched: no invented facts, price basis not guessed, Product ≠ Offer, no automatic Product, provenance per draft. Attribute decomposition, offer de-duplication, multi-message context and learning from corrections are out of scope. |

## 4. Scope

### 4.1 In scope

1. Mode `real` for `SELLER_TEXT_INPUT` (`off` | `fake` | `real`) with parser configuration (§8). Invalid `real`
   settings degrade to `off` with one server log line.
2. Real parser adapter behind the existing parser interface: builds the C2 messages from versioned prompt and
   demonstration files, calls the inference service, validates the answer, runs the reducer and safeguards, returns
   the existing `SellerTextParseResult` shape.
3. TypeScript port of the C2 answer parsing and reducer (script 2.2), with the script committed as a test reference.
4. A minimal reference inference wrapper (ops tooling, pinned to the §2 stack) that serves the C2 configuration over
   HTTP, for the integration test.
5. Idempotent submission with a client `requestId` (§6.4).
6. Failure handling: timeout, busy, malformed output — explicit UI state, no partial drafts (§6.2).
7. Allowlist for controlled testing (§8).
8. Review screen (existing layout): skipped and «possibly missed» entries (§6.3) and, for real-parser results, the
   reminder line «Список составлен автоматически. Сверьте с исходным текстом выше.» (wording approved for this
   contract by PO 2026-10-21; placement reviewed with the implementation).
9. Logging and retention rules (§6.5) and an ops note (configuration, test setup, rollback) in `docs/ops/`.
10. Tests separated into deterministic, smoke and quality evaluation (§9).

### 4.2 Out of scope

- Choosing, comparing, quantizing or fine-tuning models; prompt changes beyond the C2 prompt; decision models;
  semantic catalog matching.
- Buying or provisioning hosting, GPUs or paid APIs.
- Production enablement (separate PO decision, §10).
- Voice, photo, video, Telegram, translation, subscriptions, promotion, moderation.
- Stock-out / `available:false` updates of existing offers, offer de-duplication, multi-card atomic publish, S12
  changes, new review checkboxes, new publish UI.
- Persisting raw input or model output in the database; any DB migration.

## 5. Where inference runs and how the app reaches it

**Architecture.** A separate, stateless inference service exposes `POST /v1/chat/completions` (OpenAI-compatible
request/response) on an address configured in the app. The app owns the prompt, demonstrations, limits, answer
parsing, reducer, safeguards, catalog resolution and drafts. The service receives only the C2 messages (fixed system
prompt, fixed demonstrations, seller text) and returns the generated text plus the model identity it serves; it has
no database, catalog, credentials or tools. In-process inference in the Node app is not used (memory, single app
process per `DEPLOYMENT.md`).

**Runtime matching the evidence.** The reference wrapper loads the pinned weights with transformers in float16,
applies the model’s own chat template with `enable_thinking=false`, and calls `generate(do_sample=false,
max_new_tokens=2048)` for one request at a time — the same code path as script 2.2. It reports the model ID and
revision; the adapter refuses answers from any other identity (503, §6.2). Other serving runtimes may be evaluated
later as a separate decision.

**Known hardware facts and unknowns**

| Item | Known | Unknown |
| --- | --- | --- |
| Weights | ≈ 4 billion parameters; float16 weights ≈ 8 GB (2 bytes per parameter) plus runtime and KV-cache memory | Exact peak memory per request at 4000-character input |
| Evidenced device | One Tesla T4 (15 GiB) ran all 84 control answers at batch 1 without hitting the token limit | Latency and memory of C2 on that device (not recorded) |
| PO laptop | i5-11260H, 7.7 GiB RAM (heavily paging with the dev stack), GTX 1650 with 4 GiB VRAM | Whether and how fast the C2 configuration runs there (e.g. with CPU/disk offload); not tested |
| Other hosts | — | Throughput under concurrent sellers, CPU-only feasibility, cost |

**Temporary controlled integration test** (Part B). Any environment that can run the §2 stack and is reachable from
the app during the test session. Foreign infrastructure is allowed; text must be synthetic or PO-authored. Candidates,
without purchase: (a) a Kaggle GPU notebook (the environment where C2 ran) running the reference wrapper, reached
through a temporary tunnel for the duration of the test — PO checks the platform terms; (b) the PO laptop, if a
feasibility check shows the configuration runs at all; (c) any other free GPU environment PO already has. Choice:
D-1.

**Production deployment.** Inference in Kazakhstan under KAIDA control, no request logging, no third-party access to
seller text; sized from the smoke-test measurements. Separate PO decision (D-4); nothing is purchased by this slice.

## 6. Behaviour

### 6.1 Flow

1. Compose screen (unchanged) submits `{ text, requestId }`; submit is disabled while in flight.
2. Server: auth → body validation → mode/allowlist → in-flight de-duplication → **inference outside any DB
   transaction** → answer validation → reducer → safeguards.
3. One DB transaction: idempotency check, seller/location lookup, `resolveProduct` per item, `saveOfferDraft` per item;
   rollback on any error.
4. Response (slice-1 shape plus additive fields) → review → `CardEditor` → existing confirm/publish.

### 6.2 Request, validation, limits, failures

- Request: system = ledger prompt; six demonstration turns; final user turn = seller text verbatim. No other seller
  data (name, phone, location, user ID). Input limit unchanged: 4000 characters after trim.
- Answer: HTTP body ≤ 64 KiB; reported model identity must equal the configured one; generated text is parsed by the
  C2 rule (first JSON array); claims validated against a strict schema (`product`, `status`, `price`, `per`, `size`,
  `only`, `text`; bounded lengths; ≤ 60 claims).

| Case | API | UI |
| --- | --- | --- |
| Inference exceeds `SELLER_TEXT_PARSER_TIMEOUT_MS` (default 60 000, max 180 000) | 503 `TEXT_INPUT_TIMEOUT`, no drafts | inline error, «Повторить» (same `requestId`), manual entry link |
| Unreachable, non-2xx, oversize, wrong model identity, token limit reached, no JSON array, schema violation | 503 `TEXT_INPUT_FAILED`, no drafts | same |
| More than `SELLER_TEXT_PARSER_CONCURRENCY` (default 1) in flight | 429 `TEXT_INPUT_BUSY` | «Сервис занят, попробуйте через минуту» |
| Single claim invalid or rejected by the reducer | 201; claim listed in `skipped` | «Не распознано» |
| More than 30 resulting items | 201; first 30 become drafts, the rest `skipped` («Не больше 30 позиций за раз») | «Не распознано» |
| DB failure | 503 `TEXT_INPUT_FAILED`, rollback | same |

No automatic server-side retry. The client waits for the server timeout plus 15 s; a retry reuses the `requestId`.
The route’s maximum duration exceeds the parser timeout.

### 6.3 Safeguards: what code checks and what it cannot

Seller text and model output are untrusted data. The model has no tools and no write access. Values that appear
somewhere in the text are **not** treated as belonging to a product; the rules below say what each check can and
cannot establish.

**Price assigned to the wrong product.** The reducer’s position binding is kept: a price is accepted only if that
number is bound to a mention of the same product in the same clause (paired order for «A и B по X и Y»). Not bound →
price left empty, `price` notice. Bound weakly, across clauses, only through the quote, or followed by a later
correction marker → price kept with a `price` notice. A price in a clause with command wording → kept with a notice
(heuristic, not injection protection). Binding is positional; it can still attach a number to the wrong product
without a flag (C2: 0 of 63 wrong prices unflagged on synthetic text — not a guarantee).

**Unit assigned to the wrong product.** The model’s `per` words are accepted only if they occur inside the item’s own
quote and the quote is bound to this product’s mention (the quote does not name another product before the unit
words). Otherwise unit = empty with a `unit` notice. Example: `REAL_04` cucumbers — quote «огурцы по 500» has no
unit words → unit empty and flagged instead of the silent «kg». This is a new check; its effect on all 79 saved C2
items is measured by the deterministic replay test before acceptance and listed in the PR.

**Packaging.**
- The pack is taken only from the model’s `size` words that occur in the item’s quote; otherwise empty with a `pack`
  notice.
- The seller’s unit of measure is kept: «500 г» stays 500 g. If the model normalizes to an equivalent quantity
  (0.5 kg for «500 г»), the code compares quantities in base units (g, ml); equal → accepted and shown in the seller’s
  original unit; different → pack empty with a notice. «пол кило / пол литра» = 0.5 kg / 0.5 l (C2 rule).
- Quantity of packages («2 бутылки») is not a pack size; ambiguous readings stay empty with a notice.
- Price per kg/l with a stated pack: the reducer drops the pack; here the draft keeps the price per kg/l and shows a
  `pack` notice «Фасовка из текста не перенесена» so the information is not silently lost.
- The seller’s original wording stays visible as the draft’s source quote.

**Unsupported or uncertain fields.** Missing, unparsable or unbound price/unit/pack → field empty plus a notice. A
non-tenge currency in the text → price empty plus notice. No field is filled from the catalog, from a neighbouring
item or from defaults. Ambiguous catalog → `productId` null plus notice. Notices are words, never percentages.

**Out-of-stock mentions** (`status:none`) → listed under «Не распознано» with «Отметка “нет в наличии” — измените
карточку вручную». No offer is changed.

**Omitted products — no completeness guarantee.** The model can omit a product (C2 `price_null_01`); code cannot
prove completeness. Two deterministic hints reduce, but do not close, the gap:
1. *Uncovered line:* each non-empty input line that overlaps no accepted or skipped quote is listed as «Строка не
   разобрана». Covers whole-line omissions in list-style input only.
2. *Unused number:* a price-like number in the text not used by any item is listed as «Число не использовано: …».
   Covers omitted products that had a price; misses unpriced ones (as in `price_null_01`).
Both are measured on the saved C2 answers in the deterministic tests; neither is claimed to detect all omissions. The
reminder line (§4.1 item 8) and the raw text on the review screen remain the Seller’s main check.

### 6.4 Idempotency and duplicates

- Client creates `requestId` (UUID) per submitted text; retries of the same text reuse it; edited text gets a new one.
  Optional in the API; absent → server generates one (slice-1 behaviour). `inputId` = `requestId`.
- Same (seller, `requestId`) while a request is in flight → waits for that result; no second inference.
- In the DB transaction: `pg_advisory_xact_lock` on (seller, `requestId`), then this seller’s drafts with
  `aiHints.inputId = requestId`; if found, return them (200, same body shape) without creating anything.
- Full response cached in memory for 30 minutes with a text hash; same `requestId` with different text → 409
  `TEXT_INPUT_REQUEST_CONFLICT`. Cache lost (restart) → replay returns the drafts with `skippedUnavailable: true` and the
  review shows «Список нераспознанного недоступен — сверьте с исходным текстом».
- Failed attempts create nothing: inference precedes the transaction, and the transaction is all-or-nothing.

### 6.5 Data leaving the app, retention, logging

- Leaves the app: seller text plus the fixed prompt and demonstrations, to the configured service. Nothing else.
- Testing: any location, synthetic or PO-authored text only, allowlisted test seller only. Production: Kazakhstan,
  request logging disabled (D-4).
- Stored by the app: as slice 1 — drafts with `aiHints.sourceQuote` (≤ 500 characters per draft). Raw text and raw
  model output are not written to the DB. In-memory response cache: 30 minutes, lost on restart.
- Logs: `inputId`, outcome code, duration, counts (items, drafts, skipped, notices), configuration version. Never the
  seller text, quotes, titles or model output.
- Published offers carry no `aiHints`.

## 7. API and data changes (additive)

`POST /api/seller/text-input`: body `{ text, requestId? }` (strict); 201 slice-1 body plus optional
`skippedUnavailable`; 200 for idempotent replay; new codes 503 `TEXT_INPUT_TIMEOUT`, 429 `TEXT_INPUT_BUSY`, 409
`TEXT_INPUT_REQUEST_CONFLICT`. Non-allowlisted seller in `real` mode → 503 `TEXT_INPUT_UNAVAILABLE` (as `off`).

`aiHints` (JSON in `offer_drafts.payload`, no migration) gains optional `parser: 'fake' | 'real'` and
`parserConfig` (e.g. `c2/script-2.2/Qwen3-4B@1cfa9a7`). `ParsedTextLine` gains optional `uncertainFields`; when
absent, slice-1 mapping applies, so `fake` behaviour is unchanged. Skipped entries gain reasons for the new cases.

## 8. Configuration, rollout, rollback

| Variable | Rule |
| --- | --- |
| `SELLER_TEXT_INPUT` | `off` (default) \| `fake` \| `real`; unknown → `off` |
| `SELLER_TEXT_PARSER_URL` | required for `real`; `http(s)`; private or tunnel endpoints live only in deployment env, never in Git |
| `SELLER_TEXT_PARSER_API_KEY` | optional bearer secret; never logged or committed |
| `SELLER_TEXT_PARSER_TIMEOUT_MS` | 1 000–180 000, default 60 000 |
| `SELLER_TEXT_PARSER_CONCURRENCY` | 1–8, default 1 |
| `SELLER_TEXT_INPUT_ALLOWLIST` | user IDs allowed in `real` mode; empty → nobody |

Model ID, revision, prompt and demonstrations are versioned in the repository (C2 record), not configured per
deployment. Rollout: `off` → `real` for the PO test seller during the integration test → further steps only by PO
decision. Rollback: `SELLER_TEXT_INPUT=off` and restart; text option disappears, existing drafts stay ordinary drafts,
manual entry unaffected. Code rollback: revert; no migration.

## 9. Verification

Three separate kinds of evidence; none substitutes for another. Fixtures and test names say which parser they use:
**fake** (slice 1), **replay** (real adapter fed saved C2 answers through a local stub server), **live** (real model).

### 9.1 Deterministic adapter and business-rule tests (CI)

- Reducer port: for the 56 saved ledger answers in `control28.json` (conditions C1 and C2), the port reproduces the saved `assembled` items of the
  Python reducer exactly (same input, deterministic code). Intended differences from new safeguards are listed per
  message (at least `REAL_04` cucumbers unit → empty + notice).
- Safeguards: wrong-product price (unbound, weak, cross-clause), unit outside the quote, equivalent pack normalization
  accepted and shown in the seller’s unit, non-equivalent pack rejected, «пол кило», package count vs size, non-tenge
  currency, out-of-stock, uncovered line, unused number, >30 items, command clause.
- Envelope: wrong model identity, invalid JSON, token-limit answer, oversize, >60 claims, unknown keys.
- Integration (PostgreSQL), replay mode: N drafts with `aiHints.parser = 'real'`; «Баранина» linked; free title keeps
  `productId` null; **ambiguous catalog** title → `productId` null and notice, no choice (slice-1 gap; slice 2 raises the
  risk because model titles vary); **`aiHints` absent after publish** through change set + confirm (slice-1 gap; slice 2
  adds provenance fields); idempotency sequential and concurrent; 409; timeout/500/malformed → 503 with zero drafts; DB
  error rollback; offer count 0 after parsing.
- E2E (production build): slice-1 fake E2E unchanged; one replay E2E text → review (skipped, notices, reminder) → edit
  → publish one card → stub timeout → retry without duplicates; non-allowlisted seller sees the slice-1 unavailable
  state; manual entry works.
- `pnpm verify` and branch CI green.

### 9.2 Smoke test with the real model (Part B, manual)

Purpose: prove the integration works end to end, not quality. Against the live service: 5 synthetic messages (single
item, multi-item, package, out-of-stock, unpriced). Pass when every request returns a valid answer from the pinned
model identity, drafts appear on the review screen, publish works through confirm, logs contain no text, and latency
and peak memory are recorded. A timeout or wrong identity is a failure to investigate, not a quality result.

### 9.3 Extraction quality evaluation (Part B, report for PO)

The 28 control messages are **historical regression evidence** for the same configuration, not proof of real-seller
quality. Run them through the live service and score with the C2 scorer (product recall, price/unit/pack correctness,
unflagged wrong cards, absent items) per message.

Meaningful comparison: per-message extracted facts and scores against the saved C2 run, not raw text. Greedy decoding
with pinned weights, dtype and library versions makes identical answers likely but not guaranteed: GPU type, kernel and
library differences can change tokens. Byte-for-byte equality of raw answers is therefore reported, not required.
Regressions on messages C2 got right are listed individually for PO review. Real-seller quality needs a new held-out
set of realistic messages; collecting it is a separate PO decision, not part of this slice.

## 10. Delivery

The slice delivers one user task and closes only after the real integration and PO manual acceptance.

1. **Implementation, local:** everything in §4–§8 with §9.1 green. Uses the replay stub; it is an implementation step,
   not delivery of the real-model feature.
2. **Integration test:** run the C2 wrapper in the environment chosen in D-1; §9.2 smoke test; §9.3 report.
3. **PO manual acceptance** with the live parser (§11.2).
4. Then the usual merge/checkpoint steps, each requiring PO instruction. No merge is authorized by this contract.

## 11. Acceptance

### 11.1 Acceptance criteria

1. With `SELLER_TEXT_INPUT` unset or `off`, behaviour equals the closed slice-1 `off` state; manual entry works.
2. With `fake`, all slice-1 acceptance criteria still pass.
3. With `real`, an allowlisted Seller submits a list and receives private drafts from the pinned C2 configuration on the
   existing review screen; other sellers do not see the channel.
4. Drafts open in the existing `CardEditor`; publishing uses only the existing confirm screen, with no new checkboxes;
   offer count is unchanged until explicit confirm.
5. Exact catalog matches link `productId`; ambiguous and unknown titles keep the seller title, `productId` null, with a
   notice; no catalog Product is created.
6. A price, unit or pack that the code cannot bind to its product is left empty with a notice; no value is filled from
   another item, the catalog or defaults.
7. Pack sizes are shown in the seller’s unit; equivalent normalizations are accepted, non-equivalent ones are not.
8. Every rejected claim, out-of-stock mention, uncovered input line, unused number and overflow item is listed under
   «Не распознано»; the reminder line is shown for real-parser results.
9. Timeout, service error or malformed answer creates no drafts and offers retry; retries and double submits never
   duplicate drafts.
10. A published offer created from a text-input draft carries no `aiHints`; logs contain no seller text or model
    output.
11. `SELLER_TEXT_INPUT=off` plus restart returns to the disabled state with drafts intact.
12. Smoke test passes and the quality report on the 28 control messages is reviewed by PO.

### 11.2 Manual acceptance scenario (PO, live parser, synthetic text)

1. Log in as the allowlisted test seller; open «Написать списком».
2. Submit: «Сегодня есть куриное филе по 2400 за килограмм, бёдра по 1800, пельмени наши, пачка пол кило — 1400
   тенге. Хотя нет, филе уже 2500, сметана закончилась.»
3. Expect: филе 2500 per kg; бёдра 1800 with the unit empty and a notice, no product chosen automatically; пельмени
   1400 per package 0.5 kg; сметана under «Не распознано»; reminder line visible.
4. Submit a second list with an item on its own line that the model skips, or with an unpriced item; check that
   uncovered lines or numbers appear, and note any omission that is not flagged.
5. Open a draft, correct a field, publish through the existing confirm screen.
6. Stop the inference service; submit again → error and retry, no duplicate drafts; manual card entry still works.
7. Set `off`, restart: text option gone, drafts still present.

## 12. Decisions and blockers

| ID | Item | Options and recommendation |
| --- | --- | --- |
| D-1 | Environment for the temporary integration test | (a) Kaggle GPU notebook running the reference wrapper + temporary tunnel, synthetic text, PO checks platform terms; (b) PO laptop after a feasibility check (unknown); (c) another free GPU environment PO has. **Recommendation:** (a) — it is where C2 ran, on the same GPU class, at no cost. |
| D-2 | Model licence | PO confirms the licence of `Qwen/Qwen3-4B` at the pinned revision permits the intended use before production planning. |
| D-3 | Evidence location | PR #187 is open; the replay fixtures copy `control28.json` with its SHA-256 into the test tree so the slice does not depend on that PR being merged. |
| D-4 | Production deployment | Kazakhstan hosting sized from smoke-test measurements; separate PO decision after this slice. Not a blocker for the integration test. |
| B-1 | Running environment | Blocks steps 2–3 of §10 until D-1 is decided and an environment is started by PO or with PO’s instruction. |

All reproducibility artifacts identified in §2 have been located; none is missing.

## 13. Risk flags

| Flag | Present | Evidence required |
| --- | --- | --- |
| DB migration | No (JSON fields only) | Integration tests read/write extended `aiHints`. |
| Public API | Yes, additive | Integration tests per new code; slice-1 tests unchanged. |
| Auth/security/privacy | Yes: untrusted text to a model, data leaving the app, logging | Safeguard tests, allowlist tests, log assertions, ops note on residency. |
| Concurrency/atomicity | Yes: retries, double submit, concurrency limit | Concurrent idempotency, busy and rollback tests. |
| Data loss | Yes: model omissions; dropped pack | Uncovered-line, unused-number and pack-notice tests; residual risk below. |
| External service | Yes: inference service | Stub failure tests (CI); smoke test (Part B). |

## 14. Residual risks (accepted only by PO)

- Omissions inside one sentence, especially unpriced products, are not detected by code.
- Positional binding can attach a price or unit to the wrong product without a flag.
- Evidence is synthetic and small; real seller messages, Kazakh and mixed-language text may perform worse.
- A different GPU or library version may change answers; the quality report measures this only on 28 messages.
- The response cache is in memory; after a restart a replay shows the “skipped list unavailable” notice.
- One request slot: concurrent sellers get “busy”; acceptable for a controlled test, not for launch.
