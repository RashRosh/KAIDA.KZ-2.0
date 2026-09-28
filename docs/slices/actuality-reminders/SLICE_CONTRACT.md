# Actuality reminders — Slice Contract

**Status:** APPROVED — Product Owner, 2026-09-28 (decisions in §8; the self-made choices of the draft accepted as written).

**Stage 1, item 5 (part b)** of `docs/product/EXECUTION_PLAN.md`; GitHub Issue #32. Builds on part a
(`docs/slices/offer-actuality/SLICE_CONTRACT.md`): the due state, the task block and «Всё актуально» live there.

**UX target:** accepted mockup copy (`PROJECT_RULES.md` §18.1): `S01` (the in-app block when push is off), `S18`
(«Включить push», reminder texts). The inbox screen of `S18` is not built (§3). Mobile, Russian.

**Base:** part a merged.

## 1. User task

A Seller who has not opened KAIDA gets a phone notification before their cards drop in search and again before they
disappear; one tap opens «Моя витрина» → «Актуальность», where «Всё актуально» confirms everything.

## 2. Scope and exact behavior

### Moments and texts (PO decision 2026-09-25)

- **First reminder** — when a Seller's active card reaches 24 h since confirmation (the day before it drops at 48 h):
  «Подтвердите актуальность, иначе завтра карточки опустятся в поиске» · «N карточек».
- **Second reminder** — at 144 h (the day before it hides at 168 h): «Завтра карточки пропадут из поиска» ·
  «N карточек».
- No other reminders. One notification per Seller per moment covers all their cards that reached it; a card gets each
  reminder at most once per confirmation (a new confirmation starts a new cycle).
- Quiet hours: nothing is sent between 21:00 and 09:00 Almaty time; a reminder that falls into them goes at 09:00.
- Moments are server settings (`ACTUALITY_REMINDER_HOURS` = `24,144`), not constants.

### Channel: browser push

- «Моя витрина» offers `Включить уведомления` in the task block and on «Ещё»; the browser permission prompt appears
  only after that tap. Refused or unsupported → the button explains how to turn it on later; nothing else changes.
- The Seller's device subscriptions are stored per login (a Seller may have several phones). Log out removes this
  device's subscription; a subscription the push service reports as gone is deleted.
- Tap on the notification opens `/seller?actuality=1` (the mass actuality list of part a); signed out → sign in first.
- The payload carries only the text and the link; no prices, names or phone numbers.
- iPhone: push works only when KAIDA is added to the home screen (iOS rule); the button says so on iPhone.

### When push is off

- The in-app block of part a («Пора подтвердить актуальность») is the reminder; nothing is sent by SMS, WhatsApp or
  Telegram.

### Sending

- A server job runs every 15 minutes inside the app server and can be started by a protected internal endpoint (for
  tests and an external cron). Each run finds due reminders, groups them per Seller, sends, and records each sent
  reminder (Seller, card, moment, confirmation time) so a repeated or concurrent run sends nothing twice.
- Keys for push (`WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY`, `WEB_PUSH_SUBJECT`) are server settings;
  without them the job does not start and the button is hidden.

## 3. Explicit out of scope

- The notification inbox and the bell (`S18`), any other notification types.
- SMS, WhatsApp, Telegram; email.
- Changing the 2 / 7 / 14 thresholds or the reminder moments beyond the settings.
- Buyer notifications.

## 4. Closed contracts revised

- `offer-actuality` (part a): the task block gets `Включить уведомления`; `/seller?actuality=1` opens the list directly.
- S2 auth: logout also removes the device push subscription.

## 5. Risk flags

- **External service:** notifications go through the browser vendors' push services (Google, Apple, Mozilla); the
  payload is encrypted and holds no personal data.
- **Background job and idempotency:** duplicate-safe by the sent-reminder record; concurrent runs covered by a lock.
- **Privacy:** subscriptions are tied to the login and removed on logout.
- **Migration** `0018`: subscriptions and sent reminders; no change to existing rows.

## 6. Acceptance criteria

1. `Включить уведомления` asks the browser for permission only after the tap; refusal leaves the in-app block.
2. At 24 h and at 144 h a subscribed Seller gets one notification with the right text and count; not at 23 h 59 min.
3. A second run in the same moment sends nothing; confirming the cards stops further reminders of that cycle.
4. Nothing is sent 21:00–09:00 Almaty; a due reminder then goes at 09:00.
5. Tap on the notification opens the mass actuality list; signed out → sign in, then the list.
6. Logout removes the device subscription; a gone subscription is deleted after a failed send.
7. Without push keys the app works and shows no button.

## 7. Verification and manual acceptance

- Unit: due moments, grouping, quiet hours, cycle keys with a deterministic clock.
- Integration: the job with a fake push sender — sent once, idempotent under two concurrent runs, stops after confirm,
  subscription lifecycle; migration 0018.
- E2E (mobile): the button and permission (granted / denied via browser context), the in-app block, the link opens the
  list.
- Real push on a phone is checked in manual acceptance.

**Manual acceptance (PO, phone):** enable notifications, set a card's confirmation to 24 h ago in the database, run the
job, receive the notification, tap it, confirm with `Всё актуально`; run the job again — no notification.

## 8. Product Owner decisions

- 2026-09-25 (`EXECUTION_PLAN.md` item 5): two reminders — on day 2 (before dropping) and day 6 (before hiding); no more.
- 2026-09-28: channel — browser push plus the in-app block (as in the mockup); no SMS / Telegram.
