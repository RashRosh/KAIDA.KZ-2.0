'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ClearableInput } from './ClearableInput';
import styles from '../page.module.css';

export type OwnerContacts = {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};

type ContactsResponse = { contacts: OwnerContacts };
type ApiError = { error?: { code?: string; message?: string } };

type SellerContactSettingsProps = {
  onSaved?: (contacts: OwnerContacts) => void;
};

function nullableCanonical(value: string, lowercase = false): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return lowercase ? trimmed.toLowerCase() : trimmed;
}

export function SellerContactSettings({ onSaved }: SellerContactSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phoneE164, setPhoneE164] = useState('');
  const [whatsappPhoneE164, setWhatsappPhoneE164] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function applyContacts(contacts: OwnerContacts) {
    setPhoneE164(contacts.phoneE164 ?? '');
    setWhatsappPhoneE164(contacts.whatsappPhoneE164 ?? '');
    setTelegramUsername(contacts.telegramUsername ?? '');
    setInstagramUsername(contacts.instagramUsername ?? '');
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetch('/api/seller/contacts', { cache: 'no-store' });
        const data = await response.json() as ContactsResponse & ApiError;
        if (!active) return;
        if (!response.ok) {
          setError(data.error?.message ?? 'Не удалось загрузить контакты.');
          return;
        }
        applyContacts(data.contacts);
      } catch {
        if (active) setError('Не удалось загрузить контакты.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const response = await fetch('/api/seller/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneE164: nullableCanonical(phoneE164),
          whatsappPhoneE164: nullableCanonical(whatsappPhoneE164),
          telegramUsername: nullableCanonical(telegramUsername, true),
          instagramUsername: nullableCanonical(instagramUsername, true),
        }),
      });
      const data = await response.json() as ContactsResponse & ApiError;
      if (!response.ok) {
        setError(data.error?.message ?? 'Не удалось сохранить контакты.');
        return;
      }
      applyContacts(data.contacts);
      onSaved?.(data.contacts);
      setSuccess('Контакты сохранены.');
    } catch {
      setError('Не удалось сохранить контакты.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="seller-contacts-heading">
      <p className={styles.eyebrow}>Связь с покупателем</p>
      <h2 id="seller-contacts-heading">Контакты для покупателей</h2>
      <p className={styles.muted}>Эти контакты будут видны покупателям в ваших предложениях.</p>
      {loading ? <p className={styles.status}>Загружаем контакты…</p> : (
        <form className={styles.form} onSubmit={submit} noValidate>
          <label htmlFor="seller-contact-phone">Телефон</label>
          <ClearableInput id="seller-contact-phone" value={phoneE164} onValueChange={setPhoneE164} clearLabel="Телефон" maxLength={16} disabled={saving} autoComplete="tel" placeholder="+77001234567" />

          <label htmlFor="seller-contact-whatsapp">WhatsApp</label>
          <ClearableInput id="seller-contact-whatsapp" value={whatsappPhoneE164} onValueChange={setWhatsappPhoneE164} clearLabel="WhatsApp" maxLength={16} disabled={saving} inputMode="tel" placeholder="+77001234567" />

          <label htmlFor="seller-contact-telegram">Telegram</label>
          <ClearableInput id="seller-contact-telegram" value={telegramUsername} onValueChange={setTelegramUsername} clearLabel="Telegram" maxLength={64} disabled={saving} autoCapitalize="none" placeholder="kaida_shop" />

          <label htmlFor="seller-contact-instagram">Instagram</label>
          <ClearableInput id="seller-contact-instagram" value={instagramUsername} onValueChange={setInstagramUsername} clearLabel="Instagram" maxLength={64} disabled={saving} autoCapitalize="none" placeholder="kaida.shop" />

          {error && <p className={styles.error} role="alert">{error}</p>}
          {success && <p className={styles.status} role="status">{success}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить контакты'}</button>
        </form>
      )}
    </section>
  );
}
