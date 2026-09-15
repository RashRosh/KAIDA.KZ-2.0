# KAIDA.KZ UX Backlog

Этот файл является единым рабочим списком UX/UI-проблем и наблюдений.

Он не является закрытым product contract сам по себе. Пункт становится обязательством только после включения в утверждённый Slice Contract.

## Правила работы

- Новые UX/UI-наблюдения фиксируются здесь сразу после обнаружения.
- Не исправлять соседний UX-долг попутно в функциональном slice без явного включения в scope.
- Перед подготовкой нового Slice Contract проверять этот backlog на пункты, непосредственно связанные с user task нового slice.
- Статусы: `OPEN`, `IN_SLICE`, `DONE`, `REJECTED`.
- При `DONE` указывать slice/checkpoint, которым изменение было закрыто.
- Визуальные решения сверяются с `docs/DESIGN_SYSTEM.md`; backlog не переопределяет утверждённую дизайн-систему.
- `boltkaida2` используется как UX/UI composition reference: при отсутствии конфликта с closed product contracts сначала повторяем его композицию, размеры, отступы, тексты и ритм максимально близко, а отклоняемся только по объективной причине.

## Текущее состояние

- Backlog начат после verified checkpoint `v0.0.14-s13`.
- Последний verified checkpoint до текущего corrective slice: `v0.0.15-ux1a`.
- UX1A закрыт; текущий незакрытый corrective slice: `UX1A.1 — Bolt shell/layout alignment`.
- Согласованная последовательность после решения Product Owner: `UX1A → UX1A.1 → UX1A.2 → UX1B → UX1C → UX2 → M1 → M2 при необходимости → S14`.
- `UX1A.2` зарезервирован под визуальный auth/login flow по Bolt reference и начинается только после полного закрытия UX1A.1 checkpoint.
- Действующий contract: `docs/slices/UX1A1-shell-visual-alignment/SLICE_CONTRACT.md`.
- Во время UX1A Product Owner утвердил Design System: Roboto, header `84/104px`, radius scale `8/12/16/20px`, без fake media slots до M1.

## Открытые пункты

### UX-001 — Скругления должны быть системными, а не случайными

**Статус:** IN_SLICE — UX1A  
**Область:** Visual system

Первоначальное наблюдение: controls выглядели чрезмерно скруглёнными. Временное решение `3px` было принято до появления полноценной дизайн-системы и отменено до закрытия UX1A.

**Утверждённое направление:** использовать единую radius scale из Design System:

- `--radius-sm: 8px`;
- `--radius: 12px`;
- `--radius-lg: 16px`;
- `--radius-xl: 20px`;
- `--radius-full` только там, где семантически нужен круглый chip/badge.

UX1A вводит шкалу и применяет её к shell/существующим controls через tokens. Полный redesign Offer cards относится к UX1B.

---

### UX-002 — Свободный ввод там, где система знает допустимые значения

**Статус:** OPEN  
**Область:** Forms / Data entry

Там, где множество допустимых значений известно системе, не заставлять пользователя вводить их вручную.

**Желаемое направление:**
- единицы измерения и другие короткие закрытые наборы → select / controlled choice;
- адрес → поиск/autocomplete по адресам, а не обычный dropdown;
- свободный input оставлять там, где значение действительно произвольное.

Seller-side часть этого пункта не входит в UX1A и должна рассматриваться вместе с UX2 или отдельным узким slice.

---

### UX-003 — Повторное подтверждение после «Что рядом?»

**Статус:** OPEN — planned UX1C  
**Область:** Discovery / Navigation

После нажатия на «Что рядом?» появляется дополнительное действие «Показать товары рядом».

Пользователь уже выразил намерение первым нажатием, поэтому второе подтверждение выглядит лишним.

**Желаемое направление:** одно действие должно сразу запускать соответствующий сценарий, если дополнительное подтверждение не требуется по объективной причине.

**Дополнительно:** при планировании UX1C проверить другие затронутые пути на аналогичное повторное подтверждение одного и того же намерения без превращения slice в общий аудит всего приложения.

---

### UX-004 — Seller setup разбит на лишние этапы

**Статус:** OPEN — planned UX2  
**Область:** Seller onboarding

Сейчас данные продавца вводятся несколькими последовательными этапами: сначала название / Location / адрес, затем телефон / WhatsApp / Telegram / Instagram.

Для пользователя это выглядит как одна задача: заполнить данные своей точки и способы связи.

**Желаемое направление:** дать продавцу пройти этот ввод за один логичный проход в одном пользовательском сценарии, не смешивая при этом внутренние доменные сущности и contracts.

---

### UX-005 — Несогласованная и нестабильная верхняя часть приложения

**Статус:** IN_SLICE — UX1A.1  
**Область:** App shell / Visual consistency

Верхняя зона приложения исторически различалась между страницами; первая попытка общего shell дополнительно выявила горизонтальный «прыжок» menu при переходе на seller page. После Bolt alignment отдельно выявлено движение desktop header Search вправо-влево при переключении `Поиск / Рядом / Продавцу`.

