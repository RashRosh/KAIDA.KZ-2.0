import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { resolveOperator } from '@/modules/moderation/application/resolve-operator';
import { OperatorApp } from './_components/OperatorApp';

export const metadata: Metadata = { title: 'KAIDA · Пост-проверка', robots: { index: false, follow: false } };

// Anyone who is not an operator sees the ordinary missing page (operator-post-check §2 «Operator access»).
export default async function Page() {
  await connection();
  const operator = await resolveOperator((await cookies()).get(SESSION_COOKIE_NAME)?.value).catch(() => null);
  if (!operator) notFound();
  return <OperatorApp />;
}
