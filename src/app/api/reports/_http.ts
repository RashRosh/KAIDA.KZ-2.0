import { NextResponse, type NextRequest } from 'next/server';
import { ReportError } from '@/modules/moderation/contracts/report.contract';
export const privateHeaders={'Cache-Control':'private, no-store'};
export const missing=()=>NextResponse.json({error:{code:'NOT_FOUND'}},{status:404,headers:privateHeaders});
// Browser writes must come from this origin. Non-browser calls may omit Origin; cross-site fetch metadata is denied.
export function sameOrigin(request:NextRequest) {
  const origin=request.headers.get('origin'),site=request.headers.get('sec-fetch-site');
  if(site && site!=='same-origin' && site!=='none') return false;
  if(!origin) return true;
  try {
    // Next's internal request URL may use its listening hostname rather than the browser Host.
    const supplied=new URL(origin),target=new URL(request.url);
    return supplied.host===(request.headers.get('host') ?? target.host) && supplied.protocol===target.protocol;
  }catch{return false;}
}
export function reportFailure(error:unknown) {
  if(error instanceof ReportError) return NextResponse.json({error:{code:error.code}},{status:error.status,headers:privateHeaders});
  console.error('Report operation failed'); // Never log private text or the request body.
  return NextResponse.json({error:{code:'REPORT_UNAVAILABLE'}},{status:503,headers:privateHeaders});
}
