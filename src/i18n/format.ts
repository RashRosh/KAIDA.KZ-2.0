import type { Locale } from './config';

function offersNoun(locale: Locale, count: number): string {
  if (locale === 'kk') return 'ұсыныс';
  const form = pluralForm(count);
  return form === 'one' ? 'предложение' : form === 'few' ? 'предложения' : 'предложений';
}

export function offerCount(locale: Locale, count: number): string {
  if (locale === 'kk') return `${count} ұсыныс табылды`;
  return `Найдено ${count} ${offersNoun(locale, count)}`;
}

// stage #5 (B07): «8 предложений» for the applied summary line and «Показать 8 предложений» for the sheet button.
export function offersCount(locale: Locale, count: number): string {
  return `${count} ${offersNoun(locale, count)}`;
}

export function showOffersLabel(locale: Locale, count: number): string {
  return locale === 'kk' ? `${count} ұсынысты көрсету` : `Показать ${count} ${offersNoun(locale, count)}`;
}

export function confirmedAt(locale: Locale, value: Date): string {
  const time = new Intl.DateTimeFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
  const today = new Date();
  if (value.toDateString() === today.toDateString()) {
    return locale === 'kk' ? `Бүгін ${time}-та расталды` : `Подтверждено сегодня в ${time}`;
  }
  const date = new Intl.DateTimeFormat(locale === 'kk' ? 'kk-KZ' : 'ru-KZ', { day: 'numeric', month: 'long' }).format(value);
  return locale === 'kk' ? `${date} расталды` : `Подтверждено ${date}`;
}

// Russian plural form of a count (1 карточка, 2 карточки, 5 карточек); Kazakh keys carry the same text in all forms.
export function pluralForm(count: number): 'one' | 'few' | 'many' {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'few';
  return 'many';
}
