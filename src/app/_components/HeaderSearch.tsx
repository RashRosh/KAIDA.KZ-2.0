import styles from './AppHeader.module.css';

export function HeaderSearch() {
  return (
    <form
      className={styles.headerSearch}
      action="/"
      method="get"
      role="search"
      aria-label="Поиск из шапки"
    >
      <label htmlFor="header-product-query" className={styles.visuallyHidden}>Поиск товара</label>
      <div className={styles.headerSearchField}>
        <svg className={styles.headerSearchIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.25 4.25" />
        </svg>
        <input
          id="header-product-query"
          name="q"
          type="search"
          placeholder="Найти товар — баранина, мёд, картофель…"
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      <button type="submit">
        <svg className={styles.headerButtonIcon} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.25 4.25" />
        </svg>
        <span>Искать</span>
      </button>
    </form>
  );
}
