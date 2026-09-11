# S2 Auth — Implementation Notes

Status: implementation in progress.

## Scope

Implementation is based on `v0.0.2-s1` and stays inside the approved S2 whitelist.

Implemented design:

- Identity-local phone normalization;
- three Identity tables only;
- HMAC-SHA-256 OTP verification material;
- 256-bit opaque session token with SHA-256 DB digest;
- PostgreSQL advisory transaction lock for per-phone challenge replacement;
- partial unique unfinished-challenge index;
- conditional atomic challenge consume;
- PostgreSQL-backed concurrent User get-or-create;
- database session + `kaida_session` cookie;
- four auth Route Handlers;
- minimal `/login` and auth status UI;
- no auth framework/JWT/Redis/global auth middleware/debug endpoint.

## Advisory lock key

The exact approved deterministic key is SHA-256 of `kaida-identity-phone-lock-v1\0${phoneE164}`, first 8 bytes interpreted as signed big-endian int64. It is never persisted.

## Security boundary

Test OTP is intentionally exposed only by `TestOtpDelivery`. This remains a closed-test implementation and is not public-launch ready. Rate limiting, anti-abuse, brute-force protection and real SMS remain mandatory pre-public-launch blockers.

## Verification status

Automated verification and manual acceptance are recorded separately in `VERIFICATION.md`.
