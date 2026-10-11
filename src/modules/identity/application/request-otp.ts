import { randomUUID } from 'node:crypto';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { AuthError } from '../contracts/auth.contract';
import { loadIdentityConfig, type IdentityConfig } from '../config/identity.config';
import { createOtpDigest, generateOtp } from '../crypto/otp';
import type { OtpDelivery } from '../delivery/otp-delivery';
import { replaceOtpChallenge } from '../infrastructure/identity.repository';
import { InvalidPhoneError, normalizeKzPhone } from '../phone/normalize-phone';
import { systemIdentityClock, type IdentityClock } from '../time/identity-clock';
import { loadSourceProtection, sourceAdmission, type SourceProtection } from '../source/source-protection';
import { otpPolicy } from './otp-policy';

export interface RequestOtpDependencies<Receipt> {
  sourceProtection?: SourceProtection | false;
  delivery: OtpDelivery<Receipt>;
  database?: Database;
  clock?: IdentityClock;
  config?: IdentityConfig;
  generateCode?: () => string;
  generateChallengeId?: () => string;
}

export async function requestOtp<Receipt>(
  input: { phone: string; sourceIp?: string },
  dependencies: RequestOtpDependencies<Receipt>,
): Promise<{ challenge: { id: string; expiresAt: Date }; delivery: Receipt; retryAfterSeconds: number }> {
  let phoneE164: string;
  try {
    phoneE164 = normalizeKzPhone(input.phone);
  } catch (error) {
    if (error instanceof InvalidPhoneError) throw new AuthError('INVALID_PHONE', 400, 'Введите корректный номер телефона.');
    throw error;
  }

  const db = dependencies.database ?? getDatabase();
  const protection = dependencies.sourceProtection ?? loadSourceProtection();
  const source = protection ? sourceAdmission(protection, input.sourceIp) : undefined;
  const clock = dependencies.clock ?? systemIdentityClock;
  const config = dependencies.config ?? loadIdentityConfig();
  const challengeId = (dependencies.generateChallengeId ?? randomUUID)();
  const code = (dependencies.generateCode ?? generateOtp)();
  if (!/^[0-9]{6}$/.test(code)) throw new Error('OTP generator returned invalid code');
  const otpDigest = createOtpDigest(config.otpHmacSecret, challengeId, phoneE164, code);

  const { challenge, retryAfterSeconds } = await replaceOtpChallenge(db, phoneE164, clock, otpPolicy(config), (now) => ({
    id: challengeId, phoneE164, otpDigest, createdAt: now,
    expiresAt: new Date(now.getTime() + config.otpTtlSeconds * 1000),
  }), source);
  const expiresAt = challenge.expiresAt;
  const delivery = await dependencies.delivery.deliver({ challengeId, phoneE164, code, expiresAt });

  return { challenge: { id: challengeId, expiresAt }, delivery, retryAfterSeconds };
}
