import { getDatabase, type Database } from '../../../db/client';
import { deleteSubscription, saveSubscription } from '../infrastructure/reminders.repository';

// actuality-reminders: the push subscription of one device for the signed-in login.
export async function saveDeviceSubscription(
  userId: string,
  subscription: { endpoint: string; p256dh: string; auth: string },
  dependencies: { database?: Database } = {},
) {
  await saveSubscription(dependencies.database ?? getDatabase(), userId, subscription);
}

export async function removeDeviceSubscription(userId: string, endpoint: string, dependencies: { database?: Database } = {}) {
  await deleteSubscription(dependencies.database ?? getDatabase(), endpoint, userId);
}
