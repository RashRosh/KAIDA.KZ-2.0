# S4 Implementation Notes

## Approved regression-test adaptation

After S4 introduced the approved multi-offer semantics, the existing S3 Playwright regression contained two assumptions that were no longer safe under the existing parallel E2E execution:

1. Search for `баранина` assumed exactly one visible `Баранина` result.
2. Seller setup compared the global `offers` row count before and after S3 setup.

These assumptions are test-level coupling, not a Search or Seller Input product defect. S4 explicitly permits another Seller to have an additional Offer for the same Product, including while another Playwright worker is running.

The user therefore approved one narrow exception to the S4 whitelist: `tests/e2e/seller-setup.spec.ts` may be adapted only to preserve the actual S3 regression semantics.

The adaptation is intentionally limited to:

- identifying the canonical S0 Search result by the stable seed Seller `Асыл Ет, тестовый продавец`, without asserting result count or order;
- proving that the Seller owned by this S3 test User has zero Offers before Seller setup and remains at zero after setup, reload and duplicate-setup rejection.

No Search implementation, Product implementation, Seller Input implementation, Playwright configuration, locks, sleeps, serialization or cross-test coordination were added. No other S0-S3 test was changed for this adaptation.
