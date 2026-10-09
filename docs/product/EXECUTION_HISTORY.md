# KAIDA.KZ 2.0 — Execution History

**Это исторический архив, не источник очередности.** Текущий порядок работ определяет только `docs/product/EXECUTION_PLAN.md`; состояние последнего checkpoint/tag/CI — `docs/agents/CURRENT_STATE.md`.

Ниже — блоки, перенесённые из `EXECUTION_PLAN.md` **дословно** при его сокращении (источник: `EXECUTION_PLAN.md` на `main` `debe43f`, строки указаны у каждого блока). Текст не редактировался: ссылки на SHA, run id и «ниже/выше» описывают состояние на момент записи и могут быть устаревшими.

---

## Former «Verified base и ближайшая последовательность» — closed items 1–5a and the checkpoint line

_Источник: `EXECUTION_PLAN.md`, строки 5–35. Items 6–8 of the same list (deferred / data-gated / not planned) and the 6F/6G note stay in EXECUTION_PLAN.md._

## Verified base и ближайшая последовательность

- `main`: `eba91aace5c70da6da0f446c7391c30aea9b04c9` (state-docs PR #134 поверх checkpoint'а ниже; проверено 2026-10-07); последний checkpoint `v0.0.65-search-by-product-fixture` на `b7d0b4beac2252c8155e5e6de97ba78216696a8b` (test-only fix Issue #130, PR #133, `KAIDA verify` run `37609705127`); `v0.0.64-backup-restore` на `a9c893f83bc7a2068ead983ae70cb7aaa4d222e3` (R2, PR #131, run `37602904524`, attempt 2 — attempt 1 упала на флейке #130); `v0.0.63-d0-e2e-marker-fix` на `c042e5f8b62592b2e525b0a698f055b271e8301f` (test-only fix Issue #125, PR #127, run `37586779810`); последний product checkpoint `v0.0.62-local-bootstrap-verification` на `7892d22` (R1, PR #124, run `37573885183`; предыдущий `v0.0.61-search-demand-events` на `0232c2d07af55deb9b874a12b994f97f86849783`, S15C/D0, PR #121, run `37527531918`); `v0.0.60-search-sorting-control` (PR #118, run `37510134880`); `v0.0.59-search-relevance-default` (S15B-4b, PR #114, run `37447048125`); `v0.0.58-product-as-search-signal` (S15B-4a, PR #111, run `37432078991`); `v0.0.57-buyer-autocomplete` (S15B-3, PR #108, run `37420287841` после rerun флейка seller-showcase-editor); `v0.0.56-search-known-zero` (S15B-2, PR #105, run `37370761534`); `v0.0.55-card-editor-suggestion-scroll` (PR #101, run `37347918337`); `v0.0.54-catalog-suggestion-relevance` (S15B-1, PR #97, `b3432e4`);
  merged-main `KAIDA verify` run `37326497017` SUCCESS (rerun; первый запуск cancelled инфраструктурой). Предыдущие: `v0.0.53` (run `37305378999`), `v0.0.52` (run `37293540946`).
- **Production KB Importer v1 — CLOSED.** Production KB v1 — нормальная runtime-база KAIDA: 682 Products, 210 aliases,
  35 categories в KAIDA PostgreSQL; runtime Product UUID / Offer FK сохранены; внешней KB/corpus-зависимости в runtime нет.
- Stage 6 Rev 3 закрыт на `v0.0.51-search-sort-rev3`.

Порядок работ после решения PO (2026-10-05):

1. ~~Production KB v1 / S15A~~ — **CLOSED** (`v0.0.52`).
2. ~~Catalog-backed Seller → Buyer runtime loop~~ — **CLOSED** (`v0.0.53`, PR #93; integration/user-flow proof, production-код не менялся)
   (`docs/slices/catalog-runtime-loop/SLICE_CONTRACT.md`).
   **S15B-1 — Catalog suggestion relevance / reachability — CLOSED** (`v0.0.54`, `docs/slices/s15b1-catalog-suggestion-relevance/SLICE_CONTRACT.md`). UX-slice «Card editor — mobile visibility of catalog suggestions» — **CLOSED** (`v0.0.55`, `docs/slices/card-editor-suggestion-scroll/SLICE_CONTRACT.md`). **S15B-2 — Search state: resolved Product + known-zero — CLOSED** (`v0.0.56`, `docs/slices/s15b2-known-zero/SLICE_CONTRACT.md`). **S15B-3 — Buyer autocomplete + Search по `product_id` — CLOSED** (`v0.0.57`, `docs/slices/s15b3-buyer-autocomplete/SLICE_CONTRACT.md`). Прежний S15B-4 (жёсткое разделение canonical/raw) **отменён** решением PO: Product — сигнал, не фильтр. **S15B-4a — selected Product как сигнал в общем candidate set, без relevance-порядка — CLOSED** (`v0.0.58`, `docs/slices/s15b4a-product-as-signal/SLICE_CONTRACT.md`). **S15B-4b — Search «По соответствию» (relevance) как режим по умолчанию — CLOSED** (`v0.0.59`, `docs/slices/s15b4b-relevance-sort/SLICE_CONTRACT.md`): детерминированные уровни L1/L2/L3, допуск E1 не изменён. **Search sorting control UX refresh — CLOSED** (`v0.0.60`, `docs/slices/search-sort-control-refresh/SLICE_CONTRACT.md`). **S15B закрыт.** **S15C / D0 — Search Demand Events — CLOSED** (`v0.0.61`, `docs/slices/s15c-d0-search-demand-events/SLICE_CONTRACT.md`): внутренние best-effort события осознанных поисков без идентификаторов и гео. **Деплой-предусловие (организационное, не гарантия кода):** запись `organic` в боевом окружении (`SEARCH_EVENTS_ORIGIN=organic`) остаётся выключенной, пока ежедневная операторская очистка (`pnpm search-events:purge`) не настроена во внешнем планировщике и не проверена; фактическое хранение = 90 дней + интервал очистки при успешном выполнении. События `dev` / `test` / `synthetic` — не реальный спрос. **Дальше** — «Local readiness track» ниже (решение PO 2026-10-07); D1 и AI не начаты, AI Input и AI-модерация отложены; fuzzy — позже.
   **Search sorting control UX refresh — финальный дизайн (PO, 2026-10-06; реализован в `v0.0.60`):** один компактный inline-ряд ниже чипов над выдачей; весь ряд — один dropdown-триггер (иконка-слайдеры / «По умолчанию» или критерий + текущая стрелка / индикатор); список из четырёх пунктов («По умолчанию» — relevance без direction, «По цене», «По расстоянию», «По актуальности») закрывается после выбора; активный явный пункт показывает противоположное направление, неактивный — естественное; отдельной кнопки сброса нет; accessible names различают состояние и действие.
3. ~~S15B — Search System revision~~ — **CLOSED** (`v0.0.54`–`v0.0.60`).
4. ~~S15C / D0 Search Demand Events~~ — **CLOSED** (`v0.0.61`).
5. **Local readiness track (решение PO 2026-10-07).** Цель — продолжать разработку без платной инфраструктуры; это **не** запуск пилота, **не** разрешение публичного запуска без AI и **не** изменение границ Seller Change Set (ручной ввод или AI-предложения → Seller Change Set → подтверждение продавцом → Offer). Порядок:
   - **R1 — Clean local bootstrap verification — CLOSED** (`v0.0.62`, `docs/slices/local-bootstrap-verification/SLICE_CONTRACT.md`, PR #124; runbook `docs/ops/LOCAL_BOOTSTRAP.md`, `ops/local-bootstrap/`). Границы приёмки: свежий запуск проверен только через Git Bash на Windows; команды PowerShell, воспроизведение на Linux и в CI **не проверены**. Demo-последовательность: миграции → seed → импорт KB (seed после импорта KB без предшествующего seed падает на `products_name_unique` — известное ограничение, не исправлялось). Обязателен `IDENTITY_OTP_HMAC_SECRET_HEX` (без него вход отвечает `503 AUTH_UNAVAILABLE`). Сборка `pnpm build` на слабой машине падала перемежающимся образом; причина не установлена (обход — `CIRCLE_NODE_TOTAL=2`).
   - **R2 — Backup и restore — CLOSED** (`v0.0.64`, `docs/slices/backup-restore/SLICE_CONTRACT.md`, PR #131; runbook `docs/ops/BACKUP_RESTORE.md`, `ops/backup-restore/`, команды `backup:create|restore|verify`). Границы приёмки: проверено через Git Bash на Windows; PowerShell, Linux, неограниченная нагрузка записи, перенос между версиями и push при смене VAPID-ключа **не проверены**; backup содержит ПД и действующие сессии, отзыва сессий нет; согласованность без остановки записи держится на неизменяемости и неудаляемости файлов фото.
   - **R3 — Воспроизводимая подготовка развёртывания** без покупки и создания хостинга — **перенесён после блока UX/search** (решение PO 2026-10-07, пункт 7 в порядке ниже); контракта нет, не начат.
   - **R4** (выбор следующего non-AI slice) — **закрыт решением PO 2026-10-07**: следующим стал блок UX/search ниже. Следующий кандидат после R3 агент предлагает PO отдельно.
5a. **Блок UX/search перед R3 (решение PO 2026-10-07; утверждён порядок планирования, а не реализация блока).** Каждый пункт — независимый slice со своим Slice Contract и отдельным утверждением PO; общей реализации блока нет:
   1. **Search word forms** — найти Offer при другой словоформе запроса; первый наблюдаемый случай: «груша» → свободное название «груши копченые». Это **не** typo/fuzzy. **Закрыт и принят PO 2026-10-08:** `v0.0.66-search-word-forms` (проверенный офлайн-словарь грамматических форм, без миграций, один результат в RU и KK; контракт `docs/slices/search-word-forms/SLICE_CONTRACT.md`). Не покрыто (принято): слова вне словаря, родственные пары, морфология казахского.
   2. **Card opening-hours readability** — быстрый ответ «можно ли прийти сейчас» на карточке; режим работы точки не смешивается с актуальностью Offer. **Закрыт и принят PO 2026-10-08:** `v0.0.67-card-opening-hours` (статус словами на карточке, сгруппированное расписание на странице Offer; расчёт и данные не менялись; контракт `docs/slices/card-opening-hours/SLICE_CONTRACT.md`). Известные ограничения: tz-база старых устройств может давать для Asia/Almaty +6 вместо +5; KK-строки требуют вычитки.
   3. **Card price and packaging clarity** — цена связана с объёмом/весом понятнее, без автоматической правки названий продавца и без изменения структурированных единиц. **Закрыт и принят PO 2026-10-08:** `v0.0.68-card-price-packaging` (строка цены «/ количество» при заданном количестве упаковки, ровно 1 единица — «/ л», «/ кг»; иначе «/ единица» продавца; иначе только цена; отдельная строка упаковки убрана; без пересчётов, без смены ярлыков, DTO и сортировки).
   4. **Search empty states** — known-zero и unresolved-zero остаются различимыми; короткая подсказка и следующее действие; иллюстрации и тексты — только после утверждения PO превью. **Закрыт и принят PO 2026-10-08:** `v0.0.69-search-empty-states` (блок состояния вместо серой строки: свой заголовок с запросом и пояснение для известного товара и неизвестного запроса, действия «Изменить запрос» и «Посмотреть рядом», RU/KK; без иллюстраций; API, ранжирование, D0 и сортировка не менялись; KK-строки ждут вычитки).
   5. **Typo-correction suggestions** — предложить исправленный запрос без молчаливой подмены; это fuzzy-класс, ограничение на fuzzy **не снято**: снятие — отдельным решением PO для этого slice с учётом D0 (выбор исправления не теряется и не считается дважды). **Закрыт и принят PO 2026-10-09 (решение PO: автоматическое исправление вместо явного выбора):** `v0.0.70-search-typo-correction` (исходный поиск первым; при нуле и без распознанного товара — одно уверенное исправление по узким правилам (русские буквы, ≥ 5 букв, пропуск/лишняя буква, перестановка, гласные пары а/о, е/и, и/ы), результаты исправленного запроса под двумя строками текста со ссылкой «Искать вместо этого», режим «как введено» в адресе `typed=1` и в last-search `v: 4`; одно событие D0 с исходным исходом и полями `corrected_*`; выключатель `SEARCH_AUTO_CORRECTION=off`; допуск, ранжирование и сортировка не менялись).
   6. **Buyer preview** — решение PO 2026-10-09: разделён на два независимых slice, каждый со своей приёмкой: **6a Post-publication buyer preview** («Как видят покупатели»: настоящая страница предложения опубликованной карточки, список точек, недоступное — причина без действия; `docs/slices/post-publication-buyer-preview`, контракт APPROVED rev 3) — **закрыт и принят PO 2026-10-09: `v0.0.71-post-publication-buyer-preview`** (страница покупателя в режиме просмотра `preview=1` с проверенным `return`, действие на странице карточки, у точек и на подсвеченной строке после публикации, два одобренных значка, раскладка карточки точки при крупном шрифте; допуск, DTO и данные не менялись) → **6b Pre-publication buyer preview** («Как увидят покупатели»: приватный просмотр новой карточки, черновика и несохранённых правок в редакторе через общую проекцию и общий компонент; `docs/slices/pre-publication-buyer-preview`, контракт APPROVED rev 1) — **закрыт и принят PO 2026-10-09: `v0.0.72-pre-publication-buyer-preview`** (`POST /api/seller/card-preview`, синтетические id без адреса, ничего не сохраняется; в ту же приёмку вошла правка: денежные поля продавца не принимают буквы при вводе и вставке, серверная проверка не менялась).
   7. **R3** — воспроизводимая подготовка развёртывания (см. выше).
   Для каждого UI-slice блока верификация включает читаемость на **реальном телефоне**, **длинные KK-подписи** и **крупный системный шрифт** (в дополнение к mobile + RU, `PROJECT_RULES.md` §18.5); недостающий кадр макета запрашивается у PO, а не придумывается. Консолидированный документ `KAIDA_UX_UI_DECISIONS_AND_BACKLOG.md` (7 октября 2026) — **история обсуждения**, не источник утверждений: его неутверждённые предложения (тексты, иллюстрации, анимация, форма расписания, правила цены/упаковки, состав slices) молча не принимаются; backlog из него (ручной ввод при отложенном AI, discoverability интересов и др.) остаётся backlog.

---

## Former «Последний verified product checkpoint»

_Источник: `EXECUTION_PLAN.md`, строки 71–81. Current checkpoint facts are owned by docs/agents/CURRENT_STATE.md._

## Последний verified product checkpoint

- tag: `v0.0.62-local-bootstrap-verification`; checkpoint commit `7892d22`; merged-main CI run `37573885183` green; предыдущие `v0.0.61-search-demand-events` (`0232c2d`, run `37527531918`), `v0.0.60-search-sorting-control`, `v0.0.59-search-relevance-default`, `v0.0.58-product-as-search-signal`, `v0.0.57-buyer-autocomplete`, `v0.0.56-search-known-zero`, `v0.0.55-card-editor-suggestion-scroll` (`ff8f08e`), `v0.0.54-catalog-suggestion-relevance` (`b3432e4`), `v0.0.53-catalog-runtime-loop` (`c0d1749`), `v0.0.52-production-kb-importer-v1` (`5b21710`);
- до него закрыты: Stage 6 Rev 3 (`v0.0.51-search-sort-rev3`), 6B–6D (`v0.0.48`–`v0.0.50`), 5A
  (`v0.0.47-search-visibility-without-coordinates`), `v0.0.46-search-sort-distance` и более ранние checkpoints;
- **этап 1 закрыт**: `offer-photos`, `point-contacts-hours`, `seller-showcase-editor`, `operator-post-check`, Motion,
  `offer-actuality` и `actuality-reminders`; ранее закрыты `S0–S13`, `UX1A`–`UX2A`, localization foundation, catalog
  localization, seller comment translation, Seller Entry / contextual auth, Seller Trading Points Workspace.

Перед новой работой состояние всё равно перепроверяется по git/GitHub/CI.


---

## Former «# NEXT» through «Текущий repository gate» (AI-first turn, stage 1, buyer screens, 6A–6D decisions)

_Источник: `EXECUTION_PLAN.md`, строки 84–211. Closed work; its decisions are history, the contracts they produced live under docs/slices/._

# NEXT

## Разворот продавца к AI-first (Product Owner decision, 2026-09-24/25)

Product Owner признал направление seller UI по Pass 3 неверным: ввод данных продавцом должен быть максимально
простым, главный вход — одна кнопка `Сформировать карточки товаров` с ИИ-способами (видео, фото, голос), ручной ввод —
полноценный путь на время, пока ИИ выключен или недоступен. Продуктовые решения записаны в `FEATURE_MAP.md`
(«Seller AI-first model»), целевой UX — в `SELLER_AI_FIRST_DESIGN_BRIEF.md` и `SELLER_AI_FIRST_DESIGN_REVISION_1.md`.

Pass 3 больше не является UX target ни для продавца, ни для покупателя: единственная цель — AI-first макет
(`PROJECT_RULES.md` §18.1), в нём есть и покупательские экраны.

Feature freeze сохраняется: новые product capabilities вне этого раздела не начинаются.

### Шаги

| # | Шаг | Статус на 2026-09-25 |
|---|---|---|
| 1 | ТЗ дизайнеру AI-first витрины продавца | Сделано: `SELLER_AI_FIRST_DESIGN_BRIEF.md` |
| 2 | Первый макет | Сдан: https://claude.ai/artifact/3z2pznybpsJAJbWGTxgwE4 |
| 3 | Ревизия 1: правки редактора, решения PO, экраны «ИИ выключен», прототип ручного пути | Сдана в тот же макет (кадры `Rev 1`); сверка с §5 ТЗ ревизии — все 13 пунктов закрыты |
| 4 | Visual acceptance макета после ревизии 1 | Принят PO 2026-09-25; копия — `docs/product/mockup/seller-ai-first-rev1/` |
| 5 | Slice Contracts этапа 1 (ИИ выключен) | Все пять утверждены |
| 6 | Реализация этапа 1 по контрактам | Этап 1 закрыт 2026-09-28 (`v0.0.36-actuality-reminders`) |

### Этап 1 — продавец без ИИ (**закрыт**; ниже исторический состав)

Цель: продавец проходит ручной путь целевого макета от пустой витрины до опубликованной и изменённой карточки.

1. **Фото предложения** — загрузка, хранение, показ покупателю; фото необязательно, карточка без фото публикуется
   с напоминанием продавцу о неполной карточке (`FEATURE_MAP.md` «Seller AI-first model» п. 4). Это M1,
   перенесённый вперёд из замороженной очереди.
2. **Контакты у точки** — телефон / WhatsApp / Telegram принадлежат точке; новая точка получает контакты предыдущей;
   показ Offer покупателю требует подтверждённой точки, контакты необязательны; каждый внесённый контакт
   подтверждается (телефон и WhatsApp — кодом, Telegram — подключением), неподтверждённый покупателю не показывается;
   **режим работы точки** — обязательный, копируется от предыдущей точки; в каждой карточке выдачи строка вида
   «9.00–18.00 | ПТ 13.00–18.00 | СБ ВС» (выходные зачёркнуты), зелёный / оранжевый (≤ 1 ч до закрытия) / красный;
   на порядок выдачи не влияет (`FEATURE_MAP.md` п. 13). Перед контрактом нужен кадр дизайнера (в макете его нет).
3. **«Моя витрина» и ручной редактор** — навигация `Витрина / Точки / Ещё`, редактор AI-S09 в режиме «ИИ выключен»
   на основе PR #50, свободное название товара, фасовка, несколько точек с общей ценой и своей ценой точки,
   подтверждение с предупреждением об ответственности.
4. **Пост-проверка оператором** — лента новых карточек и снятие с витрины; статус «Снято оператором» у продавца. Это
   часть S16, перенесённая вперёд.
5. **Актуальность `2 / 7 / 14`** (Issue #31) — плашки «Сегодня … 6 дней» у покупателя, задача «Пора подтвердить
   актуальность» и «Всё актуально» на «Моей витрине», скрытие неподтверждённых карточек, **напоминания продавцу**
   до скрытия (Issue #32). Перенесены из замороженной очереди решением PO (2026-09-25): актуальность и ИИ — главные
   отличия KAIDA, без них сервис теряет смысл; без напоминаний продавец не узнает, что карточки пропали из поиска.
   Актуальность напрямую определяет позицию карточки в выдаче. Расписание напоминаний (решение PO, 2026-09-25):
   первое — **до** спуска в выдаче, на второй день после подтверждения («подтвердите, иначе завтра карточки опустятся
   в поиске»); второе — на шестой день («завтра карточки пропадут из поиска»). Больше напоминаний нет. Точное время
   и канал доставки определяет контракт.

**Правило запуска (решение PO, 2026-09-25):** публичный запуск сервиса без актуальности и без ИИ (ИИ-ввод и
ИИ-модерация) не проводится.

Каждый пункт затрагивает закрытые contracts (S3, S5, S10, S12, #36, `seller-cabinet-overview`, `offer-price-unit`) и
проходит contract revision по `PROJECT_RULES.md` §4.

### PR #50 `seller-offer-editor` — слит (`v0.0.32`, 2026-09-25)

По решению PO доведён (E2E на ошибки полей, закрытие с изменениями, двойное нажатие, казахский на 320 px) и слит.
Ручная приёмка PO не проводилась — PO решил сливать без неё. Редактор — основа ручного пути этапа 1; приведение к
виду AI-S09 — в контракте пункта 3.

### Название товара — свободное до формирования каталога (решение PO, 2026-09-25)

Продавец пишет название своими словами; карточка публикуется под этим названием без выбора из каталога. Каталог
теперь существует (Production KB v1, `v0.0.52`), но выбор из него остаётся необязательным: свободное название
продолжает работать как в закрытых contracts. Для этапа 1 это означает: состояние «товара нет в
каталоге» в редакторе не нужно; контракт пункта 3 должен определить, как карточка со свободным названием находится
в поиске (сейчас поиск идёт через каталог и aliases — закрытые S6/S7), и это ревизия закрытых contracts по
`PROJECT_RULES.md` §4.

### Отменено

- `seller-points-contacts` (часть 3 контрактов Pass 3) — отменён: строил контакты на уровне продавца и отдельный
  экран контактов, которые новая модель отвергает. Заменяется пунктом 2 этапа 1.
- Ветка `slice/seller-offer-workspace` и контракт Issue #27 — отклонены ранее; контракт удалён из репозитория, история
  в Git и Issue #27.

---

# Экраны покупателя по макету — закрыто (`v0.0.37-buyer-screens`)

Решение PO (2026-09-29) выполнено в PR #63: экраны покупателя пересобраны по принятому макету (`B01` выдача, `B02`
детальная карточка; экраны без кадра — из классов макета) раньше замороженной очереди. Новые функции не добавлялись:
фильтры `B07` остаются stages 5–6 ниже; отзывы, рейтинг и жалобы (`B03`–`B06`) — insertion candidate. Контракт —
`docs/slices/buyer-screens-mockup/SLICE_CONTRACT.md`.

## Текущий repository gate

**Stage 5A — Search visibility for addressed Locations without coordinates — закрыт**: contract rev 3 APPROVED
(`docs/slices/search-visibility-without-coordinates/SLICE_CONTRACT.md`, contract commit `fc7c717`), реализация слита
PR #77 (slice-коммит `444b44f`, merge `419e60e`; repair-коммит `186ec21` — order-agnostic test assertion, merge `3763373` — PR #78),
branch CI green (runs `37182360419`/`37182363774` на `e21e2f8`, `37191449657`/`37198879235` на `186ec21`),
merged-main CI на `3763373` green (run `37199326198`), manual acceptance **PASS**.
Checkpoint annotated tag `v0.0.47-search-visibility-without-coordinates` создан на `415a25a`.

**Stage #6 Rev 2 отклонён на manual acceptance (PO, 2026-10-04)** — CHANGES REQUESTED, без PR/merge/tag. Ветка
`slice/search-price-sort-range-contract` (contract `b26573a`, реализация `977dbf0`, head `f9dd7cf`, branch CI `37205826673`
green) сохраняется неизменной как evidence; новая ветка Rev 3 строится от актуального `main`, из старой берутся только
полезные hunks/tests. Issue #12 остаётся OPEN.

**6A–6D и Stage 6 Rev 3 закрыты** (6B: PR #84, tag `v0.0.48-first-entry-correction`; 6C: PR #86, tag
`v0.0.49-search-home-last-state`; 6D: PR #88, tag `v0.0.50-inline-language`; Rev 3: PR #90, manual acceptance PASS,
checkpoint tag `v0.0.51-search-sort-rev3` создаётся на merge-коммите после green merged-main CI, до фактического
создания тег не считать существующим). **6F снята до реализации** (решение PO 2026-10-05, см. «Verified base и ближайшая последовательность»); следующий
шаг — Catalog-backed Seller → Buyer runtime loop. Порядок 6D → 6 был выбран потому, что First Entry/Search Home меняют ту же поверхность Search, что и popover Rev 3: popover не строится
внутри структуры, которую сразу заменят.

Решения PO (2026-10-04), которые должны войти в соответствующие Slice Contracts, не сокращаясь:

- **6B/6C:** `/welcome` — First Entry, показывается один раз на браузер/устройство; `/` — постоянный Search; пункт
  `Поиск` никогда не открывает First Entry. Состояние последнего поиска (запрос, сортировка, направление) — только в
  пределах вкладки/сессии; выдача и координаты не сохраняются, при возврате результаты запрашиваются заново; `distance`
  без текущих координат при восстановлении нормализуется в `actuality` (и в UI, и в хранилище), геолокация автоматически
  не запрашивается.
- **6D:** язык без отдельного gate и без Sheet — на First Entry и в `Ещё`, у покупателя и у продавца.
- **6 (Rev 3):** `sort=actuality|distance|price`, `direction=asc|desc`; выбранный критерий — настоящий первичный порядок,
  скрытого взвешенного score нет; порядок «свежие выше ageing» при явном `price`/`distance` больше не действует
  (`<7d` eligibility остаётся), actuality — tie-breaker, затем id; цена — номинальная KZT без нормализации единиц;
  geo-less после geo-known в обоих направлениях distance; по умолчанию actuality, свежие первыми; повторный выбор
  активного критерия меняет направление. Радиус, цена от–до, чипы фильтров, sheet «Фильтры» и `sort=cheaper` удаляются.
- **6F/6G** (решения 2026-10-04 сохраняются как входные требования к S15C/D0 и будущим canonical-Product чипам; сами 6F/6G как отдельные slices сняты 2026-10-05): только осознанные submit; без user-id и постоянного/сессионного идентификатора, пока контракт не докажет
  необходимость; событие — нормализованный запрос, время и нужный исход поиска; raw-события не дольше 90 дней
  (конфигурируемо); окно популярности по умолчанию 14 дней (конфигурируемо), порог повторов конфигурируем, ≤5 чипов,
  curated fallback; сырые запросы продавцу не показываются; модель общая с S15C, второй не создаётся.
- **Backlog аудита overlay** (вне текущих slices): выбор единицы цены, выбор торговых точек, «Откуда карточка».

---

## Former «S15A — Catalog bootstrap — CLOSED» (historical design of the import)

_Источник: `EXECUTION_PLAN.md`, строки 306–327. Closed at v0.0.52; the importer contract is docs/slices/production-kb-importer/SLICE_CONTRACT.md._

#### S15A — Catalog bootstrap — CLOSED

**Выполнено Production KB v1** (`v0.0.52-production-kb-importer-v1`, `docs/slices/production-kb-importer/SLICE_CONTRACT.md`):
в KAIDA PostgreSQL установлены 682 Products, 210 aliases, 35 categories. Workbook остаётся историческим/редакторским
источником, не runtime-bootstrap. Текст ниже — историческое описание исходного замысла.


Входной artifact `KAIDA.KZ_initial_product_catalog_v0.1.xlsx` содержит 787 кандидатов: 682 `include_v01=YES` и 105
`REVIEW`; RU — canonical/editorial basis, KK — draft, отдельно даны aliases, editorial categories и source metadata.
Workbook — редакторский источник, не production migration и не seed.

Будущий contract обязан определить staging/validation, merge с существующими Products, stable UUID, localized names,
aliases, collision handling, idempotency, rollback/correction и пакетный отчёт принятия. 682 `YES` — кандидатное
RU-ядро: безопасные строки принимаются пакетно после дедупликации, неоднозначные конфликты остаются человеку;
автоматическое объединение допустимо только при однозначном правиле. `candidate_code` — временный внешний ID, не
`Product.id`.

Запрещено молча: импортировать все строки или 105 `REVIEW`; считать draft KK проверенным или ставить ему
`verified_at`; объявлять Excel taxonomy финальным рубрикатором; класть весь каталог в seed; дублировать существующие
Products. `Category` остаётся полноценной сущностью KAIDA, а `category_code` workbook маппится на простой неглубокий
рубрикатор KAIDA. Вычитка KK отложена и не блокирует RU bootstrap.

---

## Former insertion-candidate sections — поставленные части (дословно)

_Источник: `EXECUTION_PLAN.md` на ветке черновика перед правкой D-INSERT. В плане оставлены только невыполненные требования (заголовки «… (остаток)»)._

## Архив и удаление карточек

В целевом макете (AI-S15–S17): архив с восстановлением и сроком хранения. Требует точной temporal semantics и server
jobs; рассматривается вместе с актуальностью.

---

## Стартовая страница сервиса — First Entry (макет, 2026-09-29)

Живой макет (версия `1790680691-0123`, страница FIRST ENTRY: `FE0` — handoff, `FEA1` / `FEA3` / `FEPA` — телефон
< 1280, `FEB2` / `FEB3` / `FEPB` — экран ≥ 1280): заголовок, настоящее поле поиска и пример выдачи по «баранина»;
демо-анимация ≈ 3,5 с один раз (флаг `kaida_fe_demo_seen`). **Сделан только телефон** — контракт
`docs/slices/first-entry-mobile/SLICE_CONTRACT.md`; экран ≥ 1280 не трогаем (решение PO 2026-09-29).

Решения PO (2026-09-29): язык выбирается один раз и меняется в «Ещё» (макет рисует `РУС / ҚАЗ` и `/ru`, `/kk` —
не делаем); демо-пример с вымышленными данными показываем; геолокация только по действию пользователя; фото в
примере — нарисованные иллюстрации, оставляем; решения Pass 3 не переносятся — идём от макета. Кнопки поиска нет,
кроме `→` в поле при наличии текста.

Открыто: казахские строки — черновик, нужна вычитка; недавние запросы на повторном визите не спроектированы;
финальный слоган; десктоп (≥ 1280); промо-баннер над поиском; «живой главный экран» (популярное / ближайшее).

---

## Правки экранов продавца после ручного просмотра PO (2026-09-29)

Небольшие отдельные slices на ветках от `claude/buyer-screens` / `main`; контракты — DRAFT до утверждения PO.

- Плитки фото по обновлённому макету (`☆` / `×`, микроменю `← →`, подхват при перетаскивании) —
  `docs/slices/seller-photo-tiles/SLICE_CONTRACT.md`;
- переход к редактированию торговой точки прямо из карточки товара и возврат к ней с сохранённым вводом —
  `docs/slices/seller-card-point-link/SLICE_CONTRACT.md`;
- без кадра / контракта пока: контакты точки «по умолчанию» (показать мой номер, проверка номера — расширение
  point-contacts-hours), избранное покупателя, жалоба на карточку (этап отзывов и жалоб).

---

## Аналитика поиска и живой главный экран покупателя (решение PO, 2026-09-29)

Запись поисковых запросов покупателей (без привязки к человеку: текст, дата, нашлось ли что-то) — основа для двух
вещей: «популярные» запросы на главном экране (самое частое за 7–14 дней, только запросы с находками; запасной
список, пока данных мало) и продажа аналитики спроса продавцам (stage 12, монетизация).

- earliest: после экранов покупателя по макету; нужны миграция и контракт;
- в тот же slice: выдача сразу на главном экране (ближайшее при включённой геолокации, иначе популярное), нужна ли
  кнопка «Найти» или выдача подстраивается под набираемое, «Может, вы искали…» при опечатке;
- перед контрактом: правила хранения запросов и приватность (что считается персональными данными), связь с
  монетизацией (stage 12).

---

## Former «COMMITTED STAGE REGISTER» — закрытые и снятые строки (дословно)

_Источник: `EXECUTION_PLAN.md` перед правкой дублирования статусов. Открытые строки (7, 8, 9, 10C, 11, 11A–11C, 12) остались в плане._

| # | Stage | Owner |
|---|---|---|
| 1 | Seller Location geo fallback (paste-and-parse, S8 revision) | `docs/slices/seller-location-geo-fallback/SLICE_CONTRACT.md` |
| 1a | ~~KAIDA address directory на открытых данных (подсказки адреса)~~ — **закрыт** (PR #72, manual acceptance PASS) | `docs/slices/address-directory/SLICE_CONTRACT.md` |
| 4 | ~~Nearby result-first correction~~ — **закрыт** (PR #73, manual acceptance PASS) | Issue #34, `docs/slices/nearby-result-first/SLICE_CONTRACT.md` |
| 5 | ~~Поиск: кнопка «Фильтры» — сортировка «ближе» / «актуальнее» и расстояние~~ — **закрыт** (PR #74, manual acceptance PASS) | Issue #12, `docs/slices/search-sort-distance/SLICE_CONTRACT.md` |
| 5A | ~~Search visibility for addressed Locations without coordinates~~ — **закрыт** (PR #77 + repair PR #78, manual acceptance PASS) | `docs/slices/search-visibility-without-coordinates/SLICE_CONTRACT.md`, Issue #12 |
| 6A | Process/UX rules maintenance: граница доставки mobile + RU, выбор interaction pattern, язык без отдельного gate (docs) | `PROJECT_RULES.md` §18.4–18.5 |
| 6B | ~~First Entry correction: `/welcome` отдельно от Search `/`, intro один раз на браузер/устройство, язык на First Entry, без языкового экрана~~ — **закрыт** (PR #84, manual acceptance PASS) | `docs/slices/first-entry-correction/SLICE_CONTRACT.md` |
| 6C | ~~Search Home + состояние последнего поиска (поле по центру, ≤5 чипов, восстановление запроса/сортировки при возврате)~~ — **закрыт** (PR #86, manual acceptance PASS) | `docs/slices/search-home-last-state/SLICE_CONTRACT.md` |
| 6D | ~~Inline-язык в `Ещё` (покупатель и продавец): компактная таблетка `РУС \| ҚАЗ` в строке «Язык», сразу, без Sheet/Done~~ — **закрыт** (PR #88, manual acceptance PASS) | `docs/slices/inline-language/SLICE_CONTRACT.md` |
| 6 | Поиск, сортировка Rev 3 — **один vertical slice**: «Расстояние / Цена / Актуальность» с направлением, public API, порядок, anchored popover; заменяет отклонённую Rev 2 — **закрыт** (PR #90, manual acceptance PASS) | Issue #12, `docs/slices/search-sort-rev3/SLICE_CONTRACT.md` |
| 6F | ~~Search Query Log~~ — **снята до реализации** (2026-10-05); цель переходит в S15C/D0 после S15B | — |
| 6G | ~~Динамические популярные запросы~~ — убрана из ближней очереди; переосмыслена как readiness-gated популярные canonical Product чипы (≤5, curated fallback) после S15C/D0/D1; сырые/unresolved запросы Products не становятся | future Slice Contract |
| 10A | ~~S15A — Catalog bootstrap~~ — **закрыт** (Production KB v1, `v0.0.52-production-kb-importer-v1`) | `docs/slices/production-kb-importer/SLICE_CONTRACT.md` |
| 10A+ | ~~Catalog-backed Seller → Buyer runtime loop~~ — **закрыт** (`v0.0.53-catalog-runtime-loop`, PR #93, manual acceptance PASS) | `docs/slices/catalog-runtime-loop/SLICE_CONTRACT.md` |
| 10B | S15B — Search System revision — **закрыт** (`v0.0.54`–`v0.0.60`): каталоговый `product_id`, suggestions, resolved search отдельно от seller-title fallback, known-zero отдельно от unknown | `SEARCH_SYSTEM_SPEC_v0.1.md` / future contract revisions |

---

## Former «ISSUE REGISTER (reconciliation 2026-10-05)» (дословно)

# ISSUE REGISTER (reconciliation 2026-10-05)

Порядок работ определяют разделы выше; Issues владеют подробными требованиями и сюда не копируются. Состояние каждого
Issue — ровно одно (классификация принята PO).

| Issue | Состояние | Owner / trigger |
|---|---|---|
| #12 Search sorting | covered / closed (completed, Stage 6 Rev 3, `v0.0.51`) | будущие фильтры — не остаток этого Issue, см. «Additional Search filters» |
| #55 Demand | input to scheduled workstream | S15A closed (`v0.0.52`) → S15B → S15C (stage 10C); D3–D6 — по gates в Feature Map |
| #75 AI-правила обработки seller input | input to scheduled workstream | AI Input (stage 7, S17–S20): входные правила будущих Slice Contracts; AI-модерация — stage 8 |
| #76 distance sensitivity в ranking | later / dependency-gated | после S15B + данных D0/D1. Не может влиять скрыто на явные `actuality | distance | price`; требует отдельного relevance/recommendation context и contract revision (Rev 3 закрыл скрытый score) |
| #79 Price Intelligence | later / dependency-gated | Product resolution (S15B) + накопленные цены; не в ranking на MVP |
| #10 Market navigation | later / triggered | «Insertion candidates» ниже |
| #54 категории товаров продавца | later / backlog | trigger: у продавцов много карточек; зависит от каталога/Category и решений PO |
| #83 Security automation | later / trigger-gated | триггеры внутри Issue (Dockerfile/registry/SBOM и т. д.) |
| #116 CI flake (migration-test) | UNSCHEDULED Development, вне R3 (решение PO) | правило триажа сбоев — `PROJECT_RULES.md` §7–§8 |
| #13, #16, #17, #19, #27, #31, #32, #34, #35, #36, #37, #42 | covered / closed | реализовано или завершено, Issue закрыт |
| #20–#23, #28, #29 | invalid / temp | не product requirements |

## Архив записей реестра требований (поставлено / отклонено)

_Источник: `REQUIREMENTS_REGISTER.md` на `67113c9`; строки перенесены дословно при упрощении системы планирования. Идентификаторы стабильны. Снимок, не очередь и не разрешение на реализацию. Источники — коды из `REQUIREMENTS_SOURCE_MAP.md` §1._

| ID | Capability | Вид | Статус | Метка | Источники | Зависимости / триггер / свидетельство | Ограничения и примечания |
|---|---|---|---|---|---|---|---|
| O-REVIEW-FILE | Файл docs/reviews/localization-foundation-kk-review.docx отслеживался Git вопреки правилу AGENTS.md — снят с индекса (единое решение D-REVIEW-FILE) | Operations | DELIVERED |  | AG:Git и среда; KKR | Свидетельство: docs-PR этой консолидации (index-only удаление, `git rm --cached`); локальная копия сохранена; авторитетный .md-пакет остаётся в Git. Проверка зависимостей: на .docx не ссылался ни один отслеживаемый документ, кроме запрета AGENTS.md:147; содержимое .docx дублировало .md (265 строк, 0 заполненных решений) | Правило AGENTS.md сохраняется; файл добавлен коммитом 0c41f2a вместе с несвязанными правками |
| V-CORE | S0–S13: поиск, lifecycle Offer, auth, Seller/Location, Change Set, управление Offer, каталог/алиасы, реальный поиск, geo, ranking, контакты, discovery, batch, интересы | Development | DELIVERED |  | FM; SL:S0..S13 | v0.0.1-s0 … v0.0.14-s13 |  |
| V-UX1 | UX1A–UX2A: app shell, визуальное выравнивание, auth modal, карточки, Nearby, actionability, seller onboarding, адаптивный header | Development | DELIVERED |  | SL:UX1A..UX2A; UXR | v0.0.15-ux1a … v0.0.22-ux2a | Объединённый UX1 — см. X-UX1 |
| V-STAGE1 | Этап 1 продавца без ИИ: цена обязательна, вход/точки продавца, локализация RU/KK, кабинет, единица цены, редактор, витрина, пост-проверка, актуальность, напоминания, экраны покупателя, First Entry (mobile), плитки фото, shortcut фото, связь карточка↔точка | Development | DELIVERED |  | EP; EH; SL; IC:#13,#31,#32,#35,#36 | v0.0.23 … v0.0.41 (теги по именам); offer-photos и point-contacts-hours закрыты по записям EP/EH без отдельного тега | Закрытые Issues #13, #31, #32, #35, #36 — выполнены |
| V-GEO | Seller geo fallback, справочник адресов на открытых данных, видимость Offers без координат, Nearby result-first | Development | DELIVERED |  | UXR:spot-check №1; SL:seller-location-geo-fallback; SL:address-directory; SL:search-visibility-without-coordinates; SL:UX1C-nearby-geo-intent; SL:UX2-seller-onboarding; IC:#34 | v0.0.43, v0.0.44, v0.0.45, v0.0.47 | Закрывает: «address autocomplete — отдельное будущее решение» (UX2) и UX-010 (UX1C) |
| V-GUEST-INTEREST | Кнопка интереса видна гостям | Development | DELIVERED |  | UXR:spot-check №3; SL:buyer-interest-guest-visibility | v0.0.26-buyer-interest-guest-visibility |  |
| V-MARKET-TEXT | Текущая текстовая адресация места: тип точки market/pavilion, подсказка названия «Рынок, павильон, ряд или ориентир», адрес — свободный текст ≤ 500, справочник адресов с marketplace-записями | Development | DELIVERED |  | CODE:locations; SL:seller-trading-points-workspace; SL:address-directory; CSB:recovery report | Свидетельство: DB check типов (`market`,`shop`,`pavilion`,`home`,`other`), строки points.nameHint/type.*, locations.addressText; справочник адресов v0.0.44 (по снимку CS 2026-10-02: 63 marketplace, «Зелёный Базар» найден; не перепроверено) | Это описание существующего, а не оценка достаточности для пилота и не замена #10 (B-MARKET-NAV). Не проверено: находит ли поиск по тексту ряда/места |
| V-PHONE-GROUP | Группировка цифр телефона при вводе (#42) | Development | DELIVERED |  | IC:#42 | В коде: formatKzPhoneInput в AuthModal.tsx (отдельного тега нет; точный slice не установлен) | Issue закрыт как COMPLETED |
| V-SORT | Явная сортировка Расстояние/Цена/Актуальность с направлением; компактный контрол сортировки | Development | DELIVERED |  | FM:AI-first п.11; IC:#12; UXD:§3 | v0.0.46, v0.0.51, v0.0.60 | Закрытое поведение не пересматривать без нового основания (UXD §3) |
| V-S15 | Production KB v1, catalog runtime loop, S15B (suggestions, known-zero, autocomplete, product-as-signal, relevance default), S15C/D0 | Development | DELIVERED |  | EP; EH; FM; SS:§24; DM:D0; GS:G3 | v0.0.52 … v0.0.61 | Закрывает пункты SS §24: suggestions, product_id, без OR, raw_fallback, known-zero, search_events, sort. Не закрыто: unresolved interest/watch (M-D2) |
| V-R1R2 | R1 локальный bootstrap и R2 backup/restore | Operations | DELIVERED |  | EP; SL:local-bootstrap-verification; SL:backup-restore | v0.0.62, v0.0.64 (+v0.0.63, v0.0.65 как test-fix) | Границы приёмки — O-LIMITS |
| V-UXSEARCH | Блок UX/search: словоформы, режим работы на карточке, цена и упаковка, пустые состояния, исправление опечаток | Development | DELIVERED |  | UXD:§4.1,§4.2,§5,§8; EP; AUD | v0.0.66 … v0.0.70 | Ранее записывались как backlog в UXD; не считать открытыми. Typo-slice закрывает также submit-time предложение исправленного запроса из SS §7 B2–B4 в принятой форме (автоисправление, rev 3); fuzzy-подсказки при вводе — B-FUZZY-SUGGEST |
| V-PREVIEW | Просмотр «как видят покупатели»: опубликованная (6a) и до публикации (6b) карточка; ввод цены без букв | Development | DELIVERED |  | UXD:§4.3; EP; EH | v0.0.71, v0.0.72 | Закрывает кандидата UXD §4.3 |
| X-PASS3 | Направление seller UI «Pass 3» и wireframe как UX target | Development | REJECTED |  | EH; FM:AI-first; MEM; CNV:VEioj7KKfjKfhD1RZpivdQ | Признано неверным PO (2026-09-24/25). Замена: AI-first макет rev 1 (PR §18.1) | Историческая палитра Pass 3 не переносится |
| X-FILTER-SHEET | Кнопка/sheet «Фильтры», радиус, цена от–до, sort=cheaper | Development | REJECTED |  | EH; FM:AI-first п.11; IC:#12 | Сняты решением PO при Rev 3. Замена: сортировка Rev 3 (v0.0.51); отдельные фильтры — B-FILTERS |  |
| X-6F | 6F Search Query Log как отдельный slice | Development | REJECTED |  | EP:п.6F/6G; EH | Снята до реализации. Замена: S15C/D0 (v0.0.61) |  |
| X-6G | 6G динамические популярные запросы как отдельный slice | Development | REJECTED |  | EP:п.6F/6G | Переосмыслена. Замена: B-CHIPS |  |
| X-S25 | S25 — hard cap активных Offer / «первые N бесплатно» | Development | REJECTED |  | FM:S25; EP:Commercial correction; CM:§4; DM:§40; CPA:§9 (устаревшее описание лимита); SJ:Деньги | Замена: нет hard cap — Free сохраняет полноценную ручную витрину (решение PO 2026-09-30, подтверждено в PO-сообщении о коммерческих решениях п.13: «не вводить hard commercial assortment cap»; в коде cap не реализован — поиск по src не нашёл). Возврат — только по pilot evidence и новому явному решению PO; допустимы technical/anti-abuse/fair-use limits | Идентификаторы S25–S29 сохранены ради истории; прежняя линейная схема hard cap → subscription → bulk → promotion устарела |
| X-OFFER-WORKSPACE | Seller Offer Workspace (#27) и slice seller-points-contacts | Development | REJECTED |  | IC:#27; SL:seller-cabinet-overview | #27 закрыт NOT_PLANNED. Замена: seller-showcase-editor, seller-trading-points-workspace, point-contacts-hours | Контракты seller-offer-workspace и seller-points-contacts отсутствуют в репозитории |
| X-PHOTO-MANDATORY | Фото обязательно для публикации | Development | REJECTED |  | FM:AI-first п.4; MEM | Отменено PO 2026-09-25. Замена: публикация без фото с напоминанием «карточка неполная» |  |
| X-UX1 | Объединённый UX1 (marketplace shell) | Development | REJECTED |  | SL:UX1-marketplace-shell | Superseded before implementation. Замена: UX1A…UX2A |  |
| X-LANG-URL | Языковые URL /ru, /kk и «РУС / ҚАЗ» в макете First Entry; отдельный языковой экран/gate | Development | REJECTED |  | EP:First Entry; SL:inline-language | Решение PO: язык выбирается один раз и меняется в «Ещё». Замена: inline-язык (v0.0.50) |  |
| X-SEARCH-BUTTON | Кнопка поиска где-либо, кроме «→» в поле при наличии текста | Development | REJECTED |  | EP:First Entry; HO29:§5 | Замена: «→» в поле при наличии текста (решение PO 2026-09-29) |  |
| X-MAP-PIN | Интерактивная карта/pin для seller geo как обязательный путь | Development | REJECTED | NON-GOAL | BR:§21.10; FM:address directory | Исключена как обязательный путь (не вечный запрет): может вернуться только явной contract revision без обязательной зависимости core от платного SaaS. Замена: справочник адресов + разбор ссылки на карту (mockup S12A — Proposed) |  |
| X-TILE-44 | Цели касания 44×44 для ☆/× на плитках фото | Development | REJECTED | LIMIT | HO29:§8; SL:seller-photo-tiles (§6.5) | Осознанное решение PO: 36×44. Замена: нет (принятое отклонение от §18.4) |  |
| X-DESIGN-SYSTEM | Отдельный DESIGN_SYSTEM.md | Development | REJECTED |  | EP:Отменено; HO25:§6; UXB | Удалён 2026-09-25. Замена: принятый макет + PROJECT_RULES §18.1/§18.4 | Ссылки на него остались — O-DOC-DEBT |
| X-DEMAND-V1 | Вне Demand v1 (DM §38, §25): доступ к individual buyers, buyer leads, «этот человек ищет ваш товар», точные координаты, heatmap с деанонимизацией, raw query log для продавца, закупочный прогноз в кг/шт, AI forecast, dynamic pricing, координация цен, выручка/склад конкурентов, Opportunity Score, ad auction, CPC/CPM, sponsored ranking, citywide Business heatmap, export/API, ML recommendations | Development | REJECTED | NON-GOAL | DM:§25,§38 | Ограниченный по объёму non-goal (не вечный запрет): исключены из v1 Demand; возврат — только явным решением PO и новым contract. Замена: не требуется | Demand v1 — market signal, не прогноз закупок |
| X-BO-NONGOALS | Вне этапа планирования Backoffice (BO §8): giant Backoffice, отдельный admin backend, generic CRUD, Billing UI/провайдер/subscription engine, новые billing tables, Boost/Business implementation, seller-facing paid Demand, hard active-Offer cap, generic enterprise RBAC/финальные меню/permission matrix до Operations Map | Development | REJECTED | NON-GOAL | BO:§8 | Ограниченный по объёму non-goal этапа планирования (не вечный запрет); реализация — отдельными slices после K-PLANNING. Замена: не требуется |  |
| X-GROWTH-DONOTS | Чего не делать на запуске (GS §6): оптимизировать регистрации; распылять первых продавцов по всему Алматы; покупать трафик до ликвидности supply; автоматически создавать Products из запросов; автоматизировать Bounty до ручной экономики; публиковать счётчики спроса без реальных данных; массово генерировать SEO-страницы без свежих Offers; смешивать sponsored placement с organic | Operations | REJECTED | NON-GOAL | GS:§6 | Ограниченные принципы strategy backlog (не вечный запрет); пересмотр — решением PO. Замена: не требуется |  |
| X-UXR-REJECTS | Отклонено в аудите UX-корпуса (UX_REFERENCE_INDEX, #37): авто-sticky Search/header как универсальное требование; популярность/рейтинг/новизна как сортировка по умолчанию; спекулятивные крупные панели фильтров; корзина, оформление, доставка, оплата, add-to-cart; скидки/старая цена/клубная цена без контракта; фальшивые рейтинги/отзывы; обязательное реальное фото до M1 и выдача демо-медиа за фото продавца; копирование соцвитрин/маркетинговых механик; использование UX-советов («без CAPTCHA», альтернативные входы) для ослабления будущей anti-abuse | Development | REJECTED | NON-GOAL | UXR:Issue #37 audit conclusions | Ограниченные по объёму решения аудита (не вечный запрет); пересмотр — решением PO. Замена: не требуется | ADAPT-пункты аудита (автозаполнение телефона, читаемое форматирование и краткое пояснение про OTP как presentation) — не требования; формат телефона поставлен (V-PHONE-GROUP) |
| X-CANONICAL-ONLY | Жёсткий canonical-only поиск: выбранный Product режет выдачу только по offers.product_id; отдельный raw fallback только по явному «Искать как введено» (SS §1, §4, §7, S15B-3) | Development | REJECTED |  | SS:§1,§4,§7,§19.4,§20; ATT:d1b687b0; SL:s15b4a-product-as-signal | Заменено решением PO: единая модель релевантности, Product — сильный сигнал, а не фильтр; свободные названия не исчезают. Замена: v0.0.58-product-as-search-signal, v0.0.59-search-relevance-default | Fuzzy-часть spec — B-FUZZY-SUGGEST. Также заменены: режимы mode=catalog\|raw_fallback и параметр mode=raw_fallback (SS §19.4, §20) единой выдачей; radiusM (SS §19.3) снят в Rev 3. Поставлено из SS §19–§20: разрешённый Product в ответе (resolvedProduct) и различение «известный Product, ноль» / «неизвестный» |
| X-TEMP-ISSUES | Случайные Issues #20–#23, #28, #29 | Operations | REJECTED |  | IC | Закрыты NOT_PLANNED как случайные. Замена: нет |  |
| X-UXD-NOT-ADOPTED | Не принято автоматически из UX-обзора (UXD §6) и замечания к сортировке (UXD §3) | Development | REJECTED | NON-GOAL | UXD:§3,§6; UXA:§2.3,§2.10,§3,§6 | Не принято из-за отсутствия доказательного основания (не вечный запрет):  перенос поиска в верхнюю треть; удаление чипов; фотокатегории только под свежие продукты; удаление двух названий/типа точки без проверки функций; автоудаление пустых черновиков (риск потери данных); удаление стрелок галереи без проверки доступности; скрытие юридического предупреждения после первого показа; переименование подтверждения актуальности в обещание свежести; замена «Маршрута» контактом; выводы о retention без данных; переоткрытие slice сортировки из-за названия default и стрелок | Каждый пункт может быть пересмотрен только новым основанием/данными и решением PO. Замена: не требуется |

## Former «INSERTION CANDIDATES» плана — оставшиеся требования (дословно)

_Источник: `EXECUTION_PLAN.md` на `67113c9`. Невыполненные требования ведёт `REQUIREMENTS_REGISTER.md` (EP:insertion в столбце «Источники» реестра указывает на этот раздел). Правило вставки сохранено в плане._

### INSERTION CANDIDATES

Insertion candidate не имеет жёсткого номера. Он рассматривается **только на checkpoint/re-evaluation boundary** и никогда не вклинивается внутрь уже открытого slice.

#### Market internal navigation — Issue #10

- earliest sensible point: после этапа 1;
- trigger: пилот на крупных рынках показывает, что обычного route до Location недостаточно;
- direction: Market directory → scheme/MarketPlaces → Location binding → buyer internal navigation;
- default without trigger: остаётся unscheduled.

#### Additional Search filters (отдельно от #12)

Сортировка «Расстояние / Цена / Актуальность» с направлением закрыта Stage 6 Rev 3 (`v0.0.51`). Радиус и цена от–до
в Rev 3 **сняты**; отдельные фильтры (радиус, диапазон цены, тип точки, фото/контакты, rating) не добавляются без нового
решения PO и своей data/usefulness-основы. Trigger: PO подтверждает конкретный filter use case.

#### M2 — публичное видео предложения

- earliest: после фото этапа 1;
- целевой макет предусматривает до 5 фото + 1 публичное видео;
- trigger: Product Owner подтверждает, что видео нужно покупателю, а не только как вход для ИИ.

#### Отзывы, рейтинг, жалобы на фото

В целевом макете (AI-S20–S22, AI-B03–B06, AI-M03–M05). Отдельный committed slice не определён.

- trigger: Product Owner утверждает trust/review use case, antifraud и moderation semantics;
- до этого нельзя показывать fake rating/reviews;
- решение PO (2026-09-25): жалоба — **на карточку целиком**, не только на фото; причина выбирается после нажатия
  (`FEATURE_MAP.md`, «Seller AI-first model», п. 9). Макет AI-B05 / AI-B06 / AI-M03 и brief §14.3 перерабатываются
  при подготовке этого этапа.

#### Архив и удаление карточек

В целевом макете (AI-S15–S17): архив с восстановлением и сроком хранения — раздел архива с датой переноса и остатком срока, «Подтвердить и восстановить», исчезновение через 30 дней после переноса, необратимое «Удалить». Требует server jobs, точной temporal semantics и пересмотра R2 (фото неизменяемы и не удаляются). Поставлено частично: стадия актуальности `archived` (≥ 336 ч без подтверждения) как статус карточки продавца. Не поставлено: всё перечисленное выше. Подробности и открытые решения — `REQUIREMENTS_REGISTER.md`, запись S-ARCHIVE.

#### OTP resend + timer

`AuthModal.tsx` не имеет resend-механизма; `S2-auth/FEATURE_SPEC.md` выносит resend/throttling за scope S2.

- earliest: unscheduled — требует product/security решения;
- trigger: Product Owner выбирает naive resend или отдельный slice с throttling ближе к launch.

#### Промо-баннер над строкой поиска (решение PO, 2026-09-29)

Место над строкой поиска у покупателя под акции, новинки и другую информирующую / вовлекающую маркетинговую
информацию.

- earliest: после экранов покупателя по макету;
- экраны покупателя не реализуют баннер, но их вёрстка не должна мешать вставить его над строкой поиска;
- перед контрактом: кадр дизайнера, кто и как управляет содержимым (оператор), правила маркировки рекламы и связь с
  монетизацией / продвижением (stage 12, S28–S29).

#### Стартовая страница сервиса — First Entry (остаток)

Мобильная часть поставлена (`v0.0.38-first-entry-mobile`, `v0.0.48-first-entry-correction`); исходный текст решений PO 2026-09-29 перенесён в `EXECUTION_HISTORY.md`. Остаток: недавние запросы на повторном визите не спроектированы; финальный слоган; десктоп ≥ 1280 (PO: не берём, в последнюю очередь); промо-баннер над поиском (см. выше); казахские строки — черновик, нужна вычитка.

#### Тёмная / светлая тема (пожелание PO, 2026-09-29)

Переключатель темы в «Ещё» (у покупателя и у продавца), рядом с «Язык». Срок не назначен. В макете и токенах только
светлая тема — нужны тёмные токены и кадры дизайнера (`PROJECT_RULES.md` §18.1); палитру агент не придумывает.

#### Правки экранов продавца после ручного просмотра PO (остаток)

Поставлены `seller-photo-tiles` (`v0.0.39`) и `seller-card-point-link` (`v0.0.41`); исходный текст перенесён в `EXECUTION_HISTORY.md`. Без кадра/контракта пока: контакты точки «по умолчанию» (показать мой номер, проверка номера — расширение point-contacts-hours), избранное покупателя, жалоба на карточку (этап отзывов и жалоб).

#### Аналитика поиска и живой главный экран покупателя (остаток)

Поставлено: запись поисковых событий D0 (`v0.0.61`), Search Home с curated-чипами (`v0.0.49`), объяснение при опечатке (`v0.0.70`); исходный текст решения перенесён в `EXECUTION_HISTORY.md`. Остаток: выдача сразу на главном экране (ближайшее при геолокации, иначе популярное) и популярное из реальных данных — по readiness-gate D0/D1 (динамические чипы). Кнопка поиска: решение PO — только «→» в поле при наличии текста.

#### Unify buyer Search entry points

`HeaderSearch` (full-page GET) и `SearchForm` (client-side fetch) на `/` ведут себя по-разному.

- earliest: unscheduled;
- direction: унифицировать submission behavior, не меняя closed Search semantics (S0/S6/S7/S9).
