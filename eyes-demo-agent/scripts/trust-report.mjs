// How often do people agree with the AI reviewer? Reads closed pull requests and compares the AI's last verdict
// with what happened next. No extra storage: the PR history is the record.
//   GH_TOKEN=… GITHUB_REPOSITORY=owner/repo node eyes-demo-agent/scripts/trust-report.mjs [how-many-PRs]   → markdown on stdout
//
//   AI said pass → merged                          = agreed (automatic if a bot merged it)
//   AI said fail → code changed afterwards, merged = agreed (the bug was real and got fixed)
//   AI said fail → closed without merging          = agreed (the change was rejected)
//   AI said fail → merged with no further changes  = overridden (a person disagreed with the AI)
const repo = process.env.GITHUB_REPOSITORY;
const limit = Number(process.argv[2] ?? 100);
const api = async (path) => {
  const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`, Accept: 'application/vnd.github+json' },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
};
const verdictOf = (body = '') => {
  if (/Visual review[^\n]*:\s*PASS|## ✅ (Agent 1|AI review)/.test(body)) return 'pass';
  if (/Visual review[^\n]*:\s*FAIL|## ❌ (Agent 1|AI review)/.test(body)) return 'fail';
  return null;
};

const prs = [];
for (let page = 1; prs.length < limit && page <= 5; page++) {
  const batch = await api(`/pulls?state=closed&per_page=50&page=${page}&sort=updated&direction=desc`);
  if (!batch.length) break;
  prs.push(...batch);
}
const rows = [];
for (const pr of prs.slice(0, limit)) {
  const comments = await api(`/issues/${pr.number}/comments?per_page=100`);
  // Agent 1 puts its verdict in the PR description; reviews of developer PRs post it as a comment.
  const last = [{ body: pr.body, created_at: pr.created_at }, ...comments].filter((c) => verdictOf(c.body)).at(-1);
  if (!last) continue;
  const verdict = verdictOf(last.body);
  const commits = await api(`/pulls/${pr.number}/commits?per_page=100`);
  const changedAfter = commits.some((c) => new Date(c.commit.committer.date) > new Date(last.created_at)
    && !/^\[agent\]/.test(c.commit.message));
  const merged = !!pr.merged_at;
  // The PR list leaves out who merged it; the single-PR endpoint has it.
  const mergedBy = merged ? (await api(`/pulls/${pr.number}`)).merged_by : null;
  const byBot = mergedBy?.type === 'Bot' || /\[bot\]$/.test(mergedBy?.login ?? '');
  let outcome;
  if (verdict === 'pass') outcome = merged ? (byBot ? 'agreed · merged automatically' : 'agreed · merged by a person') : 'unclear · closed without merging';
  else if (!merged) outcome = 'agreed · rejected';
  else outcome = changedAfter ? 'agreed · bug fixed, then merged' : 'overridden · merged despite the AI';
  rows.push({ n: pr.number, title: pr.title, verdict, outcome, url: pr.html_url });
}
const agreed = rows.filter((r) => r.outcome.startsWith('agreed')).length;
const overridden = rows.filter((r) => r.outcome.startsWith('overridden')).length;
const auto = rows.filter((r) => r.outcome.includes('automatically')).length;
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : '—');
console.log(`## AI reviewer — trust report

| Reviewed PRs | Agreement with people | Merged with no person needed | Overridden by a person |
|---|---|---|---|
| ${rows.length} | **${pct(agreed, agreed + overridden)}** (${agreed} of ${agreed + overridden}) | ${pct(auto, rows.length)} (${auto}) | ${overridden} |

${overridden ? `### Overridden — worth a look (these teach you where the rules need tuning)\n\n${rows.filter((r) => r.outcome.startsWith('overridden')).map((r) => `- [#${r.n} ${r.title}](${r.url})`).join('\n')}\n` : ''}
### All reviewed PRs

| PR | AI verdict | What happened |
|---|---|---|
${rows.map((r) => `| [#${r.n}](${r.url}) ${r.title.replace(/\|/g, '/')} | ${r.verdict} | ${r.outcome} |`).join('\n')}
`);
