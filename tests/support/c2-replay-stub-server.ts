import { createServer } from 'node:http';
import { createStubState, handleStubRequest } from './c2-replay-stub';

// HTTP wrapper of the replay stub for E2E: `tsx tests/support/c2-replay-stub-server.ts <port>`. Loopback only.
// Requires the bearer key from STUB_PARSER_API_KEY when set. GET /__stats reports the number of completion calls.
const port = Number(process.argv[2] ?? 3199);
const state = createStubState(process.env.STUB_PARSER_API_KEY || null);

createServer(async (req, res) => {
  if (req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(req.url === '/__stats' ? JSON.stringify({ calls: state.calls }) : '{"ok":true}');
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const response = await handleStubRequest(new Request(`http://127.0.0.1:${port}${req.url}`, {
    method: req.method, headers, body: Buffer.concat(chunks),
  }), state);
  res.writeHead(response.status, { 'content-type': 'application/json' });
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, '127.0.0.1');
