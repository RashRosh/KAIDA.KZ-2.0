import { NextResponse, type NextRequest } from 'next/server';
import { resolveCurrentUser } from '@/modules/identity/application/resolve-current-user';
import { SESSION_COOKIE_NAME } from '@/modules/identity/session/session-cookie';
import { submitReport } from '@/modules/moderation/application/offer-reports';
import { reportsEnabled, submitReportSchema } from '@/modules/moderation/contracts/report.contract';
import { missing, privateHeaders, reportFailure, sameOrigin } from './_http';
export const runtime='nodejs';
export async function POST(request:NextRequest) {
  if(!reportsEnabled()) return missing();
  if(!sameOrigin(request)) return NextResponse.json({error:{code:'FORBIDDEN'}},{status:403,headers:privateHeaders});
  try {
    const user=await resolveCurrentUser(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if(!user) return NextResponse.json({error:{code:'AUTH_REQUIRED'}},{status:401,headers:privateHeaders});
    const input=submitReportSchema.safeParse(await request.json().catch(()=>null));
    if(!input.success) return NextResponse.json({error:{code:'INVALID_REPORT'}},{status:400,headers:privateHeaders});
    return NextResponse.json(await submitReport(user.id,input.data),{headers:privateHeaders});
  } catch(error) {return reportFailure(error);}
}
