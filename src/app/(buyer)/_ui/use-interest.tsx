'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { interestResponseSchema, interestsResponseSchema } from '../../../modules/interests/contracts/interests.contract';
import { AuthModal } from '../../_components/AuthModal';

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

  const load = useCallback(async (): Promise<InterestsState> => {
    try {
      const response = await fetch(`/api/interests?locale=${locale}`, { cache: 'no-store' });
      if (response.status === 401) return { kind: 'anonymous' };
      if (!response.ok) return { kind: 'error' };
      const parsed = interestsResponseSchema.parse(await response.json());
      return { kind: 'ready', productIds: new Set(parsed.interests.map((interest) => interest.product.id)) };
    } catch {
      return { kind: 'error' };
    }
  }, [locale]);

  useEffect(() => {
    if (!productId) return;
    let active = true;
    void load().then((next) => { if (active) setState(next); });
    return () => { active = false; };
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
    setError(false);
    setPending(true);
    try {
      const response = await fetch(`/api/interests/${productId}`, { method: active ? 'DELETE' : 'PUT', cache: 'no-store' });
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
        if (current.kind !== 'ready') return current;
        const next = new Set(current.productIds);
        if (active) next.delete(productId);
        else next.add(productId);
        return { kind: 'ready', productIds: next };
      });
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  async function completeAuth() {
    setAuthOpen(false);
    if (!productId) return;
    setError(false);
    setPending(true);
    try {
      const response = await fetch(`/api/interests/${productId}`, { method: 'PUT', cache: 'no-store' });
      if (!response.ok) throw new Error('Interest unavailable');
      interestResponseSchema.parse(await response.json());
    } catch {
      setError(true);
    }
    setState(await load());
    setPending(false);
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
