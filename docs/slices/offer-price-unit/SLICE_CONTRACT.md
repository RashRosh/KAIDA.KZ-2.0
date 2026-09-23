# Offer price unit: canonical choices and custom value — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-23. Implementation remains gated by the order below and
`PROJECT_RULES.md`.

**Placement:** after all three localization contracts and `seller-cabinet-overview`, before `seller-offer-editor`.
The editor cannot ship its accepted S-06 unit control until this contract is merged.

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

A Seller chooses a consistent price unit from a short list, or enters a truthful custom unit when the list does not
fit; Buyers see the unit in their interface language without changing the price or Offer identity.

## 2. Scope and exact behavior

### Canonical model

- Canonical codes: `kg`, `piece`, `liter`, `package`, `other`.
- Localized labels:
  - `ru`: `кг`, `шт`, `л`, `упак.`, `другое`;
  - `kk`: `кг`, `дана`, `л`, `қапт.`, `басқа` (native Kazakh review required before merge).
- Unit remains optional, preserving Mandatory Offer Price: a price amount is required, a unit is not.
- `other` requires a trimmed Seller-authored value of 1–40 characters. Canonical choices reject a custom value.
- A custom value is stored and shown as written in every locale; it is never machine-translated.
- Package quantity or size such as `100 г`, `500 г`, `1,5 кг` is not a unit and remains out of scope.

### Storage and migration

- Offer and SellerChangeItem store structured unit data: nullable canonical code plus nullable custom value.
- Existing `price_unit = null` migrates to no unit.
- Existing values matching a canonical label after trim and case normalization migrate to the corresponding code.
- Every other non-empty legacy value migrates losslessly to `other` with its original trimmed text.
- Historical migrations remain immutable. Upgrade proof covers null, every recognized label and an unknown legacy
  value. No Offer, ChangeSet item, price amount, currency or relationship changes during migration.

### Mutation and read contracts

- S4, S5 and S12 create/update inputs use the same structured value:

```text
unit: null
  | { code: "kg" | "piece" | "liter" | "package" }
  | { code: "other", value: string }
```

- This is an explicit revision of the existing free-text mutation field; all single and batch paths switch
  together. Server validation owns the invariant and never trusts a localized label as a canonical code.
- Owner and buyer reads keep the existing display-oriented `price.unit: string | null` field for compatibility.
  Canonical codes are rendered to the requested locale; `other` returns the Seller-authored value.
- Requests without locale retain Russian display labels. Unit choice does not affect eligibility, Search matching,
  ranking, lifecycle, ownership or ChangeSet atomicity.

### Seller UI control

- S-06 shows the five choices as one controlled field; responsive presentation may be chips or a select without
  changing semantics.
- Choosing `Другое / Басқа` reveals the custom-value field. Switching away clears that custom draft only
  after the new canonical choice is explicit.
- Edit mode resolves stored canonical data to the matching choice; migrated unknown values open as `Другое /
  Басқа` with the preserved value.
- Validation is localized and attached to the controlled field/custom input. Changing locale keeps the selection
  and custom draft.

## 3. Explicit out of scope

- Package quantity/size, conversion between units, price normalization or comparison by unit.
- Seller-defined aliases for canonical units; automatic translation of custom units.
- Search/filter/ranking by unit; Catalog changes; currency changes.
- Rewriting historical Seller-authored custom values for style or spelling.

## 4. Closed contracts revised or preserved

- **Mandatory Offer Price:** amount remains mandatory and unit remains nullable; currency stays server-owned KZT.
- **S4/S5/S12 SellerChangeSet:** free-text unit input is explicitly revised to structured input; review, confirmation,
  stale protection, idempotency, ownership and S12 all-or-nothing behavior remain unchanged.
- **Localization:** canonical labels follow requested locale; custom values are Seller-authored and shown as written.
- **S7/S9/S11/UX1D reads:** existing `price.unit` remains a display string, so buyer DTO shape and eligibility remain
  unchanged.

## 5. Expected areas and risk flags

Offers and Seller Input contracts/storage, migration, single and batch validation, owner/buyer projections, S-06
unit control and localized strings.

| Risk | Proof requirement |
|---|---|
| DB migration / data loss | Upgrade preserves null, canonical matches and arbitrary legacy values exactly as specified. |
| Public API | S4/S5/S12 structured mutation validation and unchanged display-read shape are proven. |
| Atomicity | Invalid unit in one S12 item applies none of the batch. |
| Localization | Canonical labels change with locale; custom values never change. |

No auth/privacy, external-service or new concurrency mechanism.

## 6. Acceptance criteria

1. New and edited Offers accept exactly the five canonical choices, with a value required only for `other`.
2. Unit remains optional; missing unit does not weaken the mandatory amount rule.
3. Russian and Kazakh reads localize canonical labels and preserve custom values as written.
4. Every pre-existing non-empty unit survives migration either as a canonical code or lossless `other` value.
5. S4, S5 and S12 share one validation rule; invalid batch input preserves all-or-nothing behavior.
6. Locale switching and `Назад к правке` preserve the selected unit and custom draft.
7. Unit changes do not affect price amount/currency, Offer identity, eligibility, lifecycle, ranking or ownership.
8. Kazakh labels are native-verified and the control has no clipping at 320 px.

## 7. Verification and manual acceptance

- Unit: schema matrix for null, every code, valid/invalid `other`, localized projection.
- Integration: migration upgrade; S4 create; S5 update; S12 mixed batch and rollback on one invalid unit.
- E2E (`ru` + `kk`, mobile + desktop): choose each canonical unit, use `Другое / Басқа`, switch locale,
  return from review, confirm and inspect the canonical card.
- One full regression run and branch CI on the final executable head.

Manual scenario: edit an Offer from `кг` to `шт`, review and confirm; switch to `ҚАЗ` and see `дана`.
Create another Offer with `Другое = ведро`, switch language and confirm that `ведро` remains unchanged.

## 8. Approval boundary

Approval authorizes the canonical codes, lossless legacy migration and the explicit S4/S5/S12 mutation revision
above. Implementation starts only at this contract's position in `EXECUTION_PLAN.md`.
