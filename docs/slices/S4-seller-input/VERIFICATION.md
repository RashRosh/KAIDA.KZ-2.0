# S4 Verification

## Automated verification status

Branch: `slice/s4-seller-input`

Base checkpoint: `80d97bebd5e3427cdae96441df64dad23efdbb30` / `v0.0.4-s3`

GitHub Actions run `34677972025` on head `f6897967b00068bf36ea414947c6b7efd08ca413` finished **FAILURE**.

The failure was localized to the pre-existing S3 E2E regression under parallel Playwright execution:

- Search asserted a unique `Баранина` heading although S4 legally permits multiple Offers for the same Product.
- S3 setup compared global `offers` count although the parallel S4 E2E may legally create an Offer for another Seller.

This was not treated as a product defect and no production implementation was changed for it.

## Approved exception

A narrow whitelist exception was explicitly approved for:

`tests/e2e/seller-setup.spec.ts`

The regression was adapted to assert only the actual closed S3 contract:

- Seller setup itself creates no Offer for the Seller owned by that S3 User;
- canonical S0 seed Offer remains discoverable through Search by stable seed Seller identity;
- S3 auth, setup, reload, duplicate-setup rejection and logout semantics remain unchanged.

The test does not assert Search ordering, unique Product result count or global Offer count.

No `playwright.config.ts` change, serialization, locks, sleeps or cross-test coordination were introduced. Other S0-S3 tests remain unchanged.

## Final automated verification before manual acceptance

GitHub Actions run `34678275226` on head `846abc6424ff21d0a241522f142d30ca57a49937` finished **SUCCESS**.

Verified by the full `pnpm verify` pipeline:

- PostgreSQL 18.6;
- clean S0→S1→S2→S3→S4 migration chain;
- lint PASS;
- typecheck PASS;
- 130 unit tests PASS;
- 57 integration tests PASS;
- production build PASS;
- 24/24 Playwright E2E PASS on mobile + desktop.

## Manual acceptance

Date: 2026-09-12

Environment:

- GitHub Codespaces;
- branch `slice/s4-seller-input`;
- head `846abc6424ff21d0a241522f142d30ca57a49937`;
- PostgreSQL 18;
- application opened through the Codespaces forwarded port 3000.

Result: **PASS**.

Manually verified:

- anonymous Search for `баранина` contains canonical seed Seller `Асыл Ет, тестовый продавец`;
- S2 test OTP login flow works;
- S3 Seller/Location setup remains usable when needed;
- `/seller` contains `Добавить товар`;
- proposal created for Product `Баранина`, price `4321.50`, unit `кг`, comment `S4 manual свежий привоз`;
- creation navigates to `/seller/change-sets/{id}`;
- proposed Change Set is displayed and UI clearly states that Offer has not yet been created;
- preview preserves Product, Seller, Location, price, unit and comment;
- reload preserves and reloads the same proposed Change Set from the server;
- confirmation changes the Change Set to confirmed and UI reports `Offer создан`;
- Offer ID is displayed;
- reload after confirmation preserves confirmed status, the same Offer ID and unchanged proposal data;
- canonical seed Offer remains present in Search; an additional S4 Offer is accepted and ordering is not evaluated;
- logout works and anonymous Search remains functional;
- mobile viewport approximately 390–400 px: seller input, proposed screen and confirmed screen checked without horizontal scroll;
- desktop viewport approximately 1440 px: same main flow checked;
- keyboard navigation checked for labels, Tab/focus, submit and confirmation button.

The following were intentionally not repeated manually because they are covered by automated tests: concurrent confirm, repeated confirm idempotency, ownership spoofing, cross-user isolation, atomic rollback, DB constraints, ambiguous Product and migration upgrade.

## Gate

Automated verification: PASS.

Manual acceptance: PASS.

This documentation commit must itself receive a green full GitHub Actions run on the final branch head before S4 may be considered ready for merge.

Merge, tag `v0.0.5-s4` and S5 remain forbidden until explicit authorization.
