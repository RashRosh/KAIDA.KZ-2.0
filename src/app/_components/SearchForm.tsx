'use client';

import { useRef, useState, type FormEvent } from 'react';
import { searchQuerySchema, searchResponseSchema, type SearchResponse } from '@/modules/search/contracts/search.contract';
import { OfferCard } from './OfferCard';
import styles from '../page.module.css';

type SearchState =
  | { kind: 'initial' | 'loading' | 'validation' | 'error' }
  | { kind: 'success'; result: SearchResponse };

export function SearchForm() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<SearchState>({ kind: 'initial' });
  const pending = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const loading = state.kind === 'loading';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const parsed = searchQuerySchema.safeParse(query);
    if (!parsed.success) {
      setState({ kind: 'validation' });
      input.current?.focus();
      return;
    }
    pending.current = true;
    setState({ kind: 'loading' });
    try {
      const response = await fetch(`/api/search?${new URLSearchParams({ q: parsed.data })}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 400) {
        setState({ kind: 'validation' });
        return;
      }
      if (!response.ok) throw new Error('Search unavailable');
      const result = searchResponseSchema.parse(await response.json());
      setState({ kind: 'success', result });
    } catch {
      setState({ kind: 'error' });
    } finally {
      pending.current = false;
    }
  }

  const feedback = loading
    ? 'Ищем предложения…'
    : state.kind === 'success'
      ? state.result.offers.length === 0
        ? 'По вашему запросу ничего не найдено.'
        : `Найдено предложений: ${state.result.offers.length}`
      : '';

  return (
    <section className={styles.searchArea} aria-label="Поиск предложений">
      <form onSubmit={submit} noValidate>
        <label htmlFor="product-query" className={styles.label}>Какой товар ищете?</label>
        <div className={styles.searchControls}>
          <input
            ref={input}
            id="product-query"
            name="q"
            type="search"
            placeholder="Например, баранина"
            value={query}
            readOnly={loading}
            onChange={(event) => setQuery(event.target.value)}
            aria-invalid={state.kind === 'validation'}
            aria-describedby={state.kind === 'validation' ? 'search-help search-validation' : 'search-help'}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" disabled={loading}>{loading ? 'Ищем…' : 'Найти'}</button>
        </div>
        <p id="search-help" className={styles.help}>Введите точное название товара.</p>
        {state.kind === 'validation' && <p id="search-validation" className={styles.error} role="alert">Введите название товара.</p>}
      </form>
      <div className={styles.results} aria-busy={loading}>
        <p className={styles.feedback} role="status" aria-live="polite" aria-atomic="true">{feedback}</p>
        {state.kind === 'error' && <p className={styles.error} role="alert">Не удалось выполнить поиск. Попробуйте ещё раз.</p>}
        {state.kind === 'success' && state.result.offers.length > 0 && (
          <ul className={styles.offerList} aria-label="Предложения">
            {state.result.offers.map((offer) => <li key={offer.id}><OfferCard offer={offer} /></li>)}
          </ul>
        )}
      </div>
    </section>
  );
}
