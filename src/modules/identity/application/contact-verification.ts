import { randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { getDatabase } from '../../../db/client';
import { AuthError } from '../contracts/auth.contract';
import { loadIdentityConfig, type IdentityConfig } from '../config/identity.config';
import { createOtpDigest, generateOtp, verifyOtpDigest } from '../crypto/otp';
import { contactVerificationChallenges } from '../db/contact-verification-challenges.table';
import type { OtpDelivery } from '../delivery/otp-delivery';
import { systemIdentityClock, type IdentityClock } from '../time/identity-clock';

// OTP with the purpose «contact verification» (point-contacts-hours §2). Same code, TTL and delivery rules as login;
// a real SMS provider replaces `delivery` for both at once.
type Dependencies<Receipt> = {
  delivery: OtpDelivery<Receipt>;
  database?: Database;
  clock?: IdentityClock;
  config?: IdentityConfig;
  generateCode?: () => string;
};

export async function requestContactVerification<Receipt>(
  ownerUserId: string,
  phoneE164: string,
  dependencies: Dependencies<Receipt>,
): Promise<{ challenge: { id: string; expiresAt: Date }; delivery: Receipt }> {
  const db = dependencies.database ?? getDatabase();
  const now = (dependencies.clock ?? systemIdentityClock)();
  const config = dependencies.config ?? loadIdentityConfig();
  const id = randomUUID();
  const code = (dependencies.generateCode ?? generateOtp)();
  const expiresAt = new Date(now.getTime() + config.otpTtlSeconds * 1000);
  await db.transaction(async (tx) => {
    // A new request replaces the unfinished one for the same owner and number, as login does per phone.
    await tx.update(contactVerificationChallenges).set({ supersededAt: now }).where(and(
      eq(contactVerificationChallenges.ownerUserId, ownerUserId),
      eq(contactVerificationChallenges.phoneE164, phoneE164),
      isNull(contactVerificationChallenges.consumedAt),
      isNull(contactVerificationChallenges.supersededAt),
    ));
    await tx.insert(contactVerificationChallenges).values({
      id,
      ownerUserId,
      phoneE164,
      otpDigest: createOtpDigest(config.otpHmacSecret, id, phoneE164, code),
      createdAt: now,
      expiresAt,
    });
  });
  const delivery = await dependencies.delivery.deliver({ challengeId: id, phoneE164, code, expiresAt });
  return { challenge: { id, expiresAt }, delivery };
}

// Consumes the challenge and returns the proved number; the caller records it inside the same transaction.
export async function consumeContactVerification(
  tx: Pick<Database, 'select' | 'update'>,
  ownerUserId: string,
  input: { challengeId: string; code: string },
  dependencies: { clock?: IdentityClock; config?: IdentityConfig } = {},
): Promise<string> {
  const now = (dependencies.clock ?? systemIdentityClock)();
  const config = dependencies.config ?? loadIdentityConfig();
  const [challenge] = await tx.select().from(contactVerificationChallenges).where(and(
    eq(contactVerificationChallenges.id, input.challengeId),
    eq(contactVerificationChallenges.ownerUserId, ownerUserId),
  )).limit(1);
  if (!challenge) throw new AuthError('INVALID_OTP_CHALLENGE', 400, 'Код больше недоступен. Запросите новый.');
  if (challenge.consumedAt || challenge.supersededAt) throw new AuthError('OTP_NOT_ACTIVE', 409, 'Код больше недействителен. Запросите новый.');
  if (now.getTime() >= challenge.expiresAt.getTime()) throw new AuthError('OTP_EXPIRED', 410, 'Срок действия кода истёк. Запросите новый.');
  if (!verifyOtpDigest(config.otpHmacSecret, challenge.id, challenge.phoneE164, input.code, challenge.otpDigest)) {
    throw new AuthError('INVALID_OTP', 401, 'Неверный код.');
  }
  const [consumed] = await tx.update(contactVerificationChallenges).set({ consumedAt: now }).where(and(
    eq(contactVerificationChallenges.id, challenge.id),
    isNull(contactVerificationChallenges.consumedAt),
    isNull(contactVerificationChallenges.supersededAt),
    gt(contactVerificationChallenges.expiresAt, now),
  )).returning({ phoneE164: contactVerificationChallenges.phoneE164 });
  if (!consumed) throw new AuthError('OTP_NOT_ACTIVE', 409, 'Код больше недействителен. Запросите новый.');
  return consumed.phoneE164;
}
