# Offer photos: upload, storage, buyer display — Slice Contract

**Status:** DRAFT — ready for Product Owner approval; decisions recorded in §8.

**Stage 1, item 1** of `docs/product/EXECUTION_PLAN.md` (seller without AI). This is M1, moved ahead of the frozen
queue.

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1):
`AI-S09 · Editor · Media` and `· Manual · Validation` (seller), `AI-B01` result card and `AI-B02` gallery (buyer),
`States1`/`States2` media tile states. Mandatory UI rules: `PROJECT_RULES.md` §18.4.

**Base product checkpoint:** `v0.0.32-seller-offer-editor`.

## 1. User task

A Seller attaches up to five photos to a card, chooses the cover and order, and can change them later; a Buyer sees
the cover in results and can look through all photos of the card.

## 2. Scope and exact behavior

### Photos on an Offer

- An Offer has an ordered list of 0–5 photos; the first is the cover. The list belongs to the Offer, changes only
  through a confirmed SellerChangeSet and increments the Offer revision.
- **Photos are optional** (`FEATURE_MAP.md` «Seller AI-first model» п. 4, PO decision 2026-09-25, overriding the
  brief and the mockup's «Добавьте хотя бы одно фото товара»). A card without photos is published; before confirm the
  Seller sees a neutral reminder: `Без фото карточка проигрывает конкурентам — покупатели чаще выбирают карточки с
  фото` with `Добавить фото` and `Опубликовать без фото`. Not an error, not red, no checkbox. The full
  incomplete-card reminder (photo, comment, opening hours) belongs to stage 1 item 3; this slice owns the photo part.
- The absence of photos never changes buyer ranking or visibility; buyers see the neutral fallback.
- `deactivate_offer` / `activate_offer` do not touch photos and do not require them.
- Buyer visibility rules are unchanged: a photo is not an eligibility condition (S1/S9/S10 unchanged).

### Upload

- The Seller picks files from the gallery or camera (`image/*`); each file uploads at once, independently, with
  its own progress, error and `Повторить`. A failed file does not block the others or clear the form.
- Accepted: JPEG, PNG, WebP up to 15 MB per file. Anything else, a larger file or an image whose shorter side is under
  300 px gets a plain message at that tile (`Это не фото…`, `Файл больше 15 МБ`, `Фото слишком маленькое`).
- The server decodes the image, applies orientation, **removes all metadata (including GPS)**, stores only
  re-encoded versions — a display size (long side ≤ 1600 px) and a thumbnail (long side ≤ 480 px) — and discards
  the original. Decoding has a pixel limit against oversized images.
- An uploaded photo belongs to the uploading Seller. Until it is attached to an Offer by a confirmed ChangeSet only
  that Seller can see it. A Seller may hold at most 50 unattached photos; above that the upload is refused with a
  message.

### Storage

- Files live on the KAIDA server's own disk in a configured directory (a Docker volume in deployment), behind a
  storage boundary so that an S3-compatible store can replace it later without changing Offer data. No external
  service (`PROJECT_RULES.md` §10.1).
- A photo file is immutable: replacing a photo is a new upload with a new id, so public URLs can be cached for a
  long time.
- A photo is public only while it is attached to an active Offer; otherwise it is served to its owner only.

### Seller surfaces (inside the existing editor from `seller-offer-editor`)

- A `Фото` section at the top of the form, as `AI-S09 · Editor · Media`: tiles with the cover marked, `+ Фото`,
  counter `N из 5`; at 5 the add tile is disabled with `Лимит`.
- Per photo: `Сделать обложкой`, `Переместить` with left/right buttons (no drag required), `Удалить`. Drag to reorder
  is optional and never the only way.
- No photo validation. While any upload is in progress the submit waits for it or says which photo is still loading.
- The section shows a quiet hint `Карточки с фото выбирают чаще` while it is empty.
- Edit mode shows current photos; changing them is part of the same edit and follows the same confirm flow.
- The confirmation page shows the cover and the photo count. The seller offer list shows the cover or the fallback.
- Dirty-close and `Назад к правке` keep the uploaded photos and their order.

### Buyer surfaces

- The shared buyer Offer card (search and «Рядом») shows the cover thumbnail or the
  neutral fallback that does not imitate a product (`AI-B01 · Variants`).
- Tapping the photo opens a full-screen viewer: swipe and previous/next buttons, `2 из 4`, close; overlay rules of
  §18.4. With one photo there is no navigation.
- An image that fails to load shows the fallback; the card's name, price, point, contacts and route stay usable.
- Alt text: product name plus `фото N из M`.

## 3. Explicit out of scope

- Public video (M2), AI photo input, frames from video.
- Shared photos across several points and per-point photo overrides — contract «Моя витрина и ручной редактор»
  (stage 1 item 3) defines how one card on N points writes the same photos.
- Complaints about photos and the system fallback after a confirmed complaint.
- Cleanup of unattached photos, backup of the photo directory, CDN — follow-ups recorded in §5.
- Restyling the rest of the editor to AI-S09 (stage 1 item 3); only the photo section follows the mockup here.
- A buyer offer detail page (brief gap 13); the viewer opens over the current card.

## 4. Closed contracts used and revisions

- **S4/S5 SellerChangeSet — extended.** `create_offer` and `update_offer` items carry an ordered photo list (0–5;
  omitted on update = unchanged). Confirm stays atomic: Offer data and photo list apply together or
  not at all. Ownership: every photo id must belong to the Seller and be ready; otherwise the whole ChangeSet is
  rejected. Optimistic revision check unchanged.
- **S12 batch seller input — unchanged:** batch cards are created without photos and can get them by editing.
- **`seller-offer-editor` — extended** with the photo section; its other behavior is unchanged.
- **UX1B / UX1D buyer offer cards — extended** with the cover and viewer; content order otherwise unchanged.
- **Privacy (`PROJECT_RULES.md` §18.4: no raw coordinates in public):** kept by stripping metadata on upload.
- **S1 lifecycle, S9 ranking, S10 contact actions:** unchanged.

## 5. Expected areas and risk flags

New media module (upload, processing, storage boundary, serving), DB migration for photos and their link to Offers
and ChangeSet items, ChangeSet validation and confirm, editor photo section, buyer card cover and viewer.

| Risk | Proof requirement |
|---|---|
| Privacy | A JPEG with GPS EXIF is served without any metadata; the original is not kept. |
| Ownership | A foreign, unattached or deleted photo id in a ChangeSet rejects it; another Seller cannot fetch an unattached photo. |
| Atomicity | A failing confirm leaves neither new Offer fields nor a changed photo list. |
| Limits | More than 5 photos per Offer is rejected by the API, not only by the form. |
| Abuse / resources | Size, type, pixel and 50-unattached limits enforced on the server. |
| Double submit | Repeated confirm creates one Offer with one photo list. |
| Disk growth | Unattached photos accumulate until the cleanup follow-up; recorded, not solved here. |
| Backup | The photo directory is not in a backup yet; recorded as a launch prerequisite. |

## 6. Acceptance criteria

1. A card can be published without photos; before confirm the Seller sees the non-blocking reminder.
2. The Seller adds up to 5 photos, sees per-file progress, retries one failed file without losing the others.
3. Cover and order can be changed with buttons alone; the first photo is the cover everywhere.
4. Editing a published card can add, replace, reorder or remove photos, including removing all of them.
5. Served photos carry no metadata; only resized versions are stored.
6. Unattached photos are visible to their owner only; photos of an active Offer are public; a foreign photo id is
   rejected.
7. Buyer cards show the cover or the neutral fallback; the viewer shows all photos with `N из M` and meets §18.4.
8. A broken image never hides name, price, point, contacts or route.
9. All new strings exist in `ru` and `kk`, Kazakh native-verified, no clipping at 320 px.
10. Regression of S1/S4/S5/S9/S10/S12/`seller-offer-editor` stays green; ranking is identical with and without photos.

## 7. Verification and manual acceptance

- Integration: upload processing (formats, size, small image, metadata removed), ownership, ChangeSet with and
  without photos, 5-photo limit, atomic confirm, access rules for serving.
- E2E (mobile + desktop, `ru` + `kk`): create with photos; publish without photos through the reminder; one failed upload and retry;
  reorder and cover by buttons; edit replacing photos; removing all photos; buyer cover, viewer, fallback.
- Unit: only for non-trivial ordering logic.
- One full regression run and branch CI on the final executable head.

Manual scenario: on a phone, `Продавцу` → add a card, take a photo with the camera and add two from the gallery,
make the second one the cover, confirm — the card shows that cover in the list and in buyer search. Open the card as
a buyer, swipe through three photos. Edit the card, delete all photos — after the reminder it publishes with the fallback. Repeat once in `ҚАЗ`.

## 8. Product Owner decisions (2026-09-25)

1. Photos are optional; a card without photos is published after a non-blocking reminder; no ranking effect.
2. The text batch input (S12) stays as it is.
3. Defaults taken without a separate decision (change them if needed): limits 5 photos / 15 MB / 300 px / 50
   unattached; originals are not kept.
