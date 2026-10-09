# R3 approved security exceptions

Status: E-R3-OS, E-R3-GO, E-R3-BRACES and E-R3-TOOLS-HEALTH APPROVED by PO on 2026-10-09 for isolated local R3 testing only. Not a deployment authorization. Limited to isolated local R3 testing; no public launch. Final runtime/tools scans confirm the OS list and the additional tools-only dependency below.

## E-R3-OS: Debian packages without a supplied fix

Targets: runtime and tools, Debian 13.6, Node 24.19.0 trixie-slim pinned in Dockerfile. Final runtime and tools scans each confirm 43 HIGH Debian package/CVE occurrences, eight distinct CVEs; no fixed version supplied by the fresh Trivy DB. This is not a claim of non-exploitability.

| Package | Installed version | HIGH CVEs |
|---|---|---|
| bsdutils | 1:2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| libacl1 | 2.3.2-2+b1 | CVE-2026-54369 |
| libblkid1 | 2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| liblastlog2-2 | 2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| libmount1 | 2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| libsmartcols1 | 2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| libsystemd0 | 257.13-1~deb13u1 | CVE-2026-16742 |
| libtinfo6 | 6.5+20250216-2 | CVE-2025-69720 |
| libudev1 | 257.13-1~deb13u1 | CVE-2026-16742 |
| libuuid1 | 2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| login | 1:4.16.0-2+really2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| mount | 2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |
| ncurses-base | 6.5+20250216-2 | CVE-2025-69720 |
| ncurses-bin | 6.5+20250216-2 | CVE-2025-69720 |
| perl-base | 5.40.1-6+deb13u1 | CVE-2026-9538 |
| util-linux | 2.41.5-0+deb13u1 | CVE-2026-76642, CVE-2026-78408, CVE-2026-78409, CVE-2026-78410 |

Reachability assessment: the app runs as UID/GID 1000; the reference stack does not run systemd/udev/login/mount services. These base utilities are not app entry points. This is a bounded configuration assessment, not a reachability audit of every library. Mitigation: loopback-only app/TLS ports, unpublished DB, non-root app/tools, no organic events, disposable restore target, trusted operator inputs. No use beyond the approved isolated stack.

Review trigger: a fixed Debian package/base image, new relevant exploit evidence, exposure or runtime changes, and before any future hosting/public-launch review. Rebuild and rescan then; this proposal does not waive that review.

## E-R3-GO: latest esbuild compiler baseline

Target: tools only. esbuild 0.28.2 upstream Linux x64 binary contains the Go 1.26.5 version string; current npm release has no later esbuild version. Older esbuild 0.18.20 / 0.25.12 have been removed through an override. Go 1.26.6 fixes exist, but the upstream esbuild package has not adopted them. Rebuilding/vendoring upstream binaries is outside this minimal dependency-patch approach.

Trivy does not report a Go result for esbuild 0.28.2 (its Go build-info marker is absent). These seven potential HIGH stdlib findings are therefore explicitly recorded from the compiler baseline and vulnerability DB rather than silently treating scanner absence as clearance. Function-level linkage/reachability is unverified.

| Potential CVE | Affected component / finding | Fixed Go version |
|---|---|---|
| CVE-2026-33818 | encoding/asn1: golang: Go encoding/asn1: Denial of Service via excessive recursion in Unmarshal | 1.26.6 |
| CVE-2026-39821 | golang.org/x/net/idna: golang: net/http: golang.org/x/net/idna: Privilege escalation via incorrect Punycode label processing | 1.26.6 |
| CVE-2026-56853 | net/http: golang: Go net/http: Unencrypted HTTP/2 connections vulnerable to Denial of Service | 1.26.6 |
| CVE-2026-56858 | html/template: golang: Go html/template: Cross-Site Scripting via pathological input | 1.26.6 |
| CVE-2026-56859 | encoding/xml: golang: Go: Denial of Service via XML decoding recursion depth issue | 1.26.6 |
| CVE-2026-56860 | net/url: golang: golang net/url: Denial of Service from quadratic complexity in path resolution | 1.26.6 |
| CVE-2026-56862 | crypto/tls: golang: Golang crypto/tls: Denial of Service via indefinite KeyUpdate messages | 1.26.6 |

Mitigation: tools has no published port and runs one-off trusted migrations/import/preflight commands; esbuild is used to transform trusted repository code, not as an HTTP/TLS server or for untrusted build input. It is absent from the production runtime dependency tree. Review trigger: upstream esbuild compiled with Go >=1.26.6, any use of serve/remote/untrusted input, or future deployment review.

## E-R3-BRACES: trusted lint glob patterns

Target: tools only, braces 3.0.3, CVE-2026-93687 (HIGH, deeply nested patterns can overflow the stack). Trivy supplies no fixed version; npm latest is 3.0.3. Dependency path: eslint-config-next 16.3.8 -> @next/eslint-plugin-next -> fast-glob -> micromatch 4.0.8 -> braces. It is a devDependency, absent from runtime.

Mitigation: lint/glob patterns come from trusted checked-in configuration; tools publishes no service and does not accept attacker-controlled patterns. This is a usage assessment, not proof every possible call is unreachable. Review trigger: a patched braces release, changed glob inputs, untrusted repository processing or future deployment review.

## E-R3-TOOLS-HEALTH: one-off image has no service healthcheck

Status: APPROVED by PO on 2026-10-09 for local R3. Target: tools only; Trivy image-configuration rule DS-0026, LOW, No HEALTHCHECK defined. The runtime image has a real DB-backed HTTP healthcheck and passes this rule. The tools image is an ephemeral CLI (`compose run --rm`) that exits after migrate/import/preflight/purge; its command exit code is the readiness signal. It is not a long-running service and has no HTTP listener. Adding a dummy healthcheck would provide no operational evidence.

Mitigation: tools is profile-gated and unpublished; the supported orchestrator checks each command exit code and refuses app startup on failure. Review trigger: converting tools to a persistent service or changing orchestration; then define a meaningful healthcheck or reevaluate. This exception is limited to isolated local R3 testing.

## Approval record

PO approved E-R3-BRACES for isolated local R3 testing on 2026-10-09. PO also explicitly approved E-R3-OS and E-R3-GO for local R3 on 2026-10-09. PO explicitly approved E-R3-TOOLS-HEALTH for local R3 on 2026-10-09. No approval applies to hosting/public launch or changed exposure. Secrets cannot be excepted. Any additional actionable finding requires a fix or a separate approved exception.
