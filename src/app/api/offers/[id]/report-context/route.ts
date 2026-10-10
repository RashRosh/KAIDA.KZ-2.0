import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { loadReportContext } from '@/modules/moderation/application/offer-reports';
import { reportsEnabled } from '@/modules/moderation/contracts/report.contract';
import { missing, privateHeaders, reportFailure } from '../../../reports/_http';
export const runtime='nodejs';
export async function GET(request:NextRequest,context:{params:Promise<{id:string}>}) {
  if(!reportsEnabled()) return missing();
  const id=z.uuid().safeParse((await context.params).id);
  if(!id.success) return missing();
  try {
    const result=await loadReportContext(id.data,request.nextUrl.searchParams.get('locale')==='kk'?'kk':'ru');
    // Match the buyer's existing Offer-page boundary: other points, including switched-off ones, stay private.
    const evidence={...result.evidence,points:result.evidence.points.filter(p=>p.offerId===id.data)};
    return result.available ? NextResponse.json({evidence},{headers:privateHeaders}) : missing();
  } catch(error) {return reportFailure(error);}
}
