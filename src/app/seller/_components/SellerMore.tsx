'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import { Bar, Ic, LoginRequired, Nav, Phone } from '../_kaida/ui';
import { InlineLanguage } from '../_kaida/InlineLanguage';
import { forgetPushOnThisDevice } from '../../_components/push-client';
import { PushToggle } from './PushToggle';

function formatPhone(e164: string) {
  const digits = e164.replace(/\D/g, '');
  if (digits.length !== 11 || !digits.startsWith('7')) return e164;
  return `+7 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
}

// AI-S19 · More: the account, «Добавить списком», language, the way back to the buyer screens and sign-out.
// One account serves both roles (PO, 2026-09-29): sign-out lands on the buyer «Ещё», where «Войти» shows it took effect.
export function SellerMore() {
  const { t } = useI18n();
  const router = useRouter();
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? await response.json() as { user: { phone: string } | null } : { user: null })
      .then((data) => { if (alive) setPhone(data.user?.phone ?? null); })
      .catch(() => { if (alive) setPhone(null); });
    return () => { alive = false; };
  }, []);

  async function logout() {
    setLoggingOut(true);
    try {
      await forgetPushOnThisDevice();
      const response = await fetch('/api/auth/logout', { method: 'POST' });
      if (response.ok) {
        router.push('/more');
        router.refresh();
      }
    } finally {
      setLoggingOut(false);
    }
  }

  const row = { textDecoration: 'none', color: 'inherit' } as const;
  return (
    <Phone>
      <Bar title={t('cabinet.more')} />
      {phone === null ? <LoginRequired /> : (
        <main className="body" style={{ gap: 12 }}>
          <div className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <div className="lic p" style={{ borderRadius: 20 }}><Ic name="user" /></div>
            <div style={{ flex: 1 }}>
              {phone ? <div className="ts num">{formatPhone(phone)}</div> : <div className="sk" style={{ height: 16, width: '60%' }} />}
              <p className="c">{t('more.signedInWith')}</p>
            </div>
          </div>
          <div className="card" style={{ gap: 0, padding: '0 12px' }}>
            <Link className="li" href="/seller/batch" style={row}>
              <Ic name="layers" className="c2" /><div className="mid"><div className="ts">{t('cabinet.batch')}</div></div><Ic name="right" className="c2" />
            </Link>
          </div>
          <PushToggle variant="row" />
          <div className="card" style={{ gap: 0, padding: '0 12px' }}>
            <InlineLanguage />
            <Link className="li" href="/" style={row}>
              <Ic name="search" className="c2" /><div className="mid"><div className="ts">{t('cabinet.buyerEntry')}</div></div><Ic name="right" className="c2" />
            </Link>
            <button type="button" className="li" onClick={() => void logout()} disabled={loggingOut} aria-busy={loggingOut}>
              {loggingOut ? <span className="spin c2" /> : <Ic name="left" className="c2" />}<div className="mid"><div className="ts">{loggingOut ? t('cabinet.loggingOut') : t('cabinet.logout')}</div></div>
            </button>
          </div>
        </main>
      )}
      <Nav active="more" />
    </Phone>
  );
}
