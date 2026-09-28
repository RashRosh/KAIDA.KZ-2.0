import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { removeDeviceSubscription, saveDeviceSubscription } from '@/modules/reminders/application/device-subscriptions';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

// actuality-reminders: this device's push subscription for the signed-in login (POST saves, DELETE removes).
const endpointSchema = z.url().max(2000).refine((value) => value.startsWith('https://'), 'https only');
const subscriptionSchema = z.object({
  endpoint: endpointSchema,
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});
const removalSchema = z.object({ endpoint: endpointSchema });

async function currentUser(request: NextRequest) {
  try {
    return await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    return undefined;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await currentUser(request);
  if (user === undefined) {
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) {
    return NextResponse.json({ error: { code: 'AUTH_REQUIRED', message: 'Войдите, чтобы включить уведомления.' } }, { status: 401, headers: noStore });
  }
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_SUBSCRIPTION', message: 'Некорректная подписка.' } }, { status: 400, headers: noStore });
  }
  try {
    await saveDeviceSubscription(user.id, { endpoint: parsed.data.endpoint, p256dh: parsed.data.keys.p256dh, auth: parsed.data.keys.auth });
    return new Response(null, { status: 204, headers: noStore });
  } catch {
    console.error('Push subscription save failed');
    return NextResponse.json({ error: { code: 'PUSH_UNAVAILABLE', message: 'Не удалось включить уведомления.' } }, { status: 503, headers: noStore });
  }
}

export async function DELETE(request: NextRequest): Promise<Response> {
  const user = await currentUser(request);
  if (user === undefined) {
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Не удалось проверить вход.' } }, { status: 503, headers: noStore });
  }
  if (!user) return new Response(null, { status: 204, headers: noStore });
  const parsed = removalSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_SUBSCRIPTION', message: 'Некорректная подписка.' } }, { status: 400, headers: noStore });
  }
  try {
    await removeDeviceSubscription(user.id, parsed.data.endpoint);
    return new Response(null, { status: 204, headers: noStore });
  } catch {
    console.error('Push subscription removal failed');
    return NextResponse.json({ error: { code: 'PUSH_UNAVAILABLE', message: 'Не удалось выключить уведомления.' } }, { status: 503, headers: noStore });
  }
}
