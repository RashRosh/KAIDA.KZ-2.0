// No account data is broadcast or persisted. Private callers discard in-flight work on every session change.
const eventName = 'kaida-session-change';
let tabSource: string | undefined;
const source = () => tabSource ??= crypto.randomUUID();
export function announceSessionChange(revalidate = true) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: { revalidate } }));
  try { const channel = new BroadcastChannel(eventName); channel.postMessage({ source: source(), revalidate }); channel.close(); } catch { /* Focus revalidation still applies. */ }
}
export function watchSessionChanges(changed: (revalidate: boolean) => void) {
  const local = (event: Event) => changed((event as CustomEvent<{ revalidate?: boolean }>).detail?.revalidate !== false);
  window.addEventListener(eventName, local);
  let channel: BroadcastChannel | undefined;
  try { channel = new BroadcastChannel(eventName); channel.onmessage = event => { if (event.data?.source !== source()) changed(event.data?.revalidate !== false); }; } catch { /* No broadcast support. */ }
  return () => { window.removeEventListener(eventName, local); channel?.close(); };
}
