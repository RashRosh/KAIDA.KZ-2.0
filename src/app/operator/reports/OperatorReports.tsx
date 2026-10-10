'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { OperatorReport, ReportPage, ReportReason, ResolveReport } from '@/modules/moderation/contracts/report.contract';
import { REMOVAL_REASONS, type RemovalReason } from '@/modules/moderation/contracts/moderation.contract';
import { ReportEvidence } from '../../_components/ReportEvidence';
import { Bar, Phone, Radio, SkeletonRows } from '../../seller/_kaida/ui';
import '../../_components/report.css';

const REASONS:Record<ReportReason,string>={price_mismatch:'Цена не совпадает',photo_mismatch:'Фото не соответствует товару',description_wrong:'Неверное описание',other:'Другое'};
const REMOVALS:Record<RemovalReason,string>={prohibited_item:'Товар нельзя размещать',photo_mismatch:'Фото не соответствует товару',contacts_or_ads:'Контакты или реклама',other:'Другое'};
const OUTCOMES:Record<ResolveReport['disposition'],string>={removed:'Карточка снята',already_removed:'Карточка уже была снята',returned:'Карточка возвращена',no_action:'Без снятия карточки'};
const time=(v:string)=>new Intl.DateTimeFormat('ru-KZ',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));

export function OperatorReports() {
  const router=useRouter();
  const [tab,setTab]=useState<'open'|'closed'>('open'),[page,setPage]=useState<ReportPage|null>(null),[report,setReport]=useState<OperatorReport|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[attempt,setAttempt]=useState(0),[loading,setLoading]=useState(true);
  const [mode,setMode]=useState<ResolveReport['disposition']|null>(null),[reason,setReason]=useState<RemovalReason|null>(null),[comment,setComment]=useState(''),[rationale,setRationale]=useState('');
  const pending=useRef(false),alive=useRef(true),heading=useRef<HTMLDivElement>(null);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    const controller=new AbortController();
    void(async()=>{setLoading(true);try{
      const response=await fetch(`/api/operator/reports?state=${tab}`,{cache:'no-store',signal:controller.signal});
      if(!response.ok) throw Error('list');const data=await response.json() as ReportPage;
      if(!controller.signal.aborted){setPage(data);setError('');}
    }catch{if(!controller.signal.aborted)setError('Не удалось открыть жалобы. Повторите.');}finally{if(!controller.signal.aborted)setLoading(false);}})();
    return()=>controller.abort();
  },[tab,attempt]);
  useEffect(()=>{heading.current?.focus();},[report?.id,mode]);
  async function open(id:string) {
    if(pending.current)return;pending.current=true;setBusy(true);setError('');
    try {const response=await fetch(`/api/operator/reports/${id}`,{cache:'no-store'});if(!response.ok)throw Error('read');
      const data=await response.json() as {report:OperatorReport};if(alive.current){setReport(data.report);setMode(null);}
    }catch{if(alive.current)setError('Не удалось открыть жалобу. Повторите.');}finally{pending.current=false;if(alive.current)setBusy(false);}
  }
  async function more() {
    if(!page || pending.current)return;pending.current=true;setBusy(true);
    try{const response=await fetch(`/api/operator/reports?state=${tab}&offset=${page.rows.length}`,{cache:'no-store'});if(!response.ok)throw Error('list');const data=await response.json() as ReportPage;
      if(alive.current)setPage({...data,rows:[...page.rows,...data.rows]});
    }catch{if(alive.current)setError('Не удалось загрузить жалобы. Повторите.');}finally{pending.current=false;if(alive.current)setBusy(false);}
  }
  async function decide() {
    if(!report?.current || !mode || pending.current)return;
    if(mode==='removed' && !reason){setError('Выберите причину снятия.');return;}
    if(['returned','no_action'].includes(mode) && !rationale.trim()){setError('Укажите обоснование решения.');return;}
    const input:ResolveReport={token:report.current.token,disposition:mode,reason:mode==='removed'?reason:null,sellerComment:mode==='removed'?comment:'',rationale};
    pending.current=true;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/operator/reports/${report.id}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),cache:'no-store'});
      const data=await response.json() as {report?:OperatorReport;error?:{code:string}};
      if(!alive.current)return;
      if(response.status===409){setError('Карточка или решение уже изменились. Обновите жалобу и проверьте данные.');return;}
      if(!response.ok || !data.report)throw Error('resolve');setReport(data.report);setMode(null);setAttempt(v=>v+1);
    }catch{if(alive.current)setError('Не удалось записать решение. Повторите действие.');}finally{pending.current=false;if(alive.current)setBusy(false);}
  }
  function back(){setError('');if(mode)setMode(null);else setReport(null);}
  function choose(next:ResolveReport['disposition']){setMode(next);setReason(null);setComment('');setRationale('');setError('');}
  return <Phone><div className="report-flow" style={{display:'contents'}}>
    <div ref={heading} tabIndex={-1}><Bar title={report?'Жалоба':'Жалобы'} onBack={report?back:()=>router.push('/operator')} backDisabled={busy}/></div>
    <main className="body" style={{gap:14}}>
      {!report?<>
        <div className="tabs"><button type="button" className="btn btn-g" aria-pressed={tab==='open'} onClick={()=>{setPage(null);setTab('open');}}>Открытые · {page?.openCount ?? '…'}</button><button type="button" className="btn btn-g" aria-pressed={tab==='closed'} onClick={()=>{setPage(null);setTab('closed');}}>Закрытые</button></div>
        <p className="c">Сначала самые ранние</p>
        {loading?<SkeletonRows/>:page?.rows.length===0?<p className="t">Жалоб нет</p>:page?.rows.map(row=><article key={row.id} className="report-panel">
          <span className="c">{row.closedAt?'Закрыта':'Открыта'} · {time(row.at)}</span><ReportEvidence evidence={row.evidence} reportId={row.id} compact/>
          <b>{REASONS[row.reason]}</b>{row.disposition && <p>{OUTCOMES[row.disposition]}</p>}
          <button type="button" className="btn btn-o w" disabled={busy} onClick={()=>void open(row.id)}>Рассмотреть</button>
        </article>)}
        {page?.hasMore && <button type="button" className="btn btn-o w" disabled={busy} onClick={()=>void more()}>Показать ещё</button>}
      </>:<>
        <p className="c">{report.closedAt?'Закрыта':'Открыта'} · {REASONS[report.reason]} · {time(report.at)}</p>
        {report.closedAt && <section className="report-panel" aria-label="Исторический итог"><h2 className="h2">{OUTCOMES[report.disposition!]}</h2><p className="c">Итог рассмотрения на {time(report.closedAt)}</p>{report.rationale && <p className="t">{report.rationale}</p>}<p className="c">Возврат или повторная публикация не открывают жалобу заново.</p></section>}
        <div className="report-compare">
          <section className="report-panel" aria-label="При отправке"><b>При отправке · {time(report.at)}</b><ReportEvidence evidence={report.evidence} reportId={report.id}/></section>
          <section className="report-panel" aria-label="Сейчас"><b>Сейчас</b>{report.current?<><ReportEvidence evidence={report.current.evidence}/><p className="c">{report.current.removal?'Снята оператором':report.current.available?'На витрине':'Недоступна покупателям'}</p></>:<p className="t">Текущие данные недоступны. Обновите.</p>}{report.laterCardEvent && <p className="c">{report.laterCardEvent.kind==='returned'?'Позднее возвращена оператором':'Позднее опубликована продавцом'} · {time(report.laterCardEvent.at)}</p>}</section>
        </div>
        {report.current && report.current.evidence.version!==report.evidence.version && <p className="report-privacy">Карточка изменена после жалобы. Сравните сохранённые и текущие данные.</p>}
        {report.photoId && <p className="c">Спорное фото: {report.evidence.photoIds.indexOf(report.photoId)+1}</p>}
        <section className="report-panel report-privacy" aria-label="Сообщение покупателя"><b>Сообщение покупателя</b><p className="t">{report.text || 'Без комментария'}</p><p className="c">Только для оператора · не передаётся продавцу</p></section>
        {mode && <section className="report-panel" aria-label="Подтверждение решения">
          <h2 className="h3">{OUTCOMES[mode]}</h2>
          {mode==='removed'?<>
            {REMOVAL_REASONS.map(r=><label key={r} className="li" style={{minHeight:48,position:'relative'}}><input type="radio" className="cbx" name="report-removal" checked={reason===r} onChange={()=>setReason(r)}/><Radio on={reason===r}/><span>{REMOVALS[r]}</span></label>)}
            <label htmlFor="seller-report-comment">Отдельный комментарий продавцу · необязательно</label><textarea id="seller-report-comment" maxLength={300} value={comment} onChange={e=>setComment(e.target.value)} disabled={busy}/>
            <p className="c">Не включайте данные покупателя. Снятие действует на всю карточку во всех точках.</p>
          </>:<><label htmlFor="report-rationale">Обоснование · только для оператора{mode==='already_removed'?' · необязательно':''}</label><textarea id="report-rationale" maxLength={300} value={rationale} onChange={e=>setRationale(e.target.value)} disabled={busy}/></>}
        </section>}
        {report.closedAt && <Link className="btn btn-o w" href={`/operator?card=${report.evidence.cardId}`}>Открыть текущую карточку</Link>}
        <button type="button" className="btn btn-g w" disabled={busy} onClick={()=>void open(report.id)}>Обновить жалобу</button>
      </>}
      {error && <p role="alert" className="emsg">{error}</p>}
      {!report && error && <button type="button" className="btn btn-o" onClick={()=>setAttempt(v=>v+1)}>Повторить</button>}
    </main>
    {report && !report.closedAt && report.current && <footer className="foot" style={{display:'flex',flexDirection:'column',gap:8}}>
      {mode?<button type="button" className={`btn ${mode==='removed'?'btn-d':'btn-p'} w`} disabled={busy} onClick={()=>void decide()}>{mode==='removed'?'Снять карточку и закрыть жалобу':'Подтвердить и закрыть жалобу'}</button>:<>
        {report.current.removal?<><button type="button" className="btn btn-o w" disabled={busy} onClick={()=>choose('already_removed')}>Уже снята · закрыть жалобу</button><button type="button" className="btn btn-o w" disabled={busy} onClick={()=>choose('returned')}>Вернуть карточку и закрыть жалобу</button></>:<button type="button" className="btn btn-d w" disabled={busy} onClick={()=>choose('removed')}>Снять карточку</button>}
        <button type="button" className="btn btn-o w" disabled={busy} onClick={()=>choose('no_action')}>Без снятия · указать обоснование</button>
      </>}
    </footer>}
  </div></Phone>;
}
