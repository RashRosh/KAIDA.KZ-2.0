import { NextRequest, NextResponse } from 'next/server';
import { buildCardPreview } from '@/modules/seller-input/application/card-preview';
import { cardPreviewBodySchema } from '@/modules/seller-input/contracts/card-preview.contract';
import { localeFromApiRequest } from '../../../../i18n/api';
import { jsonError, mapCardError, noStore, sellerUser } from '../cards/_shared';

export const runtime = 'nodejs';

// pre-publication-buyer-preview: the Seller's private preview of a card that is not published yet. Session only; the body is
// the editor's values; nothing is saved, nothing is logged, the answer is never cached and has no public address.
export async function POST(request: NextRequest): Promise<Response> {
  const user = await sellerUser(request);
  if (user instanceof Response) return user;
  const parsed = cardPreviewBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError('INVALID_CARD_INPUT', 'Проверьте название, цену и точки.', 400);
  try {
    const previews = await buildCardPreview(user.id, parsed.data, { locale: localeFromApiRequest(request) });
    return NextResponse.json({ previews }, { headers: noStore });
  } catch (error) {
    return mapCardError(error, 'Seller card preview failed');
  }
}
