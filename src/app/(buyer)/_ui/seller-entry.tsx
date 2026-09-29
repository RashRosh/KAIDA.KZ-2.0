'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, type MouseEvent } from 'react';
import { AuthModal } from '../../_components/AuthModal';

// seller-entry-contextual-auth, moved from the site header: a signed-in visitor goes straight to the seller cabinet;
// anyone else signs in over the current page and then goes there; cancelling keeps them where they were.
export function useSellerEntry() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);

  async function enter(event: MouseEvent<HTMLElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trigger.current = event.currentTarget;
    const user = await fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? (await response.json() as { user: unknown }).user : null)
      .catch(() => null);
    if (user) router.push('/seller');
    else setOpen(true);
  }

  const modal = open ? (
    <AuthModal
      open
      onClose={() => {
        setOpen(false);
        requestAnimationFrame(() => trigger.current?.focus());
      }}
      onAuthenticated={() => {
        setOpen(false);
        router.push('/seller');
      }}
    />
  ) : null;

  return { enter, modal };
}
