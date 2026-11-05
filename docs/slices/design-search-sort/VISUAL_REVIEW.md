# D2 visual review — PO screenshots 2026-11-05 — NOT ACCEPTED

PO clarified the normal results screenshot (second attachment) as comparison target; first attachment is the geo-denied variant. Compare layout at the same CSS viewport/zoom, not raw screenshot pixel dimensions. Current runtime6763fa1 is a partial migration, not faithful whole-screen completion; green CI proves behavior, not visual fidelity.

Observed gaps against attached target:
- An extra quick-query chips row changes header height and pushes the content down (existing behavior, but still a visible mismatch).
- No favourite hearts on result photos, despite existing Offer-favourite capability elsewhere.
- Three nav destinations vs four; missing Favourites tab, legacy hamburger instead of dots for More. Existing Favourites route is available via More, so this is relocation of an existing feature, not new domain functionality.
- Place name is regular secondary-colored text; target medium/dark, stronger hierarchy. Source caption truncation and scalable14/20 closed guarantee need deliberate compatibility, not a blanket exemption.
- Seller display name missing after the address although SearchOffer already has seller data.
- Freshness is coarse days/Today with old color rules and no leaf icon; target minutes/hours/days + icon + new palette. Actual buyer DTO exposes whole days only; do not fabricate precise times.
- Extra full-width opening-hours row changes card density; current closed hours contract explicitly requires it. This is an actual compatibility decision, not a claim of a faithful matching card.
- Route caption is always Route, target shows distance when known; current distance already available, should be reused without duplicating it in address line. Preserve accessible route name and geo-less rules.
- Contact/More icon paths/strokes still partly legacy.
- Geo-denied notice is small/plain and BELOW sort in current code, target is expanded notice ABOVE toolbar with clear title and Retry; the first screenshot also uses another sort-trigger treatment. Source variant comparison must be explicit.

Different product names, photos, prices, counts and contact availability in the synthetic fixture are data differences, not visual defects. Real source illustrations must not replace real Offer data. Photo104 and price22/26 already match source metrics; don't report them as defects merely due to screenshot scaling.

Next: revise same D2 contract around these explicit findings; resolve only genuinely closed behavior conflicts (chips/hours/time DTO), migrate existing favourite/navigation presentation rather than invent new business behavior; compare like-for-like data/states and record before/after. No PO acceptance, merge or tag.

## Rework: собственная проверка перед повторным показом PO

Источник: текущий Claude canvas1793830896-9a07, B03-Results (normal/loading/correction), B03-Sort и B04-Empty (denied), система1793830833-b2b7. Сравнение на CSS360, одинаковых текстах/иллюстрациях/ценах. Fake phone border/canvas не переносится в приложение. Число18 иллюстративно: приложение честно показывает число фактических Offers.

| Область | Фактическая проверка |
|---|---|
| Header/toolbar | Search52, margin16, normal funnel/chevron16/24; нет chips после поиска, count+sort; clear X и его отступ исправлены |
| Card | Photo104×104, radius14, padding12/gap12; price22/26 Geologica700, title15/20 Roboto400; независимые computed assertions проходят |
| Heart | Правый верхний угол104px фото;44px target/white plate; исправлен legacy cascade, смещавший его к центру; real login/save/remove/retry/logout flow проходит |
| Place/seller | Точка14/20 medium/dark, адрес+продавец13/18 rem, single-line ellipsis; полный DOM/title;200% проверяет readability suite |
| Freshness | Реальные lastConfirmedAt, 2ч/3дня/40мин/1день в фиксированной fixture; leaf SVG и5цветов из source; source timestamp не влияет на eligibility |
| Footer/nav | Контакты44, route44/radius14/distance when known;4nav с Favourites и More dots; часы остаются на Offer |
| Geo denied | Panel надtoolbar, exacttitle/body/NBSP/Retry; outline up-down trigger14/20; исправлена обрезка trigger; menu320 в viewport; навигация имеет видимую геометрию внизу |
| Loading | Четыре source-shaped skeletons, toolbar/spacer18, исходные ширины текстовых полос, круги контактов и route placeholder; pulse1400 и reduced-motion |
| Correction | Banner надtoolbar, source copy/typed link, прежняя typed семантика; обе locale проверяются |

Сохранены screenshots B03-normal-360, B04-denied-360, B03-loading-360, B03-error-360, B03-correction-360 в Playwright report. Стабильные локальные копии и живой screenshot3500 лежат в sibling verification-evidence/D2-rework-final. Synthetic source illustrations находятся только в tests/fixtures/design-search; ручной preview fixture ограничен loopback55439/kaida_design. Runtime не содержит демонстрационных предложений.

Оставшиеся осознанные адаптации: без известных координат маршрут подписан «Маршрут», guest hearts пустые, порядок/count/давность берутся из бизнес-логики, а не статичной картинки. Error очищает прежнюю выдачу по S0 вместо нарисованного saved/offline состояния; доп. geo-dialog не добавлен. Source-correction использует реальную выдачу вместо двух статичных демонстрационных карточек. Desktop/KK/320 source кадры отсутствуют: это responsive/localization проверки, не pixel parity с несуществующим макетом. Прежние не перенесённые экраны остаются legacy. Полное pixel-perfect совпадение всех состояний/приложения не заявляется.

Вывод агента: перечисленные PO расхождения исправлены и проверяются как цельная выдача. Это техническая/визуальная сверка агента, не manual acceptance PO. Прежний55caf3c CI не засчитывается за новый runtime. Новая приёмка, merge и checkpoint отсутствуют.

Verification follow-up: final7files54E2E PASS (mobile+desktop), covering the old projection/presentation expectations corrected after the full run. Full local E2E before those final expectation updates:324PASS/16FAIL/72SKIP/2notrun;14failures were obsolete D2 expectations, one shared milk-fixture lifetime race (fixed test isolation), one seller flow timeout (unchanged rerun PASS). Full local integration434/435PASS, unchanged importer timeout; isolated importer7/8PASS with a different timeout. Lint/typecheck/build and731unit PASS. Clean final branch CI remains the full-regression gate; no manual PO acceptance claimed.

Final motion comparison: whole heart .97, nav pill .94 with stationary nav text,100ms/cubic-bezier(.33,1,.68,1), no scaling in reduced motion. A real cascade failure in reduced mode was caught and corrected. Independent pointer-held E2E checks the source matrices, not just stylesheet declarations. Final6targeted PASS; full CI before this motion-only follow-up7628489/42002517885 PASS731unit/435integration/342E2E with72intentional skips. Final runtime dc3d6ec: full PR CI42004819351 SUCCESS —731unit/435integration/343E2E PASS,73intentional project skips; CodeQL42004819048/dependency42004819159 SUCCESS. Final normal/denied CI screenshots inspected. No PO acceptance, merge/tag or deploy claimed.
