"""Bounded, non-inference diagnostics of frozen voice research evidence."""
import json,pathlib,re,wave,math,array,ast,collections,struct
R=pathlib.Path(__file__).parent;D=R/'diagnostic';D.mkdir(exist_ok=True)
def words(t):return re.findall(r'\w+',t.lower().replace('ё','е'),re.UNICODE)
def normalize(t):
    w=words(t);s=' '.join(w)
    # Presentation-only conversions, frozen before rescoring. No spelling/product repair.
    table={'двести пятьдесят':'250','сто восемьдесят':'180','үш жүз':'300','екі жүз елу':'250','бес жүз':'500','триста':'300','пятьсот':'500','две':'2','екі':'2'}
    for a,b in sorted(table.items(),key=lambda x:-len(x[0])):s=re.sub(r'(?<!\w)'+re.escape(a)+r'(?!\w)',b,s)
    return ['unit_kg' if x in ['кг','килограмм','килограмы'] else 'unit_liter' if x in ['литр','литрл','л'] else 'currency_kzt' if x in ['тенге','теңге','₸'] else x for x in s.split()]
def align(a,b):
    d=[[0]*(len(b)+1) for _ in range(len(a)+1)]
    for i in range(len(a)+1):d[i][0]=i
    for j in range(len(b)+1):d[0][j]=j
    for i in range(1,len(a)+1):
        for j in range(1,len(b)+1):d[i][j]=min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]!=b[j-1]))
    i,j=len(a),len(b);ops=[]
    while i or j:
        if i and j and d[i][j]==d[i-1][j-1]+(a[i-1]!=b[j-1]):ops.append({'op':'equal' if a[i-1]==b[j-1] else 'substitution','reference':a[i-1],'hypothesis':b[j-1]});i-=1;j-=1
        elif j and d[i][j]==d[i][j-1]+1:ops.append({'op':'insertion','reference':None,'hypothesis':b[j-1]});j-=1
        else:ops.append({'op':'deletion','reference':a[i-1],'hypothesis':None});i-=1
    ops.reverse();counts=collections.Counter(x['op'] for x in ops);return {'errors':d[-1][-1],'reference_tokens':len(a),'wer':d[-1][-1]/len(a),'substitutions':counts['substitution'],'deletions':counts['deletion'],'insertions':counts['insertion'],'alignment':ops}
out=[];audio=[];extract=[]
for corpus,base in [('robotic',R),('neural',R/'neural')]:
    gold=json.loads((base/'fixed-corpus.json').read_text(encoding='utf8'));rows=json.loads((base/'asr-results.json').read_text(encoding='utf8'))
    for x in gold:
        path=base/'audio'/(x['id']+'.wav')
        with wave.open(str(path),'rb') as w:
            pcm=array.array('h',w.readframes(w.getnframes()));dur=w.getnframes()/w.getframerate()
            stats={'corpus':corpus,'id':x['id'],'sample_rate':w.getframerate(),'channels':w.getnchannels(),'sample_width':w.getsampwidth(),'frames':w.getnframes(),'duration_s':dur,'rms_dbfs':20*math.log10(max(1,math.sqrt(sum(v*v for v in pcm)/len(pcm)))/32768),'peak_abs':max(abs(v) for v in pcm),'clipped_sample_fraction':sum(abs(v)>=32767 for v in pcm)/len(pcm),'zero_sample_fraction':sum(v==0 for v in pcm)/len(pcm),'reference':x['reference']}
        with wave.open(str(base/'audio'/(x['id']+'-16k.wav')),'rb') as w:stats.update(resampled_rate=w.getframerate(),resampled_duration_s=w.getnframes()/w.getframerate(),duration_delta_ms=1000*(w.getnframes()/w.getframerate()-dur))
        audio.append(stats)
    for x in rows:
        g=next(y for y in gold if y['id']==x['id']);seq=words(x['text']);runs=[(tok,len(list(group))) for tok,group in __import__('itertools').groupby(seq)];run=max(runs,key=lambda z:z[1]) if runs else ('',0)
        stderr=(base/'results'/(x['runtime']+'-'+x['id']+'.stderr')).read_text(encoding='utf8',errors='replace')
        out.append({'corpus':corpus,'runtime':x['runtime'],'id':x['id'],'lang':x['lang'],'detected_language':x.get('language'),'native_language_lines':[line for line in stderr.splitlines() if 'auto-detected language' in line or 'lang =' in line],'reference':g['reference'],'transcript':x['text'],'raw':align(words(g['reference']),seq),'presentation_normalized':align(normalize(g['reference']),normalize(x['text'])),'maximum_identical_token_run':{'token':run[0],'length':run[1]}})
    for x in json.loads((base/'extraction-results.json').read_text(encoding='utf8')):
        response=x['response'];choice=response['choices'][0] if response else {}
        items=x['items'];nonnull=correct_nonnull=0
        g=next(y for y in gold if y['id']==x['id'])['expected']
        for i,item in enumerate(g):
            for field in ['product','price','unit']:
                if item[field] is not None:
                    nonnull+=1
                    if i<len(items) and field in items[i] and items[i][field]==item[field]:correct_nonnull+=1
        extract.append({'corpus':corpus,'model':x['model'],'source':x['source'],'id':x['id'],'text':x['text'],'items':items,'gold':g,'finish_reason':choice.get('finish_reason'),'completion_tokens':response.get('usage',{}).get('completion_tokens') if response else None,'error':x['error'],'field_correct':x['field_correct'],'field_total':x['field_total'],'nonnull_fact_correct':correct_nonnull,'nonnull_fact_total':nonnull,'extra_items':x['extra_items'],'duplicate_item_count':len(items)-len({json.dumps(i,sort_keys=True) for i in items})})
tree=ast.parse((R/'extract_bench.py').read_text(encoding='utf8'));prompt=schema=None
for node in tree.body:
    if isinstance(node,ast.Assign):
        if any(isinstance(t,ast.Name) and t.id=='system' for t in node.targets):prompt=ast.literal_eval(node.value)
        if any(isinstance(t,ast.Name) and t.id=='schema' for t in node.targets):schema=ast.literal_eval(node.value)
(D/'prompt.txt').write_text(prompt+'\n',encoding='utf8');(D/'schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2),encoding='utf8')
(D/'asr-analysis.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf8');(D/'audio-analysis.json').write_text(json.dumps(audio,ensure_ascii=False,indent=2),encoding='utf8');(D/'extraction-analysis.json').write_text(json.dumps(extract,ensure_ascii=False,indent=2),encoding='utf8')
for corpus in ['robotic','neural']:
    for runtime in ['whisper.cpp','faster-whisper']:
        a=[x for x in out if x['corpus']==corpus and x['runtime']==runtime];b={}
        for metric in ['raw','presentation_normalized']:
            stats={k:sum(x[metric][k] for x in a) for k in ['errors','reference_tokens','substitutions','deletions','insertions']};stats['wer']=stats['errors']/stats['reference_tokens'];b[metric]=stats
        print(corpus,runtime,json.dumps(b),flush=True)
print('Audio validation: max duration delta ms',max(abs(x['duration_delta_ms']) for x in audio),'max clipping fraction',max(x['clipped_sample_fraction'] for x in audio),flush=True)
