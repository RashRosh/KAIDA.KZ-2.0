# KAIDA.KZ 2.0 — Design System v1.0

**Назначение:** источник истины по визуальному языку и интерфейсным правилам KAIDA.KZ.  
**Актуализировано:** 15 сентября 2026.  
**Verified base при принятии:** `v0.0.14-s13`, `main = ff8bd7ee`.

Документ нормализован из утверждённой Product Owner дизайн-системы. Текущий verified state проекта всегда берётся из репозитория, а не из исторической строки статуса внутри дизайн-документа.

## 0. Приоритет и применение

При конфликте источников:

1. `docs/slices/<slice>/SLICE_CONTRACT.md` и закрытые slice contracts — поведение, тексты, API, privacy/business semantics;
2. `docs/PROJECT_RULES.md` и Technical Foundation;
3. этот Design System — visual language, tokens, layout, spacing, responsive rules, presentation states;
4. общие представления исполнителя о том, «как обычно делают».

Design System не имеет права самостоятельно менять закрытое поведение, публичный API, business rule, тексты ошибок или ARIA semantics. Если визуальное решение требует contract change — STOP и отдельное согласование.

Токены и компоненты внедряются **только по мере открытых slices**. Нельзя рефакторить весь UI или создавать компоненты «на будущее» только потому, что они описаны здесь.

### Решения Product Owner, уточнившие исходный документ

- UI-шрифт: **Roboto** вместо Manrope / Plus Jakarta Sans;
- radii: системная шкала **8 / 12 / 16 / 20px** по назначению; временное решение `3px` отменено до закрытия UX1A;
- primary header: **84px mobile / 104px desktop (>=768px)**; route navigation не должна вызывать horizontal layout shift;
- UX1B не резервирует fake media slots; реальный media layout появляется в M1 вместе с media model/data;
- reviews/rating — запланированная capability, а не вечный запрет; до отдельного slice нельзя показывать фиктивный рейтинг без данных.

---

## 1. Продуктовая рамка UI

KAIDA — не магазин. Пользователь находит, где товар есть **сейчас**, и связывается с продавцом напрямую.

1. **Свежесть важнее полноты.** Offer должен давать понять, насколько недавно продавец его подтверждал, когда соответствующее UI-представление будет введено своим slice.
2. **Место важнее доставки.** Точка продажи и расстояние визуально важнее имени продавца.
3. **Действие — контакт, а не заказ.** Корзины в текущей модели нет; целевое действие — звонок/мессенджер.
4. **Гео — ускоритель, не шлагбаум.** Интерфейс работает без geolocation; запрос координат только по явному действию пользователя и в границах закрытых geo contracts.
5. **Продвижение не ломает органическую релевантность.** Promotion — будущая capability и не даёт права обходить relevance/freshness filters.

---

## 2. Tokens

Все глобальные tokens живут в `src/app/globals.css :root`. Компоненты не должны плодить literal colors/radii/durations. Component-specific dimensions допустимы локально.

### 2.1 Color

```css
--background: #faf9fc;
--bg: var(--background);
--surface: #ffffff;
--surface-sunken: #f2eff7;
--text: #251d33;
--muted: #696171;
--border: #ddd7e4;
--input-border: #81768c;
--border-strong: var(--input-border);
--primary: #6736bd;
--primary-hover: #51299a;
--primary-soft: #f3edfd;
--primary-disabled: #76618f;
--error: #9c253d;
--danger: var(--error);
--error-soft: #fdecef;
--fresh: #1f7a53;
--fresh-soft: #e6f5ee;
--stale: #8a5a00;
--stale-soft: #fdf3e2;
--neutral-label: #5b5568;
--neutral-soft: #efedf3;
```

Rules:

- `--border` — decorative border only; interactive controls use `--border-strong` / `--primary`;
- state is never communicated only by color; text/icon semantics remain necessary;
- green/amber are reserved for freshness semantics, not fake discounts or urgency;
- promoted Offers do not get a special attention color.

### 2.2 Typography

Primary family: **Roboto**, Cyrillic-capable, working weights `400 / 600 / 700 / 800`.

Runtime rule: browser must receive the font as an app-hosted static asset; no runtime request from the user's browser to Google Fonts or another external font service. Current Next.js wiring may use `next/font`, which emits self-hosted build assets.

```css
--font-sans: var(--font-roboto), system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
```

Type scale:

| role | size / line-height | weight |
|---|---|---:|
| display | `clamp(2rem, 5vw, 3.25rem)` / 1.1 | 800 |
| h1 | `1.75rem` / 1.2 | 800 |
| h2 | `1.375rem` / 1.3 | 700 |
| h3 | `1.125rem` / 1.35 | 700 |
| body | `1rem` / 1.5 | 400 |
| body-sm | `0.875rem` / 1.45 | 400 |
| caption | `0.8125rem` / 1.4 | 600 |
| label | `0.875rem` / 1.2 | 600 |
| price | `1.375rem` / 1.2 | 700 |
| price-lg | `1.75rem` / 1.15 | 800 |

