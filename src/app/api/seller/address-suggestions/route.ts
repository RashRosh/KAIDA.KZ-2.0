import { NextRequest, NextResponse } from 'next/server';
import { searchAddressDirectory } from '../../../../modules/address-directory/application/search-address-directory';
import { addressDirectoryQuerySchema } from '../../../../modules/address-directory/contracts/address-directory.contract';
import { resolveCurrentUser } from '../../../../modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '../../../../modules/identity/session/session-cookie';

export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

export async function GET(request: NextRequest): Promise<Response> {
  let user;
  try {
    user = await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch {
    return NextResponse.json({ error: { code: 'AUTH_UNAVAILABLE' } }, { status: 503, headers: noStore });
  }
  if (!user) return NextResponse.json({ error: { code: 'AUTH_REQUIRED' } }, { status: 401, headers: noStore });

  const parsed = addressDirectoryQuerySchema.safeParse(request.nextUrl.searchParams.get('q'));
  if (!parsed.success) return NextResponse.json({ suggestions: [] }, { status: 200, headers: noStore });

  try {
    return NextResponse.json({ suggestions: await searchAddressDirectory(parsed.data) }, { status: 200, headers: noStore });
  } catch {
    console.error('Address directory search failed');
    return NextResponse.json({ suggestions: [] }, { status: 200, headers: noStore });
  }
}
