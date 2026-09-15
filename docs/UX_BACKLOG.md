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
- Последний verified checkpoint: `v0.0.18-ux1b`.
- UX1A, UX1A.1, UX1A.2 и UX1B закрыты; текущий slice: `UX1C — Nearby geo-intent cleanup`.
- Согласованная последовательность: `UX1A → UX1A.1 → UX1A.2 → UX1B → UX1C → отдельный buyer-actionability slice → UX2 → M1 → M2 при необходимости → S14`.
- Во время UX1A Product Owner утвердил Design System: Roboto, header `84/104px`, radius scale `8/12/16/20px`, без fake media slots до M1.

## Открытые пункты

### UX-001 — Скругления должны быть системными, а не случайными

**Статус:** DONE — UX1A / `v0.0.15-ux1a`  
**Область:** Visual system

Первоначальное наблюдение: controls выглядели чрезмерно скруглёнными. Временное решение `3px` было принято до появления полноценной дизайн-системы и отменено до закрытия UX1A.

**Утверждённое направление:** использовать единую radius scale из Design System:

- `--radius-sm: 8px`;
- `--radius: 12px`;
- `--radius-lg: 16px`;
- `--radius-xl: 20px`;
- `--radius-full` только там, где семантически нужен круглый chip/badge.

UX1A ввёл шкалу и применил её к shell/существующим controls через tokens. Полный redesign Offer cards относится к UX1B.

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

**Статус:** IN_SLICE — UX1C  
**Область:** Discovery / Navigation

После нажатия на «Что рядом?» появляется дополнительное действие «Показать товары рядом».

Пользователь уже выразил намерение первым нажатием, поэтому второе подтверждение выглядит лишним.

**Утверждённое направление UX1C:** одно действие `Рядом` должно сразу запускать соответствующий сценарий browser geolocation, если дополнительное подтверждение не требуется по объективной причине. Privacy contract S11 сохраняется: geolocation запрашивается только после явного пользовательского действия, координаты используются только для конкретного запроса и не сохраняются.

**Дополнительно:** при планировании UX1C проверить другие непосредственно затронутые пути на аналогичное повторное подтверждение одного и того же намерения без превращения slice в общий аудит всего приложения.

---

### UX-004 — Seller setup разбит на лишние этапы

**Статус:** OPEN — planned UX2  
**Область:** Seller onboarding

Сейчас данные продавца вводятся несколькими последовательными этапами: сначала название / Location / адрес, затем телефон / WhatsApp / Telegram / Instagram.

Для пользователя это выглядит как одна задача: заполнить данные своей точки и способы связи.

**Желаемое направление:** дать продавцу пройти этот ввод за один логичный проход в одном пользовательском сценарии, не смешивая при этом внутренние доменные сущности и contracts.

---

### UX-005 — Несогласованная и нестабильная верхняя часть приложения

**Статус:** DONE — UX1A.1 / `v0.0.16-ux1a1`  
**Область:** App shell / Visual consistency

Верхняя зона приложения исторически различалась между страницами; первая попытка общего shell дополнительно выявила горизонтальный «прыжок» menu при переходе на seller page. После Bolt alignment отдельно выявлено движение desktop header Search вправо-влево при переключении `Поиск / Рядом / Продавцу`.

**Закрытое направление:**
- одна shell-система на основных routes;
- primary header `84px` mobile / `104px` desktop;
- desktop global Search имеет стабильные `x/width` между основными routes и не зависит от ширины auth/context справа;
- secondary desktop navigation имеет стабильную левую геометрию;
- Roboto и tokens из Design System;
- mobile navigation compact menu без постоянной второй строки.

---

### UX-006 — Нет понятного входа для продавца

**Статус:** DONE — UX1A / `v0.0.15-ux1a`  
**Область:** Information architecture / Seller journey

Пользователь, который хочет стать продавцом или управлять своими предложениями, не должен угадывать, где начинается seller flow.

**Закрытое направление:** общий shell имеет понятный seller entry, ведущий в существующий `/seller` flow без изменения seller business behavior.

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

**Статус:** DONE — UX1B / `v0.0.18-ux1b`  
**Область:** Buyer UI / Layout / Offer cards

Первоначально на основных экранах было слишком много пустого пространства и слишком мало полезного контента в первом экране. Композиция была ближе к лендингу, чем к рабочему интерфейсу поиска и просмотра предложений.

