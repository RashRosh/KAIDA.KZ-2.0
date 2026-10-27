# Bounded local voice feasibility study

Date: 2026-10-09. Repository main: c4b19c082f8242b766a5c8b3a6515916a20f4174. Research only; no product implementation, queue change or launch approval.

## Recommendation

Local CPU execution is computationally feasible for this small corpus. Neither tested extraction model is ready to adopt: unsupported fields and extra products occur even on reference text; incomplete outputs also occurred on actual transcripts. Transcription quality is language- and synthesis-dependent. Keep the complete voice task as the proposed first AI workflow; do not call shared text processing or reference-text diagnostics a completed seller flow.

## Method and limits

Nine frozen scripted cases: three RU, three KK, three mixed; each group has a single-product case, a multi-product case and ambiguous/missing information. Twelve expected draft items per corpus. The texts and gold fields were fixed before execution and were unchanged for both synthesis passes. See corpus.json and each fixed-corpus.json for exact text, expected fields, durations and WAV SHA256s.

Two locally generated audio passes are retained: robotic eSpeak NG 1.52.0 (34.38 seconds total) and neural Piper RU dmitri/medium + KK issai/high. Mixed audio concatenates language-specific speech segments; it is not natural code-switching. Neither corpus is native-speaker-reviewed. The additional neural pass was added after observing the robotic speech limitation; it is not a blind held-out test. No real-user recordings or data were used.

Same multilingual Whisper base family in both runtimes; whisper.cpp uses GGML floating-point weights, faster-whisper uses CTranslate2 CPU int8. Two threads, beam/best-of 5, temperature 0 for faster-whisper; native defaults retain fallback behavior. RU/KK language is supplied; mixed uses automatic detection. Cold invocation wall times include model load/imports. Runtime order is fixed, OS cache and host paging are uncontrolled; these are observations, not a statistically stable speed ranking.

Extraction uses llama.cpp CPU only, two threads, one slot, 2048-token context, seed 42, temperature 0, JSON-schema constraint and 256-output-token cap. A fixed prompt and six-product vocabulary are in extract_bench.py. This is a research draft schema (product, price, unit, clarify), not the production SellerChangeSet adapter or the full KB. Each model has 9 reference-text diagnostic runs and 18 runs from actual ASR outputs per audio pass; reference diagnostics are reused for the neural pass, not counted as voice success. Warm per-request timings exclude server startup, which is recorded separately.

WER = word-level Levenshtein errors / reference words, with lowercase/punctuation normalization and ё→е. Spoken numbers versus digit output still count as word substitutions. WER can exceed 100% because insertion/repetition counts are unbounded. Draft-field accuracy counts four exact slots per expected item, in spoken order; extra items are reported separately and invalidate exact-case success. Missing/invalid outputs score zero. Null/clarify matches can raise field accuracy even when the product is wrong: inspect exact-case counts.

Invented-missing fields means a non-null price/unit/product where the gold slot is unknown. Extra items are another invention indicator. Unsupported non-null fields also include wrong recognized facts; in actual-transcript runs this does not isolate whether ASR or extraction caused the error. Truncated JSON cannot be fully assessed for inventions and is reported separately, never treated as safe. Brand/location invention is structurally excluded by the schema and was not measured.

Memory is sampled every 50 ms over each process tree plus Windows peak-working-set counters; RSS and private commit are both retained. This is not GPU memory. No concurrent model inference, no Docker resource change, no external inference provider; network was used only for tool/model/document downloads.

## Neural-speech pass: measured results

| Transcription runtime | WER RU / KK / mixed | Median / maximum cold wall (s) | Peak RSS / private MiB |
|---|---:|---:|---:|
| faster-whisper | 86.4% / 195.7% / 91.3% | 4.98 / 9.00 | 323 / 1314 |
| whisper.cpp | 86.4% / 95.7% / 95.7% | 5.95 / 10.08 | 307 / 791 |

