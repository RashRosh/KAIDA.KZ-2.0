'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import type { MessageKey } from '@/i18n/messages';
import type { ReportEvidence as Evidence } from '@/modules/moderation/contracts/report.contract';
import { PROBLEM_REASONS, type ProblemReason, type SubmitVisitOutcome, type VisitOutcomeResult } from '@/modules/moderation/contracts/visit-outcome.contract';
import { photoUrl } from '@/modules/media/contracts/photo.contract';
import { readVisitSignal } from '../../_ui/offer-details';
import { ReportEvidence } from '../../../_components/ReportEvidence';
import { Bar, Ic, Phone, SkeletonRows } from '../../../seller/_kaida/ui';
import '../../../_components/report.css';

type ProblemPayload = Extract<SubmitVisitOutcome, { outcome: 'problem' }>;

export function BuyerReportFlow({offerId,onClose}:{offerId:string;onClose:()=>void}) {
  const {t,locale}=useI18n();
  const [step,setStep]=useState<'reason'|'comment'|'sent'>('reason');
  const [duplicate,setDuplicate]=useState(false);
  const [isVerified,setIsVerified]=useState(true);
  const [context,setContext]=useState<Evidence|null>(null),[reason,setReason]=useState<ProblemReason|null>(null);
  const [text,setText]=useState(''),[photoId,setPhotoId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState<MessageKey|''>(''),[attempt,setAttempt]=useState(0);
  const pending=useRef(false),alive=useRef(true),lastRequest=useRef<ProblemPayload|null>(null),sendButton=useRef<HTMLButtonElement>(null),heading=useRef<HTMLDivElement>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();
    void(async()=>{
      try {
        const response=await fetch(`/api/offers/${offerId}/report-context?locale=${locale}`,{cache:'no-store',signal:controller.signal});
        if(!response.ok) throw Error('context');
        const result=await response.json() as {evidence:Evidence};
        if(!controller.signal.aborted) setContext(result.evidence);
      } catch {if(!controller.signal.aborted) setError('report.loadError');}
    })();return()=>controller.abort();
  },[offerId,locale,attempt]);
  useEffect(()=>{heading.current?.focus();},[step]);

  function choose(next:ProblemReason) {
    if(!context || pending.current) return;
    setReason(next);setError('');
    if(next==='photo_mismatch' && context.photoIds.length===1) setPhotoId(context.photoIds[0]!);
    else if(next!=='photo_mismatch' || context.photoIds.length===0) setPhotoId(null);
    setStep('comment');
  }
  async function send() {
    if(!context || !reason || pending.current) return;
    const needsPhoto=reason==='photo_mismatch' && context.photoIds.length>0;
    if(needsPhoto && (!photoId || !context.photoIds.includes(photoId))) {setError('report.choosePhoto');return;}
    const fields={
      outcome:'problem' as const,
      version:context.version,
      locale:context.locale,
      hasVisitSignal:readVisitSignal(offerId),
      reason,
      text:text.trim(),
      photoId:needsPhoto?photoId:null,
    };
    const previous=lastRequest.current;
    const input:ProblemPayload={...fields,submissionId:previous && JSON.stringify({...previous,submissionId:undefined})===JSON.stringify({...fields,submissionId:undefined})?previous.submissionId:crypto.randomUUID()};
    lastRequest.current=input;pending.current=true;setBusy(true);setError('');
    try {
      const response=await fetch(`/api/offers/${offerId}/visit-outcome`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
      const result=await response.json() as Partial<VisitOutcomeResult> & {error?:{code:string}};
      if(!alive.current) return;
      if(result.error?.code==='STALE_CONTEXT') {setError('report.stale');setAttempt(v=>v+1);return;}
      if(result.error?.code==='REPORT_QUOTA') {setError('report.quota');return;}
      if(result.error?.code==='INVALID_PHOTO') {setError('report.choosePhoto');setAttempt(v=>v+1);return;}
      if(!response.ok || !result.id) throw Error('send');
      setDuplicate(result.duplicate===true);setIsVerified(result.isVerified===true);setStep('sent');
    }catch{if(alive.current) setError('outcome.problemError');}
    finally{pending.current=false;if(alive.current) setBusy(false);}
  }
  const photoStep=step==='comment' && reason==='photo_mismatch' && (context?.photoIds.length ?? 0)>1;
  const noPhotoNote=step==='comment' && reason==='photo_mismatch' && (context?.photoIds.length ?? 0)===0;
  return <Phone><div className="report-flow" style={{display:'contents'}}>
    <div ref={heading} tabIndex={-1}><Bar title={t(step==='sent'?'outcome.problemSent':step==='reason'?'outcome.problemTitle':photoStep?'report.whichPhoto':'report.commentTitle')}
      onBack={()=>{if(step==='comment'){setStep('reason');setError('');}else onClose();}} backDisabled={busy}/></div>
    <main className="body" style={{gap:16}}>
      {step==='sent'?<><div className="report-success" aria-hidden="true">✓</div><p role="status" className="t">{t('report.thanks')}</p>{duplicate && <p className="c">{t('report.duplicate')}</p>}{!isVerified && <p className="c" data-testid="outcome-guest-note">{t('outcome.guestNote')}</p>}</>:<>
        {!context?<SkeletonRows/>:<>
          <ReportEvidence evidence={context} compact/>
          {step==='reason'?<><h2 className="h3">{t('outcome.whatHappened')}</h2>{PROBLEM_REASONS.map(r=><button key={r} type="button" className="report-reason" data-reason={r} onClick={()=>choose(r)}><span>{t(`report.reason.${r}`)}</span><Ic name="right"/></button>)}</>:<>
            <div className="report-panel"><b>{reason && t(`report.reason.${reason}`)}</b></div>
            {noPhotoNote && <p className="c" data-testid="outcome-no-photo-note">{t('outcome.noPhotoNote')}</p>}
            {photoStep && <div className="report-photo-choice" aria-label={t('report.whichPhoto')}>{context.photoIds.map((id,i)=><button key={id} type="button" aria-pressed={photoId===id} onClick={()=>{setPhotoId(id);setError('');}}>
              {/* eslint-disable-next-line @next/next/no-img-element -- immutable local seller photo */}
              <img src={photoUrl(id,'thumb')} alt={t('report.photo',{n:i+1})}/><span>{photoId===id?'●':'○'} {t('report.photo',{n:i+1})}</span></button>)}</div>}
            <label className="h3" htmlFor="report-comment">{t('report.optionalComment')}</label>
            <textarea id="report-comment" value={text} maxLength={300} onChange={e=>setText(e.target.value)} disabled={busy} aria-describedby={error?'report-privacy report-error':'report-privacy'}/>
            <p className="c">{t('report.noPersonalData')}</p><div id="report-privacy" className="report-privacy">{t('report.private')}</div>
          </>}
        </>}
        {error && <div id="report-error" role="alert" className="emsg">{t(error)}{error==='report.loadError' && <button type="button" className="btn btn-o" onClick={()=>{setError('');setAttempt(v=>v+1);}}>{t('report.retry')}</button>}</div>}
      </>}
    </main>
    {step==='comment' && <footer className="foot"><button ref={sendButton} type="button" className="btn btn-p w" disabled={busy || !context} onClick={()=>void send()}>{t(busy?'report.sending':'outcome.sendProblem')}</button></footer>}
    {step==='sent' && <footer className="foot"><button type="button" className="btn btn-p w" onClick={onClose}>{t('report.backToCard')}</button></footer>}
  </div></Phone>;
}
