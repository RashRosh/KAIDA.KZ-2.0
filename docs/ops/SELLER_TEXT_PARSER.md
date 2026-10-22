# Seller text parser (real mode) — operations

Owning contract: [seller-ai-text-real-parser](../slices/seller-ai-text-real-parser/SLICE_CONTRACT.md). Pinned
configuration: [C2_CONFIGURATION.md](../slices/seller-ai-text-real-parser/C2_CONFIGURATION.md). Production enablement
is a separate PO decision (D-4); nothing here authorizes it.

## What runs where

- The **KAIDA app** builds the C2 messages, calls the service, validates the answer, runs the reducer and safeguards,
  resolves the catalog and writes private drafts. Seller text is sent to the service; nothing else about the Seller.
- The **inference service** (`ops/seller-text-parser/c2_inference_server.py`) serves only `Qwen/Qwen3-4B` at revision
  `1cfa9a7208912126459214e8b04321603b3df60c`, float16, greedy, thinking off, 2048 new tokens, one request at a time.
  It refuses to start if the loaded revision differs. It has no database, catalog or credentials of the app.
- **Residency:** temporary tests may use foreign infrastructure with synthetic or PO-authored text only and the
  allowlisted test seller only. Production processing of seller text is in Kazakhstan, with request logging disabled.
- **Platform terms:** check that the host's terms allow serving an inference endpoint for KAIDA before using it.
  Kaggle and free Colab do not (contract §12 D-1).

## App configuration (deployment environment only, never Git)

| Variable | Value |
| --- | --- |
| `SELLER_TEXT_INPUT` | `real` (default `off`; `fake` for local demos and CI) |
| `SELLER_TEXT_PARSER_URL` | service base URL; the app posts to `<base>/v1/chat/completions`. Loopback may be `http`, anything else `https` |
| `SELLER_TEXT_PARSER_API_KEY` | same key as the service; required for every non-loopback URL; ≥ 32 characters |
| `SELLER_TEXT_PARSER_TIMEOUT_MS` | 1 000–180 000, default 60 000 |
| `SELLER_TEXT_PARSER_CONCURRENCY` | 1–8, default 1; more parallel requests get «Сервис занят» |
| `SELLER_TEXT_INPUT_ALLOWLIST` | comma-separated user IDs or login phones (E.164) allowed to use `real`; empty → nobody |

An invalid `real` configuration turns text input `off` and logs one line naming the broken rule (never the value).
Restart the app after changing these variables.

Generate a key: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it in the
service host's environment and the app's environment only. Never paste it into chat, issues, logs or Git.

## Running the service (GPU host)

1. Python ≥ 3.12, `pip install -r ops/seller-text-parser/requirements.txt` (torch from the CUDA wheel index).
2. `KAIDA_PARSER_API_KEY=<key> python ops/seller-text-parser/c2_inference_server.py --host 127.0.0.1 --port 8000`
3. The first line printed is `{"event": "ready", ...}` with torch/transformers versions and GPU names. Record it.
   Differences from the evidenced stack (torch 2.11.0+cu128, transformers 5.16.1, Tesla T4) are allowed but must be
   reported with the quality comparison.
4. Reaching it from the app: a loopback URL on the same machine, or an HTTPS tunnel/forward to the loopback port.
   **Any tunnel or forward makes the service public: the key is mandatory.** `--allow-no-auth` is only for a service
   and app on the same machine with no tunnel. Close the tunnel and stop the service after the test session.

The service logs one line per request (method, path, status, milliseconds, token count) — never text or headers.
`GET /healthz` answers `{"ok": true}` without the key.

## Temporary test on Modal (candidate for D-1)

