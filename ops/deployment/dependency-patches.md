# R3 dependency patches

Dependency changes are separate in commits 1c22b99 and 412d2a9. The exact frozen-lockfile changes below include platform packages; listing them does not establish testing on those platforms.

| Direct / build dependency | Before | After | Finding / reason |
|---|---|---|---|
| next / eslint-config-next | 16.3.4 | 16.3.8 | GHSA-vcvr-r3jv-pc5j (next/og ImageResponse RCE), CVE-2026-94483/94484/94485/94543/94544/94486; keep lint plugin aligned |
| sharp | 0.35.4 | 0.35.5 | GHSA-wq5f-xc86-pv6w (librsvg CVE-2026-96889); bundled native packages updated |
| source-map-js override | 1.2.1 | 1.2.2 | CVE-2026-93749 |
| brace-expansion overrides | 1.1.18 / 5.0.9 | 1.1.20 / 5.0.11 | CVE-2026-102276, CVE-2026-102278 |
| esbuild override | 0.18.20 / 0.25.12 / 0.28.2 | 0.28.2 only | Remove older embedded Go 1.20.7 / 1.23.12 stdlib findings; residual upstream compiler risk explicitly assessed |
| pnpm | 11.19.0 | 11.28.5 | Bundled undici 6.28.0 -> 6.29.0, CVE-2026-19534; same pnpm major |
| Node image | 24.19.0 bookworm-slim | 24.19.0 trixie-slim | Debian base with available security patches; Node version unchanged |

Docker OS packages are pinned after the base selection: gzip 1.13-1+deb13u1; libpcre2-8-0 10.46-1~deb13u3; libsqlite3-0 3.46.1-7+deb13u2; libssl3t64 / openssl-provider-legacy 3.5.7-1~deb13u3; perl-base 5.40.1-6+deb13u1. Exact initial/final scanner records in the PR show the addressed package/CVE pairs. npm, corepack and yarn are removed from the final images when not needed. Install caches are removed in the same layer.

Compatibility impact: Next/sharp/brace/source-map patches retain their existing major/minor APIs; pnpm changes within major 11. The esbuild override crosses 0.x minor versions for legacy drizzle-kit loader dependencies and is the main compatibility risk. Full regression CI and real migrations/import/preflight commands are required; no new migration or data transformation is introduced. Debian changes native runtime libraries; the clean Linux amd64 build, actual photo decoding/body-limit check and restored-photo proof validate the exercised paths. Other architectures/platforms remain unverified.

