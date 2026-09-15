import { z } from 'zod';
import { resolveBuyerOfferRoute } from '@/modules/offers/application/resolve-buyer-offer-route';
import { build2GisRouteUrl } from '@/modules/offers/routing/build-2gis-route-url';

export const runtime = 'nodejs';

const noStoreHeaders = { 'Cache-Control': 'no-store' };
const offerIdSchema = z.string().uuid();
const notFoundBody = { error: { code: 'OFFER_ROUTE_NOT_FOUND', message: 'Маршрут недоступен.' } };

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const parsedOfferId = offerIdSchema.safeParse((await context.params).id);
  if (!parsedOfferId.success) {
    return Response.json(notFoundBody, { status: 404, headers: noStoreHeaders });
  }

  try {
    const destination = await resolveBuyerOfferRoute(parsedOfferId.data);
    if (!destination) {
      return Response.json(notFoundBody, { status: 404, headers: noStoreHeaders });
    }

    return new Response(null, {
      status: 302,
      headers: {
        ...noStoreHeaders,
        Location: build2GisRouteUrl(destination),
      },
    });
  } catch {
    console.error('Buyer Offer route resolution failed');
    return Response.json(
      { error: { code: 'OFFER_ROUTE_UNAVAILABLE', message: 'Не удалось построить маршрут. Попробуйте ещё раз.' } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
