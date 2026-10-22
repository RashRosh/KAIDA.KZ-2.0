# Seller AI text input — real parser (integration slice 2) — Slice Contract

**Status:** APPROVED — IMPLEMENTATION AUTHORIZED (PO review of PR #190 at `d6c7f14a`, 2026-10-21; revision 3 applies
the three corrections required by that review: durable retry protection §6.4, mandatory endpoint authentication §8,
consistent handling of invalid model output §6.2). Authorized: §10 steps 1–2 on a dedicated implementation branch.
Not authorized: production enablement, purchases, merge, checkpoint tag. The slice stays open until the real-model
verification (§9.2–§9.3) and PO manual acceptance (§11.2).

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
5. Durable idempotent submission with a client `requestId`: one small table and migration (§6.4).
6. Failure handling: timeout, busy, invalid answer — explicit UI state, no partial drafts; individually unusable
   claims are skipped with a visible reason (§6.2).
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
- Persisting raw input or raw model output in the database; schema changes other than the submissions table of
  §6.4.

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

**Temporary controlled integration test** (Part B). Any environment that can run the §2 stack, is reachable from the
app during the test session, and whose terms permit serving an inference endpoint for KAIDA. Foreign infrastructure
is allowed; text must be synthetic or PO-authored. An endpoint reachable through a public tunnel or address always
requires authentication (§8). Platform terms checked 2026-10-21 (§12 D-1): Kaggle and free Colab are excluded.
Choice: D-1.

**Production deployment.** Inference in Kazakhstan under KAIDA control, no request logging, no third-party access to
seller text; sized from the smoke-test measurements. Separate PO decision (D-4); nothing is purchased by this slice.

## 6. Behaviour

### 6.1 Flow

1. Compose screen (unchanged) submits `{ text, requestId }`; submit is disabled while in flight.
2. Server: auth → body validation → mode/allowlist → seller lookup → **submission claim** (§6.4: replay, conflict,
   wait, or own the attempt) → **inference outside any DB transaction** → answer validation → reducer → safeguards.
3. One DB transaction: lock the submission row and re-check that this attempt still owns it, location lookup,
   `resolveProduct` per item, `saveOfferDraft` per item, submission marked `succeeded` with its result; rollback on
   any error.
4. Response (slice-1 shape plus additive fields) → review → `CardEditor` → existing confirm/publish.

### 6.2 Request, validation, limits, failures

- Request: system = ledger prompt; six demonstration turns; final user turn = seller text verbatim. No other seller
  data (name, phone, location, user ID). Input limit unchanged: 4000 characters after trim.
Model output is validated at two levels, and each case has exactly one outcome.

**Answer level — the whole request is rejected, no drafts are created** (503 `TEXT_INPUT_FAILED`; the submission is
recorded as `failed` and a retry with the same `requestId` runs inference again):

- service unreachable, non-2xx status, response body > 64 KiB, response body not JSON;
- envelope not OpenAI-compatible: no `choices[0].message.content` string;
- reported model identity differs from the pinned one; `finish_reason` = `length` (token limit reached);
- no JSON array can be extracted from the generated text by the C2 rule (first JSON array; a top-level object is
  unwrapped only through `claims`/`items`/`data`, as in script 2.2), or the extracted text is not valid JSON;
- more than 60 array elements.

**Claim level — the request continues** (201): an array element that is not an object, has an unknown `status`, has
no usable `product`, or has a field of the wrong type or over its length bound (`product` ≤ 200, `text` ≤ 500,
`price`/`per`/`size` ≤ 100 characters) is not used. It is listed under «Не распознано» with the reason «Ответ
модели по этой позиции не распознан»; the label is the claim's `product` when that is a string of 1–200
characters, otherwise «Позиция N»; the quote is shown only if the claim's `text` is a substring of the seller text,
never model-invented wording. Unknown extra keys in a claim are ignored. This is safe because such a claim never
produces a draft. A valid answer whose claims are all unusable, or which is an empty array, returns 201 with zero
drafts and the review shows the skipped list and the manual-entry link. Claims rejected by the reducer rules (§6.3)
follow the same claim-level path.

