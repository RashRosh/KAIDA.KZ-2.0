# «Моя витрина» and the manual editor — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-27 (mixed product name and decisions a–g in §8).

**Stage 1, item 3** of `docs/product/EXECUTION_PLAN.md`.

**UX target:** accepted mockup copy `docs/product/mockup/seller-ai-first-rev1/` (`PROJECT_RULES.md` §18.1), AI-off
variants first: `OFF1` (showcase, editor, edit published, published), `OFF2` (Confirm · AI off), `S01` (showcase empty,
statuses, loading, error), `S02` (source sheet · AI outage), `S09` / `S09b` (editor, unit sheet, pack fields,
validation, submitting, submit error, discard confirm, returned from point, card points, one-point price), `S10`
(point selector), `S11` (per-point data — price only, see §2), prototype `P4`. Where a frame conflicts with a Product
Owner decision in `FEATURE_MAP.md` «Seller AI-first model», the decision wins (photo is optional; only price differs
per point; comment is shared). Mandatory UI rules: `PROJECT_RULES.md` §18.4.

**Base:** `main` after PR #53 (offer photos, point contacts and hours).

## 1. User task

A Seller opens «Моя витрина», adds a product by hand under their own name with a price, optional pack, photos and
comment, puts it into one, several or all of their points with one common price or a point's own price, confirms once
and sees the card on the showcase; later changes it in all points or in one point, or saves an unfinished card as a
draft and finishes it later. A Buyer finds the card by words of its name.

## 2. Scope and exact behavior

### Navigation and shell

- Seller sections: `Витрина / Точки / Ещё` (bottom bar on mobile, the same three items on desktop). The separate
  overview (`seller-cabinet-overview`) and offers list pages merge into «Моя витрина» at `/seller`; old links
  (`/seller/offers`, `/seller/offers?new=1`) redirect there (the latter opens the editor).
- `Ещё`: language, `Добавить списком` (existing batch text input S12, unchanged) and `Выйти`.
- Seller screens take the mockup look: Roboto for text, Geologica for headings, KAIDA purple `#9900CC` as the accent,
  tokens from `ds/kaida/tokens.json` (light theme). Fonts are served from the repository, no request to a third party
  from the user's device. Buyer screens keep their current look (restyled later).

### «Моя витрина» (`AI-S01`, `OFF1`)

- One primary action `Сформировать карточки товаров` opens the source sheet (`S02 · AI outage`): `Снять видео`,
  `Добавить фотографии`, `Надиктовать товары` visible but disabled with `Временно недоступно`; `Заполнить вручную`
  active and opens the empty editor.
- **Empty:** the P4 texts: `Покажите товары покупателям рядом` / `Добавьте товар: фото, название и цену. Карточка
  появится на витрине после вашего подтверждения.`
- **Filled:** tabs `Все · N` and `Черновики · N` (the tab `Внимание` arrives with items 4–5). One row per product card,
  newest change first: cover photo or neutral placeholder, name with pack (`Курага · 500 г`), common price and unit,
  `· N точки`, status badge (icon + word, never color alone):
  - `На витрине` — at least one of its points is on;
  - `Выключено` — all its points are off;
  - `Черновик` — an unsent draft, with what is missing: `Не заполнено: цена, точка`.
- **Incomplete card reminder** (`FEATURE_MAP.md` п. 4): a published card without photo or without comment shows
  `Без фото` / `Без комментария`. When there is no photo, the placeholder shows a `+`; tapping it opens the editor
  at the photo control. Tapping the rest of the row still opens the card screen, where the full edit remains
  available. A missing comment has no duplicate quick-edit action.
- After publishing, the card is on top and highlighted with `Опубликовано. Карточка уже видна покупателям` or
  `Изменения опубликованы` (`OFF1 · Published`).
- Loading shows skeletons of the same shape; the primary action is available at once. A failed load shows
  `Не удалось обновить` with `Повторить` and keeps what was already shown.

### Product card = one product in one or more points

- A card is one product of the Seller sold in N points: N offers that share **name, pack, unit, photos and comment**
  and differ only in **price** and on/off state (`FEATURE_MAP.md` п. 6).
