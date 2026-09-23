import { AppHeader } from '../_components/AppHeader';
import { SellerSetup } from './_components/SellerSetup';
import styles from './page.module.css';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';

export default async function SellerPage() {
  const locale = await getRequestLocale();
  return (
    <>
      <AppHeader showAuth={false} contextLabel={messages[locale]['context.seller']} />
      <div className={styles.shell}>
        <main className={styles.main}>
          <SellerSetup />
        </main>
      </div>
    </>
  );
}