| Case | API | UI |
| --- | --- | --- |
| Inference exceeds `SELLER_TEXT_PARSER_TIMEOUT_MS` (default 60 000, max 180 000) | 503 `TEXT_INPUT_TIMEOUT`, no drafts | inline error, «Повторить» (same `requestId`), manual entry link |
| Answer-level failure (list above) | 503 `TEXT_INPUT_FAILED`, no drafts | same |
| More than `SELLER_TEXT_PARSER_CONCURRENCY` (default 1) in flight | 429 `TEXT_INPUT_BUSY`, no drafts | «Сервис занят, попробуйте через минуту» |
| Claim-level failure | 201; claim listed in `skipped` | «Не распознано» |
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

**Existing persistence checked (2026-10-21).** No existing table can hold submission identity: drafts are deleted on
publication and can be deleted by the Seller, `seller_change_sets` keeps only a nullable `draft_id`, and no generic
idempotency table exists. Keeping the state in draft JSON or in memory would lose it on publication, deletion or
restart. This slice therefore adds one table (migration `0030`).

**Table `seller_text_submissions`** — primary key (`seller_id`, `request_id`); `text_digest` (SHA-256 of
`request_id` + line feed + trimmed text, hex; a salted digest, the text itself is not stored); `parser` (`fake` |
`real`); `status` (`processing` | `succeeded` | `failed`); `attempt_id` and `attempt_started_at` (the current owner
of the processing attempt); `failure_code`; `result` (JSON, only when `succeeded`: created draft IDs in order,
`skipped`, uncertainty notices per draft, omission hints); `created_at`; `expires_at` = `created_at` + 24 hours.

**Retry period: 24 hours** from the first accepted submission. Within it, every guarantee below holds across
application restarts, draft publication, draft deletion and concurrent requests, because all of them are decided by
this row, not by drafts or memory. Expired rows are deleted on later submissions; after expiry the same `requestId`
is treated as a new submission. The client creates a new `requestId` per submitted text and reuses it only for
retries of that text, so expiry does not affect normal use.

