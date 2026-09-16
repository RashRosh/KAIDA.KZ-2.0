# KAIDA.KZ 2.0 — Feature Map

Этот документ — **долгосрочная карта capabilities и зависимостей**.

Он не отвечает на вопрос «что делать следующим». Текущая очередь принадлежит только `docs/product/EXECUTION_PLAN.md`.

## Product core

KAIDA.KZ строится вокруг цикла:

`Seller Input → SellerChangeSet → Offer → Search / Discovery → Buyer Action`

Центральная сущность — `Offer`: актуальное предложение конкретного Seller в конкретной Location.

Покупатель не обязан иметь отдельный Buyer profile. `User` — account, `Seller` — seller profile, `Location` — физическая точка продажи, `Product` — каноническая товарная сущность, `Category` — навигационная структура.

## Историческая S-линейка

| ID | Capability | Dependency | Status |
|---|---|---|---|
| S0 | First Search | — | CLOSED |
| S1 | Offer lifecycle / freshness cutoff | S0 | CLOSED |
| S2 | Phone/test-OTP Auth | S0 | CLOSED |
| S3 | Seller + first Location | S2 | CLOSED |
| S4 | First SellerChangeSet → Offer | S3 | CLOSED |
| S5 | Offer management through ChangeSet | S4 | CLOSED |
| S6 | Product catalog + aliases | S0 | CLOSED |
| S7 | Search real seller Offers | S4, S6 | CLOSED |
| S8 | Seller Location coordinates | S3, S7 | CLOSED |
| S9 | Search geo ranking | S1, S8 | CLOSED |
| S10 | Buyer contact actions | S7 | CLOSED |
| S11 | Nearby discovery | S8, S9 | CLOSED |
| S12 | Batch manual SellerChangeSet | S5 | CLOSED |
| S13 | Explicit Product interest | S2, S6 | CLOSED |
| S14 | Discovery by explicit interests | S7, S13 | PLANNED |
| S15 | Search learning / zero-result analysis | S6, S7 | PLANNED |
| S16 | Operator moderation / disable bad Offer or Seller | S7 | PLANNED |
| S17 | AI text → proposed ChangeSet | S12 | LATER |
| S18 | Voice → proposed ChangeSet | S17 | LATER |
| S19 | Photo input → proposed ChangeSet | S17 | LATER |
| S20 | Video input → multi-item proposed ChangeSet | S17, S12 | LATER |
| S21 | Telegram seller input on shared business logic | S17 | LATER |
| S22 | Real SMS provider / public auth gate | S2 | BEFORE PUBLIC LAUNCH |
| S23 | Buyer notifications about interesting Product Offers | S14 | LATER |
| S24 | Deterministic personalized recommendations | S14 + data | LATER |
| S25 | Active Offer volume policy | S5 | LATER |
| S26 | Seller subscription / entitlements | S25 | LATER |
| S27 | Paid seller convenience / accelerated bulk input | S20, S26 | LATER |
| S28 | Offer promotion object | S9 | LATER |
| S29 | Sponsored reach with honest labeling | S28 | LATER |
| S30 | Behavioral ranking | S24 + data | LATER |
| S31 | Product rarity signal | data | LATER |
| S32 | Automated moderation / suspicious Offer detection | data | LATER |
| S33 | Seller analytics | S28–S29 | LATER |

S-numbers отражают историческую capability map. Они **не задают текущую execution order** и не запрещают вставлять отдельно одобренные vertical slices между ними.

## Вставленные / уточнённые capabilities

Эти product requirements появились после первоначальной S-линейки. Подробные требования принадлежат GitHub Issues; порядок — `EXECUTION_PLAN.md`.

| Capability | Issue | Main dependencies |
|---|---:|---|
| Market internal navigation / MarketPlace | #10 | Seller, Location, Search |
| Explicit Search sorting: freshness/distance/price | #12 | S9, mandatory price, freshness policy |
| Seller Offer Workspace | #27 | SellerChangeSet, mandatory price, Locations |
| Seller Freshness Policy 2/7/14 | #31 | S1, S5, S9 |
| Seller Freshness Reminder | #32 | freshness policy, seller workspace |
| Nearby result-first UX | #34 | S11 / closed geo privacy |
| Seller contextual entry/auth | #35 | S2, app shell |
| Multiple Trading Points Workspace | #36 | Seller, Location, S8 |
| UX reference / Design System reconciliation | #37 | docs/design maintenance |
| M1 real Offer media | tracked by execution plan | Offer, seller workspace, buyer cards |

Mandatory Offer Price is already CLOSED at checkpoint `v0.0.23-mandatory-offer-price`; it is no longer future work.

## Domain evolution principles

### Seller Input

Все manual/AI/channels должны сходиться в одну business boundary:

`input → SellerChangeSet → SellerChangeItem → confirmation/apply → Offer`

AI не редактирует Offer напрямую.

### Catalog

Product ≠ search query.

`Query Log → matched/unmatched/zero-result → analysis → controlled Product/alias/Category change`

Пользовательский запрос никогда не создаёт Product автоматически.

### Geo / markets

Generic Location остаётся обычной точкой продажи.

Если internal market navigation становится нужной, она развивается отдельным domain contour:

`Market → MarketPlace → Seller Location`

Рынок не становится архитектурным центром KAIDA.KZ.

### Media

Seller-provided Offer media принадлежит Offer. Product canonical image/icon — отдельная capability.

Offer media presentation и AI photo/video seller input — разные задачи и не должны смешиваться.

### Reviews / trust

Reviews/rating допустимы только после отдельного data/moderation contract. Нельзя рисовать fake rating или reputation proxy заранее.

### Monetization

Разделять:

- volume limits;
- seller convenience;
- Offer reach/promotion.

Promotion не обходит organic relevance/freshness eligibility.

## MVP boundary

MVP должен доказать три цикла:

**Seller loop**  
`Seller сообщает → подтверждает/обновляет → Offer остаётся актуальным`

**Buyer pull loop**  
`Buyer ищет → находит актуальный Offer → связывается / строит маршрут`

**Buyer discovery loop**  
`Buyer открывает KAIDA → видит актуальные Offers рядом или по явным интересам`

После S16 и committed core contour выполняется отдельный MVP/public-beta review. Само наличие будущих AI/monetization capabilities не является blocker для закрытого MVP.

## Что не строим заранее

Без отдельного slice и измеримого сигнала не создавать:

- микросервисы;
- event bus/Kafka;
- separate search cluster;
- vector DB;
- Kubernetes;
- ML ranking;
- generic notification platform;
- сложную entitlement architecture;
- пустые domain modules «на будущее».

Текущую последовательность всегда брать из `docs/product/EXECUTION_PLAN.md`.
