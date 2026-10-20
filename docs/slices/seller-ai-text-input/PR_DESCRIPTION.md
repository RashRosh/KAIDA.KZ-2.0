# Seller AI text input — integration slice 1

## Summary

- Adds the first **integration** path for free-text seller input: text → server parse (`SELLER_TEXT_INPUT=fake`) → **offer drafts** → existing `CardEditor` → existing confirm/publish flow.
- Introduces slice contract `docs/slices/seller-ai-text-input/SLICE_CONTRACT.md` aligned with code, PR #187 research boundaries, and closed S12 limitations (no batch API for pack/free title).
- Does **not** enable live LLM, change `EXECUTION_PLAN` queue, or auto-publish.

## Product impact

- With `SELLER_TEXT_INPUT=fake` (E2E default on port 3100), sellers see **«Написать списком»** on the showcase source sheet.
- Recognized lines become drafts on «Моя витрина»; skipped and uncertain items are shown explicitly on the review screen.
- Publication still requires per-card «Проверить и опубликовать» and existing confirmation — no new moderation UI.

## Known limitations

- Only the **fake** deterministic parser ships; production default remains `off`.
- Skipped-line notices live in API + `sessionStorage`; reload of the review page may hide skips.
- No text-driven update/deactivate (`available:false`); create drafts only.
- Research assets in PR #187 are **not** merged by this PR.

## Tests

| Layer | Status |
| --- | --- |
| Unit (`seller-text-input.test.ts`) | 7 passed locally |
| Integration | Requires `DATABASE_URL` + `TEST_DATABASE_URL` (CI) |
| E2E (`seller-text-input.spec.ts`) | Runs on server 3100 with `SELLER_TEXT_INPUT=fake` |
| Full `pnpm verify` | Run on CI / machine with test Postgres |

## Manual acceptance (PO)

1. Set `SELLER_TEXT_INPUT=fake`, log in as seller with one point.
2. «Сформировать карточки» → «Написать списком» → paste `Баранина 4500 кг` → «Разобрать в черновики».
3. Review shows draft; open editor, fix if needed; publish via existing confirm — buyer sees card only after confirm.
4. Paste text with `виноград` mention without price → skipped block visible.
5. Confirm offer count unchanged until publish.

## Rollback

Revert merge; keep `SELLER_TEXT_INPUT=off`. Drafts can be deleted from the showcase.
