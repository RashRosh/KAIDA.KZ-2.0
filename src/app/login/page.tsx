import Link from 'next/link';
import { LoginFlow } from './_components/LoginFlow';
import styles from './page.module.css';

export default function LoginPage() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href="/" className={styles.wordmark} aria-label="KAIDA.KZ, главная">KAIDA.KZ</Link>
        <span>Тестовый вход</span>
      </header>
      <main className={styles.main}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>Авторизация</p>
          <h1>Войти по телефону</h1>
          <p>SMS пока не отправляется. В закрытой тестовой версии код появится прямо на экране.</p>
        </div>
        <LoginFlow />
      </main>
    </div>
  );
}
