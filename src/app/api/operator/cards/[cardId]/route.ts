import { NextResponse, type NextRequest } from 'next/server';
import { loadOperatorCard } from '@/modules/moderation/application/operator-post-check';
import { cardIdSchema, OperatorCardNotFoundError } from '@/modules/moderation/contracts/moderation.contract';
import { noStore, notFound, operatorOf, unavailable } from '../../_operator';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: Promise<{ cardId: string }> }): Promise<Response> {
  const operator = await operatorOf(request);
  if (operator === 'unavailable') return unavailable();
  if (!operator) return notFound();
  const cardId = cardIdSchema.safeParse((await context.params).cardId);
  if (!cardId.success) return notFound();
  try {
    return NextResponse.json({ card: await loadOperatorCard(cardId.data) }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof OperatorCardNotFoundError) return notFound();
    console.error('Operator card loading failed');
    return unavailable();
  }
}
