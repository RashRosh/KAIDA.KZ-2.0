import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SearchScreen } from './_ui/SearchScreen';
import { INTRO_SEEN_COOKIE, shouldShowFirstEntry } from './_ui/intro-marker';

// The ordinary Search (stage 6B): `/` never shows First Entry itself. Only the generic entry — no `q`, no intro
// marker — is sent to `/welcome`; `?q=` reopens the same results after Back and is never intercepted.
export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const q = Array.isArray(params.q) ? params.q[0] : params.q;
  if (shouldShowFirstEntry({ hasQuery: Boolean(q), introSeen: cookieStore.get(INTRO_SEEN_COOKIE)?.value === '1' })) {
    redirect('/welcome');
  }
  return <SearchScreen />;
}