| Extractor / transcript source | Exact fields | Exact cases | Invented unknown fields / extra items | Invalid/truncated | Median / maximum request (s) |
|---|---:|---:|---:|---:|---:|
| qwen2.5-0.5b-instruct-q4_k_m / faster-whisper | 28/48 (58.3%) | 0/9 | 2 / 23 | 0 | 5.33 / 7.97 |
| qwen2.5-0.5b-instruct-q4_k_m / whisper.cpp | 23/48 (47.9%) | 0/9 | 2 / 17 | 0 | 4.74 / 8.73 |
| qwen2.5-1.5b-instruct-q4_k_m / faster-whisper | 21/48 (43.8%) | 0/9 | 3 / 15 | 0 | 14.06 / 31.34 |
| qwen2.5-1.5b-instruct-q4_k_m / whisper.cpp | 22/48 (45.8%) | 1/9 | 2 / 8 | 0 | 14.18 / 26.55 |

## Reference-text diagnostics (not voice evidence)

| Extractor | Exact fields | Exact cases | Invented unknown fields / extra items | Median request (s) |
|---|---:|---:|---:|---:|
| qwen2.5-0.5b-instruct-q4_k_m | 27/48 (56.2%) | 0/9 | 2 / 8 | 3.08 |
| qwen2.5-1.5b-instruct-q4_k_m | 35/48 (72.9%) | 2/9 | 3 / 0 | 6.23 |

## Robotic-speech pass (retained limitation evidence)

| Runtime | Aggregate WER | Median / maximum cold wall (s) | Peak RSS MiB |
|---|---:|---:|---:|
| faster-whisper | 295.6% | 3.26 / 5.25 | 323 |
| whisper.cpp | 102.9% | 4.37 / 9.38 | 308 |

Robotic pass raw extraction results, unsupported counts and per-language metrics remain in extraction-results.json and summary.json. Do not discard this unsuccessful pass. Initial PyAV 19.0.1 API failure and Windows stdout encoding repair are retained; final measured faster-whisper uses PyAV 15.1.0. Memory sampling was corrected to include venv child processes before final runs.

## Versions and licenses

- whisper.cpp 1.9.5, release binary b5454: MIT.
- faster-whisper 1.2.1 + CTranslate2 4.8.2: MIT; PyAV 15.1.0.
- llama.cpp 0.6.0-dev, b11524, commit 86a283532: MIT.
- Whisper base weights: MIT. Qwen2.5 0.5B/1.5B Instruct Q4_K_M weights: Apache-2.0.
- eSpeak NG 1.52.0: GPL-3.0-or-later, espeakng-loader 0.2.4. Piper runtime 2023.11.14-2: MIT; bundled phonemizer has its own licensing.
- Piper voice model cards state dataset licenses: RU dmitri CC0, KK issai CC-BY-4.0. RU ruslan (noncommercial) and irina (unknown) were inspected but not selected. These research artifacts are not a production redistribution/licensing approval.

Model revisions and individual weight/tokenizer SHA256s:

```json
{
  "ggerganov/whisper.cpp": {
    "revision": "5359861c739e955e79d9a303bcbc70fb988958b1",
    "license": "mit",
    "files": {
      "ggml-base.bin": "60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe"
    }
  },
  "Systran/faster-whisper-base": {
    "revision": "ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66",
    "license": "mit",
    "files": {
      "config.json": "56a6d8110d311f19c8f0471e562832c7527f146b567275bfca59fcf7c184da9a",
      "model.bin": "d01c3014881c9c6f3133c182f3d2887eb6ca1c789a7538c5c007196857a0a6a9",
      "tokenizer.json": "fb7b63191e9bb045082c79fd742a3106a12c99513ab30df4a0d47fa6cb6fd0ab",
      "vocabulary.txt": "34ce3fe1c5041027b3f8d42912270993f986dbc4bb34cf27f951e34a1e453913"
    }
  },
  "Qwen/Qwen2.5-0.5B-Instruct-GGUF": {
    "revision": "9217f5db79a29953eb74d5343926648285ec7e67",
    "license": "apache-2.0",
    "files": {
      "qwen2.5-0.5b-instruct-q4_k_m.gguf": "74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db"
    }
  },
  "Qwen/Qwen2.5-1.5B-Instruct-GGUF": {
    "revision": "91cad51170dc346986eccefdc2dd33a9da36ead9",
    "license": "apache-2.0",
    "files": {
      "qwen2.5-1.5b-instruct-q4_k_m.gguf": "6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e"
    }
  }
}
```

