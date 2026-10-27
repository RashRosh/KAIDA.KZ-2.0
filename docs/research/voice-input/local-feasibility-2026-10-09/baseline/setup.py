import json, urllib.request, pathlib, hashlib, zipfile
ROOT=pathlib.Path(__file__).parent
def get(url):
    with urllib.request.urlopen(url, timeout=60) as r: return json.load(r)
def download(url,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        print('download',path.name,flush=True)
        with urllib.request.urlopen(url,timeout=90) as r, path.open('wb') as f:
            while b:=r.read(1024*1024): f.write(b)
    return hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
manifest={}
repos=[('ggerganov/whisper.cpp',['ggml-base.bin']),('Systran/faster-whisper-base',['config.json','model.bin','tokenizer.json','vocabulary.txt']),('Qwen/Qwen2.5-0.5B-Instruct-GGUF',['qwen2.5-0.5b-instruct-q4_k_m.gguf']),('Qwen/Qwen2.5-1.5B-Instruct-GGUF',['qwen2.5-1.5b-instruct-q4_k_m.gguf'])]
for repo,files in repos:
    meta=get('https://huggingface.co/api/models/'+repo); rev=meta['sha']; manifest[repo]={'revision':rev,'license':meta.get('cardData',{}).get('license'),'files':{}}
    for name in files:
        path=ROOT/'models'/repo.split('/')[-1]/name
        manifest[repo]['files'][name]=download(f'https://huggingface.co/{repo}/resolve/{rev}/{name}',path)
    (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
url='https://github.com/ggml-org/llama.cpp/releases/download/b11524/llama-b11524-bin-win-cpu-x64.zip'
download(url,ROOT/'tools'/'llama.zip')
with zipfile.ZipFile(ROOT/'tools'/'llama.zip') as z: z.extractall(ROOT/'tools'/'llama')
print('ready',flush=True)
