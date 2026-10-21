# Manual acceptance — seller text input with the real parser (§11.2)

For: Rashit (PO). Branch `slice/seller-ai-text-real-parser`, PR #191. Not merged; no production change.

## Before you start

Ask Claude to «start the acceptance stand». This redeploys the temporary model service on your Modal account (synthetic
text only, spend limit $0, billed $0 so far) and starts the app at http://127.0.0.1:3300 in `real` mode. Allowlisted
login phone: **+7 700 111 01 01**. The login code is shown on screen (local test mode).
When you finish, ask Claude to «stop the acceptance stand»: the model service and the app stop.

The first answer after a pause can take about a minute (the model starts). Later answers take 10–30 seconds.

## Steps

1. Log in with +7 700 111 01 01 and create a point (any name, type «Магазин», address «Алматы»).
2. «Сформировать карточки товаров» → «Написать списком».
3. Paste and send:
   «Сегодня есть куриное филе по 2400 за килограмм, бёдра по 1800, пельмени наши, пачка пол кило — 1400 тенге.
   Хотя нет, филе уже 2500, сметана закончилась.»
4. Expect on the review screen:
   - филе 2500 per kg;
   - бёдра 1800 with no unit and the notice «Единица не указана рядом с товаром — проверьте»;
   - пельмени 1400 per package, with a 0.5 kg pack in the editor;
   - сметана under «Не распознано»;
   - the line «Список составлен автоматически. Сверьте с исходным текстом выше.».
5. Send a second list, for example two lines, the second one without a price:
   «Морковь 570 за кг
   Виноград ещё ждём, цену скажу позже».
   Check whether anything is listed under «Возможно, пропущено» or «Не распознано». Note any product the model
   silently omitted: the app does not promise completeness.
6. Open one draft, correct a field, publish it through «Проверить и опубликовать» and the confirm screen. Exactly one
   card appears; the other drafts stay private.
7. Ask Claude to stop only the model service, then send a list again. Expect an error with «Повторить» and «Заполнить
   вручную», and no new drafts. Manual card entry still works.
8. Ask Claude to switch text input off and restart the app. «Написать списком» disappears; your drafts are still there.

## Already verified without you (`LIVE_TEST_2026-10-21.md`)

- Smoke test with the live model: 5/5.
- 28 control messages: answers byte-identical to the saved C2 run, same scores (25/28).
- The §11.2 scenario through the real app gave the expected result.
- Replay and CI tests on the branch are green.