- Tapping a card opens the card screen (`S09b · AI-S15 Card · Points`): photos, name, and each point with its price
  (`своя цена` marked in words), state and actions `Изменить только в этой точке`, `Выключить` / `Включить`; above
  the list `Изменить во всех точках` (for a one-point card simply `Изменить`).
- Existing offers each become their own one-point card (§ migration).

### Editor (`AI-S09 · Manual · AI off`)

One component for new card, draft and edit. Mobile: full screen; desktop: dialog over the showcase (§13.1 overlay
rules). Sections in order: photos → name → price and `Цена за` → pack (conditional) → comment → trading points →
actions.

- **Photos:** unchanged from `offer-photos` (optional, up to 5, cover, reminder).
- **Name** `Название товара` — required, 2–80 characters after trimming, one line, placeholder `Например, баранина,
  лопатка`. **Mixed input** (PO decision 2026-09-27, §8):
  - while the Seller types (from 2 letters), up to 5 catalog suggestions appear under the field, matched by the same
    word-prefix rule as search against catalog names and aliases in the interface language;
  - choosing a suggestion puts its name into the field and links the card to that catalog product; the Seller may then
    add words (`Баранина` → `Баранина, лопатка`) and the link stays;
  - clearing the field or replacing the text so it no longer starts with the chosen name drops the link;
  - with no suggestion chosen the card is published under the Seller's own words, without waiting and without a
    «not in catalog» state or error;
  - suggestions are a help, never a requirement; the keyboard and screen readers can reach them (listbox pattern).
  Matching own-name cards to the catalog later (by an operator) is out of scope.
- **Price** — required, a number greater than 0 (`S09 · Validation`: `Укажите цену больше 0 ₸`; tightens Mandatory
  Offer Price, which today accepts 0), up to 2 decimals, placeholder `Сумма`, `₸`.
- **`Цена за`** — required; tap opens the unit sheet (`S09 · Unit sheet`): `кг`, `л`, `шт.`, `упак.`, `Другое`, each
  with its hint; the choice closes the sheet at once and returns focus to the field.
  - `Другое` reveals `Своя единица` — **one word: letters only, no spaces or digits, 1–20 characters** (revises the
    1–40 free text of `offer-price-unit`; existing longer values are shown as before and must be corrected only when
    the card is edited).
- **Pack** (inline, between price and comment, `S09 · Pack fields expanded`): `упак.` shows `В упаковке ·
  необязательно` with amount and unit (`г`, `кг`, `мл`, `л`); `шт.` shows the link `+ Указать вес или объём` that
  reveals the same field; `кг`, `л`, `Другое` show nothing. Buyer sees `Баранина, лопатка · 600 г` and `3 000 ₸ /
  упаковка`. Changing the unit away clears the pack.
- **Comment** — optional, up to 500 characters (unchanged), `Надиктовать` disabled with `Временно недоступно`; the
  existing translation hint stays.
- **Trading points** (`AI-S10` inline):
  - no points: `Добавить торговую точку` · `Нужна, чтобы покупатель нашёл вас`; it opens point creation (existing
    S3/S8 flow with contacts and hours from item 2) over the editor and returns with everything typed kept and the
    new point selected: `Точка добавлена и выбрана`;
  - one point: selected automatically and shown as `Выбрана автоматически — это ваша единственная точка`;
  - several: `Все точки` plus a checkbox per point, nothing preselected; `Добавить торговую точку` always present;
  - always under the list: `Будет создана 1 карточка` / `Будет создано N карточек` (Russian and Kazakh plural rules).
  - With 2+ selected points: `Настроить цены по точкам` opens the per-point list (`S11`, price only): each point
    `Как у всех` or `Своя цена` with its price and `Вернуть общую цену · X ₸`. Name, pack, unit, photos and comment
    are shown there as shared, not editable per point.
- **Required to publish:** name, price, `Цена за` (and `Своя единица` for `Другое`), at least one point. Errors show
  after the first attempt, under each field, with the summary `Заполните N полей` at the top, and focus moves to the
  first field in error (`S09 · Manual · Validation`, without the photo error).
