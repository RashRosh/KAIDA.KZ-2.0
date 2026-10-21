import { InvalidPhoneError, normalizeKzPhone } from '@/modules/identity/phone/normalize-phone';

// contact-default §4 as revised by seller-ai-text-real-parser §17 (PO 2026-10-21): a NEW point's «Телефон» starts with
// the previous point's number, else the login number; the Seller may change or clear it, and a cleared field is never
// refilled. Existing points are never prefilled. WhatsApp and Telegram are only ever filled by an explicit tap.

export type ContactsDraft = { phone: string; whatsapp: string; telegram: string };

export function canonicalPhone(value: string): string | null {
  try {
    return normalizeKzPhone(value);
  } catch (error) {
    if (error instanceof InvalidPhoneError) return null;
    throw error;
  }
}

export function holdsLoginNumber(value: string, loginPhone: string | null): boolean {
  return loginPhone !== null && canonicalPhone(value) === loginPhone;
}

export function contactChips(draft: ContactsDraft, loginPhone: string | null, telegramSuggestion: string | null = null) {
  return {
    // «Указать мой номер …»: the login number is known and «Телефон» is empty (Q3, Q10).
    loginNumber: loginPhone !== null && draft.phone.trim() === '',
    // «Использовать этот же номер»: «Телефон» holds a number and «WhatsApp» is empty (Q1, Q10).
    samePhone: draft.phone.trim() !== '' && draft.whatsapp.trim() === '',
    // «Использовать @…»: a username the Seller saved before, offered while «Telegram» is empty (§17).
    telegram: telegramSuggestion !== null && draft.telegram.trim() === '',
    // The notices appear only while the field holds the login number (Q5).
    phoneNotice: holdsLoginNumber(draft.phone, loginPhone),
    whatsappNotice: holdsLoginNumber(draft.whatsapp, loginPhone),
  };
}

// +77010000001 → «+7 701 000 00 01» with non-breaking spaces, so the number never breaks across lines. The one format
// for a phone on every seller screen (fields, chips, contact lines).
export function formatLoginPhone(e164: string): string {
  const match = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  const nb = String.fromCharCode(160);
  return match ? `+7${nb}${match[1]}${nb}${match[2]}${nb}${match[3]}${nb}${match[4]}` : e164;
}

export const formatPhone = formatLoginPhone;
