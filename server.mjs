// Minimal static server for the scraped Wikipedia site.
//   /wikipedia[/<page>]          -> site/wikipedia/pages/<page> (defaults to "index")
//   /assets/wikipedia/<file>     -> site/wikipedia/assets/<file>
// Feature flags: every flag set to true in site/wikipedia/flags.json is applied to the
// pages, using the transforms in flag-definitions.json (same flags as demo-runner).
// Turning a flag on is therefore a code change that can go in a pull request.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'site', 'wikipedia');
const port = Number(process.env.PORT) || 3001;
const definitions = JSON.parse(fs.readFileSync(path.join(root, 'flag-definitions.json'), 'utf-8'));

function flagMarkup() {
  const state = JSON.parse(fs.readFileSync(path.join(root, 'flags.json'), 'utf-8'));
  let css = '';
  let js = '';
  for (const [id, on] of Object.entries(state)) {
    const flag = definitions[id];
    if (!on || !flag) continue;
    const select = `document.querySelectorAll(${JSON.stringify(flag.selector)})`;
    if (flag.action === 'css') {
      const rules = flag.rules ?? [{ property: flag.property, value: flag.value, media: flag.media }];
      for (const r of rules) {
        const decl = `${flag.selector}{${r.property}:${r.value} !important}`;
        css += r.media ? `@media ${r.media}{${decl}}` : decl;
      }
    } else if (flag.action === 'remove') {
      js += `${select}.forEach(function(e){e.remove()});`;
    } else if (flag.action === 'replace') {
      js += `${select}.forEach(function(e){e.innerHTML=${JSON.stringify(flag.value)}});`;
    } else if (flag.action === 'script') {
      js += flag.value;
    }
  }
  return (css ? `<style data-flags>${css}</style>` : '') + (js ? `<script data-flags>${js}</script>` : '');
}

function sendPage(res, file) {
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }
  const html = fs.readFileSync(file, 'utf-8');
  const extra = flagMarkup();
  const last = html.lastIndexOf('</body>');
  const out = !extra ? html : last < 0 ? html + extra : html.slice(0, last) + extra + html.slice(last);
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(out);
}

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
    return sendPage(res, path.join(root, 'pages', page));
  }
  res.writeHead(404).end('Not found');
}).listen(port, () => console.log(`Wikipedia demo site on http://localhost:${port}/wikipedia`));
