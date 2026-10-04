# First Entry — buyer start page (phone) — Slice Contract

**Status:** BUILT on the PO's order «Начинай» (2026-09-29) — the mockup is the source, existing code is fitted to it
(PO: «выкинь решения Pass 3, идём от эталона»). The design requests of §6 were decided as proposed there (navigation
stays under the strip, no location control on the start, column 480, the caption «Пример» stays); the PO asked not to
over-specify this page. Awaiting PO acceptance on a phone. **No search button anywhere except the mockup's `→`
in the field while it holds text** (the results bar has none); Enter / the phone's search key runs the query.

**UX target:** mockup version `1790680691-0123` (`docs/product/mockup/seller-ai-first-rev1/`, `PROJECT_RULES.md`
§18.1), page FIRST ENTRY: `FE0` (handoff), `FEA1` (screens FE-M 1–6), `FEA3` (storyboard and timing), `FEPA` (live
demo), `fe.css` (mobile and live-demo rules). Mandatory UI rules: `PROJECT_RULES.md` §18.4. The desktop frames (`FEB2`,
`FEB3`, `FEPB`, layout ≥ 1280 px) are **not** part of this slice (PO, 2026-09-29).

**Base:** `main` after PR #63 (buyer screens).

**Revised by `docs/slices/first-entry-correction/SLICE_CONTRACT.md` (PO, 2026-10-04).** Superseded clauses of this contract:

- §2 «The route is `/`» — First Entry is `/welcome`; `/` is the ordinary Search.
- §2 Layout, Header «No `РУС / ҚАЗ` switch — the language is chosen once at the first visit» — First Entry carries the
  language switch as in mockup `FEA1`; there is no separate language screen.
- §2 Search, «Popular-query chips leave the start screen … stay under an empty result» — superseded for the ordinary
  Search by the Search Home slice.
- §4 AC 1 «without the language switch» and AC 7 «the language is the one chosen in the language gate».
- §6 item 2 «Language switch in the header: removed».

Everything else (layout, example fixture, demo animation, `kaida_fe_demo_seen`, `→` rule, geolocation, seller strip)
stays valid and moves to `/welcome` as described there.

## 1. User task

A Buyer opens the service and understands in a few seconds what it does: one query shows several nearby sellers,
with price, distance and freshness. Then they search for real, without signing up.

## 2. Scope and exact behavior

The route is `/` (the buyer search start). The results screen (`/?q=…`, AI-B01) is unchanged.

### Layout (FE-M)

- Header: logo `KAIDA` (left). **No `РУС / ҚАЗ` switch** — the language is chosen once at the first visit and changed in
  «Ещё» (PO decisions 2026-09-29, `PROJECT_RULES.md` §18.4); no `/ru` or `/kk` addresses.
