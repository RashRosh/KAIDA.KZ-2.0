import { AppHeader } from '../_components/AppHeader';
import { SellerSetup } from './_components/SellerSetup';
import styles from './page.module.css';

export default function SellerPage() {
  return (
    <>
      <AppHeader showAuth={false} contextLabel="Продавец" />
      <div className={styles.shell}>
        <main className={styles.main}>
          <SellerSetup />
        </main>
      </div>
    </>
  );
}
