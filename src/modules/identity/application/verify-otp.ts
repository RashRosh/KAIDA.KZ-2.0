import { randomUUID } from 'node:crypto';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { AuthError, type CurrentUser } from '../contracts/auth.contract';
import { loadIdentityConfig, type IdentityConfig } from '../config/identity.config';
import { verifyOtpDigest } from '../crypto/otp';
import { digestSessionToken, generateSessionToken } from '../crypto/session-token';
import { verifyChallengeCreateSession } from '../infrastructure/identity.repository';
import { systemIdentityClock, type IdentityClock } from '../time/identity-clock';
import { otpPolicy } from './otp-policy';

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
  if (!/^[0-9]{6}$/.test(input.code)) throw new AuthError('INVALID_AUTH_REQUEST', 400, 'Проверьте код и попробуйте ещё раз.');
  const sessionToken = (dependencies.generateToken ?? generateSessionToken)();
  const { user, sessionExpiresAt } = await verifyChallengeCreateSession(db, input.challengeId, clock, otpPolicy(config).maxFailures,
    (challenge) => verifyOtpDigest(config.otpHmacSecret, challenge.id, challenge.phoneE164, input.code, challenge.otpDigest),
    (verifyNow) => ({
      id: (dependencies.generateSessionId ?? randomUUID)(),
      tokenDigest: digestSessionToken(sessionToken),
      createdAt: verifyNow,
      expiresAt: new Date(verifyNow.getTime() + config.sessionTtlSeconds * 1000),
    }));

  return { user, sessionToken, sessionExpiresAt, sessionTtlSeconds: config.sessionTtlSeconds };
}
