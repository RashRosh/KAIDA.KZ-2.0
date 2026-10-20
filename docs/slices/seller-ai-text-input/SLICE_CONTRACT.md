# Seller AI text input (integration slice 1) — Slice Contract

**Status:** APPROVED FOR IMPLEMENTATION — Product Owner instruction in chat 2026-10-20 (first integration slice of free-text seller input; does not change `EXECUTION_PLAN.md` queue order).

**Capability:** Feature Map `S17` (text channel only). Voice, photo, video, Telegram, new publication UI, AI moderation and live paid LLM providers are **out of scope**.

**Research basis (not implementation):** open PR #187 (`docs/research/ai-text-2026-10-17/*`), especially `DRAFT_PILOT_PROPOSAL.md` and `CONTROL28_REVIEW.md`. Research replay UI and export-only pilot are **not** this slice.

**Base:** `main` at contact-default checkpoint (`v0.0.79-contact-default` / `9dff3f42ca52ec024d27191c0ce43309607a22f4`).

**UX reference:** `docs/product/mockup/seller-ai-first-rev1/` — reuse **existing** `AI-S09` editor and **existing** confirm flow (`OFF2` / `SellerConfirmChange`); **do not** implement `AI-S08` batch moderation CTA or extra verification checkboxes from the mockup.

## 1. User task

An authenticated Seller pastes or types a free-text list of products. The system turns recognized lines into **private offer drafts** that use the **same card editor** as manual entry. The Seller fixes any field in those drafts, then publishes each card through the **existing** «Проверить и опубликовать» → review → confirm path. Nothing is published automatically.

## 2. Verified facts in code (base commit)

| Area | Fact | Use in this slice |
| --- | --- | --- |
| Draft storage | `offer_drafts.payload` JSONB, `offerDraftPayloadSchema` — any field may be empty until publish (`offer-draft.contract.ts`, `seller-showcase-editor` §2) | AI output maps to draft payloads |
| Full card publish | `cardCreateBodySchema` + `createCardChangeSet` — title, optional `productId`, price, unit, pack, points (`seller-card.contract.ts`, `card-change-sets.ts`) | Publication path unchanged |
| Catalog | `resolveProduct` → `resolved` / `not_found` / `ambiguous`; suggestions API for editor (`resolve-product.ts`, `/api/catalog/suggestions`) | Server resolves catalog on draft creation; ambiguous/not_found keep seller title, `productId` null |
| S12 batch | `create_batch` items: `productName`, price, **no pack**, catalog name only (`seller-change-set.contract.ts`) | **Not used** for text AI (pack/free title would be lost) |
| Source sheet | `SourceSheet` in `SellerShowcase.tsx` — AI channels disabled with outage banner (`source.*` i18n) | Text entry enabled only when `SELLER_TEXT_INPUT=fake` |
| Comment translator pattern | `SELLER_COMMENT_TRANSLATOR=off\|fake`, deterministic adapter (`seller-comment-translation.config.ts`) | Same pattern: `SELLER_TEXT_INPUT=off\|fake`, no network LLM in this slice |

## 3. Scope

### 3.1 In scope

1. **Configuration:** `SELLER_TEXT_INPUT` with values `off` (default) and `fake` (deterministic, network-free parser for CI and local demos). Misconfiguration degrades to `off`.
2. **Entry:** When `fake` is on, `SourceSheet` offers **«Написать списком»** (text). Video/voice/photo stay disabled. Outage banner copy distinguishes «текст доступен, остальное нет».
3. **Text screen** `/seller/text-input`: multiline field, immutable display of submitted raw text on review; submit calls `POST /api/seller/text-input`.
4. **Server parse → drafts:** Parser returns structured lines (title, optional price, unit, pack, confidence, optional source quote). For each **recognized** line the server creates one `offer_draft` via `saveOfferDraft`. **Skipped** lines (mentioned in input but not turned into drafts) are returned only in the API response.
5. **Catalog:** After normalization, `resolveProduct(title)` on the server. `resolved` → store `productId` on draft when title still matches link rules; `ambiguous` / `not_found` → `productId` null, seller title preserved. No auto-pick among ambiguous candidates.
6. **Pack and units:** Map parser output to `offerDraftPayloadSchema` `unit` and `pack` (including `package` + pack amount). No silent drop of pack or free title.
7. **Uncertainty and skips (explicit UI):** Review screen `/seller/text-input/review` lists created drafts plus blocks **«Не распознано»** (skipped) and per-draft notices for **low-confidence** fields (`aiHints` on payload). No percentage scores.
8. **Edit:** Tapping a draft opens existing `CardEditor` (`draft=` query). Manual edits overwrite AI-filled fields; saving draft does not publish.
9. **Publish:** Only through existing card change-set + confirm UI. No new checkboxes, no batch «отправить на модерацию» from S08.
10. **Default point:** If the Seller has exactly one location, prefill `points: [{ locationId }]`. Otherwise `points: []` (same as manual draft).
11. **Additive draft field:** Optional `aiHints` on `OfferDraftPayload` (JSON only, **no migration**). Stripped when publishing if needed; editor ignores unknown fields.
12. **Tests:** unit (map + parser + config), integration (API + catalog + drafts DB), e2e (flows in §8).

### 3.2 Out of scope

