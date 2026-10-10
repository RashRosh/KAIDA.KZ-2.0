'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
export function ReportsLink(){
  const [count,setCount]=useState<number|null>(null);
  useEffect(()=>{const controller=new AbortController();void fetch('/api/operator/reports',{cache:'no-store',signal:controller.signal})
    .then(async r=>{if(r.ok){const d=await r.json() as {openCount:number};if(!controller.signal.aborted)setCount(d.openCount);}}).catch(()=>{});return()=>controller.abort();},[]);
  return <Link className="btn btn-o w" href="/operator/reports">Жалобы{count===null?'':` · ${count}`}</Link>;
}
