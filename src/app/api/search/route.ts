import { searchOffers } from '@/modules/search/application/search-offers';
import { geoSearchRequestSchema } from '@/modules/search/contracts/buyer-location.contract';
import { searchQuerySchema } from '@/modules/search/contracts/search.contract';
import { localeFromApiRequest } from '../../../i18n/api';

export const runtime = 'nodejs';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

export async function GET(request: Request): Promise<Response> {
  const locale = localeFromApiRequest(request);
  const parsed = searchQuerySchema.safeParse(new URL(request.url).searchParams.get('q'));
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'INVALID_QUERY', message: 'Введите название товара.' } },
      { status: 400, headers: noStoreHeaders },
    );
  }
  try {
    return Response.json(await searchOffers(parsed.data, undefined, { locale }), { headers: noStoreHeaders });
  } catch {
    console.error('Search request failed');
    return Response.json(
      { error: { code: 'SEARCH_UNAVAILABLE', message: 'Не удалось выполнить поиск. Попробуйте ещё раз.' } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const locale = localeFromApiRequest(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { code: 'INVALID_SEARCH_REQUEST', message: 'Проверьте поисковый запрос и местоположение.' } },
      { status: 400, headers: noStoreHeaders },
    );
  }

  const parsed = geoSearchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'INVALID_SEARCH_REQUEST', message: 'Проверьте поисковый запрос и местоположение.' } },
      { status: 400, headers: noStoreHeaders },
    );
  }

  try {
    return Response.json(
      await searchOffers(parsed.data.q, undefined, { buyerLocation: parsed.data.buyerLocation, locale }),
      { headers: noStoreHeaders },
    );
  } catch {
    console.error('Search request failed');
    return Response.json(
      { error: { code: 'SEARCH_UNAVAILABLE', message: 'Не удалось выполнить поиск. Попробуйте ещё раз.' } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
