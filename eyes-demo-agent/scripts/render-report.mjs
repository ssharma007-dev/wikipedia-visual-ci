// Render Agent 1's report.json into a self-contained HTML report (+ a short markdown summary).
// Usage: node eyes-demo-agent/scripts/render-report.mjs agent-report/report.json agent-report/report.html agent-report/summary.md [run-url]
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

// Before / after / differences images collected from Eyes by eyes-demo-agent/scripts/eyes-evidence.mjs.
let evidence = [];
try { evidence = JSON.parse(fs.readFileSync(path.join(path.dirname(jsonPath), 'evidence', 'evidence.json'), 'utf-8')).items ?? []; } catch {}
let batchStats = null, testStats = null;
try { batchStats = JSON.parse(fs.readFileSync(path.join(path.dirname(jsonPath), 'evidence', 'evidence.json'), 'utf-8')).stats ?? null; } catch {}
try { testStats = JSON.parse(fs.readFileSync(path.join(path.dirname(jsonPath), 'test-stats.json'), 'utf-8')); } catch {}
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
const fixed = list(r.fixHistory).flatMap((h) => list(h.bugs).map((b) => ({ ...b, round: h.round, batchUrl: h.batchUrl })));
const fixedCount = fixed.filter((b) => b.fixed).length;
const count = (cls) => findings.filter((f) => f.class === cls).length;

const evidenceBlock = (e = {}) => `
  ${image(e.imageDiff)}
  <p class="meta">${link(e.eyesUrl, 'Open this step in Eyes')}${e.dom ? ` · DOM: <code>${esc(e.dom)}</code>` : ''}</p>`;

// ---------- Summary ( page 1 ) ----------
// Time: the run's start ( RUN_STARTED_AT, set by CI ) to now; AI time: the agent transcripts' own durations.
const started = process.env.RUN_STARTED_AT ? new Date(process.env.RUN_STARTED_AT) : null;
const finished = new Date();
const mins = (ms) => `${Math.max(1, Math.round(ms / 60000))} min`;
const hhmm = (d) => d.toISOString().slice(11, 16) + ' UTC';
let aiMs = 0;
for (const f of fs.readdirSync(path.dirname(jsonPath)).filter((x) => /^agent-transcript.*\.jsonl$/.test(x))) {
  for (const line of fs.readFileSync(path.join(path.dirname(jsonPath), f), 'utf-8').split('\n')) {
    if (!line.includes('"type":"result"')) continue;
    try { aiMs += JSON.parse(line).duration_ms ?? 0; } catch {}
  }
}
const sev = (lvl) => bugs.filter((b) => (b.severity ?? '').toLowerCase() === lvl).length;
const failedCount = testStats?.failed ?? list(r.failedTests).length;
const unresolved = batchStats?.unresolved ?? 0;
const humanReview = /human-review/.test(process.env.REVIEW_MODE ?? '') || process.env.REVIEW_MODE === 'manual';
const risk = (bugs.some((b) => /high|critical/i.test(b.severity ?? '')) || failedCount) ? ['bad', 'High']
  : (bugs.length || unresolved) ? ['info', 'Medium'] : ['good', 'Low'];
const policy = process.env.MERGE_POLICY || 'auto';
const outcome = r.baseline?.saved && !bugs.length && !failedCount && !unresolved && !humanReview
  ? (policy === 'code-approval' ? ['good', 'Passed: waits for one code approval, then merges automatically'] : ['good', 'Passed: merged automatically, ticket moves to Done'])
  : ['bad', `Waiting for a person ( ${[bugs.length ? `${bugs.length} bug(s) left` : '', failedCount ? `${failedCount} failed functional check(s)` : '', unresolved ? `${unresolved} unclear difference(s)` : '', humanReview ? 'human-review label' : ''].filter(Boolean).join(', ') || 'see below'} ): ticket moves to In Review`];