Upstream references: [Next advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j), [sharp advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w), [esbuild releases](https://github.com/evanw/esbuild/releases), [pnpm releases](https://github.com/pnpm/pnpm/releases).

## Exact OS patch delta after selecting trixie

| Package | Pinned base package | Patched package | Supplied-fix findings addressed |
|---|---|---|---|
| gzip | 1.13-1 | 1.13-1+deb13u1 | CVE-2026-41992, CVE-2026-41991 |
| libpcre2-8-0 | 10.46-1~deb13u1 | 10.46-1~deb13u3 | CVE-2026-103111, CVE-2026-86145, CVE-2026-89157, CVE-2026-89161, CVE-2026-89156, CVE-2026-89158, CVE-2026-89160, CVE-2026-89162 |
| libsqlite3-0 | 3.46.1-7+deb13u1 | 3.46.1-7+deb13u2 | CVE-2026-11822, CVE-2026-11824 |
| libssl3t64 | 3.5.6-1~deb13u2 | 3.5.7-1~deb13u3 | CVE-2026-14456, CVE-2026-75804, CVE-2026-84782, CVE-2026-18798, CVE-2026-42772, CVE-2026-54872, CVE-2026-54873, CVE-2026-54875, CVE-2026-63072, CVE-2026-63076, CVE-2026-72897, CVE-2026-75805, CVE-2026-75806, CVE-2026-77696, CVE-2026-84784, CVE-2026-14457, CVE-2026-35189, CVE-2026-35191, CVE-2026-54874, CVE-2026-63073, CVE-2026-63074, CVE-2026-63075, CVE-2026-75803 |
| openssl-provider-legacy | 3.5.6-1~deb13u2 | 3.5.7-1~deb13u3 | CVE-2026-14456, CVE-2026-75804, CVE-2026-84782, CVE-2026-18798, CVE-2026-42772, CVE-2026-54872, CVE-2026-54873, CVE-2026-54875, CVE-2026-63072, CVE-2026-63076, CVE-2026-72897, CVE-2026-75805, CVE-2026-75806, CVE-2026-77696, CVE-2026-84784, CVE-2026-14457, CVE-2026-35189, CVE-2026-35191, CVE-2026-54874, CVE-2026-63073, CVE-2026-63074, CVE-2026-63075, CVE-2026-75803 |
| perl-base | 5.40.1-6 | 5.40.1-6+deb13u1 | CVE-2026-13221, CVE-2026-42496, CVE-2026-8376, CVE-2026-42497, CVE-2026-48962, CVE-2026-57432, CVE-2026-57433, CVE-2025-15649, CVE-2026-12087, CVE-2026-19487, CVE-2026-48959, CVE-2026-48961, CVE-2026-7010, CVE-2026-7017 |

## Complete lockfile version delta

| Package | Main before R3 | R3 patched lockfile |
|---|---|---|
| `@babel/parser` | 7.29.8 | 7.29.9 |
| `@esbuild/aix-ppc64` | 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/android-arm` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/android-arm64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/android-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/darwin-arm64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/darwin-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/freebsd-arm64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/freebsd-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-arm` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-arm64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-ia32` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-loong64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-mips64el` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-ppc64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-riscv64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-s390x` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/linux-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/netbsd-arm64` | 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/netbsd-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/openbsd-arm64` | 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/openbsd-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/openharmony-arm64` | 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/sunos-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/win32-arm64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/win32-ia32` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@esbuild/win32-x64` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `@img/sharp-darwin-arm64` | 0.35.4 | 0.35.5 |
| `@img/sharp-darwin-x64` | 0.35.4 | 0.35.5 |
| `@img/sharp-freebsd-wasm32` | 0.35.4 | 0.35.5 |
| `@img/sharp-libvips-darwin-arm64` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-darwin-x64` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linux-arm` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linux-arm64` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linux-ppc64` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linux-riscv64` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linux-s390x` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linux-x64` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linuxmusl-arm64` | 1.3.3 | 1.3.4 |
| `@img/sharp-libvips-linuxmusl-x64` | 1.3.3 | 1.3.4 |
| `@img/sharp-linux-arm` | 0.35.4 | 0.35.5 |
| `@img/sharp-linux-arm64` | 0.35.4 | 0.35.5 |
| `@img/sharp-linux-ppc64` | 0.35.4 | 0.35.5 |
| `@img/sharp-linux-riscv64` | 0.35.4 | 0.35.5 |
| `@img/sharp-linux-s390x` | 0.35.4 | 0.35.5 |
| `@img/sharp-linux-x64` | 0.35.4 | 0.35.5 |
| `@img/sharp-linuxmusl-arm64` | 0.35.4 | 0.35.5 |
| `@img/sharp-linuxmusl-x64` | 0.35.4 | 0.35.5 |
| `@img/sharp-wasm32` | 0.35.4 | 0.35.5 |
| `@img/sharp-webcontainers-wasm32` | 0.35.4 | 0.35.5 |
| `@img/sharp-win32-arm64` | 0.35.4 | 0.35.5 |
| `@img/sharp-win32-ia32` | 0.35.4 | 0.35.5 |
| `@img/sharp-win32-x64` | 0.35.4 | 0.35.5 |
| `@napi-rs/wasm-runtime` | 1.2.3 | 1.2.5 |
| `@next/env` | 16.3.4 | 16.3.8 |
| `@next/eslint-plugin-next` | 16.3.4 | 16.3.8 |
| `@next/swc-darwin-arm64` | 16.3.4 | 16.3.8 |
| `@next/swc-darwin-x64` | 16.3.4 | 16.3.8 |
| `@next/swc-linux-arm64-gnu` | 16.3.4 | 16.3.8 |
| `@next/swc-linux-arm64-musl` | 16.3.4 | 16.3.8 |
| `@next/swc-linux-x64-gnu` | 16.3.4 | 16.3.8 |
| `@next/swc-linux-x64-musl` | 16.3.4 | 16.3.8 |
| `@next/swc-win32-arm64-msvc` | 16.3.4 | 16.3.8 |
| `@next/swc-win32-x64-msvc` | 16.3.4 | 16.3.8 |
| `@tybys/wasm-util` | 0.10.3 | 0.10.4 |
| `@typescript-eslint/eslint-plugin` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/parser` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/project-service` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/scope-manager` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/tsconfig-utils` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/type-utils` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/types` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/typescript-estree` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/utils` | 8.70.0 | 8.71.1 |
| `@typescript-eslint/visitor-keys` | 8.70.0 | 8.71.1 |
| `axe-core` | 4.13.0 | 4.14.0 |
| `baseline-browser-mapping` | 2.11.21 | 2.11.27 |
| `brace-expansion` | 1.1.18, 5.0.9 | 1.1.20, 5.0.11 |
| `caniuse-lite` | 1.0.30001810 | 1.0.30001815 |
| `esbuild` | 0.18.20, 0.25.12, 0.28.2 | 0.28.2 |
| `eslint-config-next` | 16.3.4 | 16.3.8 |
| `ignore` | 5.3.2, 7.0.9 | 5.3.2, 7.0.10 |
| `is-core-module` | 2.16.2 | 2.17.0 |
| `nanoid` | 3.3.18 | 3.3.20 |
| `next` | 16.3.4 | 16.3.8 |
| `sharp` | 0.35.4 | 0.35.5 |
| `source-map-js` | 1.2.1 | 1.2.2 |
| `typed-array-byte-offset` | 1.0.4 | 1.0.5 |
| `typescript-eslint` | 8.70.0 | 8.71.1 |
| `which-typed-array` | 1.1.22 | 1.1.24 |