Facts checked 2026-10-21 on Modal's official pages:
- **Payment method:** "you must have a payment method on file in order to use Modal" ([billing](https://modal.com/docs/guide/billing)), and
  "Using a GPU requires having a valid payment method on file" ([GPU](https://modal.com/docs/guide/gpu)). A card is
  therefore required even when all usage stays inside the free credits.
- **Credits:** Starter is $0/month with $30/month free credits, 10 GPU concurrency ([pricing](https://modal.com/pricing)). Own containers,
  including a GPU web server, count as normal compute. T4 ≈ $0.59/hour (third-party listings; Modal's own GPU price
  table is not rendered as text). This test is expected to use well under $5.
- **Overage protection:** the Workspace *usage limit* and *spend limit* ([budgets](https://modal.com/docs/guide/budgets)). "When the spend limit is
  reached, Modal stops workloads that would incur additional out-of-pocket charges." Set the spend limit to the lowest
  allowed value (target $0) and the usage limit to $30 before deploying. Whether $0 is accepted is visible only in the
  account; if it is not, the lowest accepted value is the maximum possible charge.
- **Region:** by default, inputs are routed through `us-east` (Virginia) and containers run in any region ([region
  selection](https://modal.com/docs/guide/region-selection)). Pinning a region costs 1.15–1.75×. This is acceptable for synthetic test text only, not
  for seller data.
- **Terms** ([terms](https://modal.com/legal/terms), effective May 2026): commercial use; Customer Data is expunged after processing; Modal does not
  train models on it; crypto-mining and similar uses are prohibited. Nothing excludes our own inference service.
- **Model and runtime:** `ops/seller-text-parser/modal_app.py` builds Python 3.13, torch 2.11.0 (cu128 wheels) and
  transformers 5.16.1. It bakes the pinned revision into the image (the repository is public, not gated, licence
  `apache-2.0`) and runs the unchanged wrapper on one T4, the GPU type of the evidenced run.
  Settings: `max_containers=1`, one input per container, `scaledown_window=120` (scale to zero), bearer key from the
  Modal Secret.

Steps (account owner):
1. Create a Modal account. Add a payment method only if PO accepts that. Set the spend limit and usage limit as above.
2. On the operator machine: `pip install modal`, then `modal token new` (browser login; the token stays in
   `~/.modal.toml`, never in Git).
3. Generate a key (see above). Run `modal secret create kaida-c2-parser-key KAIDA_PARSER_API_KEY=<key>`.
4. Run `modal deploy ops/seller-text-parser/modal_app.py` from the repository root. The first build downloads about
   8 GB of weights into the image. Note the printed `https://…modal.run` URL.
5. Warm up: request `<url>/healthz` until it answers `{"ok": true}`. The first start loads the model.
6. For the app or `live-check.ts`, set `SELLER_TEXT_PARSER_URL=<url>`, `SELLER_TEXT_PARSER_API_KEY=<key>` and
   `SELLER_TEXT_PARSER_TIMEOUT_MS=180000` (cold starts).
7. After testing: `modal app stop kaida-c2-parser`, then `modal secret delete kaida-c2-parser-key`. Check usage on the
   Usage & Billing page.

## Checks

Run from a KAIDA checkout with the app variables above exported in the shell (synthetic text only):

- **Smoke (§9.2):** `pnpm exec tsx ops/seller-text-parser/live-check.ts smoke` — five synthetic messages through the
  full app parser. Pass = every case `ok`. Record the timings and the GPU's peak memory (`nvidia-smi`) during the run.
  This proves the integration, not quality.
- **Quality (§9.3):** `pnpm exec tsx ops/seller-text-parser/live-check.ts control28 --out <dir>` writes
  `live_C2.jsonl` (the script-2.2 row format) and `comparison.json` (per message: identity, byte equality with the
  saved C2 answer — reported, not required — and equality of the extracted facts). Score with the evidenced scorer:
  `python -I tests/fixtures/seller-text-real-parser/kaida_extract_exp.py score <dir>/live_C2.jsonl --split test --errors 28`
  (set `PYTHONIOENCODING=utf-8` on Windows). Self-check without a model: `live-check.ts saved --out <dir>` + the same
  score command reproduces the recorded 25/28. Regressions on messages the saved C2 run got right are listed for PO.
- **App:** with `SELLER_TEXT_INPUT=real`, the allowlisted seller uses «Написать списком»; the server logs one line per
  submission (`event: seller_text_input`, input id, outcome, duration, counts, configuration id) — never text.

## Retry protection and data

`seller_text_submissions` (migration `0030`) keeps, per Seller and request id, a salted text digest, the outcome and
the created draft IDs with the review notes for 24 hours; expired rows are deleted on later submissions. It never
stores the text. Drafts keep `aiHints.sourceQuote` (≤ 500 characters) as in slice 1; published offers carry no hints.

## Rollback

Set `SELLER_TEXT_INPUT=off` (or remove it) and restart the app: the text option disappears, existing drafts stay
ordinary drafts, manual entry is unaffected. Stop the service and close any tunnel. Code rollback: revert; the
additive submissions table may stay or be dropped (it holds nothing older than 24 hours).
