import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/db/client';
import { suggestCatalogProducts } from '@/modules/catalog/application/suggest-products';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

// seller-showcase-editor: catalog suggestions under the product name field; empty for fewer than 2 letters.
export async function GET(request: NextRequest): Promise<Response> {
  const query = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 80);
  const locale = request.nextUrl.searchParams.get('locale') === 'kk' ? 'kk' : 'ru';
  try {
    return NextResponse.json({ suggestions: await suggestCatalogProducts(getDatabase(), query, locale) }, { headers: noStore });
  } catch {
    console.error('Catalog suggestions failed');
    return NextResponse.json({ suggestions: [] }, { status: 503, headers: noStore });
  }
}
