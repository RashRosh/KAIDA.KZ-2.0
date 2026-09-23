# Seller comment translation — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-23. Implementation on a dedicated branch per `PROJECT_RULES.md` §19, in order part 1 → 2 → 3.

**Part 3 of 3** localization contracts. Depends on part 1 (`docs/slices/localization-foundation/SLICE_CONTRACT.md`).

**Decision sources:** `FEATURE_MAP.md` «Seller-authored content translation»; Product Owner decisions 2026-09-23:
only the Seller's Offer comment is translated; the Seller may write it in any language regardless of the interface
language; the translator is a server-side LLM; «Проверить перевод» is described here and hidden until that LLM is
connected; the Buyer sees the comment in the interface language with a translation mark.

**UX target:** Pass 3 `S-01` card variants (`results`, `card-contact`, `card-original`), `S-06__dirty` hint and
«Проверить перевод».

**Base product checkpoint:** `v0.0.26-buyer-interest-guest-visibility`.

## 1. User task

A Buyer reads a Seller's comment in their own interface language, and can always see what the Seller actually wrote.

## 2. Scope and exact behavior

### What is and is not translated

- Translated: the Offer comment only.
- Never translated, shown exactly as written in every locale: Seller name, Location name, address, custom price unit.
  Frames of the accepted Pass 3 prototype that show these translated are superseded on this point.

### Source language

- The Seller writes once, in any language, independent of the interface language. The form has no language picker
  and the interface language is not taken as the comment's language.
- The comment's language is detected by the translator from the text itself, after publication. It is stored with
  the translation result, not with Seller input. Until detected — and always while the translator is off — the
  language is `unknown`.
- A mixed-language comment is translated as a whole into each target locale. When the translator reports that the text
  is already in the target locale, no translation is stored for that locale.
- Comments saved before this slice are `unknown` and are translated once the translator is enabled. Their text is not
  changed.

### Translation record

- A translation belongs to one Offer comment version and one target locale (`ru` or `kk`). It stores the translated
  text, the detected source language, provenance `machine` and status `pending | available | same-language | failed`.
- Changing the comment creates a new version. A translation of an older version is stale: it is never shown, and a
  result arriving late for an older version is discarded.
- Machine text never replaces, overwrites or deletes the original.

### Translator

- A server-side LLM adapter translates a comment into `ru` and `kk` after the comment becomes public (ChangeSet
  confirmed), in the background. It never delays or fails the confirmation.
- The adapter is enabled by configuration. Without it, nothing is requested and every flow works
  (`PROJECT_RULES.md` §10.1). The concrete model and hosting are an operational choice outside this contract; the
  comment text may be sent only to a KAIDA-hosted model or a provider the Product Owner has approved.
- A failed request leaves status `failed` for that version; the next change of the comment retries naturally. No
  retry storm.

### Buyer display (Search, Nearby card)

- Current `available` translation into the interface locale: the translation is shown by default with
  «Автоперевод · Показать оригинал». The toggle shows the original in place and back, works by keyboard and marks the
  text with the right `lang`.
- `same-language`, or translator off (language `unknown`): the original is shown without any label.
- Translator on but `pending` or `failed`: the original is shown with the quiet label
  «Перевод недоступен · текст продавца». No empty card, no error message.
- Search does not use comments or their translations.

### Seller form (`S-06`)

- The hint «Покупатели увидят комментарий на своём языке — это автоперевод.» and the action «Проверить перевод» are
  shown only when the translator is enabled and the comment is not empty. With the translator off they are hidden,
  not disabled.
- «Проверить перевод» shows a read-only preview of the current draft translated into the second language: the one of
  `ru`/`kk` the draft is not written in, as detected by the translator. If the draft is detected as neither, the
  preview shows both. The Seller edits only the original. The preview is not saved and does not create a ChangeSet.
- A failed or slow preview shows a quiet message next to the comment and never blocks or clears the form.
- The preview endpoint requires an authenticated Seller and is rate-limited.

## 3. Explicit out of scope

- Translating Seller name, Location name, address, custom unit; Search over comments.
- Seller-declared comment language; Seller editing of the translation; moderation or quality guarantees of machine
  output.
- Choosing, hosting or paying for a specific LLM.
- Batch (S12) UI changes: batch comments are translated after confirmation like any other comment.

## 4. Closed contracts used and revisions

- **S4/S5/S12 SellerChangeSet:** unchanged. Seller input carries only the original comment, as today. Translation
  records are written only by the server translator after confirmation, never through Seller input or ChangeSet.
- **S1 Offers:** the comment's original text and its visibility rules unchanged.
- **S10/UX1D buyer card:** contacts, price and geo privacy unchanged; only the comment block gains the variants above.
- No closed contract behavior is revised.

## 5. Expected areas and risk flags

Offer read projection for Search/Nearby, a translation store keyed by comment version, a background translator
adapter, a Seller preview endpoint, buyer card and Seller form UI.

| Risk | Proof requirement |
|---|---|
| DB migration / data loss | Existing comments and Offer ids unchanged; the migration adds storage only. |
| Concurrency | A late translation of an older comment version is never shown. |
| External service | Full Seller and Buyer flows pass with the translator off; confirmation never waits for it. |
| Auth / abuse | Preview needs a Seller session and is rate-limited; translations cannot be written through Seller APIs. |

## 6. Acceptance criteria

1. A Seller in `ru` UI can write a Kazakh comment and vice versa; nothing in the form asks for or assumes the language.
2. With a current translation, the Buyer sees the comment in the interface language with «Автоперевод», can open the original and return.
3. A comment already in the interface language (`same-language`) shows as written, without a label.
4. Translator off: every comment shows as written, without a label; no translation hint or button for the Seller.
5. Translator on, `pending` or `failed`: the original with «Перевод недоступен · текст продавца».
6. After the Seller changes the comment, the old translation is never shown, including a late result.
7. Seller name, Location name, address and custom unit are identical in `ru` and `kk`.
8. With the translator on, «Проверить перевод» previews the second language and never blocks or clears the form.
9. ChangeSet confirmation succeeds and returns without waiting for translation; ChangeSet semantics are unchanged.

## 7. Verification and manual acceptance

- Integration with a fake translator adapter: detection result stored per version, `same-language`, mixed text,
  stale handling, late-result race, failure path, adapter disabled, legacy comments picked up after enabling.
- API/read projection: card variants per interface locale.
- E2E: Seller in `ru` UI writes a Kazakh comment; Buyer in `ru` sees the Russian translation with the
  original toggle, Buyer in `kk` sees the original without a label; translator off → originals without labels and no
  preview action.
- One full regression run and branch CI on the final executable head.

Manual scenario: with the translator on, as Seller in `РУ` write «Жаңа, таңертеңгі жеткізілім», press «Проверить
перевод» — preview in Russian; confirm. As Buyer in `РУ` see «Свежая, утренний привоз» with «Автоперевод», open the
original. Switch to `ҚАЗ` — the original, no label. Change the comment — the old translation disappears until the new
one arrives. Turn the translator off: all comments are shown as written, and the Seller form has no translation hint
or button.