- **Actions:** primary `Проверить и опубликовать`, secondary `Сохранить черновик` (new card and draft only).
- **Submitting / submit error** (`S09b`): the button shows progress and is blocked against a second tap; an error keeps
  the form and says `Не удалось отправить. Всё введённое сохранено. Проверьте сеть и повторите.`
- **Close with changes** (`S09b · Discard confirm`): `Закрыть без сохранения?` with `Продолжить правку` (default),
  `Сохранить черновик` (new card and draft only) and `Закрыть`.

### Drafts

- `Сохранить черновик` saves the editor as it is, on the server, for this Seller only; any field may be empty. A draft
  is never visible to buyers and creates no offers.
- Drafts are listed in `Черновики` and in `Все`; opening one opens the editor with everything restored, including
  photos and chosen points. Publishing a draft removes it; `Удалить черновик` in the editor removes it after a
  confirmation.
- A photo kept in a draft stays private to the owner (existing media access rule).
- Drafts are for new cards only; a change to a published card is either published or discarded.

### Edit a published card

- **In all points** (`OFF1 · Edit published · AI off`): name, pack, unit, photos, comment are changed for every point
  of the card. Price shows `Было 3 000 ₸`. Below, `Изменить также в других точках`: every point with the common price
  is checked and shows `3 000 → 3 200 ₸`; a point with its own price is unchecked and shows `своя цена: 5 000 ₸` —
  the Seller may check it to overwrite. `Будет изменено N карточек`. The Seller can also add points the card is not
  in yet (a new point is never added by itself, `FEATURE_MAP.md` п. 6); each added point gets the common price.
- **In one point** (`S09b · Edit published · One point`): `Меняется только точка «…». Остальные N точек не
  изменятся.` Only price is editable; name, unit and comment are shown read-only with `Общее для всех точек`. The
  price becomes that point's own price; `Вернуть общую цену · X ₸` restores it.
- `Выключить` / `Включить` of one point stay as today (S5), from the card screen.

### Confirm (`OFF2`)

- `Проверьте карточку` (new) / `Проверьте изменения` (edit): compact summary — name with pack, price and unit, point(s)
  with price per point and `было → стало` for an edit, photo count, comment; `Будет опубликована 1 карточка` /
  `Будет изменено N карточек`.
- Above the button, info tone, no checkbox, on every publish and every saved edit, verbatim:
  `Карточка появится на витрине сразу, без предварительной проверки. Вы несёте ответственность за то, чтобы фото,
  название и описание соответствовали законодательству Республики Казахстан. Карточки с запрещённым содержимым
  снимаются с витрины.`
- The photo reminder of `offer-photos` stays (`Опубликовать без фото` when there is none), otherwise `Опубликовать`;
  secondary `Вернуться к правке` keeps every value.
- Publishing: blocked second tap, no duplicate cards. Error: `Не удалось опубликовать. Всё введённое сохранено.`
  with `Повторить`.
- **Conflict** (any offer of the card changed since the editor opened): `Карточку уже изменили с другого устройства —
  обновите`, now-on-showcase vs. your change, `Обновить` reopens the editor with the current card and the Seller's
  change on top; nothing is applied until confirmed again.
- One confirm applies the whole card atomically: all N offers are created or changed, or none.
- No pre-moderation while AI is off (`FEATURE_MAP.md` п. 5): published = visible to buyers at once, as today.

### Search by the free name (revision of S6/S7)

- A buyer query finds an offer when **every word of the query is the beginning of some word of the offer name**
  (case- and `ё/е`-insensitive, punctuation ignored): `баран` and `баранина лопатка` find `Баранина, лопатка`;
  `лопатка` finds it too; `говядина` does not.
- The catalog stays: when the whole query resolves to a catalog product through its names and aliases (S6), offers
  linked to that product are found as well, even without the words in their name.
- A card is linked to a catalog product when the Seller chose a suggestion, or — if no suggestion was chosen — when
  its whole name resolves to exactly one catalog product; otherwise it has no product. The link never changes the
  name the Seller or Buyer sees.
