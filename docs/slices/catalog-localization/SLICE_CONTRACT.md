# Catalog localization — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-23. Implementation on a dedicated branch per `PROJECT_RULES.md` §19, in order part 1 → 2 → 3.

**Part 2 of 3** localization contracts. Depends on part 1 (`docs/slices/localization-foundation/SLICE_CONTRACT.md`)
for the active locale and the API `locale` parameter.

**Decision sources:** `FEATURE_MAP.md` «Catalog localization model» (Product Owner, 2026-09-23); KAIDA-owned text,
including catalog names, is verified by a native Kazakh speaker — machine translation is only for Seller-authored
data (Product Owner, 2026-09-23).

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

A Buyer searches in Russian or Kazakh and finds the same Offers, and sees each Product named in the chosen language.

## 2. Scope and exact behavior

### Model

- `Product.id` stays the only Product identity. Logical model: `Product → localized names → localized aliases`.
  Names and aliases belong to the controlled Catalog, never to a Seller.
- Each Product has at most one display name per locale (`ru`, `kk`). The existing `products.name` becomes the `ru`
  name without changing any value or id; it stays readable for legacy code paths.
- Russian and Kazakh are never packed into one text column.
- Aliases carry a locale. Existing aliases get no guessed locale: they stay language-unmarked and keep working in
  Search exactly as today.
- Display names are unique per locale after S6 normalization. A Kazakh name that equals another Product's Russian
  name or alias is allowed and resolves as S6 ambiguity.

### Kazakh catalog data

- Kazakh names (and optional Kazakh aliases) for current Products may be drafted by an LLM. Product Owner accepted
  the current seed catalog as provisional release copy on 2026-09-23 and deferred native-speaker review; returned
  corrections are applied as a follow-up data update. Nothing is machine-translated when a page renders or a request runs.
- Every existing Product has a provisionally accepted Kazakh name before merge. A Product added later without one is a catalog data
  gap: in `kk` it shows its Russian name marked `lang="ru"`, never an invented or empty name. The data load reports
  every Product still missing a Kazakh name.

### Search and display

- Search resolves the query against names and aliases of both locales, whatever the interface language. Matches of
  one Product are merged by `Product.id`; matches of different Products stay S6 `ambiguous`.
- Normalization stays S6: PostgreSQL `btrim → NFC → Unicode casefold → NFC`.
- Search and Nearby results show the Product name in the requested `locale` (part 1 API parameter); without it, `ru`.
  Eligibility, ranking, price, contacts, Location ownership and privacy are unchanged. A user query never creates a
  Product or alias.

## 3. Explicit out of scope

- Operator UI for editing Catalog; Categories (none exist yet).
- Automatic Product/alias creation from queries or Seller text.
- Seller-authored text of any kind (part 3).
- Search query logging or unmatched-query analysis (not implemented today; not added here).

## 4. Closed contracts used and revisions

- **S6 Catalog / aliases:** Product identity, per-Product alias uniqueness, cross-Product ambiguity and
  normalization are preserved. Localized names and alias locale are an additive extension of the Catalog model.
- **S0/S7/S9 Search:** resolution, eligibility and ranking unchanged; the set of searchable catalog terms grows.
- **Public Search API:** default (`ru`) payload unchanged; `locale=kk` changes only the displayed Product name.
- No closed contract behavior is revised.

## 5. Expected areas and risk flags

Catalog persistence and migration, Product resolution, Search/Nearby read projection, seed/catalog data load.

| Risk | Proof requirement |
|---|---|
| DB migration / data loss | Upgrade of an existing database keeps every Product id, name, alias and Offer link; Search answers the same for every existing term. |
| Public API | Requests without `locale` return the same Product names as before. |
| Data quality | Every existing Product has a provisionally accepted Kazakh name; native review is a follow-up; a later gap falls back to Russian marked `lang="ru"`. |

## 6. Acceptance criteria

1. Every existing Product keeps its id; its `ru` name equals its current name; every Offer points to the same Product.
2. Every existing term (name or alias) finds the same Product as before the migration.
3. Russian and Kazakh name/alias of the same Product return the same set of eligible Offers.
4. Two different Products sharing a term across languages return `ambiguous`, as in S6.
5. With `locale=kk`, results show the Kazakh Product name; without `locale`, the Russian name.
6. Every existing Product has a provisionally accepted Kazakh name; a Product added later without one shows its Russian name marked `lang="ru"` in `kk`.
7. Duplicate Kazakh names of different Products are rejected by the Catalog.
8. Ranking, eligibility, price, contacts and geo privacy of results are unchanged.

## 7. Verification and manual acceptance

- Migration/integration: upgrade from the current schema with real-shaped data; ids and names preserved; bilingual
  resolution; cross-language ambiguity; `kk` fallback; uniqueness per locale.
- API: with and without `locale`.
- E2E: search `баранина` and `қой еті` find the same Offers; switching locale renames the Product in
  results without losing the query.
- One full regression run and branch CI on the final executable head.

Manual scenario: search `баранина` in `ru`, then `қой еті` — same Offers. Switch to `ҚАЗ` — the query stays and the
Product reads `Қой еті, жауырын`. Add a test Product with only a Russian name and search it in `ҚАЗ` — its Russian
name is shown, nothing is empty.
