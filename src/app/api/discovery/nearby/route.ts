import { findNearbyOffers } from '@/modules/discovery/application/find-nearby-offers';
import { nearbyRequestSchema } from '@/modules/discovery/contracts/discovery.contract';
import { localeFromApiRequest } from '../../../../i18n/api';

export const runtime = 'nodejs';

const noStoreHeaders = { 'Cache-Control': 'no-store' };
const invalidRequestBody = {
  error: {
    code: 'INVALID_NEARBY_REQUEST',
    message: 'Проверьте местоположение.',
  },
};

export async function POST(request: Request): Promise<Response> {
  const locale = localeFromApiRequest(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(invalidRequestBody, { status: 400, headers: noStoreHeaders });
  }

  const parsed = nearbyRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(invalidRequestBody, { status: 400, headers: noStoreHeaders });
  }

  try {
    return Response.json(
      await findNearbyOffers(parsed.data.buyerLocation, undefined, { locale }),
      { headers: noStoreHeaders },
    );
  } catch {
    console.error('Nearby discovery request failed');
    return Response.json(
      { error: { code: 'NEARBY_UNAVAILABLE', message: 'Не удалось загрузить предложения рядом. Попробуйте ещё раз.' } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
