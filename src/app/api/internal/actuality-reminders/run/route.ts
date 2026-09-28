import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { runActualityReminders } from '@/modules/reminders/application/run-actuality-reminders';
import { readPushConfig } from '@/modules/reminders/config/reminders.config';
import { createWebPushSender } from '@/modules/reminders/infrastructure/web-push-sender';

export const runtime = 'nodejs';

// actuality-reminders: a protected manual or external-cron start of the reminder job. Without INTERNAL_JOB_SECRET
// or push keys the endpoint answers like a missing route.
function authorized(request: NextRequest, secret: string) {
  const given = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.INTERNAL_JOB_SECRET;
  const config = readPushConfig();
  if (!secret || !config || !authorized(request, secret)) return new Response(null, { status: 404 });
  try {
    const result = await runActualityReminders({ send: createWebPushSender(config) });
    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    console.error('Actuality reminder run failed');
    return NextResponse.json({ error: { code: 'REMINDERS_UNAVAILABLE' } }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
