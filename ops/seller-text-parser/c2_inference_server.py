# -*- coding: utf-8 -*-
"""Reference inference wrapper for the KAIDA C2 text-parser configuration (seller-ai-text-real-parser §5, §8).

Serves exactly one configuration -- Qwen/Qwen3-4B at the pinned revision, float16, one GPU, greedy decoding,
thinking off, 2048 new tokens, one request at a time -- over an OpenAI-compatible POST /v1/chat/completions.
The generation code path is the HFBackend of the reference script 2.2 (tests/fixtures/seller-text-real-parser/
kaida_extract_exp.py). The KAIDA app owns the prompt, demonstrations, parsing, reducer and safeguards; this
service only generates text and reports the model identity.

Access: every request needs `Authorization: Bearer <KAIDA_PARSER_API_KEY>` (at least 32 characters, compared in
constant time). `--allow-no-auth` is accepted only together with a loopback bind address, and must never be
combined with a tunnel or port forwarding: a tunnel makes a loopback-bound service public.

Logging: one line per request with method, path, status, duration and token count. Never the request body,
the generated text or the Authorization header.

Usage (GPU host, after `pip install -r requirements.txt`):
    KAIDA_PARSER_API_KEY=... python c2_inference_server.py --host 127.0.0.1 --port 8000
"""
import argparse
import hmac
import ipaddress
import json
import os
import sys
import time
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL_ID = "Qwen/Qwen3-4B"
MODEL_REVISION = "1cfa9a7208912126459214e8b04321603b3df60c"
IDENTITY = MODEL_ID + "@" + MODEL_REVISION
MAX_NEW_TOKENS = 2048
MAX_BODY_BYTES = 256 * 1024
MAX_MESSAGES = 64
MAX_CONTENT_CHARS = 20000
MIN_KEY_LENGTH = 32
# Recorded stack of the evidenced C2 run (control_C2.manifest.json). Differences are reported, not hidden.
PINNED_STACK = {"torch": "2.11.0+cu128", "transformers": "5.16.1", "gpu": "Tesla T4"}


class RequestError(Exception):
    def __init__(self, status, code):
        super().__init__(code)
        self.status = status
        self.code = code


class C2Generator:
    """Same code path as HFBackend(dtype="float16", thinking=False, device_map="single") of script 2.2."""

    def __init__(self):
        import torch
        import transformers
        from transformers import AutoModelForCausalLM, AutoTokenizer
        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(MODEL_ID, revision=MODEL_REVISION)
        self.tok.padding_side = "left"
        if self.tok.pad_token is None:
            self.tok.pad_token = self.tok.eos_token
        device_map = {"": 0} if torch.cuda.is_available() else "cpu"
        kw = dict(revision=MODEL_REVISION, device_map=device_map, attn_implementation="sdpa")
        try:
            self.model = AutoModelForCausalLM.from_pretrained(MODEL_ID, dtype=torch.float16, **kw)
        except TypeError:
            self.model = AutoModelForCausalLM.from_pretrained(MODEL_ID, torch_dtype=torch.float16, **kw)
        self.model.eval()
        commit = getattr(self.model.config, "_commit_hash", None)
        if commit != MODEL_REVISION:
            raise SystemExit("model revision mismatch: loaded %r, pinned %s" % (commit, MODEL_REVISION))
        self.info = {
            "model": IDENTITY,
            "torch": torch.__version__,
            "transformers": transformers.__version__,
            "gpus": [torch.cuda.get_device_name(i) for i in range(torch.cuda.device_count())],
            "pinned": PINNED_STACK,
        }

    def generate(self, messages):
        torch = self.torch
        prompt = self.tok.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        enc = self.tok([prompt], return_tensors="pt", padding=True, add_special_tokens=False).to(self.model.device)
        started = time.time()
        with torch.no_grad():
            out = self.model.generate(**enc, max_new_tokens=MAX_NEW_TOKENS, pad_token_id=self.tok.pad_token_id,
                                      do_sample=False, temperature=None, top_p=None, top_k=None)
        seconds = time.time() - started
        ids = out[0, enc["input_ids"].shape[1]:].tolist()
        eos_ids = {self.tok.eos_token_id, self.tok.pad_token_id}
        im_end = self.tok.convert_tokens_to_ids("<|im_end|>")
        if isinstance(im_end, int) and im_end >= 0:
            eos_ids.add(im_end)
        n = len(ids)
        while n > 0 and ids[n - 1] in eos_ids:
            n -= 1
        raw = self.tok.decode(ids[:n], skip_special_tokens=True)
        return {"content": raw, "new_tokens": n, "prompt_tokens": int(enc["input_ids"].shape[1]),
                "hit_limit": n >= MAX_NEW_TOKENS, "seconds": seconds}


