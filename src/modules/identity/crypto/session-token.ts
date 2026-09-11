import { createHash, randomBytes } from 'node:crypto';

export function generateSessionToken(random: (size: number) => Buffer = randomBytes): string {
  return random(32).toString('base64url');
}

export function digestSessionToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