- Live LLM / paid APIs / new model research; `local` or `replay` adapters (future slice).
- Voice, photo, video, Telegram (`S18`–`S21`).
- S12 batch API changes, multi-card atomic confirm, moderation queue UI.
- Auto-publish, auto-confirm, `product_candidate` creation, stock-out / `available:false` updates.
- Changing `SellerChangeSet` schema or confirm semantics.
- Updating `EXECUTION_PLAN.md` queue (B-READABILITY remains item 9).

## 4. UI states

| State | Behavior |
| --- | --- |
| Text off | Source sheet unchanged (AI outage + manual only). `/seller/text-input` → 404 or redirect to showcase. |
| Text on | Text option active; manual still available. |
| Compose | Empty / filled textarea; submit disabled while empty or in-flight. |
| Processing | Submit shows loading; no partial drafts exposed mid-request. |
| Review success | List drafts + skipped + uncertain notices; CTA «К витрине»; each draft row opens editor. |
| Review empty | No lines recognized: message + link manual / retry. |
| Error | Network or 5xx: inline error + «Повторить»; no drafts created on failed request. |
| Editor | Standard `CardEditor`; no AI chrome on fields. |
| Publish | Unchanged confirm screen; responsibility text unchanged. |

Session notices for skipped lines: returned in API and held in `sessionStorage` under `kaida:text-input-review:{inputId}` until the Seller leaves review or starts a new run. Reload of review may lose skip list (documented limitation).

## 5. API contract

### `POST /api/seller/text-input`

- Auth: same as other seller routes (S2).
- Body: `{ "text": string }` — trim, max 4000 chars; empty → 400.
- When `SELLER_TEXT_INPUT=off` → 503 `TEXT_INPUT_UNAVAILABLE`.
- Success 200:

```json
{
  "inputId": "uuid",
  "rawText": "string",
  "drafts": [ "OfferDraftView..." ],
  "skipped": [{ "label": "string", "reason": "string", "sourceQuote": "string | null" }],
  "uncertain": [{ "draftId": "uuid", "fields": ["price" | "unit" | "pack" | "catalog" | "title"], "message": "string" }]
}
```

- Creates drafts in one transaction; on failure rolls back (no partial drafts).
- Does **not** call `confirmSellerChangeSet` or create offers.

### `aiHints` on draft payload (optional)

```typescript
{
  source: 'text',
  inputId: string (uuid),
  uncertainFields: string[],
  catalogStatus?: 'resolved' | 'ambiguous' | 'not_found',
  sourceQuote?: string | null
}
```

## 6. Parser adapter (fake)

- Deterministic, no network.
- May use fixture map for exact E2E strings; general heuristic for local demos.
- Must support: multiple items per message, package + kg/l/piece units, free titles, intentional skip of a mentioned product (returned in `skipped`), low-confidence unit/price (draft created, flagged).
- Output shape is the integration contract for a future real adapter; swapping adapter must not change API or draft mapping.

## 7. Error handling

| Case | Response / UX |
| --- | --- |
| Unauthenticated | 401 |
| No seller | `SELLER_REQUIRED` (existing) |
| Text too long / empty | 400 |
| Parser off | 503 |
| Parser internal error | 503, no drafts |
| DB failure | 503, transaction rollback |

## 8. Acceptance criteria

1. With `SELLER_TEXT_INPUT=fake`, Seller can open text input from the showcase source sheet and submit a multi-line list.
2. Exact catalog match (e.g. seed «Баранина») yields a draft with linked `productId` when resolution is `resolved`.
3. Unknown product name yields draft with seller title and `productId` null.
4. Package line keeps `unit=package` and `pack` amount/unit.
5. Multiple products in one message yield multiple drafts.
6. Skipped mention appears under «Не распознано» without a draft.
7. Uncertain line yields draft plus visible notice (not hidden).
8. Seller can open draft in `CardEditor`, change fields, save draft; offer count unchanged.
9. After parse, offer count is still 0 until explicit confirm publish.
10. Failed submit can be retried; successful retry after failure does not duplicate drafts from the failed attempt.
11. S12 batch and single-card confirm regressions remain green.

## 9. Test matrix

| Layer | Cases |
| --- | --- |
| Unit | config off/fake; map item → payload (catalog resolved/ambiguous/not_found); pack/unit; uncertain flags; skipped extraction |
| Integration | POST creates N drafts; catalog link for Баранина; free title; transaction rollback on error; off mode 503 |
| E2E | end-to-end text → review → edit draft → publish one card; skip visible; no auto publish; network retry UI |

## 10. Verification

- `pnpm verify` on branch head.
- Manual: set `SELLER_TEXT_INPUT=fake`, run through §8 on port 3000.

## 11. Rollback

- Revert branch; set `SELLER_TEXT_INPUT=off` (default). Drafts created during testing can be deleted in UI. No migration to reverse.

## 12. Risks and PO decisions recorded

| Topic | Decision |
| --- | --- |
| S12 unsuitable | Use per-card drafts + existing `createCardChangeSet`, not batch API |
| DB migration | Avoided; optional `aiHints` in existing JSON payload |
| Live model | Deferred; `fake` only |
| Skip list persistence | sessionStorage + API; reload may drop skips |
| Queue | This slice does not reorder `EXECUTION_PLAN` |
