// Serves the repository root for the static visual preview: node docs/slices/card-opening-hours/visuals/serve.mjs [port]
// Open http://<your LAN IP>:<port>/docs/slices/card-price-packaging/visuals/index.html on the phone.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const types = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.js': 'text/javascript' };
createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://x');
  let file = decodeURIComponent(url.pathname);
  if (file.startsWith('/kaida/')) file = '/public' + file;
  const full = path.join(root, file);
  if (!full.startsWith(root)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(full);
    response.writeHead(200, { 'content-type': types[path.extname(full)] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end('not found'); }
}).listen(Number(process.argv[2] ?? 3300), '0.0.0.0', () => console.log('preview server on', process.argv[2] ?? 3300));
