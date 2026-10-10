import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { loadReport, resolveReport } from '@/modules/moderation/application/offer-reports';
import { reportsEnabled, resolveReportSchema } from '@/modules/moderation/contracts/report.contract';
import { operatorOf, unavailable } from '../../_operator';
import { missing, privateHeaders, reportFailure, sameOrigin } from '../../../reports/_http';
export const runtime='nodejs';
async function authorize(request:NextRequest,context:{params:Promise<{id:string}>}):Promise<{response:Response}|{operator:{id:string};id:string}> {
  if(!reportsEnabled()) return {response:missing()} as const;
  const operator=await operatorOf(request);
  if(operator==='unavailable') return {response:unavailable()} as const;
  if(!operator) return {response:missing()} as const;
  const id=z.uuid().safeParse((await context.params).id);
  return id.success ? {operator,id:id.data} as const : {response:missing()} as const;
}
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}) {
  const auth=await authorize(request,context);if('response' in auth) return auth.response;
  try{return NextResponse.json({report:await loadReport(auth.id)},{headers:privateHeaders});}catch(error){return reportFailure(error);}
}
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}) {
  const auth=await authorize(request,context);if('response' in auth) return auth.response;
  if(!sameOrigin(request)) return NextResponse.json({error:{code:'FORBIDDEN'}},{status:403,headers:privateHeaders});
  const input=resolveReportSchema.safeParse(await request.json().catch(()=>null));
  if(!input.success) return NextResponse.json({error:{code:'INVALID_DECISION'}},{status:400,headers:privateHeaders});
  try{return NextResponse.json({report:await resolveReport(auth.operator.id,auth.id,input.data)},{headers:privateHeaders});}catch(error){return reportFailure(error);}
}
