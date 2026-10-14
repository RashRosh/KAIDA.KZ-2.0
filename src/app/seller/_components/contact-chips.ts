import { InvalidPhoneError, normalizeKzPhone } from '@/modules/identity/phone/normalize-phone';

// contact-default §4: the chips that offer a number to a point form. Nothing is ever prefilled; a chip only shows what one tap would do.

export type ContactsDraft = { phone: string; whatsapp: string };

function canonical(value: string): string | null {
  try {
    return normalizeKzPhone(value);
  } catch (error) {
    if (error instanceof InvalidPhoneError) return null;
    throw error;
  }
}

export function holdsLoginNumber(value: string, loginPhone: string | null): boolean {
  return loginPhone !== null && canonical(value) === loginPhone;
}

export function contactChips(draft: ContactsDraft, loginPhone: string | null) {
  return {
    // «Указать мой номер …»: the login number is known and «Телефон» is empty (Q3, Q10).
    loginNumber: loginPhone !== null && draft.phone.trim() === '',
    // «Тот же номер, что в «Телефоне»»: «Телефон» holds a number and «WhatsApp» is empty (Q1, Q10).
    samePhone: draft.phone.trim() !== '' && draft.whatsapp.trim() === '',
    // The notices appear only while the field holds the login number (Q5).
    phoneNotice: holdsLoginNumber(draft.phone, loginPhone),
    whatsappNotice: holdsLoginNumber(draft.whatsapp, loginPhone),
  };
}

// +77010000001 → «+7 701 000 00 01» with non-breaking spaces, so the number never breaks across lines.
export function formatLoginPhone(e164: string): string {
  const match = /^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  const nb = String.fromCharCode(160);
  return match ? `+7${nb}${match[1]}${nb}${match[2]}${nb}${match[3]}${nb}${match[4]}` : e164;
}
