'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { favouritesResponseSchema, type Favourite } from '../../../modules/favourites/contracts/favourites.contract';
import { AuthModal } from '../../_components/AuthModal';
import { watchSessionChanges } from '../../_components/session-change';

type State = { kind: 'loading' | 'anonymous' | 'error' } | { kind: 'ready'; userId: string; favourites: Favourite[] };
type Target = { offerId: string; locationId: string };
export function useFavourites(target: Target | null = null, enabled = true) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const epoch = useRef(0), busy = useRef(false);
  const intent = useRef<Target | null>(null);

  const load = useCallback(async () => {
    const ticket = ++epoch.current;
    try {
      const response = await fetch(`/api/favourites?locale=${locale}`, { cache: 'no-store' });
      let next: State;
      if (response.status === 401) next = { kind: 'anonymous' };
      else if (!response.ok) next = { kind: 'error' };
      else {
        const data = favouritesResponseSchema.parse(await response.json());
        next = { kind: 'ready', userId: data.userId, favourites: data.favourites };
      }
      if (ticket === epoch.current) setState(next);
    } catch { if (ticket === epoch.current) setState({ kind: 'error' }); }
  }, [locale]);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    let sessionChanging = false;
    const lifetime = epoch;
    const invalidate = (revalidate = true) => {
      epoch.current++; busy.current = false; intent.current = null;
      setState({ kind: 'loading' }); setPendingId(null); setAuthOpen(false); setError(false); setUnavailable(false);
      if (mounted && revalidate) void load();
    };
    const focus = () => invalidate(!sessionChanging);
    const off = watchSessionChanges(revalidate => { sessionChanging = !revalidate; invalidate(revalidate); });
    window.addEventListener('focus', focus);
    const visibility = () => { if (document.visibilityState === 'hidden') { epoch.current++; setState({ kind: 'loading' }); intent.current = null; setAuthOpen(false); } else focus(); };
    document.addEventListener('visibilitychange', visibility);
    queueMicrotask(() => { if (mounted) void load(); });
    return () => { mounted = false; lifetime.current++; busy.current = false; intent.current = null; off(); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility); };
  }, [enabled, load]);

  async function write(method: 'PUT' | 'DELETE', input: Target | { id: string }) {
    if (busy.current) return;
    busy.current = true;
    const ticket = ++epoch.current;
    setPendingId('id' in input ? input.id : input.offerId); setError(false); setUnavailable(false);
    try {
      const response = await fetch('/api/favourites', { method, cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (ticket !== epoch.current) return;
      if (response.status === 401) {
        setState({ kind: 'anonymous' });
        if (method === 'PUT' && 'offerId' in input) { intent.current = input; setAuthOpen(true); }
        return;
      }
      if (response.status === 409) { setUnavailable(true); await load(); return; }
      if (!response.ok) throw new Error('Favourite request failed');
      await load();
    } catch { if (ticket === epoch.current) setError(true); }
    finally { if (ticket === epoch.current || ticket + 1 === epoch.current) { busy.current = false; setPendingId(null); } }
  }
  const activeEntry = target && state.kind === 'ready' ? state.favourites.find(f => f.offerId === target.offerId && f.locationId === target.locationId) : undefined;
  function toggle(event: React.MouseEvent<HTMLElement>) {
    if (!enabled || !target || busy.current) return;
    trigger.current = event.currentTarget;
    if (state.kind === 'anonymous') { intent.current = target; trigger.current = event.currentTarget; setAuthOpen(true); return; }
    if (state.kind === 'ready') void write(activeEntry ? 'DELETE' : 'PUT', activeEntry ? { id: activeEntry.id } : target);
  }
  // Own successful login callback receives its captured target even though the session broadcast invalidates stale work.
  const capturedIntent = intent.current;
  const modal = authOpen ? <AuthModal open description={t('fav.authDescription')}
    onClose={() => { intent.current = null; setAuthOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }}
    onAuthenticated={() => { setAuthOpen(false); intent.current = null; if (capturedIntent) void write('PUT', capturedIntent); else void load(); }} /> : null;
  return { state, error, unavailable, pendingId, active: !!activeEntry, toggle, modal, reload: load,
    available: enabled && (state.kind === 'ready' || state.kind === 'anonymous'),
    remove: (id: string) => write('DELETE', { id }),
    signIn: (event: React.MouseEvent<HTMLElement>) => { intent.current = null; trigger.current = event.currentTarget; setAuthOpen(true); } };
}
