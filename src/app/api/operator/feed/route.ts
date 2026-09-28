import { NextResponse, type NextRequest } from 'next/server';
import { loadOperatorFeed } from '@/modules/moderation/application/operator-post-check';
import { feedQuerySchema } from '@/modules/moderation/contracts/moderation.contract';
import { noStore, notFound, operatorOf, unavailable } from '../_operator';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const operator = await operatorOf(request);
  if (operator === 'unavailable') return unavailable();
  if (!operator) return notFound();
  const query = feedQuerySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return NextResponse.json({ error: { code: 'INVALID_QUERY', message: 'Некорректный запрос.' } }, { status: 400, headers: noStore });
  try {
    return NextResponse.json(await loadOperatorFeed(operator.id, query.data), { status: 200, headers: noStore });
  } catch {
    console.error('Operator feed loading failed');
    return unavailable();
  }
}
