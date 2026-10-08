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

## 4. Liquid AI — local decision / generation candidates

Sources:
- https://www.liquid.ai/blog/d1-open
- https://huggingface.co/LiquidAI/d1-3B
- https://huggingface.co/LiquidAI/d1-3B-GGUF
- https://huggingface.co/LiquidAI/LFM2.5-2.6B
- https://huggingface.co/LiquidAI/LFM2.5-Embedding-350M
- https://huggingface.co/LiquidAI/d1-omni-600M
- https://www.liquid.ai/lfm-license

### d1-3B — preferred local decision-model candidate

Liquid released `d1-3B` as a 3.12B-parameter multimodal decision model. It takes a state (text, JSON, image, or a mix) plus typed questions and returns calibrated answers such as yes/no, one choice from named options, or an ordered score. It is not a chat model and does not generate prose.

This matches several KAIDA needs unusually well:

- choose one `Product` from a short candidate list;
- answer `none / ambiguous / confident match`;
- check whether an extracted price/status/product interpretation contradicts the raw seller input;
- produce a confidence gate before a row enters `SellerChangeSet` preview;
- act as a local second-opinion / guard without sending data to an external decision API.

Candidate path:

```text
seller input
→ extraction
→ lexical / embedding top-K Product candidates
→ d1-3B typed decision
→ Product / none / ambiguity + confidence
→ proposed SellerChangeItem
→ seller review
```

Important operational advantage over Jev: `d1-3B` is open-weight and can run locally. Liquid publishes GGUF builds; the current `Q4_K_M` artifact is about 1.67 GB and is documented for `llama.cpp` and Ollama. This makes it a plausible Kazakhstan-hosted production candidate if its KAIDA benchmark is good enough.

Language support must **not** be assumed from the generic “16 languages” model tag. The d1 model card currently does not enumerate Russian/Kazakh support in enough detail to waive testing. KAIDA must benchmark Russian, Kazakh and mixed-language seller input explicitly.

### LFM2.5-2.6B — generative competitor to the selected Qwen-class extractor

`LFM2.5-2.6B` is a 2.69B general-purpose text model with local GGUF/ONNX deployment options and an official language list that includes Russian but does not include Kazakh.

Use it as a benchmark candidate for:
- seller text → structured facts;
- latency / CPU / RAM comparison against Qwen-class models;
- lightweight fallback or specialist tasks where Russian performance is sufficient.

Do **not** replace the Qwen/Kazakh-oriented candidate by default. Kazakh and mixed RU/KK performance remain a mandatory test.

### LFM2.5-Embedding-350M / ColBERT-350M — low priority for KAIDA today

Liquid's retrieval models are compact and explicitly target semantic product search, but their documented supported languages currently do **not** include Russian or Kazakh.

Therefore they are not first-line KAIDA embedding candidates today. They may be retested later if language support expands or a KAIDA-specific fine-tune becomes justified by evidence.

### d1-omni-600M — interesting future multimodal guard, not a voice solution today

`d1-omni-600M` accepts text/image and text/audio and is intended for typed decisions such as routing, classification, reranking and checks. However, Liquid states that the audio capability was trained on requests between an English speaker and an assistant.

Therefore it is **not** a validated RU/KK Seller Voice solution. Keep it as a future experiment only.

### License risk

Liquid models use the **LFM Open License v1.0**, not Apache 2.0.

Current terms allow commercial use without a separate paid license while company annual revenue is below USD 10 million. Above that threshold, commercial use requires a commercial license from Liquid AI.

For KAIDA this is not a current blocker, but it is a real future vendor/licensing constraint and must be included in any production decision. Apache-2.0 alternatives retain lower licensing risk.

### Current ranking of roles

As of 2026-10-08, the working benchmark order is:

```text
Structured Seller extraction:
Qwen/Kazakh-oriented local model
vs LFM2.5-2.6B
vs other current small local models

Semantic Product candidate generation:
EmbeddingGemma 2
vs other RU/KK-capable local embeddings
vs deterministic aliases/fuzzy baseline

Typed Product resolution / confidence:
d1-3B
vs Jev on synthetic data
vs generative LLM resolver
vs other local decision models
```

This ranking is a research hypothesis only. Benchmark results, not model reputation, decide adoption.

## 5. Candidate architecture, not a commitment

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

## 6. Mandatory evaluation gate

When the relevant Search or AI Input slice starts, compare at least:

1. current deterministic aliases/fuzzy baseline;
2. EmbeddingGemma 2;
3. other strong local multilingual embedding models available at that date;
4. generative local resolver (for example the selected Qwen-class model);
5. Jev or similar typed-decision service **only on synthetic data unless residency becomes compliant**;
6. Liquid d1-3B and other local/open alternatives to Jev available at that date;
7. LFM2.5-2.6B and other small local generative competitors to the selected Qwen-class extractor.

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

## 7. Storage / infrastructure hypothesis

If semantic vectors are proven useful, prefer the smallest architecture that works:

```text
PostgreSQL
+ pgvector (if justified by measured need)
+ local embedding service/model
```

Do not introduce a separate vector database, external semantic-search SaaS, or AI orchestration platform without measured need.

## 8. Trigger points

Revisit this note when one of these begins:

- S17–S20 AI Input;
- a Search slice that explicitly requires semantic Product resolution beyond current aliases/fuzzy rules;
- multimodal Seller Input product matching;
- Issue #75 Product-vs-Offer parsing/confidence work;
- a production-server AI benchmark near MVP.

At that point, update the candidate list because this market changes quickly. The names in this document are candidates, not permanent vendor choices.
