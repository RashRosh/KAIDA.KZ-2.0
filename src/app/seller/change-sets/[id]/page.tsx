import { AppHeader } from '../../../_components/AppHeader';
import { SellerChangeSetReview } from './_components/SellerChangeSetReview';
import styles from '../../page.module.css';
import { messages } from '@/i18n/messages';
import { getRequestLocale } from '@/i18n/server';

export default async function SellerChangeSetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getRequestLocale();
  const t = messages[locale];
  return (
    <>
      <AppHeader showAuth={false} contextLabel={t['context.seller']} />
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>{t['review.pageEyebrow']}</p>
            <h1>{t['review.pageTitle']}</h1>
            <p>{t['review.pageDescription']}</p>
          </div>
          <SellerChangeSetReview changeSetId={id} />
        </main>
      </div>
    </>
  );
}
