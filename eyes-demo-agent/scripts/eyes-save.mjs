// Save an Eyes batch through the Applitools Eyes MCP — only when it is safe to.
//   node eyes-demo-agent/scripts/eyes-save.mjs <batch-url>                → saves only if 0 unresolved and 0 failed (rejected) steps
//   node eyes-demo-agent/scripts/eyes-save.mjs <batch-url> --accept-all   → first accepts every unresolved step, then saves
//                                                            (used to refresh main's baseline after an approved auto-merge)
// Exit codes: 0 saved · 3 not saved (reason printed) · 1 error. Needs APPLITOOLS_* keys in the environment.
import { spawn } from 'node:child_process';

const [batchUrl, flag] = process.argv.slice(2);
if (!batchUrl) { console.error('Usage: eyes-save.mjs <batch-url> [--accept-all]'); process.exit(1); }
const acceptAll = flag === '--accept-all';

const server = spawn('npx', ['-y', '@applitools/mcp@0.8.5'], { stdio: ['pipe', 'pipe', 'inherit'], env: process.env });
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
  const text = (res.content ?? []).map((c) => c.text ?? '').join('\n');
  if (res.isError) throw new Error(`${name}: ${text}`);
  try { return JSON.parse(text); } catch { return text; }
}
const done = (code, message) => { console.log(message); server.kill(); process.exit(code); };

try {
  await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'eyes-save', version: '1' } });
  server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  const url = new URL(batchUrl);
  const batchId = url.pathname.split('/').filter(Boolean).pop();
  const sessionUrl = (sessionId) => `${url.origin}/app/test-results/${batchId}/${sessionId}${url.search}`;

  let info = await tool('eyes_inspect_sessions', { batchUrl });
  if (acceptAll) {
    for (const s of info.sessions.filter((x) => x.status === 'Unresolved')) {
      const steps = await tool('eyes_inspect_steps', { sessionUrl: sessionUrl(s.sessionId) });
      for (const [i, step] of (steps.steps ?? []).entries()) {
        if (step.isMatching === false) {
          await tool('eyes_resolve_checkpoint', { sessionUrl: sessionUrl(s.sessionId), stepIndex: i, action: 'accept', propagate: 'none' });
          console.log(`accepted: ${s.sessionName} [${s.environment?.device ?? ''}] step ${i}`);
        }
      }
    }
    info = await tool('eyes_inspect_sessions', { batchUrl });
  }

  const st = info.stats;
  console.log(`batch: total ${st.total}, passed ${st.passed}, failed ${st.failed}, unresolved ${st.unresolved}, unsaved ${st.unsaved}, new ${st.newSteps}`);
  if (st.unresolved > 0) done(3, 'Not saved: unresolved steps need a person.');
  if (st.failed > 0) done(3, 'Not saved: rejected steps (bugs) in the batch.');
  if (st.unsaved === 0 && st.newSteps === 0) done(0, 'Nothing to save — batch already matches its baseline.');
  await tool('eyes_resolve_save', { sessionUrl: sessionUrl(info.sessions[0].sessionId) });
  done(0, 'Saved.');
} catch (err) {
  done(1, `Error: ${err.message}`);
}
