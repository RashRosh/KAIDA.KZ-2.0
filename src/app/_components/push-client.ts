'use client';

// actuality-reminders: browser side of push — what this device can do, enabling it after a tap, and forgetting it
// on logout. Works only with the service worker at /sw.js.

export type PushState = 'loading' | 'hidden' | 'unsupported' | 'ios-home' | 'denied' | 'off' | 'on';

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function supported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function publicKey(): Promise<string | null> {
  const response = await fetch('/api/push/public-key', { cache: 'no-store' });
  if (!response.ok) return null;
  return (await response.json() as { publicKey: string }).publicKey;
}

function keyBytes(base64: string) {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function save(subscription: PushSubscription) {
  const json = subscription.toJSON();
  const response = await fetch('/api/push/subscriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  });
  if (!response.ok) throw new Error('push save');
}

export async function currentPushState(): Promise<PushState> {
  if (!await publicKey().catch(() => null)) return 'hidden';
  if (!supported()) return isIos() && !isStandalone() ? 'ios-home' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription && Notification.permission === 'granted') {
    await save(subscription).catch(() => undefined);
    return 'on';
  }
  return 'off';
}

// Called from the button tap only: the permission prompt must follow a user action.
export async function enablePush(): Promise<PushState> {
  const key = await publicKey();
  if (!key) return 'hidden';
  if (!supported()) return isIos() && !isStandalone() ? 'ios-home' : 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) });
  await save(subscription);
  return 'on';
}

// Logout: this device stops receiving the login's reminders.
export async function forgetPushOnThisDevice() {
  try {
    if (!supported()) return;
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;
    await fetch('/api/push/subscriptions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: subscription.endpoint }),
    }).catch(() => undefined);
    await subscription.unsubscribe();
  } catch {
    // Logout must not depend on push.
  }
}
