import { searchOffersWithCorrection, type CorrectedSearchOutcome } from '@/modules/search/application/search-with-correction';
import { geoSearchRequestSchema } from '@/modules/search/contracts/buyer-location.contract';
import { searchIntentSchema, searchProductIdSchema, searchQuerySchema, searchSortDirectionSchema, searchSortModeSchema, type SearchIntent } from '@/modules/search/contracts/search.contract';
import { recordSearchEvent } from '@/modules/search-events/application/record-search-event';
import { localeFromApiRequest } from '../../../i18n/api';

export const runtime = 'nodejs';

const noStoreHeaders = { 'Cache-Control': 'no-store' };

// S15C / D0: after a successful Search that carries an intent, a best-effort, bounded search event is recorded. It never throws and
// never changes the response; a request without an intent records nothing.
// A corrected Search is still ONE search: the event keeps the original outcome (unresolved, 0 Offers) and carries the corrected
// text and its Offer count in separate fields (search-typo-suggestions §4).
async function recordIntentionalSearch(intent: SearchIntent | undefined, query: string, outcome: CorrectedSearchOutcome): Promise<void> {
  if (intent === undefined) return;
  const corrected = outcome.correction;
  await recordSearchEvent({
    entry: intent,
    query,
    resolvedProductId: corrected ? null : outcome.response.resolvedProduct?.id ?? null,
    resolution: outcome.resolution,
    resultCount: corrected ? 0 : outcome.response.offers.length,
    ...(corrected ? { corrected: { query: corrected.to, resultCount: corrected.offerCount } } : {}),
  });
}

export async function GET(request: Request): Promise<Response> {
  const locale = localeFromApiRequest(request);
  const params = new URL(request.url).searchParams;
  const parsed = searchQuerySchema.safeParse(params.get('q'));
  if (!parsed.success) {
    return Response.json(
      { error: { code: 'INVALID_QUERY', message: 'Введите название товара.' } },
      { status: 400, headers: noStoreHeaders },
    );
  }
  // Stage 6 Rev 3: `sort` (default actuality) and `direction` (default: the natural one of the sort); garbage is rejected.
  // `distance` needs the buyer coordinates, which a GET cannot carry: it is rejected instead of being ordered otherwise.
  const sort = searchSortModeSchema.optional().safeParse(params.get('sort') ?? undefined);
  const direction = searchSortDirectionSchema.optional().safeParse(params.get('direction') ?? undefined);
  // S15B-3: `product_id` (a canonical Product) is optional; when present it must be a uuid.
  const productParam = params.get('product_id');
  const productId = productParam === null ? undefined : searchProductIdSchema.safeParse(productParam);
  // S15C / D0: `intent` (optional) marks an intentional search.
  const intentParam = params.get('intent');
  const intent = intentParam === null ? undefined : searchIntentSchema.safeParse(intentParam);
  // search-typo-suggestions: `correct=1` asks for the automatic correction; any other value is invalid.
  const correctParam = params.get('correct');
  if (!sort.success || !direction.success || (intent !== undefined && !intent.success) || sort.data === 'distance' || (sort.data === 'relevance' && direction.data !== undefined) || (productId !== undefined && !productId.success) || (correctParam !== null && correctParam !== '1')) {
    return Response.json(
      { error: { code: 'INVALID_SEARCH_REQUEST', message: 'Проверьте параметры поиска.' } },
      { status: 400, headers: noStoreHeaders },
    );
  }
  try {
    const outcome = await searchOffersWithCorrection(parsed.data, undefined, { locale, sort: sort.data, direction: direction.data, productId: productId?.data }, { correct: correctParam === '1' });
    await recordIntentionalSearch(intent?.data, parsed.data, outcome);
    return Response.json(outcome.response, { headers: noStoreHeaders });
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
    const outcome = await searchOffersWithCorrection(parsed.data.q, undefined, { buyerLocation: parsed.data.buyerLocation, productId: parsed.data.productId, locale, sort: parsed.data.sort, direction: parsed.data.direction }, { correct: parsed.data.correct === true });
    await recordIntentionalSearch(parsed.data.intent, parsed.data.q, outcome);
    return Response.json(outcome.response, { headers: noStoreHeaders });
  } catch {
    console.error('Search request failed');
    return Response.json(
      { error: { code: 'SEARCH_UNAVAILABLE', message: 'Не удалось выполнить поиск. Попробуйте ещё раз.' } },
      { status: 503, headers: noStoreHeaders },
    );
  }
}
