'use client';

import { useRouter } from 'next/navigation';
import { AppHeader } from '../_components/AppHeader';
import { AuthModal } from '../_components/AuthModal';
import styles from './page.module.css';
import { useI18n } from '@/i18n/I18nProvider';

// actuality-reminders: a reminder opened while signed out comes back to its list after sign-in. Only this one
// same-site path is accepted, so the parameter cannot send anyone elsewhere.
const REMINDER_RETURN = '/seller?actuality=1';

function afterLogin() {
  return new URLSearchParams(window.location.search).get('next') === REMINDER_RETURN ? REMINDER_RETURN : '/';
}

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
        onAuthenticated={() => router.replace(afterLogin())}
      />
    </>
  );
}
