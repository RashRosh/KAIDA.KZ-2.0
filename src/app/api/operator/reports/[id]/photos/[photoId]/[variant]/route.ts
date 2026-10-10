import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { readReportPhoto } from '@/modules/moderation/application/offer-reports';
import { reportsEnabled } from '@/modules/moderation/contracts/report.contract';
import { operatorOf, unavailable } from '../../../../../_operator';
import { missing, privateHeaders, reportFailure } from '../../../../../../reports/_http';
export const runtime='nodejs';
export async function GET(request:NextRequest,context:{params:Promise<{id:string;photoId:string;variant:string}>}) {
  if(!reportsEnabled()) return missing();
  const operator=await operatorOf(request);
  if(operator==='unavailable') return unavailable();if(!operator) return missing();
  const params=z.object({id:z.uuid(),photoId:z.uuid(),variant:z.enum(['display','thumb'])}).safeParse(await context.params);
  if(!params.success) return missing();
  try {
    const bytes=await readReportPhoto(params.data.id,params.data.photoId,params.data.variant);
    return bytes ? new Response(new Uint8Array(bytes),{headers:{...privateHeaders,'Content-Type':'image/webp','X-Content-Type-Options':'nosniff'}}) : missing();
  }catch(error){return reportFailure(error);}
}
