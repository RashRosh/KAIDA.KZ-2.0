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
            <h1>Настройка торговой точки</h1>
            <p>Укажите данные торговой точки и контакты. После сохранения подтвердите местоположение — и можно добавлять товары.</p>
          </div>
          <SellerSetup />
        </main>
      </div>
    </>
  );
}