const minutesPerCheckpoint = Number(process.env.REPORT_MINUTES_PER_CHECKPOINT || 2);
const reviewedByAi = batchStats ? batchStats.checkpoints : 0;
const jiraUrl = process.env.JIRA_BASE_URL && r.task?.key ? `${process.env.JIRA_BASE_URL.replace(/\/+$/, '')}/browse/${r.task.key}` : '';
const leaderRows = [
  ['Outcome', `<span class="tag ${outcome[0]}">${esc(outcome[1])}</span>`],
  ['Risk', `<span class="tag ${risk[0]}">${risk[1]}</span> <span class="meta">based on bugs left, failed checks and unclear differences</span>`],
  started ? ['Time', `Started ${hhmm(started)} · finished ${hhmm(finished)} · <b>${mins(finished - started)}</b> in total${aiMs ? ` · AI work ${mins(Math.min(aiMs, finished - started))}` : ''}`] : null,
  ['Coverage', [batchStats?.screens ? `<b>${batchStats.screens}</b> screens` : '', batchStats?.environments?.length ? `<b>${batchStats.environments.length}</b> environments` : '', batchStats ? `<b>${batchStats.checkpoints}</b> visual checkpoints` : '', testStats ? `<b>${testStats.total}</b> test cases${list(r.tests?.added).length ? ` ( ${list(r.tests.added).length} new )` : ''}` : ''].filter(Boolean).join(' · ') || '—'],
  ['Quality', [testStats ? `Functional checks <b>${testStats.passed}/${testStats.total}</b> passed ( ${testStats.total ? Math.round(100 * testStats.passed / testStats.total) : 0}% )` : '', `Bugs left: <b>${bugs.length}</b>${bugs.length ? ` ( high ${sev('high') + sev('critical')} · medium ${sev('medium')} · low ${sev('low')} )` : ''}`, `fixed by the AI: <b>${fixedCount}</b>`].filter(Boolean).join(' · ')],
  batchStats ? ['AI decisions', `<b>${batchStats.accepted}</b> accepted as real change · <b>${batchStats.rejected}</b> rejected as bug · <b>${batchStats.unresolved}</b> left for a person`] : null,
  reviewedByAi ? ['Manual review saved ( estimate )', `${reviewedByAi} checkpoints reviewed by the AI ≈ <b>${mins(reviewedByAi * minutesPerCheckpoint * 60000)}</b> of manual comparison <span class="meta">( ${minutesPerCheckpoint} min per checkpoint )</span>`] : null,
  ['Traceability', [jiraUrl ? link(jiraUrl, `Jira ${r.task.key}`) : esc(r.task?.key ?? ''), process.env.PR_URL ? link(process.env.PR_URL, 'Pull request') : '', repoUrl && sha ? link(`${repoUrl}/commit/${sha}`, `Commit ${sha.slice(0, 7)}`) : '', r.tests?.batchUrl ? link(r.tests.batchUrl, 'Eyes batch') : '', runUrl ? link(runUrl, 'CI run') : ''].filter(Boolean).join(' · ')],
].filter(Boolean);
const leaderSummary = `<h2>Summary</h2>
<div class="wrap"><table>${leaderRows.map(([k, v]) => `<tr><th style="width:28%">${k}</th><td>${v}</td></tr>`).join('')}</table></div>`;

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

${leaderSummary}
<div style="height:20px"></div>


<div class="cards">
  <div class="card"><div class="num">${count('real-change')}</div>real changes</div>
  <div class="card"><div class="num">${bugs.length}</div>bugs left</div>
  ${fixed.length ? `<div class="card"><div class="num">${fixedCount}</div>bugs fixed by the AI</div>` : ''}
  <div class="card"><div class="num">${recs.length}</div>baseline recommendations</div>
  <div class="card"><div class="num">${r.baseline?.saved ? 'Yes' : 'No'}</div>baselines saved</div>
</div>

${(testStats || batchStats || fixed.length || bugs.length) ? `<h2>Results at a glance</h2>
<div class="wrap"><table><tr><th>Area</th><th>Result</th></tr>
${testStats ? `<tr><td>Test cases ( Playwright )</td><td><b>${testStats.total}</b> run · <b>${testStats.passed}</b> passed · <b>${testStats.failed}</b> failed${testStats.skipped ? ` · ${testStats.skipped} skipped` : ''}</td></tr>` : ''}
${batchStats ? `<tr><td>Visual checkpoints ( Applitools Eyes )</td><td><b>${batchStats.checkpoints}</b> checked · <b>${batchStats.noDifference}</b> no difference · <b>${batchStats.differences}</b> with differences${batchStats.newCheckpoints ? ` · ${batchStats.newCheckpoints} new` : ''}</td></tr>
<tr><td>Differences, decided by the AI</td><td><b>${batchStats.accepted}</b> accepted as real change · <b>${batchStats.rejected}</b> rejected as bug · <b>${batchStats.unresolved}</b> left for a person</td></tr>` : ''}
${batchStats?.environments?.length ? `<tr><td>Tested on ( Applitools Ultrafast Grid )</td><td><table><tr><th>Device</th><th>Browser</th><th>OS</th><th>Viewport</th><th>Checkpoints</th><th>With differences</th></tr>${batchStats.environments.map((e) => `<tr><td>${esc(e.device)}${e.emulated ? ' ( emulated )' : ''}</td><td>${esc(e.browser)}</td><td>${esc(e.os)}</td><td>${esc(e.viewport)}</td><td>${e.checkpoints}</td><td>${e.differences}</td></tr>`).join('')}</table></td></tr>` : ''}
<tr><td>Bugs</td><td><b>${bugs.length + fixedCount}</b> found · <b>${fixedCount}</b> fixed by the AI · <b>${bugs.length}</b> left</td></tr>
<tr><td>Baselines</td><td>${r.baseline?.saved ? 'saved in Eyes' : 'not saved yet, a person saves after review'}</td></tr>
</table></div>` : ''}

