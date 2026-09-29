'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { AuthModal } from '../../_components/AuthModal';
import { forgetPushOnThisDevice } from '../../_components/push-client';
import { Bar, Ic, Radio, Sheet } from '../../seller/_kaida/ui';
import { BuyerScreen } from '../_ui/buyer-ui';
import { useSellerEntry } from '../_ui/seller-entry';

// buyer-screens-mockup · buyer «Ещё» (no frame; built like the seller's AI-S19): sign-in or the signed-in phone with
// sign-out, the language (chosen once at the first visit, changed only here) and the way to the seller cabinet.

function formatPhone(e164: string) {
  const digits = e164.replace(/\D/g, '');
  if (digits.length !== 11 || !digits.startsWith('7')) return e164;
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
}

export function BuyerMore() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const seller = useSellerEntry();
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [signInOpen, setSignInOpen] = useState(false);
  const signInButton = useRef<HTMLButtonElement>(null);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [choice, setChoice] = useState(locale);
  const [loggingOut, setLoggingOut] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = response.ok ? await response.json() as { user: { phone: string } | null } : { user: null };
      return data.user?.phone ?? null;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void loadUser().then((next) => { if (alive) setPhone(next); });
    return () => { alive = false; };
  }, [loadUser]);

  async function logout() {
    setLoggingOut(true);
    try {
      await forgetPushOnThisDevice();
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        setPhone(null);
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  }

  const overlay = (
    <>
      {seller.modal}
      {signInOpen && (
        <AuthModal
          open
          // A dismissed sign-in returns focus to «Войти» (UX1A2).
          onClose={() => { setSignInOpen(false); window.setTimeout(() => signInButton.current?.focus(), 0); }}
          onAuthenticated={(user) => { setSignInOpen(false); setPhone(user.phone); router.refresh(); }}
        />
      )}
      {languageOpen && (
        <Sheet title={t('more.languageTitle')} onClose={() => setLanguageOpen(false)} closeButton={false}>
          <div role="radiogroup" aria-label={t('more.language')} style={{ display: 'flex', flexDirection: 'column' }}>
            {(['ru', 'kk'] as const).map((value) => (
              <button key={value} type="button" className="li" role="radio" aria-checked={choice === value} onClick={() => setChoice(value)}>
                <Radio on={choice === value} /><div className="mid"><div className="ts">{t(value === 'ru' ? 'language.ru' : 'language.kk')}</div></div>
              </button>
            ))}
          </div>
          <p className="c">{t('more.languageNote')}</p>
          <button type="button" className="btn btn-p lg w" onClick={() => { setLocale(choice); setLanguageOpen(false); router.refresh(); }}>{t('more.done')}</button>
        </Sheet>
      )}
    </>
  );

  return (
    <BuyerScreen section="more" top={<Bar title={t('buyer.more')} />} overlay={overlay}>
      <main className="body" style={{ gap: 12 }}>
        <div className="card" style={{ gap: 0, padding: '0 12px' }}>
          {phone ? (
            <>
              <div className="li">
                <div className="lic p" style={{ borderRadius: 20 }}><Ic name="user" /></div>
                <div className="mid"><div className="ts num">{formatPhone(phone)}</div><p className="c">{t('more.signedInWith')}</p></div>
              </div>
              <button type="button" className="li" onClick={() => void logout()} disabled={loggingOut} aria-busy={loggingOut}
                style={{ background: 'transparent', border: 0, borderTop: '1px solid var(--line)' }}>
                {loggingOut ? <span className="spin c2" /> : <Ic name="left" className="c2" />}
                <div className="mid"><div className="ts">{loggingOut ? t('cabinet.loggingOut') : t('cabinet.logout')}</div></div>
              </button>
            </>
          ) : (
            <button ref={signInButton} type="button" className="li" onClick={() => setSignInOpen(true)} disabled={phone === undefined} style={{ background: 'transparent', border: 0 }}>
              <Ic name="user" className="c2" /><div className="mid"><div className="ts">{t('auth.signIn')}</div><p className="c">{t('buyer.signInHint')}</p></div><Ic name="right" className="c2" />
            </button>
          )}
        </div>
        <div className="card" style={{ gap: 0, padding: '0 12px' }}>
          <button type="button" className="li" onClick={() => { setChoice(locale); setLanguageOpen(true); }} aria-haspopup="dialog" style={{ background: 'transparent', border: 0 }}>
            <Ic name="globe" className="c2" /><div className="mid"><div className="ts">{t('more.language')}</div><p className="c">{t(locale === 'ru' ? 'language.ru' : 'language.kk')}</p></div><Ic name="right" className="c2" />
          </button>
          <a className="li" href="/seller" onClick={(event) => void seller.enter(event)} style={{ textDecoration: 'none', color: 'inherit', borderTop: '1px solid var(--line)' }}>
            <Ic name="store" className="c2" /><div className="mid"><div className="ts">{t('buyer.sellerEntry')}</div></div><Ic name="right" className="c2" />
          </a>
        </div>
        <p className="c" style={{ color: 'var(--ink3)' }}>{t('common.disclaimer')}</p>
      </main>
    </BuyerScreen>
  );
}
