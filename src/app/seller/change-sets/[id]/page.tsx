import Link from 'next/link';
import { SellerChangeSetReview } from './_components/SellerChangeSetReview';
import styles from '../../page.module.css';

export default async function SellerChangeSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">KAIDA.KZ</Link>
        <Link href="/seller" className={styles.secondaryLink}>Продавец</Link>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Seller Change Set</p>
          <h1>Проверка изменения</h1>
          <p>Offer создаётся только после явного подтверждения.</p>
        </div>
        <SellerChangeSetReview changeSetId={id} />
      </main>
    </div>
  );
}
