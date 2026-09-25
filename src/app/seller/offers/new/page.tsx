import { redirect } from 'next/navigation';

// seller-offer-editor: «Добавить товар» is the S-06 form over the offers list; this address keeps old links working.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const from = (await searchParams).from;
  redirect(typeof from === 'string' ? `/seller/offers?new=1&from=${encodeURIComponent(from)}` : '/seller/offers?new=1');
}
