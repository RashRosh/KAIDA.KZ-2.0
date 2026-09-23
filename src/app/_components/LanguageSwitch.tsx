'use client';

import { useI18n } from '@/i18n/I18nProvider';
import type { Locale } from '@/i18n/config';
import { useRouter } from 'next/navigation';
import styles from './LanguageSwitch.module.css';

const choices: Locale[] = ['ru', 'kk'];

export function LanguageSwitch() {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  return (
    <div className={styles.switcher} role="group" aria-label={t('language.switch')}>
      {choices.map((choice) => (
        <button
          key={choice}
          type="button"
          className={styles.choice}
          aria-label={t(`language.${choice}`)}
          aria-pressed={locale === choice}
          onClick={() => {
            setLocale(choice);
            router.refresh();
          }}
        >
          <span className={styles.desktop}>{t(`language.${choice}`)}</span>
          <span className={styles.mobile} aria-hidden="true">{choice === 'ru' ? t('language.ruShort') : t('language.kkShort')}</span>
        </button>
      ))}
    </div>
  );
}
