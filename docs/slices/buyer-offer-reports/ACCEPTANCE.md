# Buyer Offer reports — isolated acceptance handoff

Implementation PR: [#169](https://github.com/RashRosh/KAIDA.KZ-2.0/pull/169). Executable commit: `0d5aaf6c972593f8fae6afdbd302e69e8d00f45a`; later handoff-only commits do not change executable files. Use the final PR head and its checks for manual acceptance. Implementation is **not merged or tagged**; the contract remains approved, not CLOSED.

Reporting defaults off (`BUYER_REPORTS_LOCAL_TESTING=0`); the separate acceptance instance enables it for synthetic fixtures only. Real-user reporting, production evidence retention and public deployment remain unauthorized. No SMS delivery, purchase or voice research resume.

## Verification

- Windows x64, Node24.14.1, pnpm11.28.5, Chromium and isolated PostgreSQL18. Local production build: webpack,768MiB Node heap, one worker, opt-in memory optimization; no Docker/system resource changes. CI uses the unchanged standard build.
- Lint/types,510 unit tests; targeted atomic admission/disposition, real route authorization/privacy, additive migration and existing migration regression passed. Fresh/repeat migration includes27 migrations and32 application tables. Upgrade compared every pre-existing public table without rewrites.
- Twelve concurrent retries produce one immutable report; six concurrent cards admit exactly five; closure does not release quota; rolling expiry does. Language, actuality/off-on and return do not reset versions; confirmed edits do, including edits back to earlier values. Stale decisions fail; conflicting resolutions allow one winner; injected final-write failure rolls back moderation/audit and closure.
- Mobile RU browser task proves Back/login preservation, explicit Send, operator removal, seller privacy and closed-after-return history. Runtime preview interaction also checks photo selection and non-photo optional comment. No buyer outcome delivery is claimed.
- R2 source/restore:32 tables,27 migrations,4 photo rows and8 referenced display/thumb files match. Three unreferenced files are informational under the existing backup policy. Detached historical-photo bytes match SHA256 `0f642e9516c561c1678e7765f286a3530ebbd13ffc3a90b85f86731e75803c03`; restored closed disposition/text/current1400 versus reported1200 remain distinct. Actual HTTP denies guest/seller access to the report route, unrelated photo IDs and anonymous ordinary historical access. Existing private owner access to their own photo is unchanged; ordinary operator access to a detached photo is still denied.
- Full regression/CI evidence is linked through the PR checks and recorded in CURRENT_STATE. Local clean full integration had one existing5s S6 upgrade timeout; it passed with a15s command override, without changing committed thresholds. An earlier unclean run used the catalog imported by browser global setup; clean test preparation corrected it. Local timing and final standard CI results must be distinguished.
- No dependency version changes or new security exception. Existing R3 E-R3-OS/E-R3-GO exceptions remain isolated-local-only; closure cannot extend them.

## Runtime screenshots and limits

[Reasons](evidence/buyer-reasons.png), [photo/comment](evidence/buyer-photo-comment.png), [non-photo comment](evidence/buyer-optional-comment.png), [historical/current comparison](evidence/operator-historical-comparison.png). These show real product UI with synthetic fixture data, not static mockups. Report comparison's lower sections are reachable by vertical scrolling.

Readability:320px viewport at normal and explicitly doubled text/line heights, with vertical body scrolling and reachable actions: [measurements](evidence/readability-and-restore.json), [buyer2x](evidence/buyer-320-2x.png), [operator2x](evidence/operator-320-2x.png). This is Chromium verification, not OS font scaling, a screen-reader audit or a physical-device test. Mobile RU is the accepted boundary; KK keys are structurally complete but copy provisional; desktop/KK visual acceptance remains outside this gate. Private text is escaped and never automatically forwarded; this cannot prevent an authorized human operator manually disclosing it. Previously cached public photos cannot be retroactively revoked.

## Synthetic acceptance fixtures

Use a mobile-sized browser at **http://127.0.0.1:3200**. Port3000 and its private checkpoint database/photos are unchanged. Separate browser profiles/incognito contexts keep buyer/operator/seller sessions distinct. Existing local OTP appears in the login dialog; there is no real SMS.

| Fixture | Recorded identity |
| --- | --- |
| Seller | phone `+77000991401`, User `a9030000-0000-4000-8000-000000000001`; Seller `8689b148-5fcb-46e8-ad96-aec6310403a6` |
| Buyer | phone `+77000991402`, User `a9030000-0000-4000-8000-000000000002` |
| Allowlisted operator | phone `+77000991403`, User `a9030000-0000-4000-8000-000000000003` |
| Two-photo card | Offer `d2d82b3a-f491-4bb2-8a67-67ff3be72275`; card `a4f86c66-c8cb-4325-83d7-84d1e06137d0` |
| Non-photo/no-action card | Offer `47075974-6301-44cf-b45a-316f5799d657`; card `c047238c-ce5c-4c72-b772-bfe83a1707a7` |
| Historical restore proof | Offer `77158e66-ad62-40f4-8a2a-baabaf4e0c1b`; card `feeb7d75-84f5-4b6a-a0e4-14334420dcb6`; closed report `49176131-dbf8-49eb-aedd-831fec6a309f` |
| Proof buyer / shared point | User `a9030000-0000-4000-8000-000000000009`, phone `+77000991409`; Location `94b37b13-32ab-4404-896b-44234e3e17cd` |
| Photos | `a9030000-0000-4000-8000-000000000004`, `...005`, `...007` (detached historical), `...008`; prefix is `a9030000-0000-4000-8000-000000000` |

Source container/volume: `kaida-buyer-reports-postgres` / `kaida-buyer-reports-pg`, loopback55436, DB `kaida_reports`; regression DB `kaida_test`. Restore container/volume: `kaida-buyer-reports-restore-postgres` / `kaida-buyer-reports-restore-pg`,55437, DB `kaida_reports_restore`. These alone are disposable. Exact container/PID manifests and raw logs: private `tmp/buyer-reports-evidence`; photos/confidential bundle/restored files: Windows TEMP `kaida-buyer-reports-20261010`, outside Git. Preserve evidence before any separately authorized fixture cleanup. Synthetic illustrations contain no dev or personal photos.

## Simple manual checklist

1. **Buyer:** open `/offers/d2d82b3a-f491-4bb2-8a67-67ff3be72275`; choose photo mismatch. It immediately opens photo/comment without Next. Choose photo2 and optional text; Back/reselect keeps both. A non-photo reason keeps the text and hides photo selection. Only Send opens login; completing buyer login retains the draft and requires another explicit Send. Expect `Жалоба отправлена` / `Спасибо, мы проверим предложение.` Repeating the same-version report cannot replace its text or create another report.
2. **Operator:** log in separately and open `/operator/reports`. Review the new report and reported/current evidence. Choose removal, an independently selected operator reason and seller comment; confirm closure. The card is unavailable to the buyer. Open the current card and explicitly return it: it becomes visible, while the closed report retains its historical removal disposition.
3. **Seller:** log in separately at `/seller`. See only the operator reason/comment, never buyer text/phone. Replace the disputed photo and confirm the edit. In the closed report, the operator still sees the old evidence/photo separately from current content. The prebuilt restore-proof report already demonstrates old1200/two photos versus current1400/one photo.
4. **No action:** buyer reports `/offers/47075974-6301-44cf-b45a-316f5799d657` with any non-photo reason; optional text may be blank. Operator chooses no action, records a private rationale and confirms. The report closes; the Offer remains visible.

STOP for PO manual acceptance. No implementation merge, checkpoint tag or future queue change is authorized by this handoff.
