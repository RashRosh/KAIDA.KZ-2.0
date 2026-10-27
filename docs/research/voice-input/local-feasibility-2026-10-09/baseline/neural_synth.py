import pathlib,json,subprocess,wave,hashlib,os
R=pathlib.Path(__file__).parent;N=R/'neural';N.mkdir(exist_ok=True);(N/'audio').mkdir(exist_ok=True);rows=json.loads((R/'corpus.json').read_text(encoding='utf8'));exe=next((R/'tools'/'piper').rglob('piper.exe'))
env={**os.environ,'OMP_NUM_THREADS':'2'}
for row in rows:
    pcm=b'';rate=None
    for n,(lang,text) in enumerate(row['segments']):
        model=next((R/'models'/('piper-'+lang)).glob('*.onnx'));part=N/'audio'/(row['id']+f'-part{n}.wav')
        p=subprocess.run([str(exe),'-m',str(model),'-f',str(part)],input=(text+'\n').encode('utf8'),stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,creationflags=0x08000000,timeout=60)
        if p.returncode:raise RuntimeError(p.stderr.decode(errors='replace'))
        with wave.open(str(part),'rb') as w:
            if w.getnchannels()!=1 or w.getsampwidth()!=2:raise RuntimeError('unexpected PCM format')
            if rate is not None and w.getframerate()!=rate:raise RuntimeError('mismatched sample rates')
            rate=w.getframerate();pcm+=w.readframes(w.getnframes())+b'\0'*(rate//4*2)
    path=N/'audio'/(row['id']+'.wav')
    with wave.open(str(path),'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm)
    row.update(reference=' '.join(t for _,t in row['segments']),duration_s=len(pcm)/(rate*2),audio_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
(N/'fixed-corpus.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
print('neural fixed corpus',len(rows),'clips',round(sum(x['duration_s'] for x in rows),2),'seconds',flush=True)
