# Seller comment translation — Slice Contract

**Status:** PROPOSED — contract review before production implementation.

**Part 3 of 3** localization contracts. Depends on part 1 (`docs/slices/localization-foundation/SLICE_CONTRACT.md`).

**Decision sources:** `FEATURE_MAP.md` «Seller-authored content translation»; Product Owner decisions 2026-09-23:
only the Seller's Offer comment is translated; the translator is a server-side LLM; «Проверить перевод» is described
here and hidden until that LLM is connected.

**UX target:** Pass 3 `S-01` card variants (`results`, `card-contact`, `card-original`), `S-06__dirty` hint and
«Проверить перевод».

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

A Buyer reads a Seller's comment in their own language when a translation exists, and can always see what the
Seller actually wrote.

## 2. Scope and exact behavior

### What is and is not translated

- Translated: the Offer comment only.
- Never translated, shown exactly as written in every locale: Seller name, Location name, address, custom price unit.
  Frames of the accepted Pass 3 prototype that show these translated are superseded on this point.

### Source language

- The Seller writes once, in their own language. The comment's source locale is the interface locale at the moment
  the Seller submits it. There is no language picker in the form.
- The source locale travels with the comment through `SellerChangeItem` and is applied to the Offer together with the
  comment at confirmation, in the same atomic step.
- Comments saved before this slice have source locale `unknown`. The migration does not guess and does not change
  the text.

### Translation record

- A translation belongs to one Offer comment version and one target locale. It stores the text, provenance `machine`
  and status `pending | available | failed`.
- Changing the comment creates a new version. A translation of an older version is stale: it is never shown, and a
  result arriving late for an older version is discarded.
- Machine text never replaces, overwrites or deletes the original.

### Translator

- Translation is produced by a server-side LLM adapter after the comment becomes public (ChangeSet confirmed), in
  the background. It never delays or fails the confirmation.
- The adapter is enabled by configuration. Without it, no translations are requested and every flow works
  (`PROJECT_RULES.md` §10.1). The concrete model and hosting are an operational choice outside this contract; the
  comment text may be sent only to a KAIDA-hosted model or a provider the Product Owner has approved.
- A failed request leaves status `failed`; a later confirmed change retries naturally. No retry storm.

### Buyer display (Search, Nearby card)

- Source locale equals the interface locale, or is `unknown`: the original is shown, no label.
- A current `available` translation exists: the translation is shown with «Автоперевод · Показать оригинал». The
  toggle shows the original in place and back, works by keyboard and marks the text with the right `lang`.
- Otherwise (translator off, `pending`, `failed`): the original is shown with the quiet label
  «Перевод недоступен · текст продавца». No empty card, no error message.
- Search does not use comments or their translations.

### Seller form (`S-06`)

- The hint «Покупатели увидят автоперевод на <другой язык>.» and the action «Проверить перевод» are shown only when
  the translator is enabled and the comment is not empty. With the translator off they are hidden, not disabled.
- «Проверить перевод» shows a read-only preview of the current draft comment translated into the other locale. The
  Seller edits only the original. The preview is not saved and does not create a ChangeSet.
- A failed or slow preview shows a quiet message next to the comment and never blocks or clears the form.
- The preview endpoint requires an authenticated Seller and is rate-limited.

## 3. Explicit out of scope

- Translating Seller name, Location name, address, custom unit; Search over comments.
- Seller editing of the translation; moderation or quality guarantees of machine output.
- Choosing, hosting or paying for a specific LLM.
- Batch (S12) UI changes beyond carrying the source locale with each item.

## 4. Closed contracts used and revisions

- **S4/S5/S12 SellerChangeSet — additive revision.** `SellerChangeItem` gains the comment's source locale; confirmation
  copies it to the Offer with the comment. Unchanged: no direct Offer write from Seller input, ownership checks,
  atomic apply, one-time apply, server-side validation, batch aggregation. Translation records are written only by
  the server translator, never by Seller input.
- **S1 Offers:** the comment's original text and its visibility rules unchanged.
- **S10/UX1D buyer card:** contacts, price and geo privacy unchanged; only the comment block gains the variants above.
- `PROJECT_RULES.md` §4 STOP: this contract is the explanation for the S4 revision (why: translation needs a known
  source language; what changes: one additive field; consequence: none for existing flows). Product Owner approval of
  this contract approves that revision.

## 5. Expected areas and risk flags

Seller-input write path and migration, Offer read projection for Search/Nearby, a translation store, a background
translator adapter, a Seller preview endpoint, buyer card and Seller form UI.

| Risk | Proof requirement |
|---|---|
| DB migration / data loss | Existing comments and Offer ids unchanged; legacy source locale `unknown`. |
| Concurrency | A late translation of an older comment version is never shown. |
| External service | Full Seller and Buyer flows pass with the translator off; confirmation never waits for it. |
| Auth / abuse | Preview needs a Seller session and is rate-limited; translations cannot be written through Seller APIs. |

## 6. Acceptance criteria

1. A comment submitted in `kk` UI is stored with source `kk`; in `ru` UI with `ru`; legacy comments are `unknown`.
2. ChangeSet confirmation applies comment and source locale atomically and still applies once only.
3. With a current translation, the Buyer sees «Автоперевод», can open the original and return.
4. Translator off, pending or failed: the Buyer sees the original with «Перевод недоступен · текст продавца».
5. Same source and interface language, or `unknown`: the original without a label.
6. After the Seller changes the comment, the old translation is never shown, including a late result.
7. Seller name, Location name, address and custom unit are identical in `ru` and `kk`.
8. With the translator off, «Проверить перевод» and the hint are absent; with it on, the preview shows and never blocks the form.
9. Confirmation succeeds and returns without waiting for translation.

## 7. Verification and manual acceptance

- Integration with a fake translator adapter: source locale through ChangeSet, atomic apply, version/stale handling,
  late-result race, failure path, adapter disabled.
- API/read projection: card variants per locale; legacy `unknown`.
- E2E (part 1 flag on): Seller submits a comment in `kk`, Buyer in `ru` sees the translation and the original toggle;
  translator off → original with label; preview visible only with the translator on.
- One full regression run and branch CI on the final executable head.

Manual scenario: with the translator on, as Seller in `ҚАЗ` write «Жаңа, таңертеңгі жеткізілім», press «Проверить
перевод», confirm. As Buyer in `РУ` see «Свежая, утренний привоз» with «Автоперевод», open the original. Change the
comment — the old translation disappears until the new one arrives. Turn the translator off: the original is shown
with «Перевод недоступен · текст продавца» and the Seller form has no translation hint or button.
