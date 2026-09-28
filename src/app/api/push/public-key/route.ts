import { NextResponse } from 'next/server';
import { readPushConfig } from '@/modules/reminders/config/reminders.config';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

// actuality-reminders: the browser needs the public key to subscribe; 404 while push is not configured.
export async function GET(): Promise<Response> {
  const config = readPushConfig();
  if (!config) {
    return NextResponse.json({ error: { code: 'PUSH_DISABLED', message: 'Уведомления не настроены.' } }, { status: 404, headers: noStore });
  }
  return NextResponse.json({ publicKey: config.publicKey }, { status: 200, headers: noStore });
}
