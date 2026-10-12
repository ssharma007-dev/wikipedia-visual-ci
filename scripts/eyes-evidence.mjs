// Collect before / after / differences-highlighted images for every changed step of an Eyes batch,
// through the Applitools Eyes MCP, so the report shows the changes without opening the dashboard.
// Run it BEFORE baselines are saved (after a save, Eyes reports the steps as matching).
//   node scripts/eyes-evidence.mjs <batch-url> <out-dir>      → <out-dir>/evidence.json + PNGs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [batchUrl, outDir] = process.argv.slice(2);
if (!batchUrl || !outDir) { console.error('Usage: eyes-evidence.mjs <batch-url> <out-dir>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const MAX_AREAS_PER_STEP = 3;
const MAX_ITEMS = 16;
const PAD = 60;

const server = spawn('npx', ['-y', '@applitools/mcp@0.8.5'], { stdio: ['pipe', 'pipe', 'ignore'], env: process.env });
let buffer = '';
let nextId = 1;
const pending = new Map();
server.stdout.on('data', (chunk) => {
  buffer += chunk;
  let i;
  while ((i = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, i).trim();
    buffer = buffer.slice(i + 1);
    if (!line) continue;
    let msg; try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});
const send = (method, params) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, (m) => (m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result)));
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
async function tool(name, args) {
  const res = await send('tools/call', { name, arguments: { workspaceRoot: process.cwd(), ...args } });
  const text = (res.content ?? []).map((c) => c.text ?? '').join('\n').trim();
  if (res.isError) throw new Error(`${name}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}
const copy = (src, name) => {
  const file = String(src).split('\n').map((l) => l.trim()).find((l) => l.endsWith('.png'));
  if (!file || !fs.existsSync(file)) return null;
  const dest = path.join(outDir, name);
  fs.copyFileSync(file, dest);
  return dest;
};
const decision = { accepted: 'accepted', rejected: 'rejected', none: 'unresolved' };

const items = [];
try {
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'eyes-evidence', version: '1' } });
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const url = new URL(batchUrl);
  const batchId = url.pathname.split('/').filter(Boolean).pop();
  const sessionUrl = (sid) => `${url.origin}/app/test-results/${batchId}/${sid}${url.search}`;
  const info = await tool('eyes_inspect_sessions', { batchUrl });

  for (const s of info.sessions) {
    if (items.length >= MAX_ITEMS) break;
    const sUrl = sessionUrl(s.sessionId);
    const steps = (await tool('eyes_inspect_steps', { sessionUrl: sUrl })).steps ?? [];
    for (const [stepIndex, step] of steps.entries()) {
      if (step.isMatching !== false || items.length >= MAX_ITEMS) continue;
      const { areas = [] } = await tool('eyes_inspect_changed_areas', { sessionUrl: sUrl, stepIndex });
      const env = s.environment ?? {};
      const base = {
        test: s.sessionName, step: step.tag, decision: decision[step.resolution] ?? step.resolution ?? 'unresolved',
        environment: `${env.device === 'Desktop' ? env.browser : env.device} · ${env.width}×${env.height}`,
        eyesUrl: `${url.origin}/app/test-results/${batchId}/${s.sessionId}/steps/${stepIndex + 1}${url.search}`,
      };
      const list = areas.length ? areas.slice(0, MAX_AREAS_PER_STEP) : [null];
      for (const [n, a] of list.entries()) {
        if (items.length >= MAX_ITEMS) break;
        const rect = a && {
          left: Math.max(0, a.left - PAD), top: Math.max(0, a.top - PAD),
          width: Math.max(a.width + 2 * PAD, 360), height: Math.max(a.height + 2 * PAD, 160),
        };
        const id = `${items.length + 1}`;
        const args = rect ? { rect } : {};
        const before = step.baseline?.id ? copy(await tool('eyes_inspect_image', { sessionUrl: sUrl, imageId: step.baseline.id, ...args }), `${id}-before.png`) : null;
        const after = step.checkpoint?.id ? copy(await tool('eyes_inspect_image', { sessionUrl: sUrl, imageId: step.checkpoint.id, ...args }), `${id}-after.png`) : null;
        const diff = copy(await tool('eyes_inspect_image_diff', { sessionUrl: sUrl, stepIndex, ...args }), `${id}-diff.png`);
        items.push({ ...base, area: a ? `${a.width}×${a.height} at (${a.left}, ${a.top})` : 'whole step', before, after, diff,
          newTest: !step.baseline?.id });
        console.log(`evidence ${id}: ${s.sessionName} [${base.environment}] ${base.decision}`);
      }
    }
  }
} catch (err) {
  console.error(`Evidence collection stopped: ${err.message}`);
}
fs.writeFileSync(path.join(outDir, 'evidence.json'), JSON.stringify({ batchUrl, items }, null, 2));
console.log(`${items.length} changed area(s) captured → ${path.join(outDir, 'evidence.json')}`);
server.kill();
process.exit(0);
