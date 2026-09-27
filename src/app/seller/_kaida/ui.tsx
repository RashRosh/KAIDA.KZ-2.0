'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';

// Building blocks of the accepted mockup (docs/product/mockup/seller-ai-first-rev1): the same class names as its
// kaida.css, so every screen renders exactly as its frame.

export function Ic({ name, className = '', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`ic i-${name}${className ? ` ${className}` : ''}`} style={style} aria-hidden="true" />;
}

// The phone: the whole screen of a seller page.
export function Phone({ children }: { children: React.ReactNode }) {
  return <div className="kaida kaida-app motion"><div className="ph">{children}</div></div>;
}

export function Lang() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  return (
    <div className="lang" role="group" aria-label={t('language.switch')}>
      {(['ru', 'kk'] as const).map((choice) => (
        <button key={choice} type="button" aria-pressed={locale === choice} onClick={() => { setLocale(choice); router.refresh(); }}>
          {choice === 'ru' ? 'РУС' : 'ҚАЗ'}
        </button>
      ))}
    </div>
  );
}

export function Bar({ title, onBack, backLabel = 'Назад', backDisabled = false, lang = false, children }: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  lang?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <header className="bar">
      {onBack && (
        <button type="button" className={`ib${backDisabled ? ' dis' : ''}`} aria-label={backLabel} onClick={onBack} disabled={backDisabled} style={backDisabled ? { color: 'var(--ink3)' } : undefined}>
          <Ic name="left" />
        </button>
      )}
      <h1 className="bar-t" style={{ margin: 0 }}>{title}</h1>
      {lang && <Lang />}
      {children}
    </header>
  );
}

export type NavSection = 'showcase' | 'points' | 'more';

export function Nav({ active }: { active: NavSection }) {
  const { t } = useI18n();
  const items: { key: NavSection; href: string; icon: string; label: string }[] = [
    { key: 'showcase', href: '/seller', icon: 'store', label: t('cabinet.showcase') },
    { key: 'points', href: '/seller/points', icon: 'pin', label: t('cabinet.points') },
    { key: 'more', href: '/seller/more', icon: 'menu', label: t('cabinet.more') },
  ];
  return (
    <nav className="nav" aria-label={t('cabinet.nav')}>
      {items.map((item) => (
        <Link key={item.key} href={item.href} className={active === item.key ? 'on' : undefined} aria-current={active === item.key ? 'page' : undefined}>
          <Ic name={item.icon} />{item.label}
        </Link>
      ))}
    </nav>
  );
}

export function Toast({ children, bottom }: { children: React.ReactNode; bottom?: number }) {
  return (
    <div className="toast" role="status" style={bottom ? { bottom } : undefined}>
      <Ic name="check" style={{ color: '#7ee29a' }} /><span style={{ flex: 1 }}>{children}</span>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)';

// Scrim + bottom sheet (kaida .scrim/.sheet); focus moves in, stays in, and returns to the opener on close.
export function Sheet({ title, onClose, role = 'dialog', closeButton = true, children, describedBy }: {
  title: string;
  onClose: () => void;
  role?: 'dialog' | 'alertdialog';
  closeButton?: boolean;
  children: React.ReactNode;
  describedBy?: string;
}) {
  const ids = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const sheet = ref.current;
    (sheet?.querySelector<HTMLElement>('[data-autofocus]') ?? sheet?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !sheet) return;
      const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus(); };
  }, []);
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div ref={ref} className="sheet" role={role} aria-modal="true" aria-labelledby={`${ids}-t`} aria-describedby={describedBy}>
        <div className="grab" />
        {closeButton ? (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2 className="h3" id={`${ids}-t`} style={{ flex: 1 }}>{title}</h2>
            <button type="button" className="ib" aria-label="Закрыть" onClick={onClose}><Ic name="close" /></button>
          </div>
        ) : (
          <h2 className="h3" id={`${ids}-t`}>{title}</h2>
        )}
        {children}
      </div>
    </>
  );
}

// kaida checkbox (.cb) with a real input laid over it: the same box for a finger, keyboard and screen readers.
export function Check({ checked, onChange, label, disabled, indeterminate }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  indeterminate?: boolean;
}) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flex: 'none' }}>
      <span className={`cb${checked || indeterminate ? ' on' : ''}`} aria-hidden="true" style={indeterminate ? { background: 'var(--surface)', color: 'var(--primary)' } : undefined}>
        {checked && !indeterminate && <Ic name="check" />}
        {indeterminate && <span style={{ width: 10, height: 2, background: 'var(--primary)', borderRadius: 1 }} />}
      </span>
      <input type="checkbox" className="cbx" aria-label={label} checked={checked} disabled={disabled}
        ref={(element) => { if (element) element.indeterminate = Boolean(indeterminate); }}
        onChange={(event) => onChange(event.target.checked)} />
    </span>
  );
}

export function Radio({ on }: { on: boolean }) {
  return <span className={`rd${on ? ' on' : ''}`} aria-hidden="true" />;
}

export function ErrorLine({ id, children }: { id?: string; children: React.ReactNode }) {
  return <div className="emsg" id={id}><Ic name="alert" />{children}</div>;
}

// No-photo fallback: the translucent KAIDA sign (mockup comment 045a8fb4).
export function Thumb({ photoUrl, size = 56, radius = 10 }: { photoUrl?: string | null; size?: number; radius?: number }) {
  return (
    <div className={`img${photoUrl ? '' : ' fb'}`} style={{ width: size, height: size, borderRadius: radius }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- owner-only photo route */}
      {photoUrl ? <img src={photoUrl} alt="" /> : <Ic name="logo" />}
    </div>
  );
}

// Signed-out seller page (no frame in the mockup): the empty-state composition of AI-S01 with the sign-in action.
export function LoginRequired() {
  const { t } = useI18n();
  return (
    <main className="body" style={{ justifyContent: 'center', gap: 20, padding: '24px 20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'center' }}>
        <h2 className="h1">{t('seller.loginRequired')}</h2>
        <p className="t c2">{t('seller.loginHelp')}</p>
      </div>
      <Link className="btn btn-p lg w" href="/login">{t('auth.signIn')}</Link>
    </main>
  );
}

// AI-S01 · Offline + Error: the error banner with «Повторить».
export function LoadError({ title, text, onRetry }: { title: string; text?: string; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div className="banner err" role="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14 }}>
      <Ic name="alert" className="dn" />
      <div style={{ flex: 1 }}><div className="ts">{title}</div><p className="c c2">{text ?? t('cabinet.unchanged')}</p></div>
      <button type="button" className="btn btn-o sm" onClick={onRetry}><Ic name="refresh" className="sm" />{t('cabinet.retry')}</button>
    </div>
  );
}

// AI-S01 · Loading: skeleton card rows of the same shape.
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  const widths = [[80, 50, 38], [70, 45, 32], [76, 40, 36]];
  return (
    <>
      <span className="vh" role="status">{t('cabinet.loading')}</span>
      {Array.from({ length: rows }, (_, index) => {
        const [a, b, c] = widths[index % widths.length]!;
        return (
          <div key={index} className="card" style={{ flexDirection: 'row', gap: 12 }} aria-hidden="true">
            <div className="sk" style={{ width: 64, height: 64, borderRadius: 10 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="sk" style={{ height: 14, width: `${a}%` }} />
              <div className="sk" style={{ height: 14, width: `${b}%` }} />
              <div className="sk" style={{ height: 22, width: `${c}%` }} />
            </div>
          </div>
        );
      })}
    </>
  );
}
