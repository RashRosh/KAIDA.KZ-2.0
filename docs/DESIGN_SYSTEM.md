# KAIDA.KZ 2.0 — Design System v1.1

**Назначение:** источник истины по visual language и presentation rules KAIDA.KZ.  
**Execution order:** не здесь; см. `docs/product/EXECUTION_PLAN.md`.  
**UX references:** `docs/product/UX_REFERENCE_INDEX.md`.

## 0. Source priority

Design System не меняет product behavior самостоятельно.

При конфликте:

1. фактический closed contract / approved current Slice Contract;
2. `docs/PROJECT_RULES.md` и stable architecture/privacy boundaries;
3. explicit Product Owner decision;
4. этот Design System — visual/presentation rules;
5. relevant UX references из `UX_REFERENCE_INDEX.md`;
6. общие conventions исполнителя.

Внешние UX-гайды — advisory evidence. Использовать `KEEP / ADAPT / REJECT / GAP`; generic e-commerce pattern не имеет права молча менять KAIDA contract.

Токены/компоненты внедряются только по scope открытого slice. Не рефакторить весь UI «под систему» без user task.

## 1. Product UI frame

KAIDA.KZ — не checkout-магазин. Пользователь находит, **где товар есть сейчас**, и связывается с Seller напрямую.

UI priorities:

1. **Свежесть** — Offer должен ясно сообщать актуальность, когда соответствующий product contract доступен.
2. **Product + price** — основная коммерческая информация читается первой.
3. **Location / distance** — место покупки важнее декоративной информации о Seller.
4. **Buyer action** — звонок / messenger / route, а не корзина.
5. **Geo accelerates but never blocks** — geolocation только после explicit user action согласно closed privacy contract.
6. **Working interface over landing page** — меньше explanatory/decorative hero, выше information density там, где user уже пришёл решать задачу.
7. **Technical domain entities stay internal** — ordinary UI использует язык пользователя, а не `SellerChangeSet`, IDs и status codes, если Slice Contract не требует обратного.

## 2. Tokens

Global tokens живут в `src/app/globals.css :root`. Новые components не плодят literal colors/radii/durations, если существует подходящий token.

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

- decorative border → `--border`; interactive control → `--border-strong` / `--primary`;
- state never communicated only by color;
- green/amber reserved for truthful freshness/status semantics, not fake urgency;
- promoted Offers do not get an attention color that visually overrides organic relevance.

### 2.2 Typography

Target UI family: **Roboto**, Cyrillic-capable, working weights `400 / 600 / 700 / 800`.

Browser runtime must receive font as app-hosted asset; no runtime dependency on Google Fonts or another external font CDN.

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

Comparable numbers use `font-variant-numeric: tabular-nums`. Full uppercase is not a general styling technique.

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

Mobile page side padding `20px`; desktop `48px`. Vertical rhythm принадлежит containers/gap, а не случайным margins элементов.

### 2.4 Radii / borders / shadows

```css
--radius-sm: 0.5rem;  /* 8px */
--radius: 0.75rem;    /* 12px */
--radius-lg: 1rem;    /* 16px */
--radius-xl: 1.25rem; /* 20px */
--radius-full: 999px;
--border-width: 1px;

--shadow-card: 0 1px 2px rgba(37, 29, 51, 0.06);
--shadow-sticky: 0 -2px 12px rgba(37, 29, 51, 0.08);
--shadow-pop: 0 8px 24px rgba(37, 29, 51, 0.12);
```

Default card separation — border; decorative heavy shadows не являются базовым паттерном.

### 2.5 Motion / layers

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

## 3. Responsive layout

Breakpoints:

- `48rem / 768px` — md;
- `64rem / 1024px` — lg;
- `80rem / 1280px` — xl.

Representative verification widths: **360, 390, 768, 1024, 1440**. Minimum supported width: **320px**. Page-level horizontal scrolling запрещён.

Content container: `max-width: 80rem`, centered. Mobile side padding `20px`, desktop `48px`.

