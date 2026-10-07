# KAIDA.KZ — AI / semantic technology candidates

**Status:** research backlog / not an implementation contract  
**Updated:** 2026-10-08  
**Purpose:** preserve promising AI/search technologies for the moment when the owning KAIDA slice reaches them, without turning a fresh tool into a dependency prematurely.

This note does **not** authorize implementation and does not change closed contracts. Model/provider choice must be made by a task-specific benchmark on KAIDA data and must obey production data-residency rules.

## 1. Stable architecture boundary

The core chain remains:

```text
Seller Input
→ proposed SellerChangeSet
→ seller review / confirm
→ Offer
```

AI does not write `Offer` directly.

For buyer search, canonical `Product` remains the resolution target. Semantic tooling may help produce or rank candidates, but it must not create new Products automatically or bypass Search visibility/ranking contracts.

## 2. EmbeddingGemma 2 — primary semantic/multimodal candidate

Source:
- https://blog.google/innovation-and-ai/technology/developers-tools/embeddinggemma-2/
- https://developers.googleblog.com/en/embeddinggemma-2-the-developer-guide/
- https://ai.google.dev/gemma/docs/embeddinggemma/model_card_2

Why it matters for KAIDA:

- open Apache 2.0 model;
- 740M total parameters, with modular text/vision/audio loading;
- unified embedding space for text, images, video and audio;
- multilingual support;
- 768-dimensional vectors with supported truncation to 512 / 256 / 128 dimensions;
- designed for local/on-device inference, so it is a plausible fit for Kazakhstan-hosted production.

Potential KAIDA roles:

### Buyer Search

```text
buyer query
→ embedding
→ nearest canonical Product candidates
→ deterministic KAIDA resolution / filters / Offer visibility
```

Useful for colloquial names, cross-language wording, spelling variation and semantic formulations that aliases/fuzzy matching do not cover well enough.

### Seller Input

```text
seller text / photo / voice / video
→ extraction / modality processing
→ EmbeddingGemma candidate generation
→ short Product candidate list
→ resolver / decision layer
→ proposed SellerChangeItem
```

The key idea is to avoid asking a general LLM to choose from the full catalog when a small local embedding model can cheaply narrow the search space first.

EmbeddingGemma must **not** be assumed superior before benchmark. Russian, Kazakh, mixed-language and real KAIDA product vocabulary require explicit evaluation.

## 3. Jev / System One models — typed decision candidate

Source:
- https://typesafe.ai/blog/introducing-system-one-models-and-jev
- https://api.typesafe.ai/redoc
- https://typesafe.ai/legal/privacy-policy

Jev is a different class of tool from an embedding model or generative LLM. It accepts unstructured state and returns typed probabilistic decisions rather than free-form generated text.

Potential KAIDA roles:

### Product resolver / reranker

After an embedding or lexical layer returns a small candidate set:

```text
input text + candidate Products
→ Jev-like decision model
→ selected Product / none / ambiguity
→ calibrated probability
```

This may be useful for:
- selecting one Product from a shortlist;
- deciding that none of the candidates is safe;
- separating exact Product identity from Offer attributes;
- routing low-confidence cases to seller review;
- detecting ambiguity without asking a large LLM for prose.

### Guard / second opinion

For a proposed SellerChangeItem:

```text
raw seller input
+ extracted fields
+ chosen Product
→ typed questions
→ confidence / contradiction flags
→ accept automatically into preview OR require clarification
```

The decision model must never publish an Offer and must not replace backend validation.

### Current production blocker

As of 2026-10-08, TypeSafe describes its services as TypeSafe-hosted, and its privacy policy states that the services are hosted in the United States. KAIDA production requires user/application data to be stored and processed in Kazakhstan.

Therefore:

- Jev is **not eligible for KAIDA production with real data today**;
- it may be benchmarked on synthetic/non-production examples;
- it can become a production candidate only if a compliant local/on-prem/Kazakhstan deployment path appears and passes security/privacy review.

This restriction applies to equivalent hosted decision services as well.

## 4. Candidate architecture, not a commitment

A useful future pipeline to benchmark is:

```text
Seller Input
    ↓
small local extractor / LLM
    ↓
facts: product wording, price, availability, comment...
    ↓
EmbeddingGemma 2
    ↓
top-K Product candidates
    ↓
typed decision / reranker
(Jev-like or local equivalent)
    ↓
confidence gate
    ├── high confidence → proposed SellerChangeItem
    └── low confidence  → explicit seller clarification/review
    ↓
SellerChangeSet preview
    ↓
seller confirm
    ↓
Offer
```

For buyer search:

```text
query
→ lexical/alias path + semantic candidate path
→ candidate merge
→ resolver/reranker
→ canonical Product or unresolved
→ existing Search/Offer rules
```

This is a benchmark hypothesis, not an approved implementation design.

## 5. Mandatory evaluation gate

When the relevant Search or AI Input slice starts, compare at least:

1. current deterministic aliases/fuzzy baseline;
2. EmbeddingGemma 2;
3. other strong local multilingual embedding models available at that date;
4. generative local resolver (for example the selected Qwen-class model);
5. Jev or similar typed-decision service **only on synthetic data unless residency becomes compliant**;
6. local/open alternatives to Jev available at that date.

Evaluation corpus must include:
- Russian;
- Kazakh;
- mixed Russian/Kazakh;
- spelling mistakes and colloquial product names;
- Product vs Offer-attribute ambiguity;
- multiple products in one seller message;
- negative availability;
- missing price;
- near-duplicate catalog Products.

Metrics should be task-specific, for example:
- Product Recall@1 / @3 / @10 for candidate generation;
- final Product accuracy;
- false confident match rate;
- unresolved/ambiguity precision;
- structured field accuracy;
- latency;
- RAM/CPU usage;
- cost per request if an external service is considered.

A more expensive or larger model is accepted only if it materially improves the metric that blocks product quality.

## 6. Storage / infrastructure hypothesis

If semantic vectors are proven useful, prefer the smallest architecture that works:

```text
PostgreSQL
+ pgvector (if justified by measured need)
+ local embedding service/model
```

Do not introduce a separate vector database, external semantic-search SaaS, or AI orchestration platform without measured need.

## 7. Trigger points

Revisit this note when one of these begins:

- S17–S20 AI Input;
- a Search slice that explicitly requires semantic Product resolution beyond current aliases/fuzzy rules;
- multimodal Seller Input product matching;
- Issue #75 Product-vs-Offer parsing/confidence work;
- a production-server AI benchmark near MVP.

At that point, update the candidate list because this market changes quickly. The names in this document are candidates, not permanent vendor choices.
