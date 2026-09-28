import type { CurrentUser } from '../../identity/contracts/auth.contract';
import { resolveCurrentUser } from '../../identity/application/resolve-current-user';
import { readOperatorPhones } from '../config/operator-access.config';

export function isOperator(user: CurrentUser | null, phones: ReadonlySet<string> = readOperatorPhones()): user is CurrentUser {
  return user !== null && phones.has(user.phoneE164);
}

// The session's user when its login phone is an operator phone; null for everyone else (the caller answers 404).
export async function resolveOperator(sessionToken: string | undefined): Promise<CurrentUser | null> {
  const user = await resolveCurrentUser(sessionToken);
  return isOperator(user) ? user : null;
}
