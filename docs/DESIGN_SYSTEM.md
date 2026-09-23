# KAIDA.KZ 2.0 — Design System

Этот документ является источником истины по **visual language и presentation rules** KAIDA.KZ.

Он не владеет execution order, business contracts или current checkpoint. Текущая очередь — `docs/product/EXECUTION_PLAN.md`; точное поведение slice — его Slice Contract.

## 0. Приоритет и применение

При UI/UX работе:

1. closed contracts и утверждённый текущий Slice Contract определяют поведение/API/privacy/business semantics;
2. `docs/PROJECT_RULES.md` определяет process и stable boundaries;
3. explicit Product Owner decisions определяют утверждённые product/UX revisions — включая актуальную цепочку UX-reset artifacts из `PROJECT_RULES.md` §18.1; исторический набор из 42 кадров сам по себе больше не является прямым implementation target;
4. этот Design System определяет visual/presentation rules и приводится в соответствие с этой UX-целью по мере редизайна каждой области;
5. `docs/product/UX_REFERENCE_INDEX.md` и прочие внешние references дают advisory evidence; исторические внутренние wireframe exports применяются только через authority lifecycle из `PROJECT_RULES.md` §18.1;
6. общие привычки исполнителя идут последними.

Design System не имеет права самостоятельно менять closed business/data contract. Если конкретный экран вайрфрейма требует новой бизнес-механики, которой нет ни в одном closed contract — STOP и explicit вопрос Product Owner по `PROJECT_RULES.md` §18.1, прежде чем реализовывать эту механику.

Tokens/components вводятся только когда нужны открытому slice. Не рефакторировать весь UI «ради системы».

## 1. Продуктовая рамка UI

KAIDA — не интернет-магазин. Пользователь находит, где товар есть **сейчас**, и связывается с продавцом напрямую.

- **Свежесть важнее декоративной полноты.** Когда freshness UI введён соответствующим contract, возраст подтверждения должен быть понятен пользователю.
- **Location важнее доставки.** Точка продажи/расстояние важнее имени Seller.
- **Buyer action — контакт/маршрут, не checkout.** Корзины и заказа в текущей модели нет.
- **Geo — ускоритель, не шлагбаум.** Browser location запрашивается только после explicit user intent и в границах closed privacy contracts.
- **Marketplace density вместо landing-page пустоты.** Search/result screens должны быстро выводить пользователя к полезному контенту.
- **Promotion не ломает organic relevance/freshness.** Future promoted presentation остаётся честно маркированной.

## 2. Tokens

Глобальные tokens живут в `src/app/globals.css :root`. Новые компоненты не должны плодить literal colors/radii/durations, если соответствующий token уже существует.

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
- state never communicates only by color;
- green/amber reserved for truthful freshness/status semantics, not fake urgency;
- promoted Offers do not get an attention-grabbing relevance-breaking color.

### 2.2 Typography

Primary UI family: **Roboto**, Cyrillic-capable. Working weights: `400 / 600 / 700 / 800`.

Browser получает app-hosted static font assets; runtime request к Google Fonts/другому внешнему font service не нужен.

```css
--font-sans: var(--font-roboto), system-ui, -apple-system, 'Segoe UI', Arial, sans-serif;
```

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

Comparable numbers use `font-variant-numeric: tabular-nums`.

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

Mobile page side padding `20px`; desktop `48px`. Vertical rhythm принадлежит container/gap, а не случайным margins.

### 2.4 Radii, borders, shadows

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

Default card separation — border, не декоративная тень.

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

## 3. Responsive layout

Breakpoints:

- `48rem / 768px` — md;
- `64rem / 1024px` — lg;
- `80rem / 1280px` — xl.

Representative verification widths: **360, 390, 768, 1024, 1440**. Minimum supported width: **320px**. Page-level horizontal scroll запрещён.

Content container: `max-width: 80rem`, centered. Primary header: `84px` mobile / `104px` from 768px unless explicit later Slice Contract revises it.

Route/auth/context differences не должны вызывать accidental horizontal layout shift.

Sticky header не является default на mobile. `position: sticky` вводится только когда конкретный flow это обосновывает.

## 4. Base controls

### Buttons

Variants: `primary`, `secondary`, `ghost`, `danger`.

