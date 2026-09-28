import webpush from 'web-push';
import type { PushConfig } from '../config/reminders.config';
import type { PushSender } from '../application/run-actuality-reminders';

// actuality-reminders: delivery through the browser vendors' push services; the payload is encrypted by web-push.
export function createWebPushSender(config: PushConfig): PushSender {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return async (target, payload) => {
    try {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload,
        { TTL: 12 * 60 * 60 },
      );
      return 'ok';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      return status === 404 || status === 410 ? 'gone' : 'failed';
    }
  };
}
