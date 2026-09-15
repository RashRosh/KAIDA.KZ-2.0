'use client';

import { useRouter } from 'next/navigation';
import { AppHeader } from '../_components/AppHeader';
import { AuthModal } from '../_components/AuthModal';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();

  return (
    <>
      <AppHeader showAuth={false} contextLabel="Вход" />
      <main className={styles.background} aria-hidden="true" />
      <AuthModal
        open
        onClose={() => router.replace('/')}
        onAuthenticated={() => router.replace('/')}
      />
    </>
  );
}
