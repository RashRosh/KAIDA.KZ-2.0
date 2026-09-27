import { redirect } from 'next/navigation';

// seller-showcase-editor: the offers list is part of «Моя витрина»; old links keep working (`new=1` opens the editor,
// `edit=<offer>` opens the card of that offer).
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.new === '1') query.set('new', '1');
  if (typeof params.edit === 'string') query.set('edit', params.edit);
  if (typeof params.notice === 'string') query.set('notice', params.notice);
  if (typeof params.offer === 'string') query.set('offer', params.offer);
  redirect(query.size > 0 ? `/seller?${query.toString()}` : '/seller');
}