Primary header target height: `84px` mobile / `104px` from 768px. Header/search/account controls must fit without overlap or route-induced horizontal jumps.

Sticky header на mobile не является default. `position: sticky` вводится только если конкретный Slice Contract обосновывает persistent action/search need.

## 4. Base controls

### Buttons

Variants: `primary`, `secondary`, `ghost`, `danger`.

Один dominant primary action на один видимый decision context.

- minimum touch target: `44x44px`;
- standard height: `2.75rem`;
- large primary: `3.5rem`;
- loading disables duplicate action and uses process text (`Ищем…`, `Сохраняем…`).

Unavailable action требует понятного объяснения, не только disabled styling.

### Search

Сохранять closed Search semantics: explicit submit/Enter, loading protection, validation/error/status/ARIA wiring.

Search placement должен быть стабильным. Не дублировать Search внутри одного viewport без конкретной user-task причины.

Sort/filter UI остаётся компактным; exact options/geo trigger определяет Search Slice Contract.

### Forms

Если допустимые значения известны системе, использовать controlled choice вместо свободного текста.

- units/short enums → select/chips/controlled option;
- address → address search/autocomplete, когда capability существует;
- free text только для реально произвольного значения.

### Auth modal

Modal auth должен:

- удерживать focus внутри dialog;
- блокировать background scroll;
- иметь явное close/cancel behavior;
- сохранять caller intent/return destination, если это входит в Slice Contract;
- не добавлять лишний промежуточный login page, если user уже выразил понятное действие и contract допускает modal.

## 5. Marketplace cards

Cards должны быть task-first, а не admin-table-first.

### Buyer Offer card hierarchy

Текущая целевая иерархия по мере наличия данных:

1. media / visual identity, если честно доступна;
2. Product name;
3. price + unit semantics;
4. freshness label/state, когда contract доступен;
5. Location/address/distance, когда contract доступен;
6. seller comment;
7. Seller/contact actions.

Карточка не становится автоматически одной giant link. Явные actions остаются явными.

### Price

Mandatory Offer Price закрыт как product contract.

Buyer-facing publishable Offer без `price.amount` быть не может.

Presentation:

- `4 200 ₸ / кг`, если unit задан;
- `4 200 ₸`, если `unit = null` и цена относится к Offer/лоту/упаковке;
- `0 ₸` является допустимой ценой;
- не подменять отсутствующее/невалидное значение `по запросу`, dash или invented text.

Старое presentation rule `Цена не указана` для publishable buyer Offer больше не является целевым состоянием.

### Temporary media before M1

Product Owner разрешил **temporary/demo/placeholder media presentation до M1**, если это помогает честно проектировать card/layout UX.

Boundary:

- demo/placeholder нельзя выдавать за seller-uploaded media;
- не создавать upload/storage/API/lifecycle semantics до M1;
- production business behavior не зависит от demo media;
- temporary asset должен быть нейтральным или явно fixture/demo;
- он не создаёт fake rating, fake promotion, fake seller evidence или fake product availability;
- M1 остаётся владельцем real seller Offer photos end-to-end.

После M1 целевой fallback order определяется real media contract; базовое направление: `Offer primary media → Product canonical image/icon → neutral fallback`.

M2 video — только после отдельного product decision.

## 6. Buyer screens

Рабочие buyer surfaces должны отдавать priority content/result, а не выглядеть как landing page после того, как intent уже известен.

- Search: prominent, stable, results-oriented;
- Nearby: normal navigation intent не должен тратить первый экран на повторное объяснение той же задачи; exact correction принадлежит Issue/Slice #34;
- Discovery: no fake personalization before supporting contract;
- contact/route actions должны быть легко доступны и не смешиваться с декоративным UI.

Geo permission запрашивается только после explicit user action. Buyer coordinates не становятся display/profile state без отдельного contract.

## 7. Seller UI

Seller workspace строится вокруг понятных пользователю объектов:

