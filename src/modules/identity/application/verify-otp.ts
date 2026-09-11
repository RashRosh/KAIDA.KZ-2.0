import { randomUUID } from 'node:crypto';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { AuthError, type CurrentUser } from '../contracts/auth.contract';
import { loadIdentityConfig, type IdentityConfig } from '../config/identity.config';
import { verifyOtpDigest } from '../crypto/otp';
import { digestSessionToken, generateSessionToken } from '../crypto/session-token';
import { consumeChallengeCreateSession, findOtpChallenge } from '../infrastructure/identity.repository';
import { systemIdentityClock, type IdentityClock } from '../time/identity-clock';

export interface VerifyOtpDependencies {
  database?: Database;
  clock?: IdentityClock;
  config?: IdentityConfig;
  generateToken?: () => string;
  generateSessionId?: () => string;
}

export interface VerifiedLogin {
  user: CurrentUser;
  sessionToken: string;
  sessionExpiresAt: Date;
  sessionTtlSeconds: number;
}

export async function verifyOtp(
  input: { challengeId: string; code: string },
  dependencies: VerifyOtpDependencies = {},
): Promise<VerifiedLogin> {
  const db = dependencies.database ?? getDatabase();
  const clock = dependencies.clock ?? systemIdentityClock;
  const config = dependencies.config ?? loadIdentityConfig();
  const verifyNow = clock();
  const challenge = await findOtpChallenge(db, input.challengeId);

  if (!challenge) throw new AuthError('INVALID_OTP_CHALLENGE', 400, 'Код больше недоступен. Запросите новый.');
  if (challenge.consumedAt || challenge.supersededAt) throw new AuthError('OTP_NOT_ACTIVE', 409, 'Код больше недействителен. Запросите новый.');
  if (verifyNow.getTime() >= challenge.expiresAt.getTime()) throw new AuthError('OTP_EXPIRED', 410, 'Срок действия кода истёк. Запросите новый.');
  if (!verifyOtpDigest(config.otpHmacSecret, challenge.id, challenge.phoneE164, input.code, challenge.otpDigest)) {
    throw new AuthError('INVALID_OTP', 401, 'Неверный код.');
  }

  const sessionToken = (dependencies.generateToken ?? generateSessionToken)();
  const sessionExpiresAt = new Date(verifyNow.getTime() + config.sessionTtlSeconds * 1000);
  const user = await consumeChallengeCreateSession(db, challenge.id, verifyNow, {
    id: (dependencies.generateSessionId ?? randomUUID)(),
    tokenDigest: digestSessionToken(sessionToken),
    createdAt: verifyNow,
    expiresAt: sessionExpiresAt,
  });

  if (!user) throw new AuthError('OTP_NOT_ACTIVE', 409, 'Код больше недействителен. Запросите новый.');

  return { user, sessionToken, sessionExpiresAt, sessionTtlSeconds: config.sessionTtlSeconds };
}
