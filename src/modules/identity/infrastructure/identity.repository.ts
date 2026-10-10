import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { authOtpChallenges } from '../db/auth-otp-challenges.table';
import { authSessions } from '../db/auth-sessions.table';
import { users } from '../db/users.table';
import { AuthError, type CurrentUser } from '../contracts/auth.contract';
import { requestRetryAfterSeconds, type OtpPolicy } from '../application/otp-policy';
import type { IdentityClock } from '../time/identity-clock';
import type { SourceAdmission } from '../source/source-protection';
import { chargeSource, lockSourceAdmission, sourceAdmissionWait } from '../source/source.repository';

export interface NewOtpChallenge {
  id: string;
  phoneE164: string;
  otpDigest: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface NewSession {
  id: string;
  tokenDigest: string;
  createdAt: Date;
  expiresAt: Date;
}

function phoneAdvisoryLockKey(phoneE164: string): bigint {
  const digest = createHash('sha256')
    .update(`kaida-identity-phone-lock-v1\0${phoneE164}`, 'utf8')
    .digest();
  return digest.readBigInt64BE(0);
}

export async function replaceOtpChallenge(
  db: Database, phoneE164: string, clock: IdentityClock, policy: OtpPolicy,
  createChallenge: (now: Date) => NewOtpChallenge,
  source?: SourceAdmission,
) {
  return db.transaction(async (tx) => {
    if (source) await lockSourceAdmission(tx, source);
    const lockKey = phoneAdvisoryLockKey(phoneE164).toString();
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);
    const now = clock();
    const history = await tx.select({ createdAt: authOtpChallenges.createdAt }).from(authOtpChallenges)
      .where(and(eq(authOtpChallenges.phoneE164, phoneE164),
        gt(authOtpChallenges.createdAt, new Date(now.getTime() - Math.max(policy.windowSeconds, policy.intervalSeconds) * 1000))));
    const phoneWait = requestRetryAfterSeconds(history.map((row) => row.createdAt), now, policy);
    const sourceWait = source ? await sourceAdmissionWait(tx, source, now) : 0;
    const retryAfterSeconds = Math.max(phoneWait, sourceWait);
    if (retryAfterSeconds) throw new AuthError(sourceWait ? 'OTP_SOURCE_THROTTLED' : 'OTP_REQUEST_THROTTLED', 429,
      sourceWait ? 'С этой сети запрошено слишком много кодов.' : 'Подождите перед запросом нового кода.', retryAfterSeconds, true);
    const challenge = createChallenge(now);
    await tx.update(authOtpChallenges)
      .set({ supersededAt: challenge.createdAt })
      .where(and(
        eq(authOtpChallenges.phoneE164, challenge.phoneE164),
        isNull(authOtpChallenges.consumedAt),
        isNull(authOtpChallenges.supersededAt),
      ));
    await tx.insert(authOtpChallenges).values(challenge);
    if (source) await chargeSource(tx, source, now);
    return { challenge, retryAfterSeconds: requestRetryAfterSeconds([...history.map((row) => row.createdAt), now], now, policy) };
  });
}

export async function findOtpChallenge(db: Database, id: string) {
  const [challenge] = await db.select().from(authOtpChallenges).where(eq(authOtpChallenges.id, id)).limit(1);
  return challenge ?? null;
}

