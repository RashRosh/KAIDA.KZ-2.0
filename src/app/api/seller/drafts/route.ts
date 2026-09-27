import { NextRequest, NextResponse } from 'next/server';
import { listOfferDrafts, saveOfferDraft } from '@/modules/offers/drafts/offer-drafts';
import { offerDraftPayloadSchema } from '@/modules/offers/drafts/offer-draft.contract';
import { jsonError, mapCardError, noStore, sellerUser } from '../cards/_shared';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  try {
    return NextResponse.json({ drafts: await listOfferDrafts(user.id) }, { headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller drafts read failed');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const parsed = offerDraftPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_DRAFT', 'Черновик не удалось сохранить.', 400);
  try {
    return NextResponse.json({ draft: await saveOfferDraft(user.id, null, parsed.data) }, { status: 201, headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller draft save failed');
  }
}
