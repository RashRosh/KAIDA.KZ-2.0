import { normalizeKzPhone } from '../../identity/phone/normalize-phone';

// operator-post-check: operators are the login phones listed in OPERATOR_PHONES (comma-separated). Read per request,
// so a changed list applies without a rebuild. A malformed entry fails loudly instead of silently granting nothing.
export function parseOperatorPhones(raw: string | undefined): ReadonlySet<string> {
  if (raw === undefined || raw.trim() === '') return new Set();
  const phones = raw.split(',').map((entry) => entry.trim()).filter((entry) => entry !== '');
  return new Set(phones.map((entry) => {
    try {
      return normalizeKzPhone(entry);
    } catch {
      throw new Error('OPERATOR_PHONES must be a comma-separated list of Kazakhstan phone numbers');
    }
  }));
}

export function readOperatorPhones(): ReadonlySet<string> {
  return parseOperatorPhones(process.env.OPERATOR_PHONES);
}
