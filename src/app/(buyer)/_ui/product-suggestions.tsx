'use client';

import { useEffect, useState } from 'react';
import { Ic } from '../../seller/_kaida/ui';

// S15B-3: buyer-side catalog suggestions. The data is the existing `GET /api/catalog/suggestions` (the ranking and the
// limit of five live there, S15B-1); the list uses the same look and listbox semantics as the seller card editor.

export type SuggestedProduct = { id: string; name: string };

export function useProductSuggestions(query: string, locale: 'ru' | 'kk', active: boolean): SuggestedProduct[] {
  const [suggestions, setSuggestions] = useState<SuggestedProduct[]>([]);
  const text = query.trim();
  useEffect(() => {
    if (!active || text.length < 2) {
      const timer = window.setTimeout(() => setSuggestions([]), 0);
      return () => window.clearTimeout(timer);
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      void fetch(`/api/catalog/suggestions?${new URLSearchParams({ q: text, locale })}`, { cache: 'no-store' })
        .then(async (response) => response.ok ? (await response.json() as { suggestions?: SuggestedProduct[] }).suggestions ?? [] : [])
        .then((found) => { if (alive) setSuggestions(found); })
        .catch(() => undefined);
    }, 200);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [text, locale, active]);
  return suggestions;
}

export function ProductSuggestionList({ id, label, suggestions, activeIndex, onChoose }: {
  id: string;
  label: string;
  suggestions: SuggestedProduct[];
  activeIndex: number;
  onChoose: (suggestion: SuggestedProduct) => void;
}) {
  return (
    <ul id={id} role="listbox" aria-label={label} className="card"
      style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 3, margin: 0, padding: '4px 0', listStyle: 'none', gap: 0, boxShadow: 'var(--shadow-md)' }}>
      {suggestions.map((suggestion, index) => (
        <li key={suggestion.id} id={`${id}-option-${index}`} role="option" aria-selected={index === activeIndex} className="li"
          style={{ minHeight: 48, padding: '8px 12px', cursor: 'pointer', background: index === activeIndex ? 'var(--primary-soft)' : undefined }}
          onMouseDown={(event) => { event.preventDefault(); onChoose(suggestion); }}>
          <Ic name="search" className="c2 sm" /><div className="mid"><div className="ts">{suggestion.name}</div></div>
        </li>
      ))}
    </ul>
  );
}
