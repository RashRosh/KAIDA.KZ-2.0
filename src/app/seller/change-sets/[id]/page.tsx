import { AppHeader } from '../../../_components/AppHeader';
import { SellerChangeSetReview } from './_components/SellerChangeSetReview';
import styles from '../../page.module.css';

export default async function SellerChangeSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <AppHeader showAuth={false} contextLabel="Продавец" />
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Seller Change Set</p>
            <h1>Проверка изменения</h1>
            <p>Offer создаётся только после явного подтверждения.</p>
          </div>
          <SellerChangeSetReview changeSetId={id} />
        </main>
      </div>
    </>
  );
}
