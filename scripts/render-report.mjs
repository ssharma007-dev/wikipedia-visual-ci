// Render Agent 1's report.json into a self-contained HTML report (+ a short markdown summary).
// Usage: node scripts/render-report.mjs agent-report/report.json agent-report/report.html agent-report/summary.md [run-url]
import fs from 'node:fs';
import path from 'node:path';

const [jsonPath, htmlPath, mdPath, runUrl = ''] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = (a) => (Array.isArray(a) ? a : a ? [a] : []);
const link = (url, text) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(text)}</a>` : '');

function image(p) {
  if (!p) return '';
  try {
    const data = fs.readFileSync(p).toString('base64');
    return `<img class="evidence" alt="Visual difference evidence" src="data:image/png;base64,${data}">`;
  } catch {
    return `<p class="muted">Evidence image not available (${esc(path.basename(p))}).</p>`;
  }
}

// Test links: GitHub (exact commit + line of the test) and the test's Eyes result.
const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}` : '';
const sha = process.env.REPORT_SHA || '';
function testLine(file, name) {
  try {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    const i = lines.findIndex((l) => /\btest\s*\(/.test(l) && l.includes(name));
    return i >= 0 ? i + 1 : 0;
  } catch { return 0; }
}
function testLinks(t) {
  const out = [];
  if (repoUrl && sha && t.file) {
    const line = testLine(t.file, t.name);
    out.push(link(`${repoUrl}/blob/${sha}/${t.file}${line ? `#L${line}` : ''}`, line ? `Code (line ${line})` : 'Code'));
  }
  if (t.eyesUrl) out.push(link(t.eyesUrl, 'Eyes result'));
  else if (r.tests?.batchUrl) out.push(link(r.tests.batchUrl, 'Eyes batch'));
  return out.join(' · ') || '—';
}

// Before / after / differences images collected from Eyes by scripts/eyes-evidence.mjs.
let evidence = [];
try { evidence = JSON.parse(fs.readFileSync(path.join(path.dirname(jsonPath), 'evidence', 'evidence.json'), 'utf-8')).items ?? []; } catch {}
const decisionTag = (d) => ({ accepted: ['good', 'accepted — real change'], rejected: ['bad', 'rejected — bug'], unresolved: ['info', 'left for a person'] }[d] ?? ['info', d]);
const shot = (p, label) => `<div class="shot"><p class="meta"><b>${label}</b></p>${p ? image(p) : '<p class="muted">Not available</p>'}</div>`;
const visualChanges = evidence.length ? evidence.map((e) => {
  const [tone, text] = decisionTag(e.decision);
  return `<div class="box"><h3>${esc(e.test)} <span class="tag ${tone}">${esc(text)}</span></h3>
<p class="meta">${esc(e.environment)} · step "${esc(e.step)}" · changed area ${esc(e.area)}</p>
<div class="shots">${shot(e.before, e.newTest ? 'Before — no baseline yet (new test)' : 'Before (baseline)')}${shot(e.after, 'After (this change)')}${shot(e.diff, 'Differences highlighted')}</div>
<p class="meta">${link(e.eyesUrl, 'Open this step in Eyes (optional)')}</p></div>`;
}).join('') : '<p class="muted">No visual differences were found against main\'s baseline.</p>';

const verdictLabel = { pass: 'Pass — no visual differences', 'changes-detected': 'Changes detected — all match the task', 'bugs-found': 'Bugs found' }[r.verdict] ?? r.verdict;
const verdictTone = r.verdict === 'bugs-found' ? 'bad' : r.verdict === 'pass' ? 'good' : 'info';
const findings = list(r.findings);
const isReview = r.source === 'pr-review';   // a developer's PR reviewed by the AI (not written by Agent 1)
const who = isReview ? 'AI visual review of the pull request' : 'Agent 1 · visual implementation report';
const bugs = list(r.bugs);
const recs = list(r.baseline?.recommendations);
const count = (cls) => findings.filter((f) => f.class === cls).length;

const evidenceBlock = (e = {}) => `
  ${image(e.imageDiff)}
  <p class="meta">${link(e.eyesUrl, 'Open this step in Eyes')}${e.dom ? ` · DOM: <code>${esc(e.dom)}</code>` : ''}</p>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(r.task?.key)} visual report</title>
<style>
:root{--bg:#f7f6f2;--card:#fdfdfb;--ink:#14213d;--muted:#5b6474;--line:#dce1e4;--good:#0b6e4f;--good-bg:#d9f2e6;--bad:#a1341a;--bad-bg:#fbe3d9;--info:#1f4e8c;--info-bg:#dfe9f7;--code:#eef1f4}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#11161f;--card:#18202c;--ink:#e8edf4;--muted:#9aa6b6;--line:#2a3443;--good:#7fd9b4;--good-bg:#173a2f;--bad:#f3a088;--bad-bg:#43251c;--info:#9cc2f5;--info-bg:#1c2d45;--code:#222c3a}}
:root[data-theme="dark"]{--bg:#11161f;--card:#18202c;--ink:#e8edf4;--muted:#9aa6b6;--line:#2a3443;--good:#7fd9b4;--good-bg:#173a2f;--bad:#f3a088;--bad-bg:#43251c;--info:#9cc2f5;--info-bg:#1c2d45;--code:#222c3a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px 64px}h1{font-size:28px;margin:0 0 4px}h2{font-size:20px;margin:36px 0 12px}h3{font-size:17px;margin:0 0 6px}
.muted,.meta{color:var(--muted)}.meta{font-size:14px;margin:6px 0 0}a{color:var(--info)}code{background:var(--code);padding:1px 6px;border-radius:4px;font-size:14px}
.pill{display:inline-block;padding:6px 14px;border-radius:999px;font-weight:600;margin:12px 0}.good{background:var(--good-bg);color:var(--good)}.bad{background:var(--bad-bg);color:var(--bad)}.info{background:var(--info-bg);color:var(--info)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.num{font-size:30px;font-weight:700}.shots{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:8px}.shot img.evidence{margin-top:4px;width:100%}@media (max-width:700px){.shots{grid-template-columns:1fr}}@media print{.shots{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.shot img.evidence{max-height:260px;object-fit:contain}.shot .meta{font-size:11px}}.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px;margin:12px 0}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:15px}th,td{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{background:var(--code)}
img.evidence{max-width:100%;border:1px solid var(--line);border-radius:8px;margin-top:10px;background:#fff}.tag{font-size:13px;font-weight:600;padding:2px 8px;border-radius:6px}
ul{margin:6px 0 0;padding-left:20px}.wrap{overflow-x:auto}
@media print{:root{--bg:#ffffff;--card:#ffffff;--ink:#14213d;--muted:#4a5568;--line:#cfd6dc;--code:#eef1f4}main{padding:0;max-width:none}.box,.card,tr,img.evidence{break-inside:avoid}h2{break-after:avoid}a{color:#1f4e8c}}
</style></head><body><main>
<p class="muted">${who}</p>
<h1>${esc(r.task?.key)} — ${esc(r.task?.title)}</h1>
<p class="meta">Work type <b>${esc(r.task?.workType ?? 'feature')}</b> · Task file <code>${esc(r.task?.file)}</code>${runUrl ? ` · ${link(runUrl, 'CI run')}` : ''}${r.tests?.batchUrl ? ` · ${link(r.tests.batchUrl, 'Eyes batch')}` : ''}</p>
<span class="pill ${verdictTone}">${esc(verdictLabel)}</span>

<div class="cards">
  <div class="card"><div class="num">${count('real-change')}</div>real changes</div>
  <div class="card"><div class="num">${bugs.length}</div>bugs</div>
  <div class="card"><div class="num">${recs.length}</div>baseline recommendations</div>
  <div class="card"><div class="num">${r.baseline?.saved ? 'Yes' : 'No'}</div>baselines saved</div>
</div>

<h2>Summary</h2>
<div class="box"><h3>Real changes</h3>${list(r.summary?.realChanges).length ? `<ul>${list(r.summary.realChanges).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">None.</p>'}</div>
<div class="box"><h3>Bugs</h3>${list(r.summary?.bugs).length ? `<ul>${list(r.summary.bugs).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">None found.</p>'}</div>
<div class="box"><h3>${r.baseline?.saved ? 'Agent notes — baselines were saved automatically, no action needed' : 'Next steps for the reviewer'}</h3>${list(r.summary?.nextSteps).length ? `<ul>${list(r.summary.nextSteps).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">—</p>'}</div>

<h2>Bugs found — evidence and fixes</h2>
${bugs.length ? bugs.map((b) => `<div class="box"><h3>${esc(b.title)} <span class="tag bad">${esc(b.severity)}</span></h3>
<p><b>Why it is a bug:</b> ${esc(b.whyBug)}</p><p class="meta">Rule: ${esc(b.guidelineRef)}</p><p><b>How to fix:</b> ${esc(b.fix)}</p>${evidenceBlock(b.evidence)}</div>`).join('') : '<p class="muted">No bugs found.</p>'}

<h2>Visual changes — before, after and differences</h2>
${visualChanges}

${r.bugTicket ? `<h2>Bug: reproduce → fix</h2>
<div class="box"><p><b>Reproduced:</b> ${r.bugTicket.reproduced ? 'yes' : 'no'}</p><p><b>Root cause:</b> ${esc(r.bugTicket.rootCause)}</p>
${r.bugTicket.regressionTest ? `<p><b>Regression test:</b> <code>${esc(r.bugTicket.regressionTest)}</code></p>` : ''}
<div class="cards"><div><h3>Before (bug)</h3>${image(r.bugTicket.before)}</div><div><h3>After (fixed)</h3>${image(r.bugTicket.after)}</div></div></div>` : ''}

<h2>${isReview ? 'What the pull request changes' : 'What was implemented'}</h2>
<div class="box"><p>${esc(r.implementation?.summary)}</p>
${list(r.implementation?.files).length ? `<ul>${list(r.implementation.files).map((f) => `<li><code>${esc(f.path)}</code> — ${esc(f.change)}</li>`).join('')}</ul>` : ''}</div>

<h2>Tests</h2>
<div class="wrap"><table><tr><th>Test</th><th>Why</th><th>Links</th></tr>
${list(r.tests?.relevant).map((t) => `<tr><td>${esc(t.name)} <span class="tag info">relevant</span><br><code>${esc(t.file)}</code></td><td>${esc(t.why)}</td><td>${testLinks(t)}</td></tr>`).join('')}
${list(r.tests?.added).map((t) => `<tr><td>${esc(t.name)} <span class="tag good">new</span><br><code>${esc(t.file)}</code></td><td>${esc(t.why)}</td><td>${testLinks(t)}</td></tr>`).join('')}
</table></div>
<p class="meta">Command <code>${esc(r.tests?.command)}</code> · result <b>${esc(r.tests?.result)}</b></p>

<h2>Findings</h2>
${findings.length ? findings.map((f) => `<div class="box"><h3>${esc(f.title)} <span class="tag ${f.class === 'bug' ? 'bad' : f.class === 'real-change' ? 'good' : 'info'}">${esc(f.class)}</span> <span class="tag info">${esc(f.decision)}</span></h3>
<p class="meta">${esc(list(f.environments).join(', '))}</p><p>${esc(f.why)}</p>${evidenceBlock(f.evidence)}</div>`).join('') : '<p class="muted">No visual differences.</p>'}

<h2>Baseline recommendations</h2>
${recs.length ? `<div class="wrap"><table><tr><th>Step</th><th>Environments</th><th>Recommended action</th><th>Why</th></tr>
${recs.map((x) => `<tr><td>${esc(x.step)}</td><td>${esc(list(x.environments).join(', '))}</td><td><b>${esc(x.action)}</b></td><td>${esc(x.why)}</td></tr>`).join('')}</table></div>` : '<p class="muted">No baseline changes recommended.</p>'}
<p class="meta">Marked in Eyes: <b>${r.baseline?.updatedInEyes ? 'yes' : 'no'}</b> · Saved: <b>${r.baseline?.saved ? 'yes' : 'no — a person saves after review'}</b>${r.baseline?.note ? ` · ${esc(r.baseline.note)}` : ''}</p>

</main></body></html>`;

fs.writeFileSync(htmlPath, html);

const md = `## ${r.verdict === 'bugs-found' ? '❌' : '✅'} ${isReview ? 'AI review' : 'Agent 1'} — ${r.task?.key}: ${verdictLabel}

**Implemented:** ${r.implementation?.summary ?? '—'}

| Real changes | Bugs | Baseline recommendations | Baselines saved |
|---|---|---|---|
| ${count('real-change')} | ${bugs.length} | ${recs.length} | ${r.baseline?.saved ? 'yes' : 'no — a person saves'} |

${list(r.summary?.realChanges).map((x) => `- ✅ ${x}`).join('\n')}
${list(r.summary?.bugs).map((x) => `- ❌ ${x}`).join('\n')}

**Next steps:** ${list(r.summary?.nextSteps).join(' · ') || '—'}

📄 **PDF + HTML report** (bugs with evidence and fixes, baseline reasoning): attached to the Jira ticket, and in the \`agent-report\` artifact of ${runUrl ? `[this run](${runUrl})` : 'the CI run'}.${r.tests?.batchUrl ? ` · [Eyes batch](${r.tests.batchUrl})` : ''}
`;
fs.writeFileSync(mdPath, md);
console.log(`Report: ${htmlPath}`);
