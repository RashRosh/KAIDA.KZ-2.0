import { AppHeader } from '../_components/AppHeader';
import { NearbyFeed } from './NearbyFeed';
import styles from '../page.module.css';

export default function NearbyPage() {
  return (
    <>
      <AppHeader />
      <div className={styles.shell}>
        <main className={styles.main}>
          <NearbyFeed />
        </main>
        <footer className={styles.footer}>Предложения и цены в этой версии вымышлены.</footer>
      </div>
    </>
  );
}
