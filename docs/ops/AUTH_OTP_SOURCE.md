# Local source-wide OTP operation

The approved source contract is local-only. OFF is the default; direct Next access is supported only with protection OFF. Existing port3000/private data is not this acceptance stack.

Enable only behind the isolated reference ingress: IDENTITY_OTP_SOURCE_PROTECTION=trusted-proxy, IDENTITY_OTP_SOURCE_INGRESS=isolated-proxy, separate32-byte IDENTITY_OTP_SOURCE_HMAC_SECRET_HEX and stable IDENTITY_OTP_SOURCE_KEY_GENERATION. Configure all app/worker instances alike. No app port may be published or attached to the client network. The reference Caddy edge overwrites the source header from its real peer, trusts no upstream proxy and strips Forwarded; a CDN/provider configuration needs separate verification. Never enable protection by trusting a caller's header on a directly accessible app.

## Cleanup and recovery

Run `pnpm otp-source:maintenance worker` as a supervised independent process. The reference Compose service uses restart:unless-stopped, runs a startup sweep and every5min, exits on failed sweeps and checks its actual DB heartbeat. Compose does not automatically restart an unhealthy-but-running service. SQL sweep/lock timeouts prevent indefinite blocked sweeps. Missing/stale (>15min) successful cleanup stops new issuance, not verification. A successful sweep recovers automatically unless quarantine/key mismatch/retention incident remains. Commands/logs report aggregate counts only, never raw IPs/phones/codes.

An actual24h live-table retention breach is latched even after deletion. Record/remediate the incident before `pnpm otp-source:maintenance ack-retention --operator-remediation-confirmed`. This explicitly acknowledged operation is not an automatic privacy exception. Storage downtime prevents physical deletion; supervisor/alert uptime must be verified separately before deployment.

## Rotation and restore

Before rotation, run `pnpm otp-source:maintenance quarantine` under current configuration; this persistently blocks issuance for at least15min. Keep cleanup/verification working. After the pause, coordinate all app/worker configurations to the new key/generation and run `pnpm otp-source:maintenance finish-rotation`, then a successful sweep before re-enabling issuance. Do not hot-rotate/reset counters or change the OTP secret. Remove the outgoing source key after the transition.

After ANY R2 restore, before starting protected issuance, run quarantine against the restored isolated DB, run a sweep, and wait the fresh15min pause. Restart cannot shorten it. R2 full dumps contain pseudonymous source events; do not exclude tables silently or claim deletion removes old backups/WAL/logs. Production backup/WAL/log retention/erase policy and actual trusted-proxy/perimeter verification remain mandatory separate gates; no real-user enablement is authorized.

If the restored generation cannot match an available source key, quarantine still establishes the fresh pause. Keep issuance blocked, wait the full15min, then finish-rotation under the coordinated replacement key/generation and run a successful sweep. Missing old keys are not permission to delete/reset budgets or skip the pause. This is an explicit operator restore procedure, not an automatic R2 hook; the persisted guard is tested with a controlled clock. A full R2 round trip is not re-verified by this slice.

`ops/auth-otp-source/compose.yml` expects an already migrated isolated PostgreSQL container attached as `postgres` to the external internal network kaida-auth-source-backend, a tested build in .next, approved local image references and an external env file. It publishes only loopback3200, keeps the app off the ingress network and creates its own photo volume. Record resource IDs; never repoint this stack at dev or the port3000 snapshot.

Set KAIDA_SOURCE_APP_IMAGE and KAIDA_SOURCE_TOOLS_IMAGE explicitly. Verify the images' installed Next/pg/tsx versions against the current lockfile; an old `:local` image must not silently supply stale dependencies. The reference mounts the tested executable build read-only; it is not proof of a newly built production deployment image. Acceptance image IDs and the build ID belong in the slice evidence. Production Docker builds still use the repository Dockerfile.

Build local dependencies/base using the repository Dockerfile targets os-base,prod-deps,tools. The bounded reference runtime/worker recipes in ops/auth-otp-source use those current images. The edge recipe builds standard Caddy2.11.7 with Go1.26.9 and x/net0.60.0 to fix the findings still present in the official image. Set KAIDA_SOURCE_EDGE_IMAGE explicitly; its digest/module inventory and scan results are recorded in the acceptance evidence. This changes only the local reference ingress, not the generic R3 deployment configuration. Caddy is Apache-2.0; Go/x-net are BSD-3-Clause. Repeat real-peer/header/restart proof after an ingress patch; do not infer a provider/CDN trust configuration from it.
