'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { interestResponseSchema, interestsResponseSchema } from '../../../modules/interests/contracts/interests.contract';
import { AuthModal } from '../../_components/AuthModal';
import { watchSessionChanges } from '../../_components/session-change';

// S13 interests, moved from the result card to the offer page (buyer-screens-mockup §8 c): the same API, strings,
// `aria-pressed` and sign-in on demand; a card without a catalog product has no interest action.
type InterestsState = { kind: 'loading' | 'anonymous' | 'error' } | { kind: 'ready'; productIds: Set<string> };

export function useInterest(productId: string | null) {
  const { locale, t } = useI18n();
  const [state, setState] = useState<InterestsState>({ kind: 'loading' });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const epoch = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++epoch.current;
    let next: InterestsState;
    try {
      const response = await fetch(`/api/interests?locale=${locale}`, { cache: 'no-store' });
      if (response.status === 401) next = { kind: 'anonymous' };
      else if (!response.ok) next = { kind: 'error' };
      else {
        const parsed = interestsResponseSchema.parse(await response.json());
        next = { kind: 'ready', productIds: new Set(parsed.interests.map((interest) => interest.product.id)) };
      }
    } catch {
      next = { kind: 'error' };
    }
    if (ticket === epoch.current) setState(next);
  }, [locale]);

  useEffect(() => {
    if (!productId) {
      epoch.current++;
      return;
    }
    const lifetime = epoch;
    let active = true;
    let sessionChanging = false;
    const invalidate = (revalidate = true) => {
      epoch.current++;
      setState({ kind: 'loading' });
      setPending(false);
      setAuthOpen(false);
      setError(false);
      if (active && revalidate) void load();
    };
    const focus = () => invalidate(!sessionChanging);
    const off = watchSessionChanges((revalidate) => {
      sessionChanging = !revalidate;
      invalidate(revalidate);
    });
    window.addEventListener('focus', focus);
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        epoch.current++;
        setState({ kind: 'loading' });
        setPending(false);
        setAuthOpen(false);
      } else focus();
    };
    document.addEventListener('visibilitychange', visibility);
    void load();
    return () => {
      active = false;
      lifetime.current++;
      off();
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [load, productId]);

  async function toggle(event: React.MouseEvent<HTMLElement>) {
    if (!productId || pending) return;
    if (state.kind === 'anonymous') {
      trigger.current = event.currentTarget;
      setAuthOpen(true);
      return;
    }
    if (state.kind !== 'ready') return;
    const active = state.productIds.has(productId);
    const ticket = ++epoch.current;
    setError(false);
    setPending(true);
    try {
      const response = await fetch(`/api/interests/${productId}`, { method: active ? 'DELETE' : 'PUT', cache: 'no-store' });
      if (ticket !== epoch.current) return;
      if (response.status === 401) {
        setState({ kind: 'anonymous' });
        return;
      }
      if (!response.ok) throw new Error('Interest unavailable');
      if (!active) {
        const saved = interestResponseSchema.parse(await response.json());
        if (saved.interest.product.id !== productId) throw new Error('Unexpected interest');
      }
      setState((current) => {
        if (ticket !== epoch.current || current.kind !== 'ready') return current;
        const next = new Set(current.productIds);
        if (active) next.delete(productId);
        else next.add(productId);
        return { kind: 'ready', productIds: next };
      });
    } catch {
      if (ticket === epoch.current) setError(true);
    } finally {
      if (ticket === epoch.current) setPending(false);
    }
  }

  async function completeAuth() {
    setAuthOpen(false);
    if (!productId) return;
    const ticket = ++epoch.current;
    setError(false);
    setPending(true);
    try {
      const response = await fetch(`/api/interests/${productId}`, { method: 'PUT', cache: 'no-store' });
      if (ticket !== epoch.current) return;
      if (!response.ok) throw new Error('Interest unavailable');
      interestResponseSchema.parse(await response.json());
    } catch {
      if (ticket === epoch.current) setError(true);
    } finally {
      if (ticket === epoch.current) setPending(false);
    }
    if (ticket === epoch.current) await load();
  }

  const available = productId !== null && (state.kind === 'ready' || state.kind === 'anonymous');
  const active = productId !== null && state.kind === 'ready' && state.productIds.has(productId);
  const modal = authOpen ? (
    <AuthModal
      open
      description={t('auth.interestDescription')}
      onClose={() => { setAuthOpen(false); requestAnimationFrame(() => trigger.current?.focus()); }}
      onAuthenticated={() => { void completeAuth(); }}
    />
  ) : null;

  return { available, active, pending, error, toggle, modal };
}
