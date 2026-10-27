import os
os.environ['HF_HUB_OFFLINE']='1';os.environ['OMP_NUM_THREADS']='2'
import sys,json,time,pathlib
sys.stdout.reconfigure(encoding='utf8')
from faster_whisper import WhisperModel
R=pathlib.Path(__file__).parent
start=time.perf_counter();m=WhisperModel(str(R/'models'/'faster-whisper-base'),device='cpu',compute_type='int8',cpu_threads=2,num_workers=1,local_files_only=True)
loaded=time.perf_counter();segments,info=m.transcribe(sys.argv[1],language=None if sys.argv[2]=='mixed' else sys.argv[2],beam_size=5,best_of=5,condition_on_previous_text=False,vad_filter=False,temperature=0)
text=' '.join(s.text.strip() for s in segments)
print(json.dumps({'text':text,'load_s':loaded-start,'inference_s':time.perf_counter()-loaded,'language':info.language},ensure_ascii=False),flush=True)
