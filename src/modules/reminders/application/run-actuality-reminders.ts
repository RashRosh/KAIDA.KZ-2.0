import { getDatabase, type Database } from '../../../db/client';
import { readActualityPolicy, type ActualityPolicy } from '../../offers/actuality/actuality';
import { systemClock, type Clock } from '../../offers/lifecycle/offer-lifecycle';
import { isQuietHour, parseReminderMoments, reminderText } from '../config/reminders.config';
import {
  deleteSubscription,
  findDueOffers,
  listSubscriptions,
  recordSent,
  tryRunLock,
  type DueOffer,
} from '../infrastructure/reminders.repository';

// actuality-reminders §2 «Sending»: find the points that reached a reminder moment, send one notification per Seller
// and moment to every device of the Seller's login, and record the points so no run sends them again this cycle.

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushResult = 'ok' | 'gone' | 'failed';
export type PushSender = (target: PushTarget, payload: string) => Promise<PushResult>;

export const REMINDER_LINK = '/seller?actuality=1';

export type ReminderRunResult = { skipped: 'quiet' | 'locked' | null; notified: number; points: number };

export async function runActualityReminders(dependencies: {
  send: PushSender;
  database?: Database;
  clock?: Clock;
  policy?: ActualityPolicy;
  momentsSetting?: string;
}): Promise<ReminderRunResult> {
  const database = dependencies.database ?? getDatabase();
  const now = (dependencies.clock ?? systemClock)();
  if (isQuietHour(now)) return { skipped: 'quiet', notified: 0, points: 0 };
  const policy = dependencies.policy ?? readActualityPolicy();
  const moments = parseReminderMoments(dependencies.momentsSetting ?? process.env.ACTUALITY_REMINDER_HOURS, policy);

  return database.transaction(async (tx) => {
    if (!await tryRunLock(tx)) return { skipped: 'locked', notified: 0, points: 0 };
    let notified = 0;
    let points = 0;
    for (const moment of moments) {
      const due = await findDueOffers(tx, { now, momentHours: moment.hours, untilHours: moment.until });
      const bySeller = new Map<string, DueOffer[]>();
      for (const offer of due) bySeller.set(offer.sellerId, [...(bySeller.get(offer.sellerId) ?? []), offer]);
      for (const offers of bySeller.values()) {
        const targets = await listSubscriptions(tx, offers[0]!.ownerUserId);
        if (targets.length === 0) continue;
        const cards = new Set(offers.map((offer) => offer.cardId)).size;
        const text = reminderText(moment.kind, cards);
        const payload = JSON.stringify({ ...text, url: REMINDER_LINK });
        let delivered = false;
        for (const target of targets) {
          const result = await dependencies.send(target, payload);
          if (result === 'ok') delivered = true;
          if (result === 'gone') await deleteSubscription(tx, target.endpoint);
        }
        // A reminder that reached no device is tried again by the next run.
        if (!delivered) continue;
        await recordSent(tx, moment.hours, offers);
        notified += 1;
        points += offers.length;
      }
    }
    return { skipped: null, notified, points };
  });
}
