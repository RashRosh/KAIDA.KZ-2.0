'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { REPORT_REASONS, type ReportEvidence as Evidence, type ReportReason, type SubmitReport } from '@/modules/moderation/contracts/report.contract';
import { photoUrl } from '@/modules/media/contracts/photo.contract';
import { AuthModal } from '../../../_components/AuthModal';
import { ReportEvidence } from '../../../_components/ReportEvidence';
import { Bar, Ic, Phone, SkeletonRows } from '../../../seller/_kaida/ui';
import '../../../_components/report.css';

export function BuyerReportFlow({offerId,onClose}:{offerId:string;onClose:()=>void}) {
  const {t,locale}=useI18n();
  const [step,setStep]=useState<'reason'|'comment'|'sent'>('reason');
  const [duplicate,setDuplicate]=useState(false);
  const [context,setContext]=useState<Evidence|null>(null),[reason,setReason]=useState<ReportReason|null>(null);
  const [text,setText]=useState(''),[photoId,setPhotoId]=useState<string|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[auth,setAuth]=useState(false),[attempt,setAttempt]=useState(0);
  const pending=useRef(false),alive=useRef(true),lastRequest=useRef<SubmitReport|null>(null),sendButton=useRef<HTMLButtonElement>(null),heading=useRef<HTMLDivElement>(null);
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

  function choose(next:ReportReason) {
    if(!context || pending.current) return;
    if(next==='photo_mismatch' && !context.photoIds.length) {setError('report.noPhoto');return;}
    setReason(next);setError('');
    if(next==='photo_mismatch' && context.photoIds.length===1) setPhotoId(context.photoIds[0]!);
    setStep('comment');
  }
  async function send() {
    if(!context || !reason || pending.current) return;
    if(reason==='photo_mismatch' && (!photoId || !context.photoIds.includes(photoId))) {setError('report.choosePhoto');return;}
    const fields={offerId,version:context.version,locale:context.locale,reason,text:text.trim(),photoId:reason==='photo_mismatch'?photoId:null};
    const previous=lastRequest.current;
    const input:SubmitReport={...fields,submissionId:previous && JSON.stringify({...previous,submissionId:undefined})===JSON.stringify({...fields,submissionId:undefined})?previous.submissionId:crypto.randomUUID()};
    lastRequest.current=input;pending.current=true;setBusy(true);setError('');
    try {
      const response=await fetch('/api/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
      const result=await response.json() as {receipt?:string;duplicate?:boolean;error?:{code:string}};
      if(!alive.current) return;
      if(response.status===401) {setAuth(true);return;}
      if(result.error?.code==='STALE_CONTEXT') {setError('report.stale');setAttempt(v=>v+1);return;}
      if(result.error?.code==='REPORT_QUOTA') {setError('report.quota');return;}
      if(!response.ok || !result.receipt) throw Error('send');
      setDuplicate(result.duplicate===true);setStep('sent');
    }catch{if(alive.current) setError('report.sendError');}
    finally{pending.current=false;if(alive.current) setBusy(false);}
  }
  const photoStep=step==='comment' && reason==='photo_mismatch' && (context?.photoIds.length ?? 0)>1;
  return <Phone><div className="report-flow" style={{display:'contents'}}>
    <div ref={heading} tabIndex={-1}><Bar title={t(step==='sent'?'report.sent':step==='reason'?'report.title':photoStep?'report.whichPhoto':'report.commentTitle')}
      onBack={()=>{if(step==='comment'){setStep('reason');setError('');}else onClose();}} backDisabled={busy}/></div>
    <main className="body" style={{gap:16}}>
      {step==='sent'?<><div className="report-success" aria-hidden="true">✓</div><p role="status" className="t">{t('report.thanks')}</p>{duplicate && <p className="c">{t('report.duplicate')}</p>}</>:<>
        {!context?<SkeletonRows/>:<>
          <ReportEvidence evidence={context} compact/>
          {step==='reason'?<><h2 className="h3">{t('report.whatWrong')}</h2>{REPORT_REASONS.map(r=><button key={r} type="button" className="report-reason" onClick={()=>choose(r)}><span>{t(`report.reason.${r}`)}</span><Ic name="right"/></button>)}</>:<>
            <div className="report-panel"><b>{reason && t(`report.reason.${reason}`)}</b></div>
            {photoStep && <div className="report-photo-choice" aria-label={t('report.whichPhoto')}>{context.photoIds.map((id,i)=><button key={id} type="button" aria-pressed={photoId===id} onClick={()=>{setPhotoId(id);setError('');}}>
              {/* eslint-disable-next-line @next/next/no-img-element -- immutable local seller photo */}
              <img src={photoUrl(id,'thumb')} alt={t('report.photo',{n:i+1})}/><span>{photoId===id?'●':'○'} {t('report.photo',{n:i+1})}</span></button>)}</div>}
            <label className="h3" htmlFor="report-comment">{t('report.optionalComment')}</label>
            <textarea id="report-comment" value={text} maxLength={300} onChange={e=>setText(e.target.value)} disabled={busy} aria-describedby={error?'report-privacy report-error':'report-privacy'}/>
            <p className="c">{t('report.noPersonalData')}</p><div id="report-privacy" className="report-privacy">{t('report.private')}</div>
          </>}
        </>}
        {error && <div id="report-error" role={error==='report.loginReady'?'status':'alert'} className={error==='report.loginReady'?'report-privacy':'emsg'}>{t(error as 'report.sendError')}{error==='report.loadError' && <button type="button" className="btn btn-o" onClick={()=>{setError('');setAttempt(v=>v+1);}}>{t('report.retry')}</button>}</div>}
      </>}
    </main>
    {step==='comment' && <footer className="foot"><button ref={sendButton} type="button" className="btn btn-p w" disabled={busy || !context} onClick={()=>void send()}>{t(busy?'report.sending':'report.send')}</button></footer>}
    {step==='sent' && <footer className="foot"><button type="button" className="btn btn-p w" onClick={onClose}>{t('report.backToCard')}</button></footer>}
    {auth && <AuthModal open description={t('report.login')} onClose={()=>{setAuth(false);requestAnimationFrame(()=>sendButton.current?.focus());}}
      onAuthenticated={()=>{setAuth(false);setError('report.loginReady');requestAnimationFrame(()=>sendButton.current?.focus());}}/>}
  </div></Phone>;
}
