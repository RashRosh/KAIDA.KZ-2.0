// No account data is broadcast or persisted. Private callers discard in-flight work on every session change.
const eventName = 'kaida-session-change';
let tabSource: string | undefined;
const source = () => tabSource ??= crypto.randomUUID();
export function announceSessionChange() {
  window.dispatchEvent(new Event(eventName));
  try { const channel = new BroadcastChannel(eventName); channel.postMessage({ source: source() }); channel.close(); } catch { /* Focus revalidation still applies. */ }
}
export function watchSessionChanges(changed: () => void) {
  window.addEventListener(eventName, changed);
  let channel: BroadcastChannel | undefined;
  try { channel = new BroadcastChannel(eventName); channel.onmessage = event => { if (event.data?.source !== source()) changed(); }; } catch { /* No broadcast support. */ }
  return () => { window.removeEventListener(eventName, changed); channel?.close(); };
}