**Закрытое направление UX1B:** marketplace-модель интерфейса с системным app shell, заметным поиском и адаптивной плотной выдачей Offer cards. `boltkaida2` является основным visual/composition reference; fake ratings/media/reviews и mock domain behavior не переносятся. Реальный media layout начинается в M1.

---

### UX-009 — Auth выглядит техническим и выбивается из нового shell

**Статус:** DONE — UX1A.2 / `v0.0.17-ux1a2`  
**Область:** Identity / Login presentation

S2 Auth функционально закрыт и остаётся источником истины для phone normalization, OTP, session, persistence и logout.

**Закрытое направление UX1A.2:**
- `boltkaida2` AuthModal используется как visual/composition reference;
- вход открывается centered modal/dialog поверх текущего интерфейса;
- phone и OTP — два состояния одной modal-композиции;
- настоящий S2 API, dynamic test OTP, validation/error states, session persistence и logout сохранены;
- `/login` сохранён как deep-link/fallback на ту же auth implementation.

---

### UX-010 — Buyer Offer должен быть сразу actionable

**Статус:** OPEN — requires separate buyer-actionability slice after UX1C  
**Область:** Buyer Offer card / Search / Seller contacts / Location geo  
**Тип:** UX-решение + изменение product eligibility contract

Buyer-facing Offer должен давать два обязательных первичных действия: позвонить продавцу и построить маршрут до точки. При этом seller-side сущности могут существовать в неполном состоянии; обязательность относится не ко всему Seller/Location domain, а к eligibility Offer для buyer-facing выдачи.

**Согласованное направление будущего slice:**

- Offer допускается в buyer-facing Search/Discovery только при наличии `Seller.contactPhoneE164` и полной пары `Location.latitude + Location.longitude`;
- неполный Seller/Location может существовать и редактироваться seller-side, но связанный Offer не становится buyer-visible до выполнения publishability requirements;
- первая action row карточки обязательна и содержит две полноценные кнопки: `Позвонить` + `Маршрут`;
- WhatsApp / Telegram / Instagram являются опциональными secondary actions и всегда находятся отдельной второй строкой;
- secondary row не смешивается с `Позвонить`/`Маршрут` и не переносится на следующую строку;
- secondary row всегда занимает всю доступную ширину карточки: если доступен 1 канал — одна кнопка занимает 100%; 2 канала — две равные кнопки делят 100%; 3 канала — три равные кнопки делят 100%; чем больше доступных каналов, тем уже каждая кнопка;
- secondary actions визуально используют узнаваемые фирменные иконки WhatsApp / Telegram / Instagram; отсутствие канала не создаёт пустой placeholder;
- конкретный способ построения маршрута и внешний map provider определяется только в Slice Contract этого будущего slice;
- нельзя реализовывать это попутно в UX1C: изменение затрагивает закрытые S8/S10/S11/Search eligibility contracts и требует отдельного STOP/review перед утверждением нового contract.

**До будущего slice:** текущие закрытые contracts остаются в силе, включая легальность geo-less Location в обычном Search и optional public Seller contacts. Demo-fixtures могут моделировать будущий layout, но не являются production contract.

---

## Product capability note — Reviews / Rating

Отзывы и рейтинг продавца **не являются вечным UX-запретом**. Они остаются запланированной capability KAIDA.KZ и должны появиться отдельными slices с собственными contracts, включая уже принятые требования к media review и moderation. До такого slice нельзя рисовать фиктивный рейтинг или звёзды без данных.

## Примечание по последовательности

Текущая зафиксированная последовательность UX/product work:

- `UX1A` — app shell / navigation — CLOSED;
- `UX1A.1` — Bolt shell/layout alignment — CLOSED (`v0.0.16-ux1a1`);
- `UX1A.2` — Bolt-like Auth modal поверх настоящего S2 Auth — CLOSED (`v0.0.17-ux1a2`);
- `UX1B` — marketplace Offer cards без fake media slots — CLOSED (`v0.0.18-ux1b`);
- `UX1C` — Nearby geo-intent cleanup — CURRENT;
- отдельный buyer-actionability slice — publishability + `Позвонить`/`Маршрут` + secondary social row по UX-010;
- `UX2` — seller onboarding cleanup;
- `M1` — Offer photos end-to-end + реальный media layout;
- `M2` — video/media extension при необходимости;
- затем `S14`.

Следующий slice не начинается до закрытия предыдущего checkpoint.
