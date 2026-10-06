// Minimal static server for the scraped Wikipedia site.
//   /wikipedia[/<page>]          -> site/wikipedia/pages/<page> (defaults to "index")
//   /assets/wikipedia/<file>     -> site/wikipedia/assets/<file>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site', 'wikipedia');
const port = Number(process.env.PORT) || 3001;

const types = {
  '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function send(res, file, type) {
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': type });
  fs.createReadStream(file).pipe(res);
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const urlPath = decodeURIComponent(pathname);

  if (urlPath.startsWith('/assets/wikipedia/')) {
    const file = path.join(root, 'assets', path.basename(urlPath));
    return send(res, file, types[path.extname(file)] ?? 'application/octet-stream');
  }
  if (urlPath === '/wikipedia' || urlPath.startsWith('/wikipedia/')) {
    const page = urlPath.replace(/^\/wikipedia\/?/, '') || 'index';
    return send(res, path.join(root, 'pages', page), 'text/html; charset=utf-8');
  }
  res.writeHead(404).end('Not found');
}).listen(port, () => console.log(`Wikipedia demo site on http://localhost:${port}/wikipedia`));
