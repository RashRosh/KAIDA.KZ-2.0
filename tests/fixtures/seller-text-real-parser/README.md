# C2 reference fixtures (seller-ai-text-real-parser)

Byte-exact copies; `tests/unit/seller-text-real-parser-c2.test.ts` checks the SHA-256 values below. Contract decision
D-3: copied here so the slice does not depend on the open research PR #187.

| File | Source | SHA-256 |
| --- | --- | --- |
| `kaida_extract_exp.py` | C2 reference script, `SCRIPT_VERSION = "2.2"` (PO Drive folder `kaida_control28_gpu_1792257026243923621`, also `KAIDA_all_files_2.zip`); embeds bench v2 | `695d930faf7fa6b6f83594aa9674d8c9edb272065582ab017f4204183ba8a593` |
| `control28.json` | PR #187 `docs/research/ai-text-2026-10-17/control28.json` at `c1e13faf` (28 synthetic control messages, gold, saved C0/C1/C2 answers and assembled cards) | `d5e04ceb3ea1563e26e20fcc5e5e28eacf0a9869cdde9c55e6dcec2a3529c260` |

Use: the TypeScript reducer port is compared with the saved `assembled` output of the Python reducer (56 C1/C2 answers);
the replay stub serves the saved C2 answers; `ops/seller-text-parser/live-check.ts` writes live answers in the script's
row format so `python -I kaida_extract_exp.py score <file> --split test` scores them with the evidenced scorer.

The script is reference data. KAIDA never imports or executes it at runtime. All 28 messages are synthetic.
