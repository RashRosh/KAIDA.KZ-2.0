import Link from 'next/link';
import { AppHeader } from '../_components/AppHeader';
import { SellerSetup } from './_components/SellerSetup';
import styles from './page.module.css';

export default function SellerPage() {
  return (
    <>
      <AppHeader showAuth={false} contextLabel="Продавец" />
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Seller Input</p>
            <h1>Ваши товары в KAIDA.KZ</h1>
            <p>Сначала настройте продавца и точку. Затем создавайте изменения ассортимента и подтверждайте их перед появлением Offer.</p>
            <Link className={styles.primaryLink} href="/seller/batch">Изменить несколько товаров</Link>
          </div>
          <SellerSetup />
        </main>
      </div>
    </>
  );
}
