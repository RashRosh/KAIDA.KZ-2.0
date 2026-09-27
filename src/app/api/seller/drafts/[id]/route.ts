import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteOfferDraft, saveOfferDraft } from '@/modules/offers/drafts/offer-drafts';
import { offerDraftPayloadSchema } from '@/modules/offers/drafts/offer-draft.contract';
import { jsonError, mapCardError, noStore, sellerUser } from '../../cards/_shared';

export const runtime = 'nodejs';

async function draftId(context: { params: Promise<{ id: string }> }) {
  return z.uuid().safeParse((await context.params).id);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const id = await draftId(context);
  if (!id.success) return jsonError('DRAFT_NOT_FOUND', 'Черновик не найден.', 404);
  const parsed = offerDraftPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_DRAFT', 'Черновик не удалось сохранить.', 400);
  try {
    return NextResponse.json({ draft: await saveOfferDraft(user.id, id.data, parsed.data) }, { headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller draft save failed');
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const id = await draftId(context);
  if (!id.success) return jsonError('DRAFT_NOT_FOUND', 'Черновик не найден.', 404);
  try {
    await deleteOfferDraft(user.id, id.data);
    return new Response(null, { status: 204, headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller draft delete failed');
  }
}
