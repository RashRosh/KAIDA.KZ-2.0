import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { reportsEnabled } from '@/modules/moderation/contracts/report.contract';
import { submitVisitOutcomeSchema, VisitOutcomeError } from '@/modules/moderation/contracts/visit-outcome.contract';
import { submitVisitOutcome, visitorKeyHashForGuest } from '@/modules/moderation/application/visit-outcomes';
import { missing, privateHeaders, sameOrigin } from '../../../reports/_http';

export const runtime = 'nodejs';

const VISITOR_COOKIE_NAME = 'kaida_visitor';
const VISITOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const uuidSchema = z.uuid();

function visitorSecret(): string {
  return process.env.IDENTITY_OTP_HMAC_SECRET_HEX || 'kaida-local-visitor-fallback-secret';
}

function cookieSecure(): boolean {
  if (process.env.IDENTITY_COOKIE_SECURE === 'false') return false;
  if (process.env.IDENTITY_COOKIE_SECURE === 'true') return true;
  return process.env.NODE_ENV === 'production';
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!reportsEnabled()) return missing();
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403, headers: privateHeaders });
  }
  const parsedId = uuidSchema.safeParse((await context.params).id);
  if (!parsedId.success) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404, headers: privateHeaders });
  }
  const parsedBody = submitVisitOutcomeSchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: { code: 'INVALID_OUTCOME' } }, { status: 400, headers: privateHeaders });
  }

  try {
    const user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    let mintVisitorToken: string | null = null;
    const actor = user
      ? { kind: 'user' as const, userId: user.id }
      : (() => {
        const existing = request.cookies.get(VISITOR_COOKIE_NAME)?.value;
        const token = existing && uuidSchema.safeParse(existing).success ? existing : (mintVisitorToken = randomUUID());
        return { kind: 'guest' as const, anonymousKeyHash: visitorKeyHashForGuest(token, visitorSecret()) };
      })();

    const result = await submitVisitOutcome(actor, parsedId.data, parsedBody.data);
    const response = NextResponse.json(result, { headers: privateHeaders });
    if (mintVisitorToken) {
      response.cookies.set(VISITOR_COOKIE_NAME, mintVisitorToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: cookieSecure(),
        path: '/',
        maxAge: VISITOR_COOKIE_MAX_AGE,
      });
    }
    return response;
  } catch (error) {
    if (error instanceof VisitOutcomeError) {
      return NextResponse.json({ error: { code: error.code } }, { status: error.status, headers: privateHeaders });
    }
    return NextResponse.json({ error: { code: 'OUTCOME_FAILED' } }, { status: 500, headers: privateHeaders });
  }
}
