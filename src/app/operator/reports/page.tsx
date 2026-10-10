import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { resolveOperator } from '@/modules/moderation/application/resolve-operator';
import { reportsEnabled } from '@/modules/moderation/contracts/report.contract';
import { OperatorReports } from './OperatorReports';
export const metadata={title:'KAIDA · Жалобы',robots:{index:false,follow:false}};
export default async function Page() {
  await connection();
  if(!reportsEnabled() || !await resolveOperator((await cookies()).get(SESSION_COOKIE_NAME)?.value).catch(()=>null)) notFound();
  return <OperatorReports/>;
}