- minimum touch target `44x44px`;
- standard height `2.75rem`;
- large primary action `3.5rem`;
- один dominant primary action на один visible decision context;
- loading блокирует repeated submit и показывает process verb (`Ищем…`, `Сохраняем…`).

Icon-only action допустим только при очевидной semantics и с `aria-label`.

### Search

Closed Search semantics сохраняются, пока отдельный Slice Contract их не пересмотрит:

- explicit submit;
- Enter работает;
- loading предотвращает duplicate submit;
- validation/status/ARIA не ослабляются.

Global Search submit использует компактный icon-only directional control по закрытому UX2A behavior.

Search sorting/proximity controls принадлежат отдельным Search Sorting contracts; Design System не вводит standalone geo toggle сам по себе.

### Geo

Geolocation никогда не становится скрытым prerequisite для обычного Search. Browser permission запрашивается только после explicit user intent.

### Controlled inputs

Когда допустимое множество реально известно системе, controlled choice предпочтительнее свободного ввода. Точный control определяется current Slice Contract и domain semantics.

### Language switch

Shared app shell содержит постоянно доступный переключатель русского и казахского языков на buyer и seller routes, включая anonymous state.

- на desktop видимы полные названия `Русский / Қазақша`;
- на mobile используется компактный прямой переключатель `РУ / ҚАЗ`;
- tap по неактивному mobile-варианту сразу меняет язык без menu, sheet или confirmation step;
- полные названия языков сохраняются в `aria-label` mobile controls;
- флаги не используются;

- переключатель не конкурирует с primary action текущего экрана;
- active language различим визуально и программно;
- minimum touch target каждого action — `44x44px`;
- смена языка не сбрасывает текущий маршрут, введённые данные или незавершённую пользовательскую задачу;
- layout должен выдерживать длину русского и казахского текста без clipping, overlap и горизонтального overflow;
- локализуются visible copy, validation/error/status text, placeholders, `aria-label`, `aria-describedby`, `title`, alt text и metadata;
- hardcoded user-facing strings в production components не допускаются после введения localization layer.

## 5. Cards and marketplace composition

Buyer и Seller рабочие поверхности стремятся к marketplace/card composition, а не к technical tables или explanatory landing pages, если таблица не является объективно лучшим способом выполнить user task.

Card должна показывать только truthful data/current state. Нельзя создавать fake ratings, fake availability, invented discount/urgency или technical domain jargon для пользователя.

Whole card не становится автоматически giant link: explicit actions остаются отдельными, если это лучше соответствует задаче и accessibility.

## 6. OfferCard direction

Offer — центральная buyer-facing unit.

Базовая hierarchy по мере наличия соответствующих contracts/data:

1. Product / primary media presentation;
2. mandatory price + unit semantics;
3. freshness/age state;
4. Location/address/distance;
5. Seller/context;
6. Seller comment;
7. buyer actions.

Конкретный order внутри карточки может уточняться Slice Contract, но price/location/freshness не должны теряться за декоративным контентом.

### Media boundary — approved pre-MVP rule

**Временная demo/placeholder media presentation разрешена до M1**, если она нужна для честного проектирования карточек/layout.

Граница:

- demo/placeholder visual нельзя выдавать за реальные seller-uploaded Offer media;
- до M1 нельзя вводить seller upload/storage/API/lifecycle/media business semantics без отдельного contract;
- production behavior не должен зависеть от demo media;
- M1 по-прежнему владеет real seller-provided Offer photos end-to-end;
- к MVP boundary временная presentation либо опирается на реальный media contract, либо остаётся явно нейтральным fallback по актуальному Design System.

После M1 целевой priority:

```text
Offer primary media
→ Product canonical image/icon (если такая capability существует)
→ neutral fallback
```

M2 добавляет video только при подтверждённой необходимости.

## 7. Formatting rules

- price: `4 200 ₸ / кг`; при `unit = null` — цена без `/unit`;
- publishable buyer-facing Offer без price больше не является допустимым current product state;
- не подставлять `0`, dash или `по запросу` вместо отсутствующего price;
- distance показывается только когда соответствующий public contract его возвращает;
- raw Buyer/Seller coordinates никогда не показываются;
- relative freshness text не притворяется live timer.

## 7.1 System states (loading / offline / server error)

Cross-cutting across every buyer and seller screen — added 2026-09-22 as part of promoting `UX-OBS-002` to an owned Design System rule ahead of the wireframe-driven redesign, so every screen touched during that redesign follows one pattern instead of inventing its own. Source: wireframe screens `4a`–`4c`.

