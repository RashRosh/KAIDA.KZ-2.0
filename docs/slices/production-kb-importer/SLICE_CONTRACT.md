# KAIDA Production KB Importer v1

**Status:** DRAFT — CONTROLLER REVIEW REQUIRED. Do not implement until `APPROVED — IMPLEMENTATION AUTHORIZED`.
**Base:** `main` `1c06115b27978a3b9b4e80668a9b8ff1748f0eba` (`v0.0.51-search-sort-rev3`, merged-main `KAIDA verify` run `37238019433` SUCCESS).
**Branch:** `slice/production-kb-importer-contract` (contract-only).
**Source package:** `RashRosh/kaida-product-corpus` checkpoint `v0.2.0-production-kb-export-v1`, target `39db21ab57bd1c30a5265633ad73c51f56f9e9b4`, package `kaida-kb-v1`, schema `1`.

## 1. User task

KAIDA can install the verified Production KB Package v1 into its own PostgreSQL catalog safely and repeatably, while preserving existing runtime Product UUIDs, Offer references and closed Search behavior.

After installation, normal buyer/seller runtime uses only KAIDA PostgreSQL. Runtime must not contact 2GIS, BNS/stat.gov.kz, `kaida-product-corpus`, GitHub or any external KB service.

## 2. Scope

- Vendor the exact verified five-file Production KB Package v1 as immutable application data during implementation: `products.csv`, `aliases.csv`, `categories.csv`, `CONTRACT.md`, `manifest.json`.
- Validate the package before any database mutation.
- Persist the stable KB Product identity `KAIDA-Pxxxx` while preserving existing internal UUID primary keys.
- Import or adopt 682 approved Products, 210 production-safe aliases and 35 categories into the existing Catalog boundary.
- Preserve existing Offers and their `product_id` UUID references.
- Persist minimal installed-package provenance.
- Make the import atomic and idempotent.

## 3. Explicit out of scope

Search algorithm changes, Search sorting/ranking changes, fuzzy matching, semantic/AI matching, new buyer UI, new seller UI, Seller Change Set behavior changes, Offer model changes, Product hierarchy, official BNS/KPVED runtime data, 2GIS runtime data, unresolved queue, provisional Products, price intelligence, background KB sync, scheduled KB updates, package deletion/deprecation, admin catalog UI, external KB service and microservices.

The implementation slice must not modify `kaida-product-corpus`.

## 4. Closed contracts affected

- **Catalog localization / resolution:** importer installs data behind the existing Catalog boundary. Resolution by canonical Product name, localized Product names and aliases remains the same.
- **Seller showcase/editor and batch input:** catalog suggestions and exact Product linking may see more catalog data, but suggestion/matching rules are not redesigned.
- **Search S0/S6/S7/S9/Stage 5/6C/Stage 6 Rev 3:** buyer Search API, state, ranking, sorting, eligibility and closed UI behavior remain unchanged.
- **Offer lifecycle and existing seed:** existing demo Products and Offers remain valid; Offer foreign keys are not rewritten.

## 5. Expected modules / boundaries

- Application-owned immutable package data, committed in KAIDA during implementation; no runtime or CI dependency on a sibling checkout, developer filesystem, network download or GitHub.
- A package validator that checks name/version/schema, required files, manifest hashes, source checkpoint/commit, deterministic schema, Product ID format, uniqueness, alias references and Product-category references.
- Minimal DB persistence for:
  - unique KB Product ID mapped to one runtime Product UUID;
  - categories: code, RU label, KK label;
  - Product-category relationship;
  - installed-package provenance.
- Import service/command that runs validation first, then all DB mutations in one transaction.
- Existing Catalog repositories continue to serve runtime Product resolution from KAIDA PostgreSQL.

## 6. Import model

### Runtime identity

Runtime identity remains `products.id` (UUID). Stable KB identity is a separate unique persistent value (`KAIDA-Pxxxx`) attached to or mapped to a runtime Product. The importer must not replace Product UUIDs and must not rewrite Offer Product UUID references.

### Product adoption

- Same KB ID already installed → synchronize package-owned fields on the same runtime UUID.
- No KB ID and normalized package canonical RU name safely matches exactly one existing Product → adopt that Product, attach the KB ID and preserve its UUID and references.
- No safe existing match → create a new Product with a new runtime UUID and attach the KB ID.
- Ambiguous/conflicting match → fail the entire import.

For existing localized names, the package canonical RU/KK names become package-owned Product names. If an adopted Product already has a different non-empty RU/KK localized value, the importer must preserve existing closed search coverage by retaining that previous value as an alias on the same Product where safe. If that retention would violate uniqueness or point to another Product, the whole import fails instead of silently destroying behavior.

### Alias adoption

Package aliases resolve through package Product ID → runtime Product UUID. Repeated import must not create duplicate aliases. An equivalent existing alias may be adopted for the resolved Product. Alias text that already resolves to a different Product, or would make resolution ambiguous, is a deterministic conflict and fails the whole import. No fuzzy alias reconciliation.

