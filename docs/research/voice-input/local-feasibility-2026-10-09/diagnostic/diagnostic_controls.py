"""Six prompt/schema/cache diagnostics with an already-downloaded model; not a new benchmark."""
import pathlib,json,subprocess,time,urllib.request,threading,psutil
R=pathlib.Path(__file__).parent;D=R/'diagnostic';prompt=(D/'prompt.txt').read_text(encoding='utf8').strip();schema=json.loads((D/'schema.json').read_text())
def req(path,payload=None,timeout=120):
    data=json.dumps(payload,ensure_ascii=False).encode('utf8') if payload is not None else None
    with urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:39181'+path,data=data,headers={'Content-Type':'application/json'}),timeout=timeout) as response:return json.load(response)
ru='Картофель двести пятьдесят тенге за килограмм. Яблоки пятьсот тенге за килограмм.'
visible=prompt+'\nRequired output schema: '+json.dumps(schema,ensure_ascii=False)+'\nReturn exactly one item per product actually mentioned, never list the vocabulary. If the source does not state an unambiguous price or unit, that field MUST be null even when clarify is true.'
rev=json.loads(json.dumps(schema));rev['properties']['items']['items']['properties']['product']['enum']=list(reversed(rev['properties']['items']['items']['properties']['product']['enum']))
jobs=[('original-english',prompt,'Potato, 250 tenge per kilogram.',schema),('original-ru-no-cache',prompt,ru,schema),('original-ru-reversed-enum',prompt,ru,rev),('visible-schema-ru',visible,ru,schema),('visible-schema-english',visible,'Potato, 250 tenge per kilogram.',schema),('visible-schema-ambiguous',visible,'Сыр две пятьсот. Единицу уточню потом.',schema)]
log=(D/'controls-server.stdout').open('w',encoding='utf8');err=(D/'controls-server.stderr').open('w',encoding='utf8')
args=[str(R/'tools'/'llama'/'llama-server.exe'),'-m',str(R/'models'/'Qwen2.5-1.5B-Instruct-GGUF'/'qwen2.5-1.5b-instruct-q4_k_m.gguf'),'--host','127.0.0.1','--port','39181','-t','2','-tb','2','-c','2048','-np','1','-ngl','0','--no-webui','--offline']
p=subprocess.Popen(args,stdout=log,stderr=err,creationflags=0x08000000);start=time.perf_counter();out=[]
try:
    while True:
        if p.poll() is not None:raise RuntimeError('server exited')
        try:
            if req('/health',timeout=2).get('status')=='ok':break
        except Exception:pass
        if time.perf_counter()-start>120:raise TimeoutError('server start')
        time.sleep(.25)
    props=req('/props');(D/'server-properties.json').write_text(json.dumps(props,ensure_ascii=False,indent=2),encoding='utf8')
    for name,system,text,sch in jobs:
        payload={'messages':[{'role':'system','content':system},{'role':'user','content':text}],'temperature':0,'seed':42,'cache_prompt':False,'max_tokens':256,'response_format':{'type':'json_schema','json_schema':{'name':'draft','strict':True,'schema':sch}}}
        try:rendered=req('/apply-template',{'messages':payload['messages'],'add_generation_prompt':True})
        except Exception as e:rendered={'error':repr(e)}
        tick=time.perf_counter();response=req('/v1/chat/completions',payload);out.append({'name':name,'request':payload,'rendered_template':rendered,'response':response,'wall_s':time.perf_counter()-tick});(D/'controls.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8')
        print(name,'finish',response['choices'][0]['finish_reason'],'wall',round(out[-1]['wall_s'],2),'content',response['choices'][0]['message']['content'].encode('unicode_escape').decode(),flush=True)
finally:
    p.terminate()
    try:p.wait(timeout=10)
    except subprocess.TimeoutExpired:p.kill();p.wait()
    log.close();err.close()
