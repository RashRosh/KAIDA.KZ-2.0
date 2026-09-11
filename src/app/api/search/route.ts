import { searchOffers } from '@/modules/search/application/search-offers';
import { searchQuerySchema } from '@/modules/search/contracts/search.contract';

export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const parsed = searchQuerySchema.safeParse(new URL(request.url).searchParams.get('q'));
  const headers = { 'Cache-Control': 'no-store' };
  if (!parsed.success) {
    return Response.json({ error: { code: 'INVALID_QUERY', message: 'Введите название товара.' } }, { status: 400, headers });
  }
  try {
    return Response.json(await searchOffers(parsed.data), { headers });
  } catch {
    console.error('Search request failed');
    return Response.json({ error: { code: 'SEARCH_UNAVAILABLE', message: 'Не удалось выполнить поиск. Попробуйте ещё раз.' } }, { status: 503, headers });
  }
}
