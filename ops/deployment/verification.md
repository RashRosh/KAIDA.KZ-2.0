# R3 verification and acceptance evidence

Implementation PR: [#163](https://github.com/RashRosh/KAIDA.KZ-2.0/pull/163). Contract/docs PR [#162](https://github.com/RashRosh/KAIDA.KZ-2.0/pull/162) merged at 9ff2f7a1f505fc46713f90d7a2df0b28a010bb83 after green checks. PO manual acceptance PASS at ca1b30ae8fb9972c6d6af12080e68b7ccf094039 on 2026-10-09. PR #163 merged at c2d9968efe24a4f93161eb9f0f387f7bc87886eb; merged-main CI 37920568293 passed and annotated checkpoint v0.0.73-r3-deployment-preparation is pushed.

## Executable verification

Clean clone executable SHA: `412d2a9a2f3657f50cfd70e83b2bd1b6cddb9eff`. The final evidence/handoff commit changes documentation only; its exact SHA, current-head CI and rebuilt image labels/reports are recorded in PR evidence and the acceptance message. Final-head gates are required before handoff.

Platform: Windows 11 (10.0.26200.9457), Git Bash 5.2.37, Docker Desktop 4.91.0, Engine 29.8.0, Compose 5.5.1; Docker Linux amd64 VM, 3,962,191,872 bytes memory. Chromium via Playwright 1.63.0 on Windows. Container Node 24.19.0; host CLI Node 24.14.1. Docker Desktop resources unchanged.

| Proof | Result |
|---|---|
| Frozen install, lint, typecheck; targeted preflight/health unit tests | Passed, 18 targeted tests |
| Full branch and PR regression CI | Passed: 505 unit, 285 integration, 248 E2E passed / 54 skipped; lint/types/migrate/seed/test-DB/build included. Final-head runs linked in PR |
| Clean tools/runtime images | Passed, non-root UID/GID 1000; build 324s / 714s; 1,109,505,849 / 1,099,296,225 bytes at executable SHA |
| Supported fresh and repeated deploy:up | Passed: offline guard -> tools/runtime builds -> DB -> 25 migrations -> KB import -> online preflight -> app/TLS; no seed |
| Preflight refusal tests | Passed: nine host configuration cases; empty/unmigrated DB; missing KB; unavailable DB; short secret; insecure cookie; organic; unwritable photos; wildcard/public/unacknowledged private bind. Acknowledged private-bind config allowed, not actually exposed to LAN |
| KB identity and repeat commands | Passed: 682 products, 210 aliases, 35 categories; migrate/import idempotent |
| Access boundary | App 3400 and TLS 8443 bound 127.0.0.1; DB unpublished; all six non-loopback probes refused. One source app container |
| DB-backed health | Real 200 -> isolated DB stop -> 503 -> DB restart -> 200, no-store, status-only JSON |
| TLS smoke | Three tests passed: Seller -> Buyer -> Operator, Secure + HttpOnly cookies, ordinary non-localhost HTTP cannot establish session, valid >13MiB image accepted / >15MiB rejected |
| Persistence | down without -v -> up: complete offer/photo rows and all four photo-file SHA256s unchanged |
| Unchanged R2 | create -> clean restore -> verify passed: 29 tables, 25 migrations, 2 photo rows, 4 photo files, about 1.6MB (exact final fixture bytes/hashes in PR evidence), zero orphan/skipped files. Restored public search matches; public WebP 200/content-type/bytes/hash identical. Disposable restore project removed; source stays running |

No OOM occurred. Build uses max-old-space-size=1536 and CIRCLE_NODE_TOTAL=2, sequential targets. An initial native browser run failed with net::ERR_INSUFFICIENT_RESOURCES while Windows had ~303MiB free RAM; unchanged assertions passed in 39.8s when run after scans, without concurrent builds/scans. No personal processes were stopped. Runtime packaging now includes the immutable word-form dictionary and its attribution; search behavior is unchanged.

## Security assessment

Hadolint 2.15.1: `hadolint/hadolint@sha256:32dac94127fd60b7b7e3fbfc65e1383b9b5e25c9bfd7b8536de7a539fe68a12d`. Trivy 0.75.0: `aquasec/trivy@sha256:af6acf9a6b85dfe389a1941505c0ce9efef52a4719635e1a962f022a3d855daa`.

Trivy DB v2 UpdatedAt 2026-10-09 01:16:59 UTC, DownloadedAt 07:59:16 UTC; fresh within 24h for these runs. Policy bundle sha256:1583562f8b90ed2a071b99f0e5ffff6b57e4ceb6ca3e4796577b4e6a339eb74c. Scanner execution exit 0 means completed analysis; the gate separately evaluates findings and approved exceptions.

| Target | CRITICAL | HIGH | MEDIUM | LOW | UNKNOWN | Secrets | Failed misconfiguration checks |
|---|---:|---:|---:|---:|---:|---:|---|
| runtime | 0 | 43 | 62 | 60 | 3 | 0 | 0; 27 image-config checks passed |
| tools | 0 | 44 | 64 | 60 | 3 | 0 | DS-0026 LOW, no service HEALTHCHECK; 26 checks passed |
| Dockerfile | -> | -> | -> | -> | -> | -> | 0; 27 Trivy checks passed; Hadolint [] |

All supplied HIGH/CRITICAL dependency fixes identified in the scans are applied; no such fixable finding remains. [Exact dependency versions, addressed findings and compatibility impact](dependency-patches.md) include every frozen-lockfile version delta. [Security exceptions](security-exceptions.md) identify the remaining OS/CLI/compiler risks and PO approvals for isolated local testing only. This is not a claim of vulnerability-free images.

MEDIUM/LOW summary: base Debian libraries/utilities account for runtime 62/60; tools adds two MEDIUM brace-expansion findings. glibc accounts for 30 MEDIUM / 16 LOW occurrences across libc6/libc-bin; remaining counts are in the full reports. UNKNOWN records (both images): DSA-6549-1 and TEMP-1147318-639065, liblzma5 5.8.1-1+deb13u1; CVE-2026-82560, perl-base 5.40.1-6+deb13u1. Unknown severity is retained, not treated as clearance.

Coverage limit: esbuild 0.28.2 has no Go build-info marker, so Trivy does not enumerate its Go libraries. Its observed Go 1.26.5 string and seven potential HIGH stdlib findings are explicitly assessed in E-R3-GO; function-level reachability is unverified. No scanner suppressions or security ignore list are used. Full unfiltered JSON reports and SHA256 manifest belong to PR evidence, not Git.

Reproduction commands (with mounted /reports and a shared fresh cache; run scans serially):

```bash
trivy image --input /reports/runtime.tar --scanners vuln,secret,misconfig --image-config-scanners misconfig,secret --format json --output /reports/runtime.json --exit-code 0 --timeout 30m --parallel 2 --no-progress
# Repeat for tools.tar/tools.json
trivy config /source/Dockerfile --format json --output /reports/dockerfile.json --exit-code 0
hadolint --format json - < Dockerfile
```

Pinned bases: Node 24.19.0 trixie-slim sha256:ab3eebe934147fee049b5eb83c570f68c849a13c930bdfa482de99fcdfa3b3de; PostgreSQL 18 sha256:fc973eb97c9fd04bfa1840e0f510719a584ccb3be8debfe6a4144637a9dfe8cf; Caddy 2.10.2-alpine sha256:4c6e91c6ed0e2fa03efd5b44747b625fec79bc9cd06ac5235a779726618e530d. Exact final image IDs/sizes/labels are in the PR acceptance evidence.

## Limits and manual acceptance

Only the recorded Windows/Git Bash/Docker Linux amd64 platform is verified. No hosting/public launch, real domain/certificate/provider proxy, managed DB, network perimeter, load/memory guarantees under traffic, external push delivery, multiple app instances, cross-version restore, scheduled/encrypted/off-host backups, organic demand or genuine authentication has been verified. Other host OSes, PowerShell reproduction and arm64 remain unverified. OpenCorpora public-distribution license follow-up remains in the plan. Fifty-four CI E2E cases are skipped, not claimed as tested.

1. Open https://localhost:8443 and accept the expected local certificate warning (no CA installed in Windows).
2. Sign in as Seller with the displayed test OTP; create a card with a photo.
3. In a private browser window, find that card as Buyer and open its photo.
4. Request a restart of only R3, then confirm the card/photo remain. Review this report and its limits before manual acceptance.

R3 is CLOSED after explicit PO manual acceptance. All security exceptions remain isolated-local-only; closure does not authorize public deployment. Evidence and a confidential final fixture backup are preserved; disposable stack cleanup is recorded in CURRENT_STATE.
