# -*- coding: utf-8 -*-
"""Temporary Modal deployment of the C2 reference wrapper (seller-ai-text-real-parser §5, §12 D-1).

Runs the unchanged `c2_inference_server.py` on one T4 GPU: pinned weights baked into the image at build time (no
download at request time), greedy decoding, thinking off, 2048 new tokens, one request at a time, at most one
container, scale to zero after 120 s idle. Synthetic or PO-authored text only; not a production deployment.

Credentials stay outside Git: the bearer key lives in the Modal Secret `kaida-c2-parser-key`
(variable KAIDA_PARSER_API_KEY), created by the operator:
    modal secret create kaida-c2-parser-key KAIDA_PARSER_API_KEY=<key of at least 32 characters>
Deploy / stop:
    modal deploy ops/seller-text-parser/modal_app.py
    modal app stop kaida-c2-parser
The wrapper binds 0.0.0.0 inside the container (required by Modal web servers), so it refuses to start without the key.
"""
import subprocess

import modal

MODEL_ID = "Qwen/Qwen3-4B"
MODEL_REVISION = "1cfa9a7208912126459214e8b04321603b3df60c"
PORT = 8000
WRAPPER = "/opt/kaida/c2_inference_server.py"


def download_pinned_weights():
    from huggingface_hub import snapshot_download

    snapshot_download(MODEL_ID, revision=MODEL_REVISION)


image = (
    # Stack of the evidenced run: Python 3.13, torch 2.11.0+cu128, transformers 5.16.1 (control_C2.manifest.json).
    modal.Image.debian_slim(python_version="3.13")
    .pip_install("torch==2.11.0", index_url="https://download.pytorch.org/whl/cu128")
    .pip_install("transformers==5.16.1", "accelerate", "huggingface_hub")
    .run_function(download_pinned_weights)
    .env({"HF_HUB_OFFLINE": "1", "TOKENIZERS_PARALLELISM": "false"})
    .add_local_file("ops/seller-text-parser/c2_inference_server.py", WRAPPER)
)

app = modal.App("kaida-c2-parser", image=image)


@app.function(
    gpu="T4",
    secrets=[modal.Secret.from_name("kaida-c2-parser-key")],
    max_containers=1,
    min_containers=0,
    scaledown_window=120,
    timeout=3600,
)
@modal.web_server(PORT, startup_timeout=900)
def serve():
    # One input per container (Modal default) and a single-threaded HTTP server: batch 1, as in the C2 run.
    subprocess.Popen(["python", WRAPPER, "--host", "0.0.0.0", "--port", str(PORT)])
