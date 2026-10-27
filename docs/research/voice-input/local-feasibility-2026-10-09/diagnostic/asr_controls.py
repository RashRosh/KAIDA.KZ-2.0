import pathlib,json,subprocess,time
R=pathlib.Path(__file__).parent;D=R/'diagnostic';cases=[('ru-single','ru'),('kk-single','kk'),('mixed-multi','ru'),('mixed-multi','kk')];rows=[]
for ident,lang in cases:
    key='base-no-fallback-'+ident+'-'+lang;out=D/key
    args=[str(R/'tools'/'whisper'/'Release'/'whisper-cli.exe'),'-m',str(R/'models'/'whisper.cpp'/'ggml-base.bin'),'-f',str(R/'neural'/'audio'/(ident+'-16k.wav')),'-l',lang,'-t','2','-bs','5','-bo','5','-ng','-nt','-nf','-otxt','-of',str(out)]
    tick=time.perf_counter();p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=0x08000000,timeout=120)
    (D/(key+'.stdout')).write_bytes(p.stdout);(D/(key+'.stderr')).write_bytes(p.stderr)
    text=out.with_suffix('.txt').read_text(encoding='utf8').strip() if p.returncode==0 else None
    rows.append({'id':ident,'language':lang,'args':args,'exit':p.returncode,'wall_s':time.perf_counter()-tick,'transcript':text});(D/'asr-controls.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
    print(key,'exit',p.returncode,'transcript',text.encode('unicode_escape').decode() if text else None,flush=True)
