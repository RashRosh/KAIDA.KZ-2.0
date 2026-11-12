# Buyer browser audit, 2026-11-03

This record verifies a limited buyer journey on the isolated synthetic acceptance stand. It supplements the source-derived screen atlas; it does not close a product slice or attest the running build's exact commit. No application code, schema, deployment configuration, shared status file or production data changed.

[Miro evidence and observed states](https://miro.com/app/board/uXjVES0IAlE=/?moveToWidget=3458764689227058038) · [Screen register](SCREEN_REGISTER.md)

## Environment and evidence

- Connected local Chrome; RU; viewport 360×800. The seller-off favourite was also inspected at 320×800. A separate desktop empty-list capture was observed incidentally and is not a desktop regression pass.
- Synthetic test login with an interface-displayed test OTP; no real SMS, personal audio or external AI request. The phone number and OTP are intentionally omitted from this document.
- The stand showed its dummy-data notice. Reports were disabled, so that branch was not exercised. Text input was available on the isolated stand but was not used to create this fixture.
- Source baseline remains `dcd26adba9fe124a37a800df047810d6b30ae481`; the newer `main` merge of PR #202 contains product documentation. Runtime parity with either SHA was not independently attested through the browser.
- Each accepted capture was inspected. Six nonpersonal captures are placed in the Miro evidence chapter: results, contextual phone login, empty favourites, seller-off favourite, direct unavailable link, and guest favourites. The test phone/code captures are not published.

## Results

| Case | Result | Observed behavior | Atlas states |
|---|---|---|---|
| Popular query to results | PASS | One seeded offer; fallback thumbnail already on the left; current price, point, address, actuality and contact actions | B03-R |
| Guest opens offer | PASS | Empty heart; product tracking is separate; reports action absent with flag off | B08-G |
| Cancel contextual login | PASS | Modal closes; chosen offer is not saved | A01-P → B08-G |
| Invalid phone | PASS | Short phone rejected with inline validation | A01-E |
| Invalid code, then valid test code | PASS | One invalid attempt rejected; successful login closes the modal and saves the exact selected Offer+point | A02-E → B08-S |
| Open own favourites | PASS | Current offer data shown; opening details preserves `return=/favourites`; Back returns to the list | B09-A |
| Remove final favourite | PASS | Empty state with Find product action | B09-E |
| Seller switches off own synthetic card | PASS | Favourite remains with title, point, public seller and unavailable label; no price, address, actuality, route, contacts or detail link | B10-O |
| Direct old offer URL | PASS | Unavailable page with search action, without offer details | B08-U |
| Seller-off at 320 px | LIMITED PASS | No horizontal overflow observed in this state; remove control measured 258×44 px | B10-O |
| Sign out, open favourites | PASS | Guest gate; private list hidden | B09-G |

The code-request screen and its countdown were observed. Countdown expiry, resend and OTP lifetime were not tested. A single invalid attempt is not evidence for rate limiting or lockout behavior.

## Atlas corrections and open copy issue

1. B03 previously implied that a left-side thumbnail was entirely future work. The existing ResultCard already uses a 112×112 px image/fallback, confirmed in source and on the stand. T01 now distinguishes this retained pattern from the pending four-tab navigation and later styling decisions.
2. B12–B14 are FLAG surfaces, controlled by `reportsEnabled()` in the buyer offer page. The B08 report action is conditional. Disabling this branch on the stand was respected.
3. The direct guest favourites screen says “save this offer” even though no offer was selected. The atlas preserves the current copy and records the issue. No replacement copy or application behavior was silently introduced.

## Fixture and cleanup

The unavailable transition used a newly created, isolated synthetic card and fictitious point. It had no photos, coordinates or contacts. The card was published manually, saved by the synthetic buyer, then explicitly switched off through the seller UI. Existing seeded seller offers were not edited.

Both audit favourite references were removed. The newly created card remains switched off; the synthetic point remains. The session was signed out. Internal fixture IDs and the synthetic account number remain only in temporary test notes, not in the repository or exported handoff.

## Outstanding scope

Not exercised: seller-off reversal, active-offer expiry, Offer deletion, operator takedown, reports, multi-photo gallery, real SMS, resend/OTP expiry, KK, keyboard/focus, 200% text, or the full responsive matrix. The 12 observed state frames do not imply complete coverage of all atlas screens or conditions. Seller and operator workflows remain source-derived outside the narrow fixture setup described above.

This documentation-only audit requires no application test suite. Validation consists of the recorded browser interactions, inspected captures, source reconciliation, link destination checks and native wireframe geometry checks. PR #204 remains draft.