- Title (working, the final slogan is designer's): `Найдите, где это продают рядом.` in three lines, subtitle
  `Актуальные предложения продавцов, цены и расстояние до товара.`
- The search field: a real `<input>` with `aria-label` «Поиск товара» (60 px high, radius 16). Placeholder
  `Что ищете?`; below it `Без регистрации` (static text with a check icon).
- Under it the caption `Пример · так выглядит результат` and **two example cards** (§ Example).
- Bottom: the strip `Разместить товар` (the seller entry, secondary) — opens the existing contextual seller sign-in
  (`useSellerEntry`, AI-S03).
- Buyer bottom navigation `Поиск / Рядом / Ещё` — see §6.1.
- Phone column as the rest of the buyer screens; 20 px side padding from 360 px; no horizontal scroll from 320 px;
  Russian and Kazakh lines fit (FE-M 6: the title takes 3 lines, both cards fit above the bottom strip).

### The example (a fixture, not data)

- Two cards of the AI-B01 form in the state «Пример»: `Баранина, лопатка` · `4 200 ₸ / кг` · `Мясная лавка «Береке»` ·
  `850 м от вас` · badge `Сегодня`; and `Баранина, рёбра` · `3 900 ₸ / кг` · `Зелёный базар · место 35А` · `1,4 км от
  вас` · badge `2 дня`. Photos are the drawn illustrations of the mockup (kept as they are — PO 2026-09-29).
- It is a **static fixture in the front end**, the same for everyone; no API request, no database. `Маршрут` and the
  contact icons are inactive. The block is `aria-hidden` and outside the Tab order (the keyboard goes straight to the
  field). A tap on any part of an example card puts the cursor in the field.
- The example never ranks, links or counts as a real offer. The distances are part of the fixture (no location is
  read for it).

### Demo animation (FEA3, `fe.css` `.fe-live`)

- **First visit only, once (≈ 3.5 s):** the title lines rise from a mask (80 ms step), the placeholder types
  `баранина` (the field value stays empty), a wave runs along the field, card 1 then card 2 appear (350 ms apart), the
  distance arcs draw, the freshness badges land one after the other. It stops on the last readable frame; no pause
  button (shorter than 5 s, WCAG 2.2.2).
- Flag `kaida_fe_demo_seen` in `localStorage` is set when the demo starts. If `localStorage` is unavailable the demo does
  not play (the final frame is shown).
- **Repeat visits and `prefers-reduced-motion`:** the final frame at once, no motion, placeholder `Что ищете?`
  (FE-M 5).
- **Interrupt:** `pointerdown` / `focus` / `keydown` in the field, or a tap on an example card → the demo stops, the
  example is hidden, the field is focused and empty, the placeholder is `Что ищете?` (FE-M 3). The tab going to the
  background during the demo → the final frame.
- The animated placeholder is not announced to screen readers (no `aria-live`).

### Search (real)

- There is **no permanent search button**. A round `→` button appears in the field only while the trimmed value is not
  empty (FE-M 4). `Enter` or `→` opens the results (AI-B01) for the typed query; an empty query is not sent.
- Popular-query chips leave the start screen (the example takes their place). They stay where the previous contract
  put them: under an empty result, an error and an empty submit on the results screen.
- The page for a query, the results, the offer page, «Рядом» and «Ещё» work as they do now.

### Geolocation

- Not requested when the page opens, and the start screen carries no location control. The location is asked only when
  the buyer chooses it: on «Рядом» and by the existing control of the results screen (§6.3).

## 3. Not in scope

- Desktop (≥ 1280 px, `FEB2` / `FEB3` / `FEPB`): the start page keeps the phone column there until that design is
  accepted. Dark theme, recent queries on repeat visits (not designed), the final slogan, real product photos, native
  review of the Kazakh strings (§18.3 deferral stays), live search-as-you-type, «popular from real queries» (the search
  analytics slice), the promo banner slot.
- No new endpoint, no migration, no change in search ranking or in any closed contract.

## 4. Acceptance criteria

1. The mobile start page matches FE-M 1, 2, 3, 4, 5 (screenshots at 360 and 390 px), without the language switch.
2. First visit: the demo plays once (≈ 3.5 s) and stops; the second visit and reduced motion show the final frame; no
   `localStorage` → final frame.
3. Focus, keydown or a tap on an example card stops the demo, hides the example and focuses the empty field.
4. `→` exists only with text; Enter/→ searches; an empty query sends nothing; the results are the current AI-B01.
5. The example is not focusable, not announced, and its `Маршрут` / contacts do nothing.
6. `Разместить товар` opens the seller sign-in as before; nothing is asked from the device on open.
7. Russian and Kazakh from 320 px: no cut text, no horizontal scroll; the language is the one chosen in the language
   gate.

## 5. Verification

Unit: the demo-state rule (first visit / seen / no storage / reduced motion). E2E (mobile): first visit and repeat,
interrupt by focus/tap/key, the `→` button, empty submit, seller entry, both languages at 320 px; existing E2E helpers
that use the old start form (label `Какой товар ищете?`, button `Искать`, chips) are updated. Manual acceptance on a
phone (the feel of the animation). `pnpm verify` green.

## 6. Design gaps and permission requests (`PROJECT_RULES.md` §18.1)

1. **Bottom navigation.** The frames have no `Поиск / Рядом / Ещё`; without it the buyer cannot reach «Рядом», «Ещё»
   and the language. **Request:** permission to keep the buyer navigation under the `Разместить товар` strip
   (the strip moves above it), or a design frame.
2. **Language switch in the header:** removed by the PO's decisions (recorded); the header shows only the logo.
3. **Location on the results screen and on the start.** The frames have no pin/checkbox. **Request:** confirm that the
   existing location control stays only on the results screen and «Рядом», and the start has none.
4. **Column width.** The mockup says «from 600 px a column of max 560 centred»; the app's buyer column is 480.
   **Request:** keep 480 as on all buyer screens.
5. **`aria-hidden` example under a real title:** the accessible name of the page is the title and the field; the
   example caption `Пример · так выглядит результат` stays visible text. Confirm.
