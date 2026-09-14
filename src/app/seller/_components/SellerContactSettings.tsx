'use client';

import { FormEvent, useEffect, useState } from 'react';
import styles from '../page.module.css';

type OwnerContacts = {
  phoneE164: string | null;
  whatsappPhoneE164: string | null;
  telegramUsername: string | null;
  instagramUsername: string | null;
};

type ContactsResponse = { contacts: OwnerContacts };
type ApiError = { error?: { code?: string; message?: string } };

export function SellerContactSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function applyContacts(contacts: OwnerContacts) {
    setPhone(contacts.phoneE164 ?? '');
    setWhatsappPhone(contacts.whatsappPhoneE164 ?? '');
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
        body: JSON.stringify({ phone, whatsappPhone, telegramUsername, instagramUsername }),
      });
      const data = await response.json() as ContactsResponse & ApiError;
      if (!response.ok) {
        setError(data.error?.message ?? 'Не удалось сохранить контакты.');
        return;
      }
      applyContacts(data.contacts);
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
          <input id="seller-contact-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={64} disabled={saving} autoComplete="tel" />

          <label htmlFor="seller-contact-whatsapp">WhatsApp</label>
          <input id="seller-contact-whatsapp" value={whatsappPhone} onChange={(event) => setWhatsappPhone(event.target.value)} maxLength={64} disabled={saving} inputMode="tel" />

          <label htmlFor="seller-contact-telegram">Telegram</label>
          <input id="seller-contact-telegram" value={telegramUsername} onChange={(event) => setTelegramUsername(event.target.value)} maxLength={65} disabled={saving} autoCapitalize="none" />

          <label htmlFor="seller-contact-instagram">Instagram</label>
          <input id="seller-contact-instagram" value={instagramUsername} onChange={(event) => setInstagramUsername(event.target.value)} maxLength={65} disabled={saving} autoCapitalize="none" />

          {error && <p className={styles.error} role="alert">{error}</p>}
          {success && <p className={styles.status} role="status">{success}</p>}
          <button type="submit" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить контакты'}</button>
        </form>
      )}
    </section>
  );
}
