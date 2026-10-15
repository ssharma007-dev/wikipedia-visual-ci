// Collect before / after / differences-highlighted images for every changed step of an Eyes batch,
// through the Applitools Eyes MCP, so the report shows the changes without opening the dashboard.
// Run it BEFORE baselines are saved (after a save, Eyes reports the steps as matching).
//   node eyes-demo-agent/scripts/eyes-evidence.mjs <batch-url> <out-dir>      → <out-dir>/evidence.json + PNGs
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [batchUrl, outDir] = process.argv.slice(2);
if (!batchUrl || !outDir) { console.error('Usage: eyes-evidence.mjs <batch-url> <out-dir>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const MAX_AREAS_PER_STEP = 3;
const MAX_ITEMS = 16;
const PAD = 120;          // context around each change, so small changes are readable in the PDF
const MIN_W = 640, MIN_H = 300;

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
// Counts for the report's "Results at a glance": every checkpoint in the batch, not only the ones with images.
// One entry per environment the batch ran on ( browser + version, device, OS, viewport ), from the Eyes MCP.
const environments = new Map();
const screens = new Set();
const stats = { tests: 0, checkpoints: 0, noDifference: 0, differences: 0, accepted: 0, rejected: 0, unresolved: 0, newCheckpoints: 0 };
try {
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'eyes-evidence', version: '1' } });
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const url = new URL(batchUrl);
  const batchId = url.pathname.split('/').filter(Boolean).pop();
  const sessionUrl = (sid) => `${url.origin}/app/test-results/${batchId}/${sid}${url.search}`;
  const info = await tool('eyes_inspect_sessions', { batchUrl });

  for (const s of info.sessions) {
    stats.tests++;
    screens.add(s.sessionName);
    const e = s.environment ?? {};
    const envKey = `${e.device}|${e.browser}|${e.os}|${e.width}x${e.height}`;
    if (!environments.has(envKey)) environments.set(envKey, {
      device: e.device === 'Desktop' ? 'Desktop' : e.device, browser: e.browser, os: e.os,
      viewport: `${e.width}×${e.height}`, emulated: e.device && e.device !== 'Desktop', checkpoints: 0, differences: 0 });
    const envStats = environments.get(envKey);
    const sUrl = sessionUrl(s.sessionId);
    const steps = (await tool('eyes_inspect_steps', { sessionUrl: sUrl })).steps ?? [];
    for (const [stepIndex, step] of steps.entries()) {
      stats.checkpoints++; envStats.checkpoints++;
      if (!step.baseline?.id) stats.newCheckpoints++;
      if (step.isMatching !== false) { stats.noDifference++; continue; }
      stats.differences++; envStats.differences++;
      const d = decision[step.resolution] ?? 'unresolved';
      stats[d in stats ? d : 'unresolved']++;
      if (items.length >= MAX_ITEMS) continue;
      const { areas = [] } = await tool('eyes_inspect_changed_areas', { sessionUrl: sUrl, stepIndex });
      const env = s.environment ?? {};
      const base = {
        test: s.sessionName, step: step.tag, decision: decision[step.resolution] ?? step.resolution ?? 'unresolved',
        environment: env.device === 'Desktop' ? `${env.browser} · ${env.os} · viewport ${env.width}×${env.height}` : `${env.device} ( emulated in ${env.browser} ) · ${env.os} · viewport ${env.width}×${env.height}`,
        eyesUrl: `${url.origin}/app/test-results/${batchId}/${s.sessionId}/steps/${stepIndex + 1}${url.search}`,
      };
      const list = areas.length ? areas.slice(0, MAX_AREAS_PER_STEP) : [null];
      for (const [n, a] of list.entries()) {
        if (items.length >= MAX_ITEMS) break;
        // Centre small changes in a crop of at least MIN_W × MIN_H, so a one-word change still shows its surroundings.
        // Never wider than the screen it came from (a phone is ~384px wide).
        const screenW = env.width || Infinity;
        const big = a && (() => {
          const width = Math.min(Math.max(a.width + 2 * PAD, MIN_W), screenW), height = Math.max(a.height + 2 * PAD, MIN_H);
          const left = Math.min(Math.max(0, Math.round(a.left + a.width / 2 - width / 2)), Math.max(0, screenW - width));
          return { left, top: Math.max(0, Math.round(a.top + a.height / 2 - height / 2)), width, height };
        })();
        const small = a && { left: Math.max(0, a.left - 60), top: Math.max(0, a.top - 60), width: a.width + 120, height: a.height + 120 };
        const id = `${items.length + 1}`;
        // Try the roomy crop first; if Eyes rejects it (e.g. past the image edge), fall back to a tight one.
        const grab = async (fn) => { for (const rect of [big, small, null]) { try { return await fn(rect ? { rect } : {}); } catch {} } return null; };
        const before = step.baseline?.id ? copy(await grab((x) => tool('eyes_inspect_image', { sessionUrl: sUrl, imageId: step.baseline.id, ...x })), `${id}-before.png`) : null;
        const after = step.checkpoint?.id ? copy(await grab((x) => tool('eyes_inspect_image', { sessionUrl: sUrl, imageId: step.checkpoint.id, ...x })), `${id}-after.png`) : null;
        const diff = copy(await grab((x) => tool('eyes_inspect_image_diff', { sessionUrl: sUrl, stepIndex, ...x })) ?? '', `${id}-diff.png`);
        items.push({ ...base, area: a ? `${a.width}×${a.height} at (${a.left}, ${a.top})` : 'whole step', before, after, diff,
          newTest: !step.baseline?.id });
        console.log(`evidence ${id}: ${s.sessionName} [${base.environment}] ${base.decision}`);
      }
    }
  }
} catch (err) {
  console.error(`Evidence collection stopped: ${err.message}`);
}
fs.writeFileSync(path.join(outDir, 'evidence.json'), JSON.stringify({ batchUrl, stats: { ...stats, screens: screens.size, environments: [...environments.values()] }, items }, null, 2));
console.log(`Batch: ${JSON.stringify(stats)}`);
console.log(`${items.length} changed area(s) captured → ${path.join(outDir, 'evidence.json')}`);
server.kill();
process.exit(0);