<h2>Changes and bugs</h2>
<div class="box"><h3>Real changes</h3>${list(r.summary?.realChanges).length ? `<ul>${list(r.summary.realChanges).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">None.</p>'}</div>
<div class="box"><h3>Bugs</h3>${list(r.summary?.bugs).length ? `<ul>${list(r.summary.bugs).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">None found.</p>'}</div>
<div class="box"><h3>${r.baseline?.saved ? 'Agent notes — baselines were saved automatically, no action needed' : 'Next steps for the reviewer'}</h3>${list(r.summary?.nextSteps).length ? `<ul>${list(r.summary.nextSteps).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">—</p>'}</div>

${list(r.failedTests).length ? `<h2>Functional checks that failed</h2>
<p class="muted">These Playwright assertions failed. The pull request cannot merge until they pass.</p>
${list(r.failedTests).map((t) => `<div class="box"><h3>${esc(t.name)} <span class="tag bad">failed</span></h3><p class="meta"><code>${esc(t.file)}:${esc(t.line)}</code></p><pre style="white-space:pre-wrap;font-size:13px">${esc(t.error)}</pre></div>`).join('')}` : ''}

<h2>Bugs found — evidence and fixes</h2>
${bugs.length ? bugs.map((b) => `<div class="box"><h3>${esc(b.title)} <span class="tag bad">${esc(b.severity)}</span></h3>
<p><b>Why it is a bug:</b> ${esc(b.whyBug)}</p><p class="meta">Rule: ${esc(b.guidelineRef)}</p><p><b>How to fix:</b> ${esc(b.fix)}</p>${evidenceBlock(b.evidence)}</div>`).join('') : '<p class="muted">No bugs found.</p>'}

${fixed.length ? `<h2>Bugs the AI found and fixed by itself</h2>
<p class="muted">The AI rejected these in Eyes, fixed the code, ran the tests again in a new Eyes batch and reviewed the result.</p>
${fixed.map((b) => `<div class="box"><h3>${esc(b.title)} <span class="tag ${b.fixed ? 'good' : 'bad'}">${b.fixed ? 'fixed' : 'still present'}</span> <span class="tag info">fix round ${esc(b.round)}</span></h3>
<p><b>Why it was a bug:</b> ${esc(b.whyBug)}</p>${b.rootCause ? `<p><b>Root cause:</b> ${esc(b.rootCause)}</p>` : ''}<p><b>What the AI changed:</b> ${esc(b.change)}</p>
${evidenceBlock(b.evidence)}${b.batchUrl ? `<p class="meta">${link(b.batchUrl, 'Eyes batch after the fix')}</p>` : ''}</div>`).join('')}` : ''}

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

| Real changes | Bugs left | Bugs fixed by the AI | Baseline recommendations | Baselines saved |
|---|---|---|---|---|
| ${count('real-change')} | ${bugs.length} | ${fixedCount} | ${recs.length} | ${r.baseline?.saved ? 'yes' : 'no — a person saves'} |

${list(r.summary?.realChanges).map((x) => `- ✅ ${x}`).join('\n')}
${list(r.summary?.bugs).map((x) => `- ❌ ${x}`).join('\n')}

${testStats ? `**Tests:** ${testStats.total} run, ${testStats.passed} passed, ${testStats.failed} failed. ` : ''}${batchStats ? `**Visual checkpoints:** ${batchStats.checkpoints} checked, ${batchStats.differences} with differences (${batchStats.accepted} accepted, ${batchStats.rejected} rejected, ${batchStats.unresolved} left for a person).` : ''}${batchStats?.environments?.length ? ` **Tested on:** ${batchStats.environments.map((e) => `${e.device}${e.emulated ? ' (emulated)' : ''} · ${e.browser} · ${e.os} · ${e.viewport}`).join('; ')}.` : ''}

**Next steps:** ${list(r.summary?.nextSteps).join(' · ') || '—'}

📄 **PDF + HTML report** (bugs with evidence and fixes, baseline reasoning): attached to the Jira ticket, and in the \`agent-report\` artifact of ${runUrl ? `[this run](${runUrl})` : 'the CI run'}.${r.tests?.batchUrl ? ` · [Eyes batch](${r.tests.batchUrl})` : ''}
`;
fs.writeFileSync(mdPath, md);
console.log(`Report: ${htmlPath}`);
