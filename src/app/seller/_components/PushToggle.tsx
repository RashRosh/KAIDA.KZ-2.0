'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/I18nProvider';
import type { MessageKey } from '../../../i18n/messages';
import { currentPushState, enablePush, type PushState } from '../../_components/push-client';
import { Ic } from '../_kaida/ui';

// actuality-reminders: «Включить уведомления» in the actuality task (compact) and on «Ещё» (a list row). The browser
// asks for permission only after the tap; nothing is shown while push is not configured on the server.
const hintKey: Partial<Record<PushState, MessageKey>> = {
  denied: 'push.denied',
  unsupported: 'push.unsupported',
  'ios-home': 'push.iosHome',
};

export function PushToggle({ variant }: { variant: 'task' | 'row' }) {
  const { t } = useI18n();
  const [state, setState] = useState<PushState>('loading');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void currentPushState().then((next) => { if (alive) setState(next); }).catch(() => { if (alive) setState('hidden'); });
    return () => { alive = false; };
  }, []);

  if (state === 'loading' || state === 'hidden') return null;

  async function enable() {
    setBusy(true);
    setFailed(false);
    try {
      setState(await enablePush());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const hint = hintKey[state];
  const error = failed && <p className="c" role="alert" style={{ color: 'var(--danger)' }}>{t('push.error')}</p>;

  if (variant === 'task') {
    if (state === 'on') return null;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {state === 'off' && (
          <button type="button" className="btn btn-g sm" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => void enable()} disabled={busy}>
            <Ic name="bell" className="sm" />{t('push.enable')}
          </button>
        )}
        {hint && <p className="c c2">{t(hint)}</p>}
        {error}
      </div>
    );
  }

  return (
    <div className="card" style={{ gap: 0, padding: '0 12px' }}>
      <button type="button" className="li" onClick={() => void enable()} disabled={busy || state !== 'off'} aria-busy={busy}>
        <Ic name="bell" className={state === 'on' ? 'pt' : 'c2'} />
        <div className="mid">
          <div className="ts">{state === 'on' ? t('push.on') : t('push.enable')}</div>
          <p className="c">{hint ? t(hint) : t('push.enableHint')}</p>
          {error}
        </div>
      </button>
    </div>
  );
}