def is_loopback(host):
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def validate_request(body):
    """-> messages. Only the pinned configuration is served; nothing about decoding can be changed by a caller."""
    if not isinstance(body, dict):
        raise RequestError(400, "invalid_body")
    if body.get("model") != IDENTITY:
        raise RequestError(400, "unknown_model")
    if body.get("stream"):
        raise RequestError(400, "stream_not_supported")
    if body.get("max_tokens", MAX_NEW_TOKENS) != MAX_NEW_TOKENS:
        raise RequestError(400, "max_tokens_fixed")
    if body.get("temperature", 0) not in (0, 0.0):
        raise RequestError(400, "greedy_only")
    messages = body.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= MAX_MESSAGES:
        raise RequestError(400, "invalid_messages")
    clean = []
    for m in messages:
        if not isinstance(m, dict) or m.get("role") not in ("system", "user", "assistant"):
            raise RequestError(400, "invalid_messages")
        content = m.get("content")
        if not isinstance(content, str) or len(content) > MAX_CONTENT_CHARS:
            raise RequestError(400, "invalid_messages")
        clean.append({"role": m["role"], "content": content})
    if clean[-1]["role"] != "user":
        raise RequestError(400, "invalid_messages")
    return clean


def make_handler(generator, api_key, log=print):
    class Handler(BaseHTTPRequestHandler):
        server_version = "kaida-c2"
        sys_version = ""

        def log_message(self, fmt, *args):  # the default logger would print request lines with client details
            pass

        def _send(self, status, payload):
            data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def _authorized(self):
            if api_key is None:
                return True
            header = self.headers.get("Authorization", "")
            return hmac.compare_digest(header.encode("utf-8"), ("Bearer " + api_key).encode("utf-8"))

        def do_GET(self):
            if self.path == "/healthz":
                self._send(200, {"ok": True})
            else:
                self._send(404, {"error": {"code": "not_found"}})

        def do_POST(self):
            started = time.time()
            status, tokens = 500, 0
            try:
                if self.path.rstrip("/") != "/v1/chat/completions":
                    raise RequestError(404, "not_found")
                if not self._authorized():
                    raise RequestError(401, "unauthorized")
                length = int(self.headers.get("Content-Length") or 0)
                if length <= 0 or length > MAX_BODY_BYTES:
                    raise RequestError(413, "body_size")
                try:
                    body = json.loads(self.rfile.read(length).decode("utf-8"))
                except (UnicodeDecodeError, ValueError):
                    raise RequestError(400, "invalid_json")
                result = generator.generate(validate_request(body))
                tokens = result["new_tokens"]
                status = 200
                self._send(200, {
                    "id": "chatcmpl-" + uuid.uuid4().hex,
                    "object": "chat.completion",
                    "created": int(time.time()),
                    "model": IDENTITY,
                    "choices": [{"index": 0, "message": {"role": "assistant", "content": result["content"]},
                                 "finish_reason": "length" if result["hit_limit"] else "stop"}],
                    "usage": {"prompt_tokens": result["prompt_tokens"], "completion_tokens": result["new_tokens"],
                              "total_tokens": result["prompt_tokens"] + result["new_tokens"]},
                })
            except RequestError as e:
                status = e.status
                self._send(e.status, {"error": {"code": e.code}})
            except Exception:  # noqa: BLE001 -- never echo internals or input
                status = 500
                self._send(500, {"error": {"code": "generation_failed"}})
            finally:
                log(json.dumps({"method": "POST", "path": self.path if status != 404 else "-", "status": status,
                                "ms": int((time.time() - started) * 1000), "new_tokens": tokens}))

    return Handler


def read_api_key(host, allow_no_auth, environ=os.environ):
    key = environ.get("KAIDA_PARSER_API_KEY") or None
    if key is not None and len(key) < MIN_KEY_LENGTH:
        raise SystemExit("KAIDA_PARSER_API_KEY must have at least %d characters" % MIN_KEY_LENGTH)
    if key is None:
        if not allow_no_auth:
            raise SystemExit("KAIDA_PARSER_API_KEY is required (use --allow-no-auth only for a loopback-only test)")
        if not is_loopback(host):
            raise SystemExit("--allow-no-auth is accepted only with a loopback --host")
    return key


def main(argv=None):
    parser = argparse.ArgumentParser(description="KAIDA C2 reference inference wrapper")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--allow-no-auth", action="store_true",
                        help="loopback-only tests without a tunnel or port forwarding")
    args = parser.parse_args(argv)
    api_key = read_api_key(args.host, args.allow_no_auth)
    generator = C2Generator()
    print(json.dumps({"event": "ready", "auth": api_key is not None, **generator.info}))
    if api_key is None:
        print("WARNING: no authentication. Do not expose this port through a tunnel or forwarding.", file=sys.stderr)
    # HTTPServer handles one request at a time: batch 1, as in the evidenced run. Others wait in the listen queue.
    HTTPServer((args.host, args.port), make_handler(generator, api_key)).serve_forever()


if __name__ == "__main__":
    main()
