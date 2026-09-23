import type { Locale } from './config';

export function offerCount(locale: Locale, count: number): string {
  if (locale === 'kk') return `${count} ұсыныс табылды`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11
    ? 'предложение'
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? 'предложения'
      : 'предложений';
  return `Найдено ${count} ${noun}`;
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
