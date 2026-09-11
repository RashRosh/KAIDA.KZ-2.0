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

export interface RequestOtpDependencies<Receipt> {
  delivery: OtpDelivery<Receipt>;
  database?: Database;
  clock?: IdentityClock;
  config?: IdentityConfig;
  generateCode?: () => string;
  generateChallengeId?: () => string;
}

export async function requestOtp<Receipt>(
  input: { phone: string },
  dependencies: RequestOtpDependencies<Receipt>,
): Promise<{ challenge: { id: string; expiresAt: Date }; delivery: Receipt }> {
  let phoneE164: string;
  try {
    phoneE164 = normalizeKzPhone(input.phone);
  } catch (error) {
    if (error instanceof InvalidPhoneError) throw new AuthError('INVALID_PHONE', 400, 'Введите корректный номер телефона.');
    throw error;
  }

  const db = dependencies.database ?? getDatabase();
  const clock = dependencies.clock ?? systemIdentityClock;
  const config = dependencies.config ?? loadIdentityConfig();
  const now = clock();
  const challengeId = (dependencies.generateChallengeId ?? randomUUID)();
  const code = (dependencies.generateCode ?? generateOtp)();
  if (!/^[0-9]{6}$/.test(code)) throw new Error('OTP generator returned invalid code');
  const expiresAt = new Date(now.getTime() + config.otpTtlSeconds * 1000);
  const otpDigest = createOtpDigest(config.otpHmacSecret, challengeId, phoneE164, code);

  await replaceOtpChallenge(db, { id: challengeId, phoneE164, otpDigest, createdAt: now, expiresAt });
  const delivery = await dependencies.delivery.deliver({ challengeId, phoneE164, code, expiresAt });

  return { challenge: { id: challengeId, expiresAt }, delivery };
}
