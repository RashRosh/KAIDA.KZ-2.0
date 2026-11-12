# Windows E2E maintenance — Issue #219

Base: `e1b4d93d35b5b043913f68cec500e88699a18156` (verified main). Executable maintenance commit:
`e9e4b36e71f27068996768b5f14cae67fb341c15`, branch `maintenance/219-windows-e2e`.
No product code, D6 or closed behavioral contracts changed. No merge or checkpoint tag authorized.

## Diagnosis and scoped changes

- Upgrade `@playwright/test` 1.63.0 → 1.65.0 and its locked Playwright packages only. Matching bundled Chromium:
  158.0.8127.18 / revision 1254. The installed runtime and an actual launch confirm one `--disable-features`
  argument containing `TcpPortRandomizationWin`; no custom launch args or Windows network changes.
  [Upstream mitigation](https://github.com/microsoft/playwright/pull/43605).
- Reviewed [1.64/1.65 release notes](https://playwright.dev/docs/release-notes): screen emulation, class fields,
  inert actionability, cookie matching, accessible names, query parameters and reporter behavior. Current tests
  need no API migration; Node 24 remains supported. Both configured projects remain active; workers 2, retries 0.
- Address geometry: baseline reproduced `17.999984741210938` and `18.000015258789062` for an exact CSS 18px line.
  Classification: TEST IMPLEMENTATION, strict float equality. `toBeCloseTo(18, 4)` permits less than 0.00005px;
  exact font/line-height/color, accessible full text/title, 200% scaling and overflow checks remain.
- Nearby heart investigated independently: first 10 mobile repetitions measured exactly 44×44. Eight additional
  runs sampled 30 animation frames each and measured heights 43.99998474121094–44.00001525878906 with computed
  height 44px. Classification: TEST IMPLEMENTATION, transformed rectangle float serialization. Assert exact
  computed CSS 44×44 and both rectangle dimensions ≥44 minus 0.0001px. The old boolean checked height only;
  failures now retain numerical dimensions. No CSS or hit-target contract change.
- Exclude raw `test-results/**/trace.zip` and HTML-report `data/*.zip` copies from existing CI artifacts. Local
  trace archives remain private; no raw auth traces uploaded. Screenshots/reports remain available.

## Verification

Windows, Node 24.14.1, pnpm 11.28.5, PostgreSQL 18; production build and configured mobile/desktop projects.

Baseline 1.63:

- Geometry mobile smoke: 7 passed. Geometry repeated ten times across both projects: 28 passed, 2 float failures,
  10 expected desktop Nearby skips. Additional heart frame probe: 8 passed.
- Seven network-affected specs: 32 passed, 6 expected skips; 38 local trace archives contained 420 ERR_ABORTED
  occurrences and zero ERR_NO_BUFFER_SPACE / ERR_ADDRESS_IN_USE. This bounded run did not reproduce the
  network regression; the original Issue #219 evidence remains the pre-upgrade failure evidence.

On executable commit `e9e4b36e`:

- Unit: 731/731 pass. Integration on the prepared test database: 435/435 pass (83 files).
- Lint, typecheck and production build pass.
- Nine affected E2E specs, both projects, default 2 workers / 0 retries: 40 pass / 12 existing skips.
  All 52 local traces inspected: 4,435 network records; 53 ERR_ABORTED, zero ERR_NO_BUFFER_SPACE /
  ERR_ADDRESS_IN_USE. No runner/API compatibility failure.
- Geometry repetition: 30 pass / 10 existing desktop Nearby skips, no failures (baseline: two float failures).
- Normal full Windows E2E: **357 pass / 87 existing skips, zero failures**, 9.8 minutes. Command:
  `pnpm exec playwright test`, unchanged production-build configuration, both projects, 2 workers / 0 retries.
  This used the normal retain-on-failure trace setting; no request-error count is claimed for passing full-suite
  tests. Network-error absence was directly checked in all targeted traces above.
- [Branch CI 43219572100](https://github.com/RashRosh/KAIDA.KZ-2.0/actions/runs/43219572100) **PASS** on
  `e9e4b36e71f27068996768b5f14cae67fb341c15`: lint/types, migrations/seed, 731 unit, 435 integration,
  production build, E2E 357 pass / 87 existing skips (Ubuntu 24.04).

Targeted command: `pnpm exec playwright test` with the nine issue-related spec paths, `--trace=on`, a local
`--output=tmp/219-upgrade-targeted` and list reporter. Trace mode changes evidence capture, not assertions,
workers, retries or flows. Baseline used the same seven network spec paths. Geometry reproduction command:
`pnpm exec playwright test tests/e2e/buyer-readability.spec.ts tests/e2e/design-nearby.spec.ts --grep 'buyer point|B07.ST03' --repeat-each=10 --workers=2`.

Skips are existing project boundaries, not suppressed failures: mobile RU/source-viewport acceptance,
touch-only flows and viewport tests deliberately executed once in desktop. No test was removed or disabled.

## Procedure and limitations

Integration must run after `pnpm db:test:prepare` and before E2E: E2E global setup installs Production KB into
`kaida_test`, while integration expects the deterministic seed. An initial integration attempt after baseline
E2E was interrupted after catalog fixture failures; it is not a regression result. Reprepared the dedicated test
database, isolated the first spec (13/13 pass), then ran full integration separately. An early targeted E2E start
was cancelled before tests to avoid overlapping the integration database. No retry policy or timeout was changed.

A clean targeted/full run cannot prove permanent absence of nondeterministic Windows failures. If buffer/address
errors recur, capture sanitized error codes and inspect TCP allocation/state read-only before another run.
Manual product UI acceptance is not required for tooling/test-only maintenance (PROJECT_RULES §7).
