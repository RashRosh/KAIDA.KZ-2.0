import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { resolveOperator } from '@/modules/moderation/application/resolve-operator';
import { OperatorApp } from './_components/OperatorApp';
import { reportsEnabled } from '@/modules/moderation/contracts/report.contract';
import { z } from 'zod';

export const metadata: Metadata = { title: 'KAIDA · Пост-проверка', robots: { index: false, follow: false } };

// Anyone who is not an operator sees the ordinary missing page (operator-post-check §2 «Operator access»).
export default async function Page({searchParams}:{searchParams:Promise<{card?:string}>}) {
  await connection();
  const operator = await resolveOperator((await cookies()).get(SESSION_COOKIE_NAME)?.value).catch(() => null);
  if (!operator) notFound();
  const card=z.uuid().safeParse((await searchParams).card);
  return <OperatorApp reporting={reportsEnabled()} initialCardId={card.success?card.data:null} />;
}
