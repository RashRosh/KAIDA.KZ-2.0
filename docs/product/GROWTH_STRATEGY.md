# KAIDA.KZ Growth & Marketplace Liquidity

**Status:** STRATEGY BACKLOG — NOT IMPLEMENTATION AUTHORIZATION

Этот документ не меняет порядок и gates `EXECUTION_PLAN.md` и не конкурирует с Feature Map / Slice Contracts.

**Mapping на существующий Demand workstream** (не новый параллельный поток; owning implementation workstream — Demand, `FEATURE_MAP.md` D0–D6, S15C, Issue #55):

| Growth | Demand |
|---|---|
| G3 Demand Capture | S15C / D0 |
| G4 «Я хочу это» | D2 / explicit waiting intent |
| G5 Demand Aggregation | D1 / D3 |
| G6 Buyer Return | D2 / D5 |
| G7 Seller Demand Signal | D3 |

G0–G2 (go-to-market, seeding, QR) и G8–G10 (Bounty, Demand Radar, SEO) этим mapping не покрываются и остаются strategy backlog до отдельных решений PO.

## 1. Purpose

KAIDA.KZ has a two-sided cold-start problem. Buyer acquisition is useless if searches regularly return nothing; seller acquisition is weak if sellers see no buyer demand.

The launch strategy therefore optimizes for **marketplace liquidity**, not raw registrations, traffic, or city-wide coverage.

Core growth loop:

```text
SEARCH
  ↓
FOUND ──────────────→ BUYER ACTION
  │
NOT FOUND
  ↓
I WANT THIS
  ↓
DEMAND SIGNAL
  ↓
SELLER ACQUISITION
  ↓
NEW OFFER
  ↓
BUYER RETURN / NOTIFICATION
  ↓
SEARCH / DISCOVERY
```

This extends the product core rather than replacing it:

`Seller Input → Offer → Search / Matching / Discovery → Buyer Action`.

## 2. Rules

1. Growth work does not bypass the normal vertical-slice process.
2. This document is a strategy backlog, not authorization to implement all mechanisms.
3. Only the next justified growth mechanism may enter `EXECUTION_PLAN.md` as a concrete slice.
4. Product mechanisms are implemented only after their prerequisites exist.
5. Operational launch experiments should be manual before they are automated where practical.
6. Do not optimize for registrations. Optimize for successful buyer outcomes and useful supply density.
7. Do not launch broadly across Almaty until a smaller launch cell demonstrates useful search liquidity.
8. Zero-result demand must not automatically create `Product` entities. Catalog governance remains separate.

## 3. Growth backlog

### G0 — Launch Cell

**Type:** go-to-market / operations

Select one compact launch territory in Almaty and a deliberately limited set of product categories.

Goal: create a place where KAIDA works reliably before expanding geographic coverage.

**Prerequisites:** buyer and seller core flows sufficiently stable for real users.

**Hypothesis:** concentrated supply creates materially better buyer utility than the same number of sellers dispersed across the city.

**Primary metric:** successful-search rate inside the launch cell.

**Supporting metrics:** active Offers per target Product/category; geographic coverage; freshness of Offers.

**Kill / revise criterion:** the chosen cell cannot achieve useful search coverage at a realistic seller-acquisition cost or operational effort.

---

### G1 — Supply Seeding

**Type:** go-to-market / operations

Manually recruit and onboard the initial seller base inside the launch cell. Initial working target: approximately 100–200 active sellers and enough real Offers to make target searches useful. These numbers are hypotheses, not product contracts.

Operators may help sellers create their initial data rather than waiting for self-service adoption.

**Prerequisites:** G0; working seller onboarding and Offer lifecycle.

**Hypothesis:** manually seeded supply is cheaper and faster than paying for buyer traffic into an empty marketplace.

**Primary metric:** active, fresh Offers that produce successful buyer searches.

**Kill / revise criterion:** seller onboarding cost or ongoing freshness maintenance makes the launch-cell economics implausible.

---

### G2 — Seller QR

**Type:** product + physical acquisition channel

Give a seller a stable KAIDA entry point that can be represented as a QR code in the physical selling location. A buyer scanning it enters KAIDA through that seller/context but can continue into the wider product experience.

Possible physical placements: counter, entrance, price card, package, receipt or printed card.

**Prerequisites:** stable public seller/Offer destination and real seller usage.

**Hypothesis:** existing seller foot traffic can acquire buyers more cheaply than cold paid traffic.

**Primary metric:** QR scan → meaningful KAIDA session / search / buyer action conversion.

**Kill / revise criterion:** scans are too rare or do not lead to meaningful KAIDA usage.

---

### G3 — Demand Capture

**Type:** product foundation

Persist and classify real buyer searches so KAIDA can distinguish at least matched, unmatched and zero-result demand.

This is aligned with the existing Search Learning direction and must not automatically mutate the Product Catalog.

**Prerequisites:** real search traffic.

**Hypothesis:** observed search demand reveals both catalog gaps and marketplace supply gaps.

**Primary metric:** share of search traffic that can be reliably classified and analyzed.

**Kill / revise criterion:** query data quality is too poor to distinguish useful demand signals without changing the capture model.

---

### G4 — “Я хочу это” / Demand Intent

**Type:** product growth slice

When a buyer cannot find the desired product, offer an explicit action such as `Я хочу это` instead of ending the journey at an empty result.

The action records buyer demand for a catalog-resolved Product or another controlled demand representation. It must not automatically create a new Product from arbitrary query text.

**Prerequisites:** G3; Identity if persistence requires a user account; catalog/search rules capable of safely associating demand.

**Hypothesis:** a meaningful fraction of zero-result buyers will explicitly preserve their purchase intent.

**Primary metric:** eligible zero-result searches → saved demand conversion.

**Kill / revise criterion:** saved-demand conversion is too low to justify downstream marketplace mechanisms.

---

### G5 — Demand Aggregation

**Type:** product/data

Aggregate compatible demand signals into useful counts and geography/time windows, for example: `37 people are looking for X`.

Counts must be privacy-safe and resistant to trivial duplication or inflation.

**Prerequisites:** G4 and enough real demand volume.

**Hypothesis:** aggregated intent is more useful for supply acquisition than isolated zero-result queries.

**Primary metric:** number of actionable demand clusters with enough signal to justify seller acquisition or merchandising action.

**Kill / revise criterion:** demand remains too sparse, noisy or manipulable to produce actionable clusters.

---

### G6 — Buyer Return / “Товар появился”

**Type:** product growth slice

When a relevant active Offer appears for demand previously saved by a buyer, KAIDA can return that buyer to the marketplace, initially through an appropriate in-product mechanism and later through notifications when the notification capability exists.

Example: `Вы искали X. Он появился.`

**Prerequisites:** G4; Offer lifecycle; reliable matching; notification capability for external delivery.

**Hypothesis:** fulfilled demand creates high-intent repeat usage and converts marketplace supply growth directly into buyer value.

**Primary metric:** fulfilled demand → return → Offer open / buyer action conversion.

**Kill / revise criterion:** matching produces poor relevance or returned buyers rarely engage.

---

### G7 — Seller Demand Signal

**Type:** seller product / acquisition

Expose validated, privacy-safe local demand to relevant sellers, for example: `23 people nearby looked for X during the last 7 days`.

Never fabricate urgency or counts. Do not reveal individual buyers.

**Prerequisites:** G5; enough signal; seller relevance rules; privacy review.

**Hypothesis:** demonstrated nearby demand is a stronger seller acquisition and assortment-expansion argument than generic marketplace marketing.

**Primary metric:** demand signal → seller creates/activates relevant Offer conversion.

**Kill / revise criterion:** sellers do not act on the signal or the signal encourages spam/irrelevant Offers.

---

### G8 — KAIDA Bounty

**Type:** growth experiment first; product later only if proven

Reward users for finding a real seller who can satisfy verified unmet demand.

Example: KAIDA publicly asks users to find a seller of a scarce requested product. Reward is paid only after the seller and qualifying Offer are verified.

**Mandatory first step:** run a small manual experiment before building automation.

**Risk flags:** fraud/abuse; duplicate sellers; self-referral; reward economics; moderation; payment/accounting implications.

**Prerequisites:** proven G4–G6 demand loop and enough unmet demand worth sourcing.

**Hypothesis:** paying for verified supply creation produces more marketplace value per tenge than paying for generic impressions/clicks.

**Primary metric:** verified useful new supply per unit of bounty spend.

**Kill / revise criterion:** fraud, verification cost or acquisition economics erase the advantage.

---

### G9 — Demand Radar

**Type:** data/editorial growth

Use sufficiently aggregated demand data to publish signals such as `Алматы ищет X` or identify unusually underserved products/categories.

This can later become content, PR, seller acquisition material or a data product.

**Prerequisites:** G5 plus sufficient volume and statistical stability.

**Hypothesis:** proprietary demand data creates acquisition and brand value unavailable to ordinary directories.

**Primary metric:** seller acquisition, earned distribution or buyer sessions attributable to Demand Radar outputs.

**Kill / revise criterion:** data is too sparse or obvious to create differentiated value.

---

### G10 — SEO Demand Pages

**Type:** acquisition

Create useful indexable pages around genuine product-location intent, e.g. `Где купить X в Алматы`, only where KAIDA has enough fresh supply to satisfy the query.

Do not mass-generate empty or thin pages from arbitrary query logs.

**Prerequisites:** sufficient Offer density, stable public buyer pages, freshness guarantees, search-demand evidence.

**Hypothesis:** high-intent product/location searches can acquire buyers at lower marginal cost than paid traffic.

**Primary metric:** organic landing → successful search / Offer open / buyer action.

**Kill / revise criterion:** pages lack useful supply, fail to acquire qualified traffic, or become thin-content inventory.

## 4. Execution order

The backlog is not a mandate to implement every item sequentially. Current intended dependency order is:

```text
Product core
   ↓
G0 Launch Cell
   ↓
G1 Supply Seeding
   ↓
real buyer traffic
   ↓
G3 Demand Capture
   ↓
G4 Я хочу это
   ↓
G5 Demand Aggregation
   ↓
G6 Buyer Return
   ↓
G7 Seller Demand Signal
```

`G2 Seller QR` can be tested once stable public seller/Offer destinations exist.

`G8 Bounty` remains manual-experiment-only until G4–G6 are proven.

`G9 Demand Radar` and `G10 SEO Demand Pages` require real data volume and must not be pulled forward merely because they are easy to describe.

## 5. First growth product priority

The first new product growth loop to prioritize after its prerequisites exist is:

```text
zero result
→ Я хочу это
→ demand saved
→ relevant Offer appears
→ buyer returns
→ buyer action
```

This loop is more important than QR, Bounty, Demand Radar or broad paid acquisition because it converts marketplace failure (`nothing found`) into measurable demand and a future reason to return.

## 6. What not to do at launch

- Do not optimize for total registrations.
- Do not spread initial sellers thinly across all of Almaty.
- Do not buy large volumes of buyer traffic before supply liquidity exists.
- Do not automatically create Products from search queries.
- Do not automate Bounty before manual economics and abuse risks are understood.
- Do not publish seller-demand counts without real underlying data.
- Do not mass-produce SEO pages without useful fresh Offers.
- Do not mix sponsored placement into organic relevance rules as a growth shortcut.

## 7. Decision gates

Before any G-item becomes an implementation slice, prepare the normal compact Slice Contract and verify:

- the prerequisite product contracts are already closed;
- one user task can be manually accepted in one pass;
- success metric and failure criterion are defined;
- privacy/security/fraud/payment risks are flagged where present;
- the slice does not silently change Product, Offer, Search or ranking contracts;
- implementation is the smallest diff that can test the hypothesis.

Only then may that mechanism enter the active execution queue.
