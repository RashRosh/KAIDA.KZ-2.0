import { AppHeader } from '../_components/AppHeader';
import { NearbyFeed } from './NearbyFeed';
import styles from '../page.module.css';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';

export default async function NearbyPage() {
  const locale = await getRequestLocale();
  return (
    <>
      <AppHeader />
      <div className={styles.shell}>
        <main className={styles.main}>
          <NearbyFeed />
        </main>
        <footer className={styles.footer}>{messages[locale]['common.disclaimer']}</footer>
      </div>
    </>
  );
}
