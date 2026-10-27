import pathlib,urllib.request,json,zipfile,hashlib
R=pathlib.Path(__file__).parent
def fetch(url,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        print('download',path.name,flush=True)
        with urllib.request.urlopen(url,timeout=90) as src,path.open('wb') as dst:
            while b:=src.read(1024*1024):dst.write(b)
    return hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
rev='c10ece1aade47bb51c153c893d14e5bf8e5b7117';out={'revision':rev,'runtime':'Piper 2023.11.14-2','files':{}}
for lang,voice,quality in [('ru','dmitri','medium'),('kk','issai','high')]:
    locale='ru_RU' if lang=='ru' else 'kk_KZ';root=f'{lang}/{locale}/{voice}/{quality}/';model=f'{locale}-{voice}-{quality}.onnx'
    for name in [model,model+'.json','MODEL_CARD']:
        path=R/'models'/('piper-'+lang)/name
        out['files'][root+name]=fetch(f'https://huggingface.co/rhasspy/piper-voices/resolve/{rev}/{root}{name}',path)
out['files']['piper.zip']=fetch('https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip',R/'tools'/'piper.zip')
with zipfile.ZipFile(R/'tools'/'piper.zip') as z:z.extractall(R/'tools'/'piper')
(R/'speech-sources.json').write_text(json.dumps(out,indent=2),encoding='utf8')
print('neural synthesis assets ready',flush=True)
