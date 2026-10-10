import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { listReports } from '@/modules/moderation/application/offer-reports';
import { reportsEnabled } from '@/modules/moderation/contracts/report.contract';
import { operatorOf, unavailable } from '../_operator';
import { missing, privateHeaders, reportFailure } from '../../reports/_http';
export const runtime='nodejs';
export async function GET(request:NextRequest) {
  if(!reportsEnabled()) return missing();
  const operator=await operatorOf(request);
  if(operator==='unavailable') return unavailable();
  if(!operator) return missing();
  const query=z.object({state:z.enum(['open','closed']).default('open'),offset:z.coerce.number().int().min(0).max(100000).default(0)}).safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if(!query.success) return NextResponse.json({error:{code:'INVALID_QUERY'}},{status:400,headers:privateHeaders});
  try{return NextResponse.json(await listReports(query.data.state,query.data.offset),{headers:privateHeaders});}catch(error){return reportFailure(error);}
}