### Categories

Persist all 35 category codes with RU/KK labels and Product-category links. No category UI, browse-by-category, hierarchy, ranking or navigation taxonomy is introduced.

### Provenance

Persist enough package identity to read from DB: package name, package version/schema, source checkpoint, source commit, manifest/package identity and imported counts. One current installed-package record is sufficient for v1.

## 7. Risk flags

DB migration: **YES** · public API: **NO** unless implementation proves unavoidable · auth/security/privacy: **NO** · concurrency/atomicity: **YES** · data loss: **YES** — existing Product identities/FKs must be protected · external service: **NO**.

Verification depth must match these risks: package tamper checks, migration upgrade checks, transaction rollback tests, idempotency tests and existing Catalog/Search regressions.

## 8. Acceptance criteria

1. The verified five-file package with `package_schema_version = 1`, expected source checkpoint and expected source commit is accepted.
2. A corrupted, incomplete, wrong-version or hash-mismatched package is rejected before any DB mutation.
3. All 682 package Products are represented with unique stable KB identities, and each KB ID maps to exactly one runtime Product UUID.
4. All 210 package aliases are represented against resolved runtime Product UUIDs without duplication on repeated import.
5. All 35 categories are persisted with RU/KK labels and valid Product references.
6. Existing matching Products such as `Баранина` and `Говядина` are adopted rather than replaced.
7. Existing Offer → Product UUID references remain unchanged before and after import.
8. Importing the same package twice leaves an equivalent persistent result: no duplicate Products, aliases, categories, localized names or package-install records.
9. Deterministic conflicts — KB ID on another Product, normalized canonical match to multiple Products, existing Product already carrying another KB ID, alias collision to another Product or uniqueness violation — fail the whole import and roll back.
10. Runtime buyer/seller flows use only KAIDA PostgreSQL and have no dependency on corpus checkout, 2GIS, BNS/stat.gov.kz, GitHub or any external KB service.
11. Existing Catalog/Search regression tests remain green; Search matching, sorting, ranking, state and public API semantics are unchanged.
12. Installed package provenance can be read from DB and reports package identity plus imported counts.

## 9. Manual acceptance scenario

1. Start from migrated + seeded application.
2. Verify existing `Баранина` Search/Offer behavior.
3. Run the KB import.
4. Verify the same existing `Баранина` Offer still works and still references the original runtime Product UUID.
5. Exercise one imported KB Product or alias that was not in the old two-Product seed through an existing Catalog-facing flow, if available.
6. Run the same import again.
7. Verify no visible duplication/regression in existing buyer/seller flows.

Do not create UI solely for manual acceptance. Counts, FK preservation, package validation, idempotency and rollback are automated checks.

## 10. Verification plan

- Package fixture validation tests: required files, manifest hashes, package/schema/source identity, Product ID format, uniqueness and references.
- Migration/upgrade tests for new persistence: KB ID uniqueness, category persistence, package provenance and backwards compatibility.
- Import integration tests: valid package import counts; corrupted package fails before mutation; repeated import idempotent; deterministic conflict rolls back; concurrent imports do not create duplicates.
- Adoption tests: seeded `Баранина` and `Говядина` keep their UUIDs; existing Offer FK values are unchanged.
- Alias tests: package alias resolves through adopted/created runtime Product UUID; equivalent alias adoption is idempotent; conflicting alias fails.
- Catalog/Search regressions: existing resolution, suggestions, Search API, Search sorting/ranking and seller flows remain green.
- Branch CI on exact implementation SHA after approval.

## 11. STOP conditions

Stop instead of implementation/design workaround if analysis discovers:

1. verified package violates current uniqueness constraints in a way that cannot be deterministically adopted;
2. Product adoption is ambiguous;
3. RU/KK mapping requires changing a closed localization contract;
4. safe alias import would break the existing Catalog resolution contract;
5. importer unexpectedly requires excluded hierarchy or official mappings;
6. existing Offer UUID references cannot be preserved;
7. `main` moves away from verified `v0.0.51-search-sort-rev3` before implementation authorization/base selection.

Report exact conflicting records, affected closed contract, why it blocks and smallest viable options.

## 12. Data compatibility notes from contract analysis

- Local package inspection found expected counts: 682 Products, 210 aliases, 35 categories.
- Existing seeded `Говядина` safely matches package Product `KAIDA-P0001`.
- Existing seeded `Баранина` safely matches package Product `KAIDA-P0031`.
- Existing seeded RU alias `мясо барана` belongs to `KAIDA-P0031` in the package.
- Existing seeded KK localized/alias coverage differs from package naming: package canonical KK for `KAIDA-P0031` is `Қой еті`, while the seed has a more specific KK name for lamb. This is not a blocking conflict for the contract, but implementation must preserve closed localization/search behavior using the deterministic localized-name retention rule above or fail if a uniqueness conflict appears.
