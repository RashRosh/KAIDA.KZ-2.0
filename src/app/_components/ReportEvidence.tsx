'use client';
import { formatAmount } from './format-amount';
import { photoUrl } from '@/modules/media/contracts/photo.contract';
import type { ReportEvidence as Evidence } from '@/modules/moderation/contracts/report.contract';

export function ReportEvidence({ evidence, reportId, compact=false }: {evidence:Evidence;reportId?:string;compact?:boolean}) {
  const points=compact ? evidence.points.filter(p=>p.offerId===evidence.offerId) : evidence.points;
  return <div className="report-evidence">
    {evidence.photoIds.length>0 && <div className="report-photos">{(compact?evidence.photoIds.slice(0,1):evidence.photoIds).map((id,i)=>(
      // eslint-disable-next-line @next/next/no-img-element -- immutable local photo, historical reads use a private report-scoped route
      <img key={id} src={reportId?`/api/operator/reports/${reportId}/photos/${id}/thumb`:photoUrl(id,'thumb')} alt={`${evidence.title} · ${i+1}`} />
    ))}</div>}
    <div><b>{evidence.title}</b>{points.map(p=><div key={p.offerId} className="report-point">
      {p.amount!==null && <p><span className="report-amount">{formatAmount(p.amount)}&nbsp;₸</span>{p.basis && <> <span className="report-basis">/&nbsp;{p.basis.replaceAll(' ','\u00a0')}</span></>}</p>}
      <p className="c">{p.name}{!compact && <> · {p.address}</>}</p>
    </div>)}{!compact && evidence.displayedComment && <p className="t">{evidence.displayedComment}</p>}
    {!compact && evidence.originalComment!==evidence.displayedComment && <p className="c">{evidence.originalComment}</p>}</div>
  </div>;
}
