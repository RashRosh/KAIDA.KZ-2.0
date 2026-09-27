import { NextResponse, type NextRequest } from 'next/server';
import { markOperatorFeedSeen } from '@/modules/moderation/application/operator-post-check';
import { seenBodySchema } from '@/modules/moderation/contracts/moderation.contract';
import { noStore, notFound, operatorOf, unavailable } from '../../_operator';

export const runtime = 'nodejs';

// Also called by navigator.sendBeacon when the operator leaves the feed, so the body may arrive as text.
export async function POST(request: NextRequest): Promise<Response> {
  const operator = await operatorOf(request);
  if (operator === 'unavailable') return unavailable();
  if (!operator) return notFound();
  const body = await request.text().then((text) => JSON.parse(text) as unknown).catch(() => null);
  const parsed = seenBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: { code: 'INVALID_SEEN_INPUT', message: 'Некорректная отметка.' } }, { status: 400, headers: noStore });
  try {
    await markOperatorFeedSeen(operator.id, new Date(parsed.data.until));
    return new Response(null, { status: 204, headers: noStore });
  } catch {
    console.error('Operator feed mark failed');
    return unavailable();
  }
}
