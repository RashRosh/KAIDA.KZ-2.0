import ctypes as c, json, pathlib, wave, hashlib
import espeakng_loader
R=pathlib.Path(__file__).parent
lib=espeakng_loader.load_library()
lib.espeak_Initialize.argtypes=[c.c_int,c.c_int,c.c_char_p,c.c_int]
rate=lib.espeak_Initialize(2,0,str(pathlib.Path(espeakng_loader.get_data_path()).parent).encode(),0)
if rate<=0: raise RuntimeError('synth init failed')
lib.espeak_Info.restype=c.c_char_p
version=lib.espeak_Info(None).decode()
CALLBACK=c.CFUNCTYPE(c.c_int,c.POINTER(c.c_short),c.c_int,c.c_void_p)
chunks=[]
@CALLBACK
def cb(samples,n,event):
    if n: chunks.append(c.string_at(samples,n*2))
    return 0
lib.espeak_SetSynthCallback(cb)
lib.espeak_SetVoiceByName.argtypes=[c.c_char_p]
lib.espeak_Synth.argtypes=[c.c_void_p,c.c_size_t,c.c_uint,c.c_int,c.c_uint,c.c_uint,c.c_void_p,c.c_void_p]
lib.espeak_SetParameter(1,145,0)
rows=json.loads((R/'corpus.json').read_text(encoding='utf8'))
(R/'audio').mkdir(exist_ok=True)
for row in rows:
    pcm=b''
    for lang,text in row['segments']:
        if lib.espeak_SetVoiceByName(lang.encode())!=0: raise RuntimeError('missing voice '+lang)
        chunks.clear(); raw=text.encode('utf8')+b'\0'; buf=c.create_string_buffer(raw)
        if lib.espeak_Synth(buf,len(raw),0,1,0,1,None,None)!=0: raise RuntimeError('synthesis failed')
        lib.espeak_Synchronize(); pcm+=b''.join(chunks)+b'\0'*(rate//4*2)
    path=R/'audio'/(row['id']+'.wav')
    with wave.open(str(path),'wb') as w: w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(pcm)
    row['reference']=' '.join(t for _,t in row['segments']);row['duration_s']=len(pcm)/(rate*2);row['audio_sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
(R/'fixed-corpus.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf8')
(R/'synthesis.json').write_text(json.dumps({'engine':'eSpeak NG','version':version,'sample_rate':rate,'rate':145,'voices':['ru','kk'],'mixed':'concatenated RU/KK synthesized segments, not natural code switching','license':'GPL-3.0-or-later'},indent=2),encoding='utf8')
print('synthesized',len(rows),'recordings',round(sum(x['duration_s'] for x in rows),2),'seconds; version',version,flush=True)
