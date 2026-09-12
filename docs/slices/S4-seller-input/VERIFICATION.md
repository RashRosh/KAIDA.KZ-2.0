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

## Gate

A new full GitHub Actions run is required on the commit containing this adaptation.

Until that run succeeds:

`NOT READY: automated verification pending`

If it succeeds, S4 advances only to:

`NOT READY: manual acceptance pending`

Merge, tag `v0.0.5-s4` and S5 remain forbidden until the later gates are explicitly completed.
