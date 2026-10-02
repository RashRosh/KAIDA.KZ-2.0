'use client';

import { useEffect, useRef, useState } from 'react';
import type { AddressDirectorySuggestion } from '@/modules/address-directory/contracts/address-directory.contract';
import { Ic } from '../_kaida/ui';

type Props = {
  id: string;
  label: string;
  visibleLabel?: string;
  value: string;
  onChange: (value: string) => void;
  selectedEntryId: string | null;
  onSelectedEntryIdChange: (value: string | null) => void;
  placeholder: string;
  hint?: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  autoComplete?: string;
};

export function AddressSuggestionInput({
  id,
  label,
  visibleLabel,
  value,
  onChange,
  selectedEntryId,
  onSelectedEntryIdChange,
  placeholder,
  hint,
  disabled,
  invalid,
  describedBy,
  required,
  autoComplete = 'off',
}: Props) {
  const [suggestions, setSuggestions] = useState<AddressDirectorySuggestion[]>([]);
  const [selected, setSelected] = useState<AddressDirectorySuggestion | null>(null);
  const [active, setActive] = useState(-1);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const query = value.trim();
  const open = focused && !selectedEntryId && suggestions.length > 0;

  useEffect(() => {
    if (selectedEntryId || query.length < 3) {
      const timer = window.setTimeout(() => { setSuggestions([]); setLoading(false); }, 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/seller/address-suggestions?${new URLSearchParams({ q: query })}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
        .then(async (response) => response.ok ? (await response.json() as { suggestions: AddressDirectorySuggestion[] }).suggestions : [])
        .then((found) => { setSuggestions(found); setActive(-1); })
        .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setSuggestions([]); })
        .finally(() => setLoading(false));
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selectedEntryId]);

  function change(next: string) {
    if (selectedEntryId) {
      onSelectedEntryIdChange(null);
      setSelected(null);
    }
    onChange(next);
  }

  function choose(suggestion: AddressDirectorySuggestion) {
    onChange(suggestion.addressText);
    onSelectedEntryIdChange(suggestion.id);
    setSelected(suggestion);
    setSuggestions([]);
    setActive(-1);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => index <= 0 ? suggestions.length - 1 : index - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]!);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActive(-1);
    }
  }

  return (
    <div className="fld" style={{ position: 'relative' }}>
      {visibleLabel && <div className="fl">{visibleLabel}</div>}
      <label htmlFor={id} className={visibleLabel ? 'vh' : undefined}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          className={`inp${invalid ? ' er' : ''}`}
          value={value}
          maxLength={500}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-autocomplete="list"
          aria-controls={`${id}-suggestions`}
          required={required}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 100)}
          onChange={(event) => change(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
        />
        {loading && <span className="spin" aria-hidden="true" style={{ position: 'absolute', right: 12, top: 14 }} />}
      </div>
      {hint && <span className="hint">{hint}</span>}
      {open && (
        <div id={`${id}-suggestions`} role="listbox" className="card" style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, padding: 0, overflow: 'hidden', boxShadow: '0 12px 32px rgba(25, 20, 35, .16)' }}>
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              role="option"
              aria-selected={index === active}
              className="li"
              style={{ width: '100%', textAlign: 'left', background: index === active ? 'var(--soft)' : 'transparent' }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              <Ic name={suggestion.kind === 'marketplace' || suggestion.kind === 'retail' ? 'store' : 'pin'} className="pt" />
              <span className="mid"><span className="ts">{suggestion.displayName}</span><span className="c">{suggestion.addressText}</span></span>
            </button>
          ))}
          <a className="c c2" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" style={{ padding: '8px 12px', borderTop: '1px solid var(--line)' }}>© OpenStreetMap contributors · ODbL</a>
        </div>
      )}
      {selectedEntryId && selected && (
        <div className="banner soft" style={{ padding: '10px 12px', borderRadius: 12, gap: 8 }} aria-live="polite">
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Ic name="check" className="ok" /><span className="ts">{selected.displayName}</span></div>
          <span className="c">{selected.addressText}</span>
          <span className="c c2 num">{selected.latitude.toFixed(6)}, {selected.longitude.toFixed(6)}</span>
          <a className="c c2" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors · ODbL</a>
        </div>
      )}
    </div>
  );
}
