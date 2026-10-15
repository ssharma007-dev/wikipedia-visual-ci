// Show what an Eyes batch was tested on: every test run with its raw environment ( browser, device, OS, viewport ).
//   node eyes-demo-agent/scripts/eyes-batch-info.mjs <batch-url>     ( needs APPLITOOLS_READ_KEY )
import { spawn } from 'node:child_process';
const server = spawn('npx', ['-y', '@applitools/mcp@0.8.5'], { stdio: ['pipe', 'pipe', 'ignore'], env: process.env });
let buf = '', id = 1; const pend = new Map();
server.stdout.on('data', (c) => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i).trim(); buf = buf.slice(i + 1); if (!l) continue; try { const m = JSON.parse(l); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } } catch {} } });
const send = (method, params) => new Promise((res) => { const i = id++; pend.set(i, res); server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: i, method, params }) + '\n'); });
await send('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'eyes-batch-info', version: '1' } });
server.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
const r = await send('tools/call', { name: 'eyes_inspect_sessions', arguments: { workspaceRoot: process.cwd(), batchUrl: process.argv[2] } });
const raw = r.result.content.map((c) => c.text).join(""); if (!raw.trim().startsWith("{")) { console.log(raw.slice(0,600)); process.exit(0); } const t = JSON.parse(raw);
for (const s of t.sessions) console.log(`${s.sessionName} → ${JSON.stringify(s.environment)}`);
console.log(`Session fields: ${Object.keys(t.sessions[0] ?? {}).join(', ')}`);
server.kill(); process.exit(0);