Comparable numbers use `font-variant-numeric: tabular-nums`. Normal body line length is capped around `42rem`, product description around `38rem`. Full-uppercase UI text is not a general styling technique.

### 2.3 Spacing

4px base step:

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-5: 1.25rem;
--space-6: 1.5rem;
--space-7: 1.75rem;
--space-8: 2rem;
--space-10: 2.5rem;
--space-12: 3rem;
--space-16: 4rem;
```

Mobile page side padding `20px`; desktop `48px`. Vertical rhythm is owned by containers/gaps, not arbitrary element margins.

### 2.4 Radii, borders, shadows

```css
--radius-sm: 0.5rem;  /* 8px: chips, badges, small controls */
--radius: 0.75rem;    /* 12px: inputs, normal buttons, secondary blocks */
--radius-lg: 1rem;    /* 16px: Offer/card surfaces */
--radius-xl: 1.25rem; /* 20px: large panels/media */
--radius-full: 999px;
--border-width: 1px;

--shadow-card: 0 1px 2px rgba(37, 29, 51, 0.06);
--shadow-sticky: 0 -2px 12px rgba(37, 29, 51, 0.08);
--shadow-pop: 0 8px 24px rgba(37, 29, 51, 0.12);
```

Default card separation is border, not decorative shadow.

### 2.5 Motion and layers

```css
--dur-fast: 120ms;
--dur: 160ms;
--dur-slow: 240ms;
--ease: cubic-bezier(0.2, 0, 0.2, 1);
--z-base: 0;
--z-sticky: 10;
--z-overlay: 20;
--z-toast: 30;
```

Animate only `opacity`, `transform`, `background-color`, `border-color`, `color`. Respect `prefers-reduced-motion`.

---

## 3. Responsive layout

Breakpoints:

- `48rem / 768px` — md;
- `64rem / 1024px` — lg;
- `80rem / 1280px` — xl.

Representative verification widths: **360, 390, 768, 1024, 1440**. Minimum supported width: **320px**, no page-level horizontal scroll.

Content container: `max-width: 80rem`, centered. Mobile side padding `20px`, desktop `48px`.

Primary header height: `84px` mobile, `104px` from 768px. This is a visual contract; scrollbar/auth/context differences must not shift desktop navigation horizontally. Mobile navigation may be a separate shell row when needed to preserve 44px touch targets.

No sticky header on mobile. `position: sticky` is reserved for flows that explicitly need it (for example future contact/search panels according to their slice).

---

## 4. Base controls

### Buttons

Variants: `primary`, `secondary`, `ghost`, `danger`. One dominant primary action per visible decision context.

Minimum touch target: `44x44px`. Standard button height `2.75rem`; large primary action `3.5rem`. Small controls use `--radius-sm`, normal controls use `--radius`.

Loading disables repeated action and changes text to a process verb (`Ищем…`, `Сохраняем…`). A genuinely unavailable action requires an explanation, not only gray styling.

### Search field

Keep closed S0 semantics: visible label, explicit form submit, Enter works, loading prevents duplicate submit, validation/error/status preserve existing strings and ARIA wiring.

Field/search-button height `3.5rem`; interactive border `--border-strong`; radius `--radius`.

### Geo control

Closed S9/S11 privacy semantics win over visual design. Geolocation is requested only after explicit user action and never becomes a hidden prerequisite for Search.

### Interest

Closed S13 strings/semantics stay unchanged. `aria-pressed` remains part of the contract.

---

## 5. OfferCard direction

Offer is the central buyer-facing unit. UX1B may redesign the existing card hierarchy/density, but **must not invent media before M1**.

Target information hierarchy once the relevant data/UI slices exist:

1. freshness;
2. Product name;
3. price / `Цена не указана`;
4. Location + address + distance when distance is server-provided;
5. Seller;
6. Seller comment;
7. interest / contact actions.

A whole card is not automatically one giant link. Existing explicit actions remain explicit.

### Media boundary

Before M1: no fake thumbnail, gray media rectangle, placeholder or reserved media column merely “for the future”.

M1 introduces real Offer photos end-to-end and the corresponding media layout. Product gets its own canonical image/icon by separate data decision. After M1, desired buyer priority is:

`Offer primary media → Product image/icon → neutral fallback`.

M2 extends this with video only if needed.

---

## 6. Formatting rules

- Price example: `4 200 ₸ / кг`; no price → `Цена не указана`.
- Do not substitute `0`, dash or invented `по запросу` for missing price.
- Distance is shown only when the server contract returns it; buyer coordinates are never displayed.
- Relative freshness text does not invent a live timer.
- Formatting must reuse closed implementations/contracts where they already exist rather than silently replacing them.

---

## 7. Buyer screens

### Home/Search

The UI should move away from a landing-page feel toward a working marketplace/search interface: less decorative empty space, stronger search prominence, useful content density. Exact card redesign is UX1B, not UX1A.

### Nearby

Existing S11 behavior remains until UX1C. The redundant second confirmation is planned UX1C; UX1A only provides stable navigation entry and must not trigger geolocation automatically.

### Interests / For You

S13 behavior remains closed. S14 starts only after UX1A → UX1B → UX1C → UX2 → M1/M2 sequence agreed by Product Owner.

---

## 8. Seller UI

Seller never bypasses Seller Change Set when changing Offers. UI reorganization must not merge or bypass domain boundaries.

UX2 will address seller onboarding/setup density and the single coherent user journey for Seller + Location + contacts. UX1A only supplies a clear seller entry and a shared shell.

Controlled choices are preferred where valid values are known. Address is autocomplete/search, not a simplistic dropdown. These are UX2/later form decisions, not UX1A scope.

---

## 9. Reviews / Rating

Reviews and Seller rating are **planned KAIDA.KZ capabilities**, not permanent bans.

Until dedicated slices define data, moderation and UI semantics:

- do not draw fake stars or ratings;
- do not infer reputation from unrelated data;
- do not add review UI “for future use”.

When implemented, existing product decisions still apply, including review media and moderation requirements; those details belong in their own Slice Contracts.

---

## 10. Monetization presentation

Volume limits, seller convenience and Offer reach are separate monetization axes. Subscription and promotion must not be conflated in UI or architecture.

Promotion is future work and must remain visually honest: same eligibility/relevance/freshness constraints as organic results, explicit neutral labeling, no fake urgency or visual dominance.

Do not implement monetization UI before the corresponding slices/contracts.

---

## 11. Accessibility

Baseline: WCAG 2.1 AA.

- visible `:focus-visible` outline stays;
- keyboard flow follows visual order;
- visible labels on form controls;
- existing `role=status`, `role=alert`, `aria-live`, `aria-invalid`, `aria-describedby` semantics are not weakened;
- minimum touch target `44x44px`;
- `<html lang="ru">`;
- motion respects `prefers-reduced-motion`;
- no state relies on color alone.

---

## 12. Iconography

Use one linear SVG style (`24x24`, stroke roughly `1.5–2`, `currentColor`). Decorative icons with text are `aria-hidden`; icon-only actions need `aria-label` and are allowed only when meaning is unambiguous.

Permanent non-product icon metaphors include basket/order, delivery, fake discount tag, fire/lightning urgency. A **rating star is not permanently forbidden**, but it is not used before a real Reviews/Rating slice establishes truthful rating data.

Messenger logos, when introduced, come from official brand assets; until then text labels are acceptable.

---

## 13. Current permanent/temporary prohibitions

### Product capabilities not to invent without a slice

No cart/order/payment/delivery/internal chat or other capability absent from the current product contracts. Reviews/rating are specifically **deferred, not banned**.

### UI patterns

No page-level horizontal scrolling, auto geolocation, infinite scroll as an incidental choice, fake urgency, accidental dark theme, gratuitous carousels, icon fonts, emoji-as-UI, or animations longer than the motion scale.

### Technical

No Tailwind/UI-kit migration as a side effect, no global state manager for a local request, no client persistence of buyer coordinates beyond closed geo rules, no public seller coordinates, no literal colors/radii sprinkled through new CSS modules when a token exists.

---

## 14. Slice mapping

- `UX1A`: Roboto baseline, design tokens needed now, shared shell/navigation, header `84/104`, stable nav geometry, seller entry.
- `UX1B`: buyer marketplace-card density/layout **without fake media slots**.
- `UX1C`: Nearby explicit-intent cleanup.
- `UX2`: seller onboarding/setup flow cleanup and relevant controlled inputs.
- `M1`: Offer photos end-to-end + real media layout.
- `M2`: video extension if necessary.
- `S14`: For You after the corrective UX/media sequence.
- Reviews/Rating: later dedicated slices; not implemented speculatively.

---

## 15. UI commit checklist

Before calling a UI slice complete:

1. colors/radii/durations come from tokens;
2. spacing follows the 4px system and responsive page padding;
3. no horizontal overflow at 360, 390, 768, 1024, 1440;
4. closed texts and ARIA semantics are preserved unless the Slice Contract explicitly changes them;
5. keyboard/focus behavior remains usable;
6. no future component is implemented merely because it appears in Design System;
7. media is not faked before M1;
8. reviews/rating are not faked before their slice;
9. relevant targeted E2E proves the changed visual/interaction boundary;
10. final executable branch head has green full CI and manual acceptance before merge.