export async function verifyChallengeCreateSession(
  db: Database,
  challengeId: string,
  clock: IdentityClock,
  maxFailures: number,
  matchesCode: (challenge: typeof authOtpChallenges.$inferSelect) => boolean,
  createSession: (now: Date) => NewSession,
) {
  const initial = await findOtpChallenge(db, challengeId);
  if (!initial) throw new AuthError('INVALID_OTP_CHALLENGE', 400, 'Код больше недоступен. Запросите новый.');
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${phoneAdvisoryLockKey(initial.phoneE164).toString()}::bigint)`);
    const verifyNow = clock();
    const [challenge] = await tx.select().from(authOtpChallenges).where(eq(authOtpChallenges.id, challengeId)).limit(1);
    if (!challenge) return { error: new AuthError('INVALID_OTP_CHALLENGE', 400, 'Код больше недоступен. Запросите новый.') };
    if (challenge.consumedAt || challenge.supersededAt) return { error: new AuthError('OTP_NOT_ACTIVE', 409, 'Код больше недействителен. Запросите новый.') };
    if (verifyNow.getTime() >= challenge.expiresAt.getTime()) return { error: new AuthError('OTP_EXPIRED', 410, 'Срок действия кода истёк. Запросите новый.') };
    if (challenge.failedAttempts >= maxFailures) return { error: new AuthError('OTP_ATTEMPTS_EXHAUSTED', 409, 'Попытки исчерпаны. Запросите новый код.') };
    if (!matchesCode(challenge)) {
      const failedAttempts = challenge.failedAttempts + 1;
      await tx.update(authOtpChallenges).set({ failedAttempts }).where(eq(authOtpChallenges.id, challengeId));
      // Returning the error commits the counter. Throw only after the transaction completes.
      return { error: failedAttempts >= maxFailures
        ? new AuthError('OTP_ATTEMPTS_EXHAUSTED', 409, 'Попытки исчерпаны. Запросите новый код.')
        : new AuthError('INVALID_OTP', 401, 'Неверный код.') };
    }
    const session = createSession(verifyNow);
    const [consumed] = await tx.update(authOtpChallenges)
      .set({ consumedAt: verifyNow })
      .where(and(
        eq(authOtpChallenges.id, challengeId),
        isNull(authOtpChallenges.consumedAt),
        isNull(authOtpChallenges.supersededAt),
        gt(authOtpChallenges.expiresAt, verifyNow),
      ))
      .returning({ phoneE164: authOtpChallenges.phoneE164 });

    if (!consumed) return { error: new AuthError('OTP_NOT_ACTIVE', 409, 'Код больше недействителен. Запросите новый.') };

    const [created] = await tx.insert(users)
      .values({ id: randomUUID(), phoneE164: consumed.phoneE164, createdAt: verifyNow })
      .onConflictDoNothing({ target: users.phoneE164 })
      .returning({ id: users.id, phoneE164: users.phoneE164 });

    const user = created ?? (await tx.select({ id: users.id, phoneE164: users.phoneE164 })
      .from(users)
      .where(eq(users.phoneE164, consumed.phoneE164))
      .limit(1))[0];
    if (!user) throw new Error('User conflict resolved without visible user');

    await tx.insert(authSessions).values({ ...session, userId: user.id });
    return { user, sessionExpiresAt: session.expiresAt };
  });
  if ('error' in result) throw result.error;
  return result;
}

export async function getOrCreateUserForPhone(db: Database, phoneE164: string, createdAt: Date): Promise<CurrentUser> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(users)
      .values({ id: randomUUID(), phoneE164, createdAt })
      .onConflictDoNothing({ target: users.phoneE164 })
      .returning({ id: users.id, phoneE164: users.phoneE164 });
    if (created) return created;
    const [existing] = await tx.select({ id: users.id, phoneE164: users.phoneE164 })
      .from(users)
      .where(eq(users.phoneE164, phoneE164))
      .limit(1);
    if (!existing) throw new Error('User conflict resolved without visible user');
    return existing;
  });
}

export async function findCurrentUserBySessionDigest(db: Database, tokenDigest: string, now: Date): Promise<CurrentUser | null> {
  const [row] = await db.select({ id: users.id, phoneE164: users.phoneE164 })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.tokenDigest, tokenDigest), gt(authSessions.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export async function deleteSessionByDigest(db: Database, tokenDigest: string): Promise<void> {
  await db.delete(authSessions).where(eq(authSessions.tokenDigest, tokenDigest));
}
