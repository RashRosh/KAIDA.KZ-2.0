import Link from 'next/link';
import { SellerSetup } from './_components/SellerSetup';
import styles from './page.module.css';

export default function SellerPage() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">KAIDA.KZ</Link>
        <span>Продавец</span>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Seller Input</p>
          <h1>Ваши товары в KAIDA.KZ</h1>
          <p>Сначала настройте продавца и точку. Затем создавайте изменения ассортимента и подтверждайте их перед появлением Offer.</p>
        </div>
        <SellerSetup />
      </main>
    </div>
  );
}
