'use client';

import { useRouter } from 'next/navigation';
import { AppHeader } from '../_components/AppHeader';
import { AuthModal } from '../_components/AuthModal';
import styles from './page.module.css';
import { useI18n } from '@/i18n/I18nProvider';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();

  return (
    <>
      <AppHeader showAuth={false} contextLabel={t('context.login')} />
      <main className={styles.background} aria-hidden="true" />
      <AuthModal
        open
        onClose={() => router.replace('/')}
        onAuthenticated={() => router.replace('/')}
      />
    </>
  );
}
