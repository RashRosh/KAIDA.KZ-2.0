import { readPushConfig, REMINDER_INTERVAL_MS } from '../config/reminders.config';
import { createWebPushSender } from '../infrastructure/web-push-sender';
import { runActualityReminders } from './run-actuality-reminders';

// actuality-reminders: the job runs every 15 minutes inside the app server; a database lock keeps concurrent servers
// from sending twice. Without push keys it does not start.
const scheduler = globalThis as typeof globalThis & { __kaidaReminderTimer?: NodeJS.Timeout };

export function startReminderScheduler() {
  const config = readPushConfig();
  if (!config || scheduler.__kaidaReminderTimer) return;
  const send = createWebPushSender(config);
  const run = () => {
    runActualityReminders({ send }).catch(() => console.error('Actuality reminder run failed'));
  };
  scheduler.__kaidaReminderTimer = setInterval(run, REMINDER_INTERVAL_MS);
  scheduler.__kaidaReminderTimer.unref();
  setTimeout(run, 30_000).unref();
}
