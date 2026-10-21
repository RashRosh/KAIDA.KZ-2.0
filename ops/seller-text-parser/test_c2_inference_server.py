# -*- coding: utf-8 -*-
"""HTTP, access and validation tests of the reference wrapper with a FAKE generator (no model, no GPU).
Run: python -I -m unittest discover -s ops/seller-text-parser -p "test_*.py"
These tests prove nothing about generation; the generation path is verified only on a GPU host (contract §9.2)."""
import http.client
import json
import os
import sys
import threading
import unittest
from http.server import HTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import c2_inference_server as srv  # noqa: E402

KEY = "k" * 40


class FakeGenerator:
    def __init__(self, hit_limit=False):
        self.calls = []
        self.hit_limit = hit_limit

    def generate(self, messages):
        self.calls.append(messages)
        return {"content": "[]", "new_tokens": 2, "prompt_tokens": 10, "hit_limit": self.hit_limit, "seconds": 0.01}


class WrapperTest(unittest.TestCase):
    def start(self, api_key=KEY, generator=None):
        self.logs = []
        self.generator = generator or FakeGenerator()
        self.server = HTTPServer(("127.0.0.1", 0), srv.make_handler(self.generator, api_key, log=self.logs.append))
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def post(self, body, auth="Bearer " + KEY, path="/v1/chat/completions"):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        headers = {"Content-Type": "application/json"}
        if auth is not None:
            headers["Authorization"] = auth
        conn.request("POST", path, body=json.dumps(body, ensure_ascii=False).encode("utf-8"), headers=headers)
        response = conn.getresponse()
        return response.status, json.loads(response.read().decode("utf-8"))

    def body(self, **over):
        b = {"model": srv.IDENTITY, "messages": [{"role": "system", "content": "s"}, {"role": "user", "content": "Морковь 570 за кг"}],
             "max_tokens": 2048, "temperature": 0, "stream": False}
        b.update(over)
        return b

    def test_answers_with_identity_and_openai_shape(self):
        self.start()
        status, payload = self.post(self.body())
        self.assertEqual(status, 200)
        self.assertEqual(payload["model"], srv.IDENTITY)
        self.assertEqual(payload["choices"][0]["message"]["content"], "[]")
        self.assertEqual(payload["choices"][0]["finish_reason"], "stop")

    def test_token_limit_is_reported(self):
        self.start(generator=FakeGenerator(hit_limit=True))
        self.assertEqual(self.post(self.body())[1]["choices"][0]["finish_reason"], "length")

    def test_requires_the_bearer_key(self):
        self.start()
        for auth in (None, "Bearer " + "x" * 40, KEY, "Bearer " + KEY + "x"):
            status, payload = self.post(self.body(), auth=auth)
            self.assertEqual((status, payload["error"]["code"]), (401, "unauthorized"))
        self.assertEqual(self.generator.calls, [])

    def test_only_the_pinned_configuration(self):
        self.start()
        for over, code in (({"model": "Qwen/Qwen3-4B"}, "unknown_model"), ({"max_tokens": 100}, "max_tokens_fixed"),
                           ({"temperature": 0.7}, "greedy_only"), ({"stream": True}, "stream_not_supported"),
                           ({"messages": []}, "invalid_messages"),
                           ({"messages": [{"role": "tool", "content": "x"}]}, "invalid_messages"),
                           ({"messages": [{"role": "user", "content": "x" * 20001}]}, "invalid_messages")):
            status, payload = self.post(self.body(**over))
            self.assertEqual((status, payload["error"]["code"]), (400, code))
        self.assertEqual(self.generator.calls, [])

    def test_logs_no_body_no_output_no_key(self):
        self.start()
        self.post(self.body())
        self.post(self.body(), auth="Bearer wrong")
        joined = "\n".join(self.logs)
        for secret in ("Морковь", "570", KEY, "[]", "Bearer"):
            self.assertNotIn(secret, joined)
        self.assertEqual(len(self.logs), 2)

    def test_loopback_without_key_only_when_explicitly_allowed(self):
        self.assertIsNone(srv.read_api_key("127.0.0.1", True, environ={}))
        with self.assertRaises(SystemExit):
            srv.read_api_key("127.0.0.1", False, environ={})
        with self.assertRaises(SystemExit):
            srv.read_api_key("0.0.0.0", True, environ={})
        with self.assertRaises(SystemExit):
            srv.read_api_key("127.0.0.1", False, environ={"KAIDA_PARSER_API_KEY": "short"})
        self.assertEqual(srv.read_api_key("0.0.0.0", False, environ={"KAIDA_PARSER_API_KEY": KEY}), KEY)

    def test_no_auth_server_on_loopback(self):
        self.start(api_key=None)
        self.assertEqual(self.post(self.body(), auth=None)[0], 200)


if __name__ == "__main__":
    unittest.main()