- Word matching starts from 2 letters in a query word; a 1-letter word is ignored by word matching (catalog resolution
  of the whole query still applies).
- Result order, visibility, freshness, distance and the rest of S9 ranking are unchanged.
- Buyers see the Seller's name as written, in any interface language (catalog translations of product names no longer
  change the card title).

### Migration of existing data

- Every existing offer gets its name from its catalog product (Russian name) and its catalog link kept, and becomes its
  own one-point card with the common price equal to its price. Existing `Другое` values stay as they are.
- Offers are not merged into multi-point cards automatically.

## 3. Explicit out of scope

- Statuses and tab of items 4–5: `Снято оператором`, `Внимание`, actuality task and badges, reminders.
- AI input, video, dictation, moderation queue, the AI-mode texts `Отправить на модерацию`.
- Deleting a published card or removing a point from it (a point is switched off instead).
- Drafts of edits to published cards; offline queue; drafts on the device.
- Buyer screens restyle, dark theme, the buyer Offer page layout (only the title source changes).
- Address suggestions / map link / Telegram in point creation.
- Buyer interests (S13) and Nearby / discovery (S11) for cards without a catalog product: such cards do not trigger
  interests; Nearby shows them as any other offer.
- Merging or splitting cards after migration.
- Operator tools to link own-name cards to the catalog or add catalog products from them; the starter catalog
  list of common market products in `ru` and `kk` (separate work, it does not block this slice).

## 4. Closed contracts revised

- **`seller-cabinet-overview`** — replaced by «Моя витрина»; the overview page and its sections are removed.
- **`seller-offer-editor`** — the form becomes AI-S09 AI-off: free name, pack, inline point selector with several
  points, per-point price, drafts; the separate `Где продаёте?` step disappears.
- **`offer-price-unit`** — `Другое` becomes one word of letters, 1–20; pack amount added.
- **S4/S5 SellerChangeSet** — one ChangeSet may create or change several offers of one card; confirm stays explicit,
  atomic and revision-checked.
- **Mandatory Offer Price** — price must be greater than 0 in new and edited cards.
- **S6/S7 search** — offers found by words of their own name in addition to catalog resolution.
- **`catalog-localization`** — card title is the Seller's text; catalog names serve search only.
- **#35 / #36 / UX2** — first point is created from the editor's points section; `0 / 1 / 2+` rule kept.
- **S12 batch input** — unchanged behavior, moves to `Ещё → Добавить списком`; its offers get their name from the
  catalog product.

## 5. Risk flags

| Risk | Proof requirement |
|---|---|
| Data integrity | A multi-point publish or edit creates/changes all N offers or none; shared fields are equal across a card after every change. |
| Own price | A common price change never overwrites an own price unless the Seller checked that point. |
| Concurrency | A change made from another device is detected before applying; double tap never creates duplicates. |
| Search | Word-prefix match finds free names; catalog aliases still work; no offer outside buyer visibility appears. |
| Migration | Every existing offer keeps price, unit, comment, photos, state and visibility; names equal the product's Russian name. |
| Drafts privacy | A draft and its photos are never readable by another user or buyer. |
| Regression | Old seller URLs redirect; batch input still works. |

## 6. Acceptance criteria

1. Seller sections are `Витрина / Точки / Ещё`; the seller screens use the mockup fonts, color and tokens.
2. The source sheet shows the AI ways disabled with `Временно недоступно` and `Заполнить вручную` active.
3. A Seller publishes a card with a free name, price, unit and pack; the confirm shows the responsibility text verbatim;
   the card is on top of the showcase and a buyer finds it by a word of its name.
   Typing `бар` shows the catalog suggestion `Баранина`; choosing it and adding `, лопатка` links the card to the
   catalog, and a buyer query through a catalog alias finds it.
4. With 3 points the Seller publishes one draft into 2 of them with one own price: exactly 2 offers, correct prices.
5. `Изменить во всех точках` changes name/comment/photos everywhere and price only in checked points; a point with its
   own price stays unchanged unless checked.