**Утверждённое направление:**
- одна shell-система на основных routes;
- primary header `84px` mobile / `104px` desktop;
- desktop global Search имеет стабильные `x/width` между основными routes и не зависит от ширины auth/context справа;
- secondary desktop navigation имеет стабильную левую геометрию;
- Roboto и tokens из Design System;
- mobile navigation compact menu без постоянной второй строки.

---

### UX-006 — Нет понятного входа для продавца

**Статус:** IN_SLICE — UX1A  
**Область:** Information architecture / Seller journey

Пользователь, который хочет стать продавцом или управлять своими предложениями, не должен угадывать, где начинается seller flow.

**Желаемое направление:** общий shell имеет понятный seller entry, ведущий в уже существующий `/seller` flow без изменения seller business behavior.

---

### UX-007 — В Offer отсутствует пользовательское media-представление

**Статус:** OPEN — planned M1/M2  
**Область:** Offer card / Seller Input / Media  
**Тип:** UX-проблема + обнаруженный product/domain gap

Сейчас покупательская выдача не имеет фото товара, а seller flow не предусматривает добавление media к Offer. Для одного Offer потенциально нужны несколько фотографий и, при необходимости, видео.

Это не следует смешивать с будущими AI-сценариями `фото/видео → распознавание → Change Set`: там media является способом ввода данных, здесь media является частью самого предложения, которое видит покупатель.

**Утверждённая граница:**
- Product получает собственный canonical image/icon отдельным решением;
- seller-provided фото/видео принадлежат Offer;
- реальный media layout и fallback появляются только в M1 вместе с media data/model;
- UX1B не резервирует фиктивные пустые media slots;
- будущий Buyer-card priority после M1: `Offer primary media → Product image/icon → fallback`.

**Желаемое направление M1/M2:** несколько фото, cover/primary asset, просмотр/управление seller media; video extension — отдельным M2 только при необходимости.

---

### UX-008 — Слишком низкая информационная плотность, нужен marketplace card layout

**Статус:** OPEN — planned UX1B  
**Область:** Buyer UI / Layout / Offer cards

Сейчас на основных экранах слишком много пустого пространства и слишком мало полезного контента в первом экране. Текущая композиция ближе к лендингу, чем к рабочему интерфейсу поиска и просмотра предложений.

**Желаемое направление:** перейти к привычной marketplace-модели интерфейса: системный app shell, заметный поиск, плотная выдача карточками, меньше декоративных пустот и больше полезной информации в viewport.

`boltkaida2` является основным visual/composition reference; его fake ratings/media/reviews и mock domain behavior не переносятся.

UX1A/UX1A.1 закрывают shell/navigation/search composition. Card-first layout и адаптивная выдача принадлежат UX1B. Реальный media layout не входит в UX1B и начинается в M1.

---

### UX-009 — Auth выглядит техническим и выбивается из нового shell

**Статус:** OPEN — planned UX1A.2  
**Область:** Identity / Login presentation

S2 Auth функционально закрыт и остаётся источником истины для phone normalization, OTP, session, persistence и logout. Проблема только в presentation: текущая отдельная login page визуально не соответствует Bolt-aligned shell.

**Утверждённое направление UX1A.2:**
- использовать `boltkaida2` AuthModal как visual/composition reference максимально близко;
- вход открывается как centered modal/dialog поверх текущего интерфейса с затемнением/backdrop blur;
- phone и OTP — два последовательных состояния одной modal-композиции;
- сохранить настоящий S2 API, dynamic test OTP, validation/error states, session persistence и logout;
- не переносить browser-generated OTP, fake User/role или local-only auth из Bolt;
- закрытие modal не создаёт User/session и не меняет auth state;
- отдельный `/login` route может сохраниться как deep-link/accessibility fallback, но presentation и behavior не должны дублировать две независимые auth-реализации.

UX1A.2 начинается только после полного checkpoint UX1A.1.

---

## Product capability note — Reviews / Rating

Отзывы и рейтинг продавца **не являются вечным UX-запретом**. Они остаются запланированной capability KAIDA.KZ и должны появиться отдельными slices с собственными contracts, включая уже принятые требования к media review и moderation. До такого slice нельзя рисовать фиктивный рейтинг или звёзды без данных.

## Примечание по последовательности

Текущая зафиксированная последовательность UX/product work:

- `UX1A` — app shell / navigation — CLOSED;
- `UX1A.1` — Bolt shell/layout alignment — CURRENT, должен быть полностью закрыт первым;
- `UX1A.2` — Bolt-like Auth modal поверх настоящего S2 Auth;
- `UX1B` — marketplace Offer cards без fake media slots;
- `UX1C` — Nearby geo-intent cleanup;
- `UX2` — seller onboarding cleanup;
- `M1` — Offer photos end-to-end + реальный media layout;
- `M2` — video/media extension при необходимости;
- затем `S14`.

Следующий slice не начинается до закрытия предыдущего checkpoint.
