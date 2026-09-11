import { createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import type { Database } from '../../../db/client';
import { authOtpChallenges } from '../db/auth-otp-challenges.table';
import { authSessions } from '../db/auth-sessions.table';
import { users } from '../db/users.table';
import type { CurrentUser } from '../contracts/auth.contract';

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

export async function replaceOtpChallenge(db: Database, challenge: NewOtpChallenge): Promise<void> {
  await db.transaction(async (tx) => {
    const lockKey = phoneAdvisoryLockKey(challenge.phoneE164).toString();
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey}::bigint)`);
    await tx.update(authOtpChallenges)
      .set({ supersededAt: challenge.createdAt })
      .where(and(
        eq(authOtpChallenges.phoneE164, challenge.phoneE164),
        isNull(authOtpChallenges.consumedAt),
        isNull(authOtpChallenges.supersededAt),
      ));
    await tx.insert(authOtpChallenges).values(challenge);
  });
}

export async function findOtpChallenge(db: Database, id: string) {
  const [challenge] = await db.select().from(authOtpChallenges).where(eq(authOtpChallenges.id, id)).limit(1);
  return challenge ?? null;
}

export async function consumeChallengeCreateSession(
  db: Database,
  challengeId: string,
  verifyNow: Date,
  session: NewSession,
): Promise<CurrentUser | null> {
  return db.transaction(async (tx) => {
    const [consumed] = await tx.update(authOtpChallenges)
      .set({ consumedAt: verifyNow })
      .where(and(
        eq(authOtpChallenges.id, challengeId),
        isNull(authOtpChallenges.consumedAt),
        isNull(authOtpChallenges.supersededAt),
        gt(authOtpChallenges.expiresAt, verifyNow),
      ))
      .returning({ phoneE164: authOtpChallenges.phoneE164 });

    if (!consumed) return null;

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
    return user;
  });
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
