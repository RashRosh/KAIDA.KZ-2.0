import { NextResponse, type NextRequest } from 'next/server';
import { removeCard, restoreCard } from '@/modules/moderation/application/operator-post-check';
import { cardIdSchema, OperatorCardNotFoundError, removalBodySchema } from '@/modules/moderation/contracts/moderation.contract';
import { noStore, notFound, operatorOf, unavailable } from '../../../_operator';

export const runtime = 'nodejs';

// POST removes the whole card (idempotent); DELETE returns it to the showcase (idempotent).
export async function POST(request: NextRequest, context: { params: Promise<{ cardId: string }> }): Promise<Response> {
  const operator = await operatorOf(request);
  if (operator === 'unavailable') return unavailable();
  if (!operator) return notFound();
  const cardId = cardIdSchema.safeParse((await context.params).cardId);
  if (!cardId.success) return notFound();
  const body = removalBodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: { code: 'INVALID_REMOVAL_INPUT', message: 'Выберите причину.' } }, { status: 400, headers: noStore });
  try {
    return NextResponse.json({ card: await removeCard(operator.id, cardId.data, body.data) }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof OperatorCardNotFoundError) return notFound();
    console.error('Operator card removal failed');
    return unavailable();
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ cardId: string }> }): Promise<Response> {
  const operator = await operatorOf(request);
  if (operator === 'unavailable') return unavailable();
  if (!operator) return notFound();
  const cardId = cardIdSchema.safeParse((await context.params).cardId);
  if (!cardId.success) return notFound();
  try {
    return NextResponse.json({ card: await restoreCard(operator.id, cardId.data) }, { status: 200, headers: noStore });
  } catch (error) {
    if (error instanceof OperatorCardNotFoundError) return notFound();
    console.error('Operator card return failed');
    return unavailable();
  }
}