- торговые точки;
- товары / Offers;
- freshness/action states.

В ordinary manual UI не использовать technical ChangeSet vocabulary как основную навигацию/mental model. SellerChangeSet остаётся внутренней architecture boundary и не обходится.

Card-based workspace предпочтительнее spreadsheet/admin-console presentation для повседневного seller management, если Slice Contract не доказывает обратное.

При first-run user должен видеть понятные next actions, а не длинный технический onboarding ради самого onboarding. Точное поведение принадлежит Issues #35/#36/#27 и их Slice Contracts.

## 8. Freshness presentation

Не придумывать live timers или status codes.

Когда freshness contract реализован, показывать понятный relative age (`сегодня`, `вчера`, `обновлено 3 дня назад`) в границах product policy.

State никогда не передаётся только цветом.

Green/amber tokens могут поддерживать fresh/ageing semantics, но текст остаётся обязательным.

## 9. Reviews / Rating

Reviews/rating — deferred capability, не вечный запрет.

До real data/moderation contract:

- no fake stars;
- no invented score;
- no reputation inference из unrelated data;
- no empty review widgets «на будущее».

## 10. Monetization presentation

Volume subscription, seller convenience и Offer promotion — разные axes.

Promotion, когда появится:

- не обходит eligibility/relevance/freshness;
- маркируется честно и нейтрально;
- не использует fake urgency/visual domination.

Не проектировать monetization UI раньше соответствующего slice.

## 11. Accessibility

Baseline: WCAG 2.1 AA.

- visible `:focus-visible`;
- keyboard order соответствует visual order;
- visible labels у forms;
- существующие `role=status`, `role=alert`, `aria-live`, `aria-invalid`, `aria-describedby` не ослабляются без contract reason;
- touch target >= `44x44px`;
- `<html lang="ru">`;
- motion respects `prefers-reduced-motion`;
- state не зависит только от color;
- icon-only action обязательно имеет понятный accessible name.

## 12. Iconography

Один linear SVG style: `24x24`, stroke примерно `1.5–2`, `currentColor`.

Decorative icons рядом с text — `aria-hidden`.

Icon-only control допустим только при однозначной метафоре + `aria-label`.

Не использовать как product metaphors без соответствующей capability: basket/order, delivery, fake discount tags, fire/lightning urgency.

Messenger logos — official brand assets, когда они реально нужны.

## 13. Permanent guardrails

Без отдельного product contract не вводить:

- cart/order/payment/delivery/internal chat;
- fake reviews/ratings;
- automatic hidden geolocation;
- public raw buyer/seller coordinates;
- infinite scroll «по привычке»;
- gratuitous carousels;
- emoji-as-core-UI;
- accidental dark theme;
- animations beyond motion scale;
- UI-kit/Tailwind migration как побочный эффект;
- global state manager для локальной формы/request;
- fake seller media semantics до M1.

## 14. UX reference usage

Перед UI/UX Slice Contract:

1. прочитать closed/current product contract;
2. прочитать relevant sections этого Design System;
3. открыть только релевантные entries из `UX_REFERENCE_INDEX.md`;
4. классифицировать external recommendations как `KEEP / ADAPT / REJECT / GAP`;
5. GAP, меняющий продукт или closed contract, вернуть Product Owner до implementation.

UX reference не является основанием для scope creep.

## 15. UI completion checklist

Перед завершением UI slice проверить:

1. relevant Design System + UX references просмотрены;
2. colors/radii/durations используют tokens;
3. spacing следует 4px system и responsive padding;
4. нет horizontal overflow на 360/390/768/1024/1440;
5. primary task читается на первом viewport без лишнего explanatory layer;
6. keyboard/focus/touch targets работают;
7. closed text/API/privacy behavior не изменены молча;
8. media/reviews/monetization представлены только честно в рамках доступных contracts;
9. targeted UI/E2E проверяет изменённую boundary;
10. branch CI + manual acceptance выполнены перед merge для product UI slice.
