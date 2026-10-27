import json,pathlib,time,subprocess,sys,psutil,re,wave
BASE=pathlib.Path(__file__).parent;R=BASE/'neural' if '--neural' in sys.argv else BASE;(R/'results').mkdir(exist_ok=True);rows=json.loads((R/'fixed-corpus.json').read_text(encoding='utf8'))
def norm(text):return re.findall(r'\w+',text.lower().replace('ё','е'),re.UNICODE)
def distance(a,b):
    d=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        nd=[i]
        for j,y in enumerate(b,1):nd.append(min(nd[-1]+1,d[j]+1,d[j-1]+(x!=y)))
        d=nd
    return d[-1]
def run(args,key):
    start=time.perf_counter();out=(R/'results'/(key+'.stdout')).open('w',encoding='utf8');err=(R/'results'/(key+'.stderr')).open('w',encoding='utf8')
    p=subprocess.Popen(args,stdout=out,stderr=err,creationflags=0x08000000);proc=psutil.Process(p.pid);rss=private=peakws=0;avail=[]
    while p.poll() is None:
        try:
            family=[proc]+proc.children(recursive=True);infos=[]
            for member in family:
                try:infos.append(member.memory_info())
                except psutil.Error:pass
            rss=max(rss,sum(m.rss for m in infos));private=max(private,sum(getattr(m,'private',m.vms) for m in infos));peakws=max(peakws,sum(getattr(m,'peak_wset',m.rss) for m in infos));avail.append(psutil.virtual_memory().available)
        except psutil.Error:pass
        if time.perf_counter()-start>240: p.kill();break
        time.sleep(.05)
    p.wait();out.close();err.close()
    return {'exit':p.returncode,'wall_s':time.perf_counter()-start,'peak_rss_mib':max(rss,peakws)/2**20,'peak_private_mib':private/2**20,'min_host_available_mib':min(avail)/2**20 if avail else None}
result=json.loads((R/'asr-results.json').read_text(encoding='utf8')) if (R/'asr-results.json').exists() else []
for runtime in ['whisper.cpp','faster-whisper']:
    for row in rows:
        if any(x['runtime']==runtime and x['id']==row['id'] and x['exit']==0 for x in result):continue
        key=runtime+'-'+row['id'];audio=R/'audio'/(row['id']+'.wav')
        if runtime=='whisper.cpp':
            # Native CLI accepts WAV but requires 16 kHz; decode/resample locally with PyAV.
            import av,numpy as np
            samples=[];res=av.AudioResampler(format='s16',layout='mono',rate=16000)
            with av.open(str(audio)) as inp:
                for f in inp.decode(audio=0):
                    for z in res.resample(f):samples.append(z.to_ndarray().tobytes())
                for z in res.resample(None):samples.append(z.to_ndarray().tobytes())
            native=R/'audio'/(row['id']+'-16k.wav')
            with wave.open(str(native),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(16000);w.writeframes(b''.join(samples))
            args=[str(BASE/'tools'/'whisper'/'Release'/'whisper-cli.exe'),'-m',str(BASE/'models'/'whisper.cpp'/'ggml-base.bin'),'-f',str(native),'-l','auto' if row['lang']=='mixed' else row['lang'],'-t','2','-bs','5','-bo','5','-ng','-nt','-otxt','-of',str(R/'results'/key)]
        else:args=[sys.executable,str(BASE/'fw_worker.py'),str(audio),row['lang']]
        metrics=run(args,key);text=''
        if metrics['exit']==0:
            if runtime=='whisper.cpp':text=(R/'results'/(key+'.txt')).read_text(encoding='utf8').strip()
            else:
                payload=json.loads((R/'results'/(key+'.stdout')).read_text(encoding='utf8').strip());text=payload.pop('text');metrics.update(payload)
        a,b=norm(row['reference']),norm(text);e=distance(a,b)
        metrics.update(runtime=runtime,id=row['id'],lang=row['lang'],text=text,word_errors=e,reference_words=len(a),wer=e/len(a),rtf=metrics['wall_s']/row['duration_s'])
        result.append(metrics);(R/'asr-results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
        print(key,'exit',metrics['exit'],'WER',round(metrics['wer'],3),'wall',round(metrics['wall_s'],2),'RSS',round(metrics['peak_rss_mib']),flush=True)