**Rules** (key = seller + `requestId`; another Seller's identical `requestId` is an unrelated submission):

1. `requestId` (UUID) optional; absent → the server generates one, so that request cannot be retried idempotently
   (slice-1 behaviour). `inputId` = `requestId`.
2. Different text digest for an existing key → 409 `TEXT_INPUT_REQUEST_CONFLICT`, whatever the row status, including
   after publication or deletion of its drafts. Another submission's result is never returned.
3. `succeeded` → replay: 200, no inference, nothing created. Drafts that still exist are returned in their current
   state; drafts already published or deleted are not recreated and are counted in `unavailableDrafts`; the review
   shows «Часть карточек из этого списка уже опубликована или удалена». The stored `skipped` list and notices are
   returned (notices only for drafts that still exist).
4. `processing` with a live attempt (started less than parser timeout + 30 s ago) → the request waits, polling the row,
   until the attempt finishes or becomes stale, then applies rules 2–5 to the new state (an attempt still processing
   at that point is stale and is taken over under rule 5). No second inference runs while the attempt is live.
5. `failed`, or `processing` whose attempt is older than parser timeout + 30 s (owner crashed or restarted) → this
   request takes over: new `attempt_id`, inference runs again.
6. New key → row inserted as `processing` (`INSERT … ON CONFLICT DO NOTHING`; the database decides the single
   winner of a race); losers follow rules 2–5.
7. Commit: drafts are created only in the transaction that locks the row (`SELECT … FOR UPDATE`) and finds its own
   `attempt_id` still current; it writes the drafts and sets `succeeded` with the result atomically. An attempt that
   lost ownership after a takeover creates nothing and returns the winner's result through rule 3 or 4. So one
   submission creates at most one set of drafts.
8. Failed attempts create nothing: inference precedes the transaction, the transaction is all-or-nothing, and a
   failure is recorded only by the attempt that still owns the row.

### 6.5 Data leaving the app, retention, logging

- Leaves the app: seller text plus the fixed prompt and demonstrations, to the configured service. Nothing else.
- Testing: any location, synthetic or PO-authored text only, allowlisted test seller only. Production: Kazakhstan,
  request logging disabled (D-4).
- Stored by the app: as slice 1 — drafts with `aiHints.sourceQuote` (≤ 500 characters per draft); plus the submission
  row of §6.4 for 24 hours — a salted text digest and the result (draft IDs, skipped labels, reasons and quotes of at
  most 500 characters each, notices). Raw text and raw model output are not written to the DB.
- Logs: `inputId`, outcome code, duration, counts (items, drafts, skipped, notices), configuration version. Never the
  seller text, quotes, titles or model output.
- Published offers carry no `aiHints`.

## 7. API and data changes (additive)

`POST /api/seller/text-input`: body `{ text, requestId? }` (strict); 201 slice-1 body plus `parser`, `notices`
(omission hints) and `unavailableDrafts` (0 on 201); 200 for idempotent replay with the same shape; new codes 503
`TEXT_INPUT_TIMEOUT`, 429 `TEXT_INPUT_BUSY`, 409 `TEXT_INPUT_REQUEST_CONFLICT`. Non-allowlisted seller in `real`
mode → 503 `TEXT_INPUT_UNAVAILABLE` (as `off`).

Migration `0030` adds `seller_text_submissions` (§6.4); no existing table changes. `aiHints` (JSON in
`offer_drafts.payload`) gains optional `parser: 'fake' | 'real'` and
`parserConfig` (e.g. `c2/script-2.2/Qwen3-4B@1cfa9a7`). `ParsedTextLine` gains optional `uncertainFields`; when
absent, slice-1 mapping applies, so `fake` behaviour is unchanged. Skipped entries gain reasons for the new cases.

## 8. Configuration, rollout, rollback

| Variable | Rule |
| --- | --- |
| `SELLER_TEXT_INPUT` | `off` (default) \| `fake` \| `real`; unknown → `off` |
| `SELLER_TEXT_PARSER_URL` | required for `real`; loopback host (`localhost`, `127.0.0.0/8`, `[::1]`) may use `http`, any other host must use `https`; private or tunnel endpoints live only in deployment env, never in Git |
| `SELLER_TEXT_PARSER_API_KEY` | bearer secret, at least 32 characters; **required for any non-loopback URL** (public tunnel, LAN or hosted endpoint); may be omitted only for a loopback URL; sent only in the `Authorization` header; never logged, returned to the browser or committed |
| `SELLER_TEXT_PARSER_TIMEOUT_MS` | 1 000–180 000, default 60 000 |
| `SELLER_TEXT_PARSER_CONCURRENCY` | 1–8, default 1 |
| `SELLER_TEXT_INPUT_ALLOWLIST` | user IDs or login phone numbers (E.164) allowed in `real` mode, comma-separated; empty → nobody |

A `real` configuration that breaks these rules (missing or short key for a non-loopback URL, `http` to a
non-loopback host) is invalid and degrades to `off` with one server log line that names the rule, not the value.

**Inference endpoint access.** The reference wrapper requires the same bearer key (read from its environment, at least
32 characters, compared in constant time) and answers 401 without it. It may run without a key only with an explicit
no-auth flag that it accepts only when bound to a loopback address and that the ops note forbids together with any
tunnel or port forwarding: a tunnel makes a loopback-bound service public. The wrapper logs neither request bodies nor
the `Authorization` header.

Model ID, revision, prompt and demonstrations are versioned in the repository (C2 record), not configured per
deployment. Rollout: `off` → `real` for the PO test seller during the integration test → further steps only by PO
decision. Rollback: `SELLER_TEXT_INPUT=off` and restart; text option disappears, existing drafts stay ordinary drafts,
manual entry unaffected. Code rollback: revert; the additive `seller_text_submissions` table can stay (unused) or be
dropped; it holds nothing older than 24 hours.

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
- Answer level (§6.2), each → 503 and zero drafts: unreachable, non-2xx, non-JSON body, oversize, missing content,
  wrong model identity, token limit, no array, invalid JSON, > 60 elements. Claim level, each → 201 with the claim in
  `skipped` and the documented label/quote rule: non-object element, unknown status, missing product, wrong field
  type, over-length field; extra keys ignored; all-unusable and empty arrays → 201 with zero drafts.
- Endpoint access: non-loopback URL without key or with `http` → mode `off`; key sent only as bearer header and never
  in logs or responses; loopback URL without key accepted.
- Integration (PostgreSQL), replay mode: N drafts with `aiHints.parser = 'real'`; «Баранина» linked; free title keeps
  `productId` null; **ambiguous catalog** title → `productId` null and notice, no choice (slice-1 gap; slice 2 raises the
  risk because model titles vary); **`aiHints` absent after publish** through change set + confirm (slice-1 gap; slice 2
  adds provenance fields); timeout/500/malformed → 503 with zero drafts; DB error rollback; offer count 0 after
  parsing.
- Durable idempotency (§6.4), each asserting draft and offer counts and the number of inference calls: sequential
  retry → replay, no inference; replay with no in-process state (fresh dependencies, as after a restart); concurrent
  identical requests → one inference, one draft set, same IDs in both answers; retry after one draft was published
  and after all drafts were deleted → no recreation, `unavailableDrafts` counted; same `requestId` with different text
  → 409 before and after publication; another Seller's identical `requestId` independent; failed attempt then retry →
  inference again, drafts once; stale `processing` attempt taken over and the old owner's late commit creates nothing;
  expired rows purged; migration applies on a database with existing data.
- E2E (production build): slice-1 fake E2E unchanged; one replay E2E text → review (skipped, notices, reminder) → edit
  → publish one card → stub failure → retry without duplicates; a late retry of the same submission (same
  `requestId`) after publishing returns the replay without duplicates and the review shows the «уже опубликована или
  удалена» notice; non-allowlisted seller sees the slice-1 unavailable state; manual entry works.
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
9. Timeout, service error or an answer-level invalid answer creates no drafts and offers retry; an individually
   unusable claim is skipped with a visible reason. Within the 24-hour retry period, retries and double submits never
   duplicate drafts — across restarts, after publication or deletion of the drafts, and under concurrency — and a
   reused `requestId` with different text is refused.
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
| D-1 | Environment for the temporary integration test | Terms checked 2026-10-21 (official pages): **Kaggle excluded** — Terms of Use §3 limit use to “your own internal, personal, non-commercial use, and not on behalf of or for the benefit of any third party”; the Acceptable Use Policy (effective 2025-06-22) lists “server farming” and “activity unrelated to ML data science” as resource abuse; interactive sessions also stop after 20 minutes idle. **Free Colab excluded** — its FAQ disallows “web service offerings not related to interactive compute with Colab” and “connecting to remote proxies”. Remaining options, none purchased by this slice: (a) a GPU host or account whose terms permit commercial inference serving, chosen by PO (possibly a free-credit plan; its terms and residency checked before use); (b) the PO laptop, only after a feasibility check — 4 GiB VRAM and 7.7 GiB RAM are below the ≈ 8 GB float16 weights, so the evidenced configuration is not expected to run there; (c) the Kazakhstan production candidate of D-4, if PO brings it forward. |
| D-2 | Model licence | Checked 2026-10-21: `LICENSE` at revision `1cfa9a72…` is Apache License 2.0 ("Copyright 2024 Alibaba Cloud"; SHA-256 `832dd9e0…e92e`), model card licence `apache-2.0`, repository not gated. It permits commercial use and modification; redistributing the weights would require the licence and notices; no trademark rights. KAIDA runs the weights as a service and does not redistribute them. PO confirms before production planning. |
| D-3 | Evidence location | PR #187 is open; the replay fixtures copy `control28.json` with its SHA-256 into the test tree so the slice does not depend on that PR being merged. |
| D-4 | Production deployment | Kazakhstan hosting sized from smoke-test measurements; separate PO decision after this slice. Not a blocker for the integration test. |
| B-1 | Running environment | Blocks steps 2–3 of §10 until D-1 is decided and an environment is started by PO or with PO’s instruction. Candidate 2026-10-21: Modal Starter ($30/month credits). The deployment is prepared in `ops/seller-text-parser/modal_app.py` (T4, one container, one request, scale to zero, key from a Modal Secret). Modal requires a payment method on file for any use and for GPUs, so it needs PO account action (`docs/ops/SELLER_TEXT_PARSER.md`). |

All reproducibility artifacts identified in §2 have been located; none is missing.

## 13. Risk flags

| Flag | Present | Evidence required |
| --- | --- | --- |
| DB migration | **Yes**: `0030` adds `seller_text_submissions` (additive; no existing table changed) | Migration applies on a database with existing data; idempotency tests of §9.1; integration tests read/write extended `aiHints`. |
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
- Retry protection lasts 24 hours; a retry of the same `requestId` after that creates new drafts.
- A replay cannot tell whether a missing draft was published or deleted; it reports both together.
- One request slot: concurrent sellers get “busy”; acceptable for a controlled test, not for launch.

## 15. Implementation record (branch `slice/seller-ai-text-real-parser`)

State: §10 step 1 done; step 2 done 2026-10-21 on Modal (smoke 5/5; control-28 byte-identical to the saved C2 answers, same scores; see [LIVE_TEST_2026-10-21.md](LIVE_TEST_2026-10-21.md)); step 3 (PO manual acceptance, [PO_ACCEPTANCE_HANDOFF.md](PO_ACCEPTANCE_HANDOFF.md)) open.

- Code: `src/modules/seller-text-input/real-parser/` (C2 assets generated from script 2.2, message builder, reducer port,
  safeguards), `parsers/real-seller-text-parser.ts` (adapter), `db/` + migration `0030` + `infrastructure/` (submissions),
  `application/apply-seller-text-input.ts` (§6.4 rules), route codes, compose and review screens.
- Service: `ops/seller-text-parser/` (reference wrapper with its HTTP/access tests using a fake generator, requirements,
  `live-check.ts` for §9.2–§9.3); ops note `docs/ops/SELLER_TEXT_PARSER.md`.
- Fixtures: `tests/fixtures/seller-text-real-parser/` (script 2.2 and `control28.json`, byte-exact, D-3).
- Clarifications made during implementation: allowlist accepts login phones as well as user IDs (§8); rule 4 wording
  (§6.4); claims with status `cmd` stay ignored as in script 2.2 (not listed as skipped); the «unused number» hint
  counts only numbers ≥ 10 outside every recognised quote; a parser «busy» answer is recorded as a failed attempt, so
  the retry runs again; one existing test that pinned 0029 as the newest migration now checks the 0029 entry itself.
- Replay evidence (deterministic, no model): the reducer port reproduces the Python reducer on all 56 saved C1/C2
  answers; the C2 prompt probe hash matches the manifest; on the 28 saved C2 answers the safeguards change exactly one
  value (`REAL_04` cucumbers: unit «кг» → empty with a notice) and add no omission hints; script 2.2's scorer reproduces
  the recorded 25/28 from the saved answers in the live-check row format.
- Live (Modal, T4, billed $0): see LIVE_TEST_2026-10-21.md. Latency 9–29 s per message warm, about a minute after a cold start.

## 16. Connected seller journey (scope adjustment after manual-acceptance findings, PO 2026-10-21)

Findings of the paused acceptance run (live stand, 2026-10-21):
- F-1: with no trading point the text list failed with the generic «Не удалось разобрать текст»; the reason (no point)
  was not shown and the way to create one was hidden.
- F-2: after leaving the review screen the «Не распознано» list could not be reopened (it lived only in the tab).
- F-3: the list field was small and grew with the text; the path «create point → add products» went through «Ещё».

PO instruction (2026-10-21) adds, without changing the model, prompt, parsing rules or publication semantics:
1. **Text field:** about six visible lines from the start, fixed height, inner scrolling, persistent label; the text is
   kept in the browser tab through recoverable errors and point creation (never sent anywhere else).
2. **Target point:** product entry always names its trading point. After creating a point an inline panel offers
   «Добавить товары в эту точку» (manual entry with the point selected, or the text list with the point as target) and
   «Готово»; existing points offer the same action. The text list shows the target; with several points the Seller
   chooses, nothing is switched silently. API: optional `locationId` (must be the Seller's own → else 404
   `TEXT_INPUT_POINT_NOT_FOUND`, nothing created); no point at all → 409 `TEXT_INPUT_POINT_REQUIRED`. The point is part
   of the request identity (same `requestId` with another point → 409 conflict).
3. **Missing point:** the text list explains that a point is needed and links to the existing point form
   (`/seller/points?return=text-input`); after saving it returns with that point selected and the text restored, without
   submitting; cancelling returns with the text. Manual entry keeps its existing inline point creation.
4. **Review recovery:** `GET /api/seller/text-input/{inputId}` (owner only; unknown, foreign and expired ids answer the
   same 404) rebuilds the review from the submission record: current drafts, skipped items, notices, the point, and
   how many drafts were published or deleted. The confirm step records a published draft in the record before it
   removes the draft (bookkeeping only). `GET /api/seller/text-input` lists the Seller's reviews of the last 24 hours;
   «Моя витрина» links each one. Expired or unavailable reviews show an explicit state, never an empty list. The raw
   text is still not stored on the server: without it in the tab the review says so and shows the stored result.

Verification: integration `seller-text-review-recovery.test.ts`; E2E `seller-text-journey.spec.ts` (field height and
scrolling, missing point → create → return with text, cancel, add products from new and existing points, recovery
after reload / new tab / from the showcase, other seller, published, expired) on mobile and desktop.

## 17. Acceptance session 2 findings: scope and revised closed decisions (PO 2026-10-21)

The PO approved seven findings from manual acceptance run 2 for this slice (no model, prompt, parsing-rule or
publication-semantics change). Four of them conflict with decisions of closed contracts; the PO resolved each
explicitly before implementation. These are revisions recorded here; the closed contracts stay as historical records.

| Closed decision | Revised to (PO 2026-10-21) |
|---|---|
| contact-default Q2/Q3 «no prefill» | A **new** point prefills «Телефон» with the verified login number (PO 2026-10-22; replaces «previous point, else login» of 2026-10-21). The Seller may clear it; a cleared field is never refilled. Existing points are never changed. |
| point-contacts-hours §2 «a new point copies the previous point's contacts» | A new point copies no contact: «Телефон» starts with the login number, WhatsApp starts empty (PO 2026-10-22). Only the hours are copied. |
| point-contacts-hours D2 «Telegram later, via a KAIDA bot» | Telegram per point now, **public when saved**, without bot verification. |
| point-contacts-hours first-point template Mon–Fri 09:00–18:00 | A new point starts with every day «Не указано». KAIDA never invents hours. |
| seller-showcase-editor post-publication highlight; post-publication-buyer-preview decision B (action on the highlighted row) | No lasting highlight. A short success message carries «Как видят покупатели». |
| pre-publication-buyer-preview §3.4/§3.5 (layout and wording of the preview) | Revised as in §20. The draft/unpublished label and inert contacts stay. |

Findings 1–7 are specified in §18–§21. Verification is listed per section. Mobile and desktop are covered; RU and KK
strings were added together.

## 18. Point contacts: phone default, WhatsApp, Telegram (findings 1, 2)

- **Phone default.** «Добавить точку» prefills «Телефон» once with the verified login number, never with another
  point's number (PO 2026-10-22; replaces «previous point, else login» of 2026-10-21). Without a known login number the
  field starts empty. After the Seller edits or clears the field, it is never refilled. Editing an existing point
  shows what the point holds and never writes a default into it. All numbers display in one format
  (`+7 7xx xxx xx xx`); comparisons use the canonical E.164 form.
- **WhatsApp.** A new point's WhatsApp starts empty. It is filled only by the explicit action «Использовать этот же
  номер» or by manual entry, and is never copied from another point (PO 2026-10-22; this revises point-contacts-hours
  §2, which copied it). A new point copies only the previous point's hours, and its note says so: «Режим работы как у
  точки «…»». Existing points keep their saved WhatsApp.
- **Telegram.** The field is optional, one per point. It accepts `name`, `@name`, `t.me/name`, `telegram.me/name` and
  `telegram.dog/name`, and stores only the lowercase username (5–32 characters, `[a-z0-9_]`, starting with a letter).
  It rejects invite links (`+…`, `joinchat/`), `c/` and `s/` paths, extra path segments and any other URL, with a
  field error; nothing is saved. Clearing the field removes the username.
  The buyer contact action is a link built by KAIDA as `https://t.me/<username>`, never a stored URL. When the point
  has no Telegram, a chip offers a username the Seller has already saved (another point, else the valid legacy
  seller username). One tap fills the field.
- Data: migration `0031` adds `locations.telegram_username` with a database CHECK on the format (additive, nullable).
  API: optional `contacts.telegram`; omitted keeps the current value, `null` removes it, an invalid value returns 400
  `INVALID_TELEGRAM`. `GET /api/seller/points/details` also returns `telegramSuggestion`.

Verification: unit `point-telegram`, `contact-default`; integration `point-telegram` (with migration 0031),
`point-contacts-hours`; E2E `contact-default.spec.ts`, `point-telegram.spec.ts`, `s10-contact-actions.spec.ts`.

## 19. Opening hours editor (finding 3)

- A new day kind, «Не указано» (`unset`), is distinct from «Выходной». Unset days never produce «Открыто» or a
  promised opening time. A fully unset week shows «Режим работы не указан».
- The editor is a grouped summary: days with the same hours form one line. «Изменить режим: {days}» edits a group;
  «Задать часы для дней» starts a new selection. The shortcuts are «Ежедневно», «По будням» and «Выбрать дни».
  Choosing days can split a day off its group. Breaks appear only after «+ перерыв».
- Before «Применить» the editor shows a summary, the days whose hours it will replace («Заменит часы: …») and the
  days that stay unchanged («Без изменений останутся: …»). Nothing is overwritten silently. «Отмена» keeps the form
  values. Existing schedules are shown and kept without loss.

Verification: unit `opening-hours-unset`; E2E `point-hours-editor.spec.ts`, `s10-contact-actions.spec.ts`.

## 20. Showcase rows, publication state and the draft preview (findings 4, 5, 6)

- **Row controls (4).** Every card and draft row, on the review screen and on «Моя витрина», has the same «›» and
  opens the editor. After editing a draft from the review, saving or going back returns to that review, via the
  `back` parameter (`/seller…` paths only). The controls stay the same after a reload. Other drafts are unchanged.
- **Publication state (5).** A card that buyers can see has a violet background and border and the status
  «✓ Опубликовано · На витрине». Drafts stay neutral with «Черновик». A switched-off or archived card shows its own
  state, never «На витрине». The style comes only from the current state; the publication moment adds nothing that
  persists. After publishing, a short success message appears with «Как видят покупатели»: the buyer page for one
  point, the card screen for several, and no action for a card nobody can see. The keyboard focus outline is kept.
- **Draft preview (6).** The heading is «Предпросмотр карточки», followed by the status «Черновик · Покупатели пока не
  видят» (for a change: «Изменения · Покупатели пока видят прежнюю версию»). The buyer card is directly below. There
  is no «Без фото · Без комментария» line. The hours show today's state, and the week opens on request. Contacts and
  the route are inert, with a note outside the card.
  Actions: «Перейти к публикации» opens the existing explicit confirmation; «Редактировать» returns to the editor.
  When required fields are missing, the preview lists them and offers «Дополнить карточку» instead of publishing.
  The preview never saves or publishes; going back keeps the editor state.

Verification: E2E `seller-journey-corrections.spec.ts` (row controls, publication style, focus, switched-off card),
`pre-publication-buyer-preview.spec.ts`, `post-publication-buyer-preview.spec.ts`, `seller-offer-management.spec.ts`.

## 21. Products of one point (finding 7)

- Each point card in «Точки» shows «Товары точки · N» and «Добавить товары». N counts the point's non-archived cards
  (distinct cards) plus the drafts that include the point. It is computed by the same function as the list, so the
  number and the list match.
- `/seller/points/{id}/products` lists only that point's cards and drafts, in the showcase row style. It has
  «Добавить товары» (with the point selected), an empty state «В этой точке пока нет товаров» and «Назад к точкам».
- API: `GET /api/seller/points/{id}/products` (owner only; a foreign, unknown or malformed id gets the same 404),
  returning `{point, offers, drafts, total}`. It only reads; nothing changes.

Verification: integration `point-products.test.ts` (scoping, archived excluded, drafts, ownership);
E2E `seller-journey-corrections.spec.ts` (count, list, empty state, add with the point, back).
