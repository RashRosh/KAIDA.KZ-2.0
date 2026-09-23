import { NextRequest, NextResponse } from 'next/server';
import { listBuyerInterests } from '../../../modules/interests/application/manage-interests';
import { interestsNoStore, resolveInterestUser } from './_auth';
import { hasUnsupportedQuery, localeFromApiRequest } from '../../../i18n/api';

export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<Response> {
  void localeFromApiRequest(request);
  const auth = await resolveInterestUser(request);
  if (!auth.ok) return auth.response;

  if (hasUnsupportedQuery(request.nextUrl.searchParams, []) || request.body !== null) {
    return NextResponse.json(
      { error: { code: 'INVALID_INTERESTS_QUERY', message: 'Некорректный запрос интересов.' } },
      { status: 400, headers: interestsNoStore },
    );
  }

  try {
    const interests = await listBuyerInterests(auth.user.id);
    return NextResponse.json({ interests }, { status: 200, headers: interestsNoStore });
  } catch {
    console.error('Interests loading failed');
    return NextResponse.json(
      { error: { code: 'INTERESTS_UNAVAILABLE', message: 'Не удалось загрузить интересы.' } },
      { status: 503, headers: interestsNoStore },
    );
  }
}
