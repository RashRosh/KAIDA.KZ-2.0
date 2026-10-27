# Whisper-small follow-up: PAUSED at PO request

2026-10-09. The PO has paused the study. Resume only on explicit PO instruction, then recheck sufficient physical/commit headroom; do not resume automatically. AI remains required for launch; implementation order is deferred. No research evidence or model assets were deleted.

The PO passed the audio-validation gate for this limited synthetic benchmark: all three representative clips were generally intelligible, with incorrect word stress in places; no content mismatch was reported. This is a representative audit, not independent listening validation of every clip. Artificial pronunciation and concatenated language switching remain limitations; results must not be generalized to natural seller speech.

The authorized experiment did **not start**. No small-model download, ASR inference or extraction-baseline run occurred. The user explicitly required stopping if available memory was insufficient.

## Measured limitation

Read-only Windows CIM measurements, with KiB values divided by 1024:

| Measurement | Free physical RAM | Remaining commit headroom (`FreeVirtualMemory`) |
| --- | --- | --- |
| Initial check | 74.5 MiB | 928.8 MiB |
| Three subsequent samples | 58.1–171.7 MiB | 895.2–956.3 MiB |

Total physical RAM is 7.73 GiB. The preserved [preflight evidence](memory-preflight.json) contains the three timestamped samples and the STOP decision. `FreeVirtualMemory` measures remaining Windows commit capacity, not simply free physical RAM or available GPU memory.

Upstream small-model memory is approximately 852 MB; the approved planning allowance is 1–2 GiB process memory and approximately 2 GiB available host headroom. Even the lowest expected process allocation exceeds current physical headroom, and commit capacity leaves inadequate room for safe execution and other active applications. Those estimates are not validated local minima. No OOM was induced, and no claim of measured Whisper-small peak memory or speed is made.

Minimal remedy: the PO can free memory through their normal workflow, then request a repeat of the read-only preflight. Target approximately 2 GiB available physical memory and at least 2 GiB remaining commit headroom before sequential CPU execution. No process termination, server stop, pagefile change, Docker change or hardware purchase was performed or requested as an automatic action. Dev PostgreSQL remains healthy; Docker memory remains 3,962,191,872 bytes; existing node PID 26500 remains running.

## Pending comparison and extraction definition

### Read-only follow-up after desktop application closures

The repeat check improved remaining Windows commit headroom to **18.7–18.9 GiB** (about 28 GiB committed against a 46.8 GiB limit). Physical availability remained insufficient: approximately **800 MiB** on the first detailed check, then **339–520 MiB** over three counter samples. CIM and performance counters were queried sequentially and vary slightly with active processes. [Structured consumer evidence](memory-followup.json) preserves timestamps, process groups, Windows pools, WSL `/proc/meminfo` and Docker stats. No benchmark or download started.

| Consumer group | Working set | Private committed memory |
| --- | --- | --- |
| Chrome, 25 processes | 990.7 MiB | 4000.0 MiB |
| VS Code, 28 processes | 888.8 MiB | 4783.1 MiB |
| WSL VM | 493.1 MiB | 1976.8 MiB |
| Windows service hosts | 318.4 MiB | 613.1 MiB |
| ChatGPT desktop | 241.5 MiB | 1954.1 MiB |
| Defender | 204.9 MiB | 511.3 MiB |
| Docker backend | 150.8 MiB | 281.0 MiB |
| Codex | 134.6 MiB | 353.0 MiB |
| Claude | 130.7 MiB | 740.5 MiB |

Private commit is not resident physical memory. Working sets can include shared pages; summing them does not give an exact physical allocation ledger. Windows nonpaged pool was approximately 861–867 MiB; paged pool approximately 901 MiB, not all necessarily resident. This establishes major observed consumers, not attribution of every kernel page to a driver.

Docker's only listed container, the preserved dev PostgreSQL, used approximately **30.5 MiB**. Docker's 3.69 GiB figure is its unchanged limit, not current usage. Inside the running Docker WSL VM, Linux reported approximately **2.64 GiB available** and 336 MiB cached; these are guest accounting values and do not establish equivalent free host RAM or authorize reclaiming/restarting WSL. The VM's measured Windows working set was about 493 MiB. Thus the evidence does not support treating the database or Docker's configured limit as the primary physical-memory consumer.

No process was terminated and no setting changed. Claude Code, Codex, VS Code, Docker/WSL, dev database and node PID 26500 remain protected. The smallest possible next action is for the PO to close only additional genuinely unused browser tabs/windows through their normal workflow, then repeat preflight; the approximately 991 MiB Chrome working set does not guarantee that this alone reaches the target. Do not automatically stop protected development processes or alter resource limits. A final check at 15:01:48 UTC still showed **460 MiB available physical memory** and **19,382.9 MiB commit headroom**. Commit capacity is now adequate; physical headroom remains the blocker.

The previously authorized approximately 488 MB MIT Whisper-small download remains pending. After sufficient headroom is measured, compare base and small on the fixed synthetic examples with matched native-runtime settings, and preserve exact commands, detected languages, transcripts, timing and peak working/private memory. Score recognition independently of extraction, including product/price/unit errors and raw/presentation-normalized WER.

The proposed extraction baseline is a **narrow deterministic parser**, not general AI: a declared RU/KK grammar for the six corpus product concepts, explicit number expressions and unit words, with supporting source spans for emitted facts. Unknown or ambiguous price/unit remains null with clarification; it must not infer missing products or repair unreliable ASR by guessing. It is not yet implemented or tested. Its supported grammar and held-out variations must be frozen before evaluation, and its scope limits must be reported. Evaluate clean references separately from actual ASR transcripts; show reference → transcript → draft examples so recognition losses are not mislabeled as extraction failures.

There are **no new recognition or extraction results** from this follow-up. Earlier raw results remain intact in the parent research directory. Implementation, input menus, queue and launch scope remain on hold. The first future voice implementation still requires safe retries, late-result handling and an approved private-audio lifecycle.