- **Loading:** the skeleton shape mirrors the shape of the content it precedes — no layout shift when real content replaces it. A bare spinner is acceptable only where no meaningful shape exists yet (e.g. first paint of an unknown-length list).
- **Offline / stale data:** if a cached previous result exists, show it with a visible staleness cue and an explicit `Обновить` action, instead of a blank/offline screen. Only fall back to a dedicated offline state when there is no cached data to show.
- **Server error severity — three tiers, chosen by whether the screen is meaningful without the failed data:**
  - full-screen error — only when the screen has nothing useful to show without it;
  - local block error — the failed section shows its own error/retry, the rest of the screen stays usable;
  - toast — for a failed background/non-blocking action that doesn't invalidate what's already on screen.
- **Текст ошибки содержит ровно две вещи** (Product Owner decision, 2026-09-23): что не получилось и что пользователь может сделать. Пример: `Не удалось сохранить. Проверьте соединение и повторите.` Декоративный технический идентификатор (код вида `5F2A`, «обратитесь в поддержку с номером…») **не показывается**: продукт не отдаёт таких кодов, и поддержка не сможет найти по нему запрос. Correlation ID вводится только вместе с реальной системой логирования и поддержки, отдельным решением.
- **Seller input is never silently lost** to a network/loading/error interruption — an in-progress form value survives a failed submit or a lost connection at least until the Seller explicitly leaves the flow; this does not introduce a new persisted draft/API/DB contract beyond what a slice's own contract already allows (e.g. #35's in-flow product-first continuity).

This section defines the pattern, not a new component library commitment — each redesigned slice implements it with whatever existing tokens/components fit and calls out in its own Slice Contract if a genuine new component is needed.

## 8. Buyer screens

### Search

Search — рабочая поверхность, не marketing hero. Полезный content/result state должен быть визуально приоритетным.

Explicit sorting/proximity behavior определяется Issue/Slice Contract #12, а не generic Design System.

### Nearby

Nearby direction — result-first. Большой explanatory hero не является целевой permanent composition. Privacy/deep-link behavior определяется соответствующим contract.

### Discovery / Interests

Closed S13 semantics сохраняются. Future `Для вас` вводится отдельным slice и не добавляется «для красоты» заранее.

## 9. Seller UI

Seller-facing UI оперирует понятными пользовательскими сущностями и задачами: **торговые точки, товары/предложения, актуальность**.

Технические `SellerChangeSet`, `SellerChangeItem`, internal IDs и lifecycle codes не должны становиться ordinary seller-facing vocabulary только потому, что они существуют в backend.

При этом UI не имеет права обходить ChangeSet architecture:

```text
Seller Input
→ SellerChangeSet
→ SellerChangeItem(s)
→ confirmation / apply
→ Offer
```

Seller workspace должен давать очевидный выбор между trading-point и Offer/product tasks; exact first-run/edit flows принадлежат соответствующим Slice Contracts.

Multiple Locations отображаются как понятные trading-point cards, когда capability реализована. Seller-level contacts не дублируются по Location без отдельного model decision.

### Seller workspace navigation and in-flow forms

- Seller navigation показывает только существующие destinations. Disabled/`скоро` capability не занимает постоянный слот.
- Точная mobile/desktop navigation composition, тема и тип in-flow surface берутся из визуально принятого прототипа и фиксируются Slice Contract затронутой поверхности.
- Create/edit/confirm может использовать полноэкранный шаг, dialog, side sheet или bottom sheet, если выбранный pattern сохраняет одну state machine, явный review/confirm и правила accessibility из §13. Не ссылаться на компоненты отклонённой ветки как на существующую основу.

## 10. Auth presentation

Phone/OTP auth использует единый modal/dialog pattern поверх текущего context, когда caller flow этого требует.

- visible labels;
- понятный process state;
- keyboard/focus trap/close semantics;
- background не должен случайно scroll/interact под modal;
- caller intent/return destination определяется auth/seller-entry contract, не Design System самостоятельно.

## 11. Reviews / Rating

Reviews/Rating — deferred capability, не permanent ban.

До реального Slice Contract:

- не рисовать fake stars/ratings;
- не выводить reputation из unrelated data;
- не добавлять пустой review UI «на будущее».

