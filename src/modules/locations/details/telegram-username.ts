// Point Telegram contact (seller-ai-text-real-parser §17, PO 2026-10-21): the Seller types a username, @username or a
// t.me/username link; KAIDA stores only the username and builds the link itself. Never inferred from a phone number.

// Telegram usernames: 5–32 characters, Latin letters, digits and «_», starting with a letter, not ending with «_».
export const TELEGRAM_USERNAME_PATTERN = /^[a-z][a-z0-9_]{3,30}[a-z0-9]$/;

export class InvalidTelegramUsernameError extends Error {
  readonly code = 'INVALID_TELEGRAM' as const;
  constructor(readonly reason: 'invite' | 'format') {
    super(reason === 'invite'
      ? 'Ссылки-приглашения не подходят. Укажите имя пользователя, например @kaida_shop.'
      : 'Укажите имя пользователя Telegram: 5–32 латинские буквы, цифры или «_», например @kaida_shop.');
    this.name = 'InvalidTelegramUsernameError';
  }
}

const LINK = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\/(.*)$/i;

// → the username in lower case, or null for an empty field.
export function normalizeTelegramUsername(input: string | null | undefined): string | null {
  const value = (input ?? '').trim();
  if (value === '') return null;
  let candidate = value;
  const link = LINK.exec(value);
  if (link) {
    const path = link[1]!.replace(/\/+$/, '');
    // Invite links, chat/post links and channel previews are not a person's contact.
    if (/^(?:\+|joinchat\/|c\/|s\/|addstickers\/|share\/)/i.test(path) || path.includes('/') || path.includes('?')) {
      throw new InvalidTelegramUsernameError(path.startsWith('+') || /^joinchat\//i.test(path) ? 'invite' : 'format');
    }
    candidate = path;
  } else if (/[/:.]/.test(value)) {
    throw new InvalidTelegramUsernameError('format');
  }
  candidate = candidate.replace(/^@/, '').toLowerCase();
  if (!TELEGRAM_USERNAME_PATTERN.test(candidate)) throw new InvalidTelegramUsernameError('format');
  return candidate;
}

// The only Telegram target KAIDA ever builds.
export function telegramLink(username: string): string {
  return `https://t.me/${username}`;
}