Official license copies/source URLs: licenses/. Package freeze: packages.txt. Neural voice revision/hashes: speech-sources.json. Binary archive hashes: binary-archives.json.

## Compute and estimated headroom

Windows 11 Pro; Intel i5-11260H, 6 cores / 12 logical CPUs; approximately 7.73 GiB usable host RAM. GTX 1650 4 GiB was present but unused. Docker remained at 3962191872 bytes. First host free-RAM readings were 40.6 and 174.0 MiB; pagefile usage was already about 8.65 GiB. host.json preserves later samples.

- robotic, qwen2.5-0.5b-instruct-q4_k_m: load 2.91s, peak RSS 502 MiB, private 273 MiB, minimum host available 0.6 MiB.
- robotic, qwen2.5-1.5b-instruct-q4_k_m: load 5.62s, peak RSS 1292 MiB, private 977 MiB, minimum host available 0.1 MiB.
- neural, qwen2.5-0.5b-instruct-q4_k_m: load 2.89s, peak RSS 511 MiB, private 246 MiB, minimum host available 1.9 MiB.
- neural, qwen2.5-1.5b-instruct-q4_k_m: load 10.78s, peak RSS 1017 MiB, private 913 MiB, minimum host available 0.1 MiB.

The tested chain executes without measured OOM; it is unsuitable as a validated responsive or accurate seller service. For a cleaner repeat of these same models, estimate at least 2 GiB available memory for sequential inference (observed peak plus margin); 16 GiB total host RAM would provide more coexistence headroom for the current workload. This is an estimate, not a validated minimum or a proposal to change Docker resources. Larger/more accurate ASR models require their own measurement; faster hardware alone will not fix the observed invented fields. No hosting or electricity-price estimate was validated; there were no paid-service calls.

## Proposed complete user-facing slices (unapproved)

1. Single-product voice: recording/re-recording -> real transcription -> proposed ChangeSet -> seller correction/review -> explicit confirmation, including RU/KK/mixed quality, unclear price/unit and manual fallback. Resolve recording-retention and quality acceptance before implementation.
2. Multi-product voice: one dictation -> individually editable drafts -> partial/batch confirmation, missing-field clarification and duplicate-safe retries.
3. Resumable voice processing: leave/reopen after upload, recover interrupted work, resolve late results after manual fallback without duplicates, and verify private audio deletion/retention. Base failure handling is required in slice 1; this extends durability rather than shipping an incomplete first flow.

Every slice must finish a seller task through confirmation; internal extraction is never an independently completed seller flow. Photos then add image/OCR evidence and video adds audio/frame selection/product deduplication, each with its own acceptance. No photo/video requirement or launch scope is changed. AI moderation remains deferred; public launch unauthorized.

## Evidence and reproducibility

Raw WAVs: audio/ and neural/audio/. Gold: corpus.json and fixed-corpus.json. Outputs/timing/memory: asr-results.json, extraction-results.json, extraction-runtime.json and corresponding neural/ files. Harness/prompt: synth.py, neural_synth.py, asr_bench.py, fw_worker.py, extract_bench.py. Models/binaries are retained under this disposable research directory; nothing in this directory is staged. Inference uses local paths and a temporary loopback-only server on 39181, terminated after each model. Protected dev port 3000 remains PID 26500; dev PostgreSQL remains healthy. No dev DB/photo commands were issued.