6. `Изменить только в этой точке` changes only that point's price and `Вернуть общую цену` restores it.
7. A Seller adds a point to an existing card through `Изменить`; a new point is not added by itself.
8. `Сохранить черновик` keeps an incomplete card (photos and points included) in `Черновики`; it is not visible to
   buyers; opening and publishing it removes the draft.
9. Validation, submitting, submit error, discard confirm and conflict states behave as §2.
10. `Другое` accepts one word of letters only (1–20).
11. Cards without photo or comment show the incomplete reminder with `Дополнить`.
12. Existing offers migrate as §2; old seller URLs redirect.
13. All new strings exist in `ru` and `kk`; no clipping at 320 px; focus, keyboard, 44×44 px targets, §13.1 overlays.
14. Regression of S1–S13, #35, #36, offer-photos and point-contacts-hours stays green, with tests updated where this
    contract revises them.

## 7. Verification and manual acceptance

- Unit: name word-prefix matching and normalization; suggestion link kept or dropped as the text changes; unit/pack/`Другое` validation; editor state (dirty, required
  fields, per-point prices, checked points on edit); plural `карточка/карточки/карточек` in `ru` and `kk`.
- Integration: multi-point create and edit atomicity and revisions; own-price protection; one-point edit; adding a point
  to a card; drafts CRUD and ownership; search by words plus aliases; migration on a fixture of old offers.
- E2E (mobile + desktop, `ru` + `kk`): empty showcase → manual card with pack → publish → buyer finds it; 3 points,
  2 selected, own price; edit all with an own-price point; edit one point; draft save and resume; conflict; redirect of
  old URLs; batch input from `Ещё`.

Manual scenario: on a phone open «Моя витрина», `Сформировать карточки товаров` → `Заполнить вручную`, type `Курага`,
1 800 ₸ за `упак.`, 500 г, add a point from the form, publish. Add two more points in `Точки`. Create `Баранина,
лопатка` 5 000 ₸ / кг in two points with 5 200 ₸ in one of them. Change the common price to 4 800 ₸ — the own-price
point stays 5 200 ₸. Start a third card, save as draft, find it in `Черновики`, finish it. As a buyer search `баран`
and `курага`.

## 8. Product Owner decisions

1. Free name search — by words of the name plus catalog aliases (2026-09-27).
2. Drafts — in this slice, with `Сохранить черновик` and the `Черновики` tab (2026-09-27).
3. Seller screens take the mockup look now; buyer screens later (2026-09-27).
4. Product name — mixed: catalog suggestions while typing, own words allowed without waiting (2026-09-27). A complete
   list of all products cannot be prepared in advance; the catalog grows from real cards.
5. Earlier (`FEATURE_MAP.md` «Seller AI-first model»): sections `Витрина / Точки / Ещё`; name, price, `Цена за` and a
   point are required, photo and comment optional with a reminder; only price differs per point; a new point is not
   added to existing cards; no pre-moderation while AI is off, responsibility text on every publish; `Другое` is one
   word; dictation disabled `Временно недоступно`.

Approved defaults (2026-09-27, written into §2):

- a. Existing offers become one-point cards each, without automatic merging.
- b. Name length 2–80; `Своя единица` 1–20 letters.
- c. Drafts only for new cards, not for edits of published cards.
- d. Batch text input moves to `Ещё → Добавить списком`.
- e. A card without a chosen suggestion is silently linked to a catalog product when its whole name matches exactly
  one.
- f. Price must be greater than 0 (today 0 is accepted); existing offers with price 0 stay until edited.
- g. Word matching ignores 1-letter query words.

## Ревизия: search-word-forms (2026-10-07)

- h. Правило слова дополнено: слово запроса подходит названию также, когда оно — **другая грамматическая форма** слова названия по проверенному словарю форм (точное равенство формы; слова вне словаря — только по префиксу, как раньше; все слова запроса обязательны; язык интерфейса не участвует). См. `docs/slices/search-word-forms/SLICE_CONTRACT.md`.
