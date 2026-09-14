import { AppHeader } from '../_components/AppHeader';
import { LoginFlow } from './_components/LoginFlow';
import styles from './page.module.css';

export default function LoginPage() {
  return (
    <>
      <AppHeader showAuth={false} contextLabel="Вход" />
      <div className={styles.shell}>
        <main className={styles.main}>
          <div className={styles.intro}>
            <p className={styles.eyebrow}>Авторизация</p>
            <h1>Войти по телефону</h1>
            <p>SMS пока не отправляется. В закрытой тестовой версии код появится прямо на экране.</p>
          </div>
          <LoginFlow />
        </main>
      </div>
    </>
  );
}
