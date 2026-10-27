import json,pathlib,time,subprocess,threading,urllib.request,urllib.error,psutil,sys
BASE=pathlib.Path(__file__).parent;R=BASE/'neural' if '--neural' in sys.argv else BASE;rows=json.loads((R/'fixed-corpus.json').read_text(encoding='utf8'));asr=json.loads((R/'asr-results.json').read_text(encoding='utf8'))
schema={'type':'object','properties':{'items':{'type':'array','items':{'type':'object','properties':{'product':{'type':['string','null'],'enum':['carrot','potato','apple','cheese','milk','trout',None]},'price':{'type':['number','null']},'unit':{'type':['string','null'],'enum':['kg','liter','piece','package',None]},'clarify':{'type':'boolean'}},'required':['product','price','unit','clarify'],'additionalProperties':False}}},'required':['items'],'additionalProperties':False}
system='Extract seller product drafts from Russian, Kazakh or mixed-language speech transcripts. Output JSON items in spoken order. Vocabulary: carrot=морковь/сәбіз, potato=картофель/картоп, apple=яблоко/алма, cheese=сыр/ірімшік, milk=молоко/сүт, trout=форель. Never invent products, prices or units. If price or price basis is absent or ambiguous, use null and clarify=true. If facts are clear, clarify=false. Do not repair unreliable recognition by guessing. Do not create locations, brands, sizes or facts not stated. Prices are numeric KZT amounts; kg means per kilogram, liter means per liter. Convert unambiguous spoken number words to numbers.'
jobs=([{'id':x['id'],'source':'reference-diagnostic','text':x['reference']} for x in rows] if R==BASE else [])+[{'id':x['id'],'source':x['runtime'],'text':x['text']} for x in asr if x['exit']==0]
def request(path,payload=None,timeout=120):
    data=json.dumps(payload,ensure_ascii=False).encode('utf8') if payload is not None else None
    req=urllib.request.Request('http://127.0.0.1:39181'+path,data=data,headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as r:return json.load(r)
results=[];runtime=[]
for size in ['0.5','1.5']:
    name=f'qwen2.5-{size}b-instruct-q4_k_m';model=BASE/'models'/f'Qwen2.5-{size}B-Instruct-GGUF'/(name+'.gguf')
    stdout=(R/'results'/(name+'-server.stdout')).open('w',encoding='utf8');stderr=(R/'results'/(name+'-server.stderr')).open('w',encoding='utf8')
    args=[str(BASE/'tools'/'llama'/'llama-server.exe'),'-m',str(model),'--host','127.0.0.1','--port','39181','-t','2','-tb','2','-c','2048','-np','1','-ngl','0','--no-webui']
    start=time.perf_counter();p=subprocess.Popen(args,stdout=stdout,stderr=stderr,creationflags=0x08000000);proc=psutil.Process(p.pid);stats={'peak_rss_mib':0,'peak_private_mib':0,'min_host_available_mib':999999};stop=threading.Event()
    def monitor():
        while not stop.is_set():
            try:
                m=proc.memory_info();stats['peak_rss_mib']=max(stats['peak_rss_mib'],m.rss/2**20,getattr(m,'peak_wset',0)/2**20);stats['peak_private_mib']=max(stats['peak_private_mib'],getattr(m,'private',m.vms)/2**20);stats['min_host_available_mib']=min(stats['min_host_available_mib'],psutil.virtual_memory().available/2**20)
            except psutil.Error:pass
            stop.wait(.05)
    t=threading.Thread(target=monitor,daemon=True);t.start()
    try:
        while True:
            if p.poll() is not None:raise RuntimeError('server exited '+str(p.returncode))
            try:
                if request('/health',timeout=2).get('status')=='ok':break
            except Exception:pass
            if time.perf_counter()-start>180:raise TimeoutError('load exceeded 180s')
            time.sleep(.25)
        loaded=time.perf_counter()-start
        print(name,'loaded',round(loaded,2),flush=True)
        for job in jobs:
            tick=time.perf_counter();payload=None;error=None;items=[]
            try:
                payload=request('/v1/chat/completions',{'messages':[{'role':'system','content':system},{'role':'user','content':job['text']}],'temperature':0,'seed':42,'max_tokens':256,'response_format':{'type':'json_schema','json_schema':{'name':'draft','strict':True,'schema':schema}}})
                content=payload['choices'][0]['message']['content'];items=json.loads(content)['items']
            except Exception as e:error=repr(e)
            row=next(x for x in rows if x['id']==job['id']);gold=row['expected'];correct=0;filled_missing=0;unsupported=0;extra=max(0,len(items)-len(gold))
            # Spoken order is the frozen evaluation convention; raw predictions are retained.
            for i,g in enumerate(gold):
                pred=items[i] if i<len(items) else {}
                for field in ['product','price','unit','clarify']:
                    if field in pred and pred[field]==g[field]:correct+=1
                    elif field in pred and pred[field] is not None and field!='clarify':
                        unsupported+=1
                        if g[field] is None:filled_missing+=1
            result={**job,'model':name,'wall_s':time.perf_counter()-tick,'items':items,'field_correct':correct,'field_total':len(gold)*4,'unsupported_nonnull_fields':unsupported,'invented_missing_fields':filled_missing,'extra_items':extra,'error':error,'response':payload,**stats}
            results.append(result);(R/'extraction-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
            print(name,job['source'],job['id'],f'{correct}/{len(gold)*4}',round(result['wall_s'],2),'s','invented missing',filled_missing,'error',error,flush=True)
        runtime.append({'model':name,'load_s':loaded,'jobs':len(jobs),**stats})
    except Exception as e:
        runtime.append({'model':name,'error':repr(e),**stats});print(name,'failure',repr(e),flush=True)
    finally:
        p.terminate()
        try:p.wait(timeout=10)
        except subprocess.TimeoutExpired:p.kill();p.wait()
        stop.set();t.join(timeout=2);stdout.close();stderr.close();(R/'extraction-runtime.json').write_text(json.dumps(runtime,indent=2),encoding='utf8')