## 12. Monetization presentation

Volume limits, seller convenience и Offer promotion — разные axes.

Promotion, когда появится, остаётся визуально честным: explicit neutral label, без fake urgency и без обхода eligibility/relevance/freshness.

## 13. Accessibility

Baseline: WCAG 2.1 AA.

- visible `:focus-visible`;
- keyboard order следует visual/task order;
- visible labels on forms;
- существующие `role=status`, `role=alert`, `aria-live`, `aria-invalid`, `aria-describedby` не ослабляются;
- minimum touch target `44x44px`;
- `<html lang>` динамически соответствует активному `ru` или `kk`;
- `prefers-reduced-motion`;
- state не полагается только на color.

### 13.1 Overlay focus management

Правило для modal, bottom sheet и любого другого overlay с ловушкой фокуса:

- при открытии фокус переводится внутрь overlay **один раз**; при закрытии возвращается на элемент, который его открыл;
- пока overlay открыт, фокус **не перезахватывается** при изменениях состояния — ввод в поле внутри overlay не должен возвращать фокус на первый элемент;
- клавиатурный обработчик и ловушка фокуса живут на протяжении всей открытой сессии overlay и не пересоздаются на каждый рендер.

**Почему это записано.** В отклонённой реализации прохода #27 эффект, устанавливавший ловушку фокуса, зависел от колбэка `onClose`. Родитель пересоздавал колбэк на каждое нажатие клавиши, эффект перезапускался, и фокус уезжал на первый элемент после каждого введённого символа — форма внутри bottom sheet становилась непригодной. Рабочее решение — держать колбэк в ref и оставить в зависимостях эффекта только факт открытия. Компоненты той ветки в `main` не переносятся; сохраняется само правило, чтобы новая реализация overlay не повторила этот дефект.

## 14. Iconography

Use one linear SVG style (`24x24`, stroke примерно `1.5–2`, `currentColor`). Decorative icons with text → `aria-hidden`; icon-only action → `aria-label`.

Не использовать emoji как постоянные UI icons, icon fonts, fake urgency metaphors или e-commerce symbols (basket/delivery/discount), которых нет в product contract.

Messenger logos — official brand assets, когда соответствующие actions реально существуют.

## 15. Что нельзя вводить без slice

Не добавлять speculatively:

- cart/order/payment/delivery/internal chat;
- fake review/rating;
- fake stock/discount urgency;
- auto geolocation без explicit intent;
- public raw coordinates;
- infinite scroll/carousels только как decorative choice;
- Tailwind/UI-kit migration как side effect;
- global state manager для локальной задачи;
- future components «на всякий случай».

## 16. UI verification checklist

Перед закрытием UI slice проверить:

1. visual rules используют system tokens;
2. нет page-level overflow на 360 / 390 / 768 / 1024 / 1440;
3. task hierarchy понятна без знания внутренней архитектуры;
4. closed texts/API/privacy/ARIA semantics сохранены либо явно пересмотрены Slice Contract;
5. keyboard/focus usable;
6. demo media не маскируется под real seller media;
7. fake review/availability/urgency отсутствуют;
8. relevant targeted automated proof существует;
9. final executable branch head имеет green full CI;
10. пользовательский flow прошёл manual acceptance;
11. изменённая поверхность полностью проверена на русском и казахском, включая system/error states, accessibility copy и длинный текст без overflow.

## 17. UX reference audit

Maintenance audit #37 сверил текущие rules с Product Owner UX corpus через `KEEP / ADAPT / REJECT / GAP`; conclusions зафиксированы в `docs/product/UX_REFERENCE_INDEX.md`.

Audit может уточнять presentation rules, но не имеет права молча менять closed business/data contracts. Этот раздел остаётся историческим указателем на метод для generic внешних references, а не execution roadmap.

Второй wireframe pass из `WIREFRAME_BRIEF.md` в 2026-09-22 временно был прямой UX-целью, но после UX reset pass 3
сохраняется как исторический evidence/inventory. Текущую применимость поверхности определяет цепочка
`UX_NAVIGATION_STATE_SPEC.md` → `WIREFRAME_TASK_PASS3.md` → `WIREFRAME_PASS3_REVIEW.md` → визуально принятый
исправленный прототип. Классификация всё ещё полезна для проверки, не требует ли дизайн новой business-механики.
