const KZ_CANONICAL = /^\+7[0-9]{10}$/;
const ALLOWED_INPUT = /^[0-9+()\-\s]+$/;

export class InvalidPhoneError extends Error {
  constructor() {
    super('Invalid phone number');
    this.name = 'InvalidPhoneError';
  }
}

export function normalizeKzPhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || !ALLOWED_INPUT.test(trimmed)) throw new InvalidPhoneError();

  const compact = trimmed.replace(/[()\-\s]/g, '');
  let canonical: string;

  if (/^8[0-9]{10}$/.test(compact)) canonical = `+7${compact.slice(1)}`;
  else if (/^7[0-9]{10}$/.test(compact)) canonical = `+${compact}`;
  else canonical = compact;

  if (!KZ_CANONICAL.test(canonical)) throw new InvalidPhoneError();
  return canonical;
}
