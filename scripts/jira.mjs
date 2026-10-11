// Jira Cloud helper for the visual-review pipeline (no dependencies).
//   node scripts/jira.mjs fetch <KEY>                       → prints the ticket as markdown (for the AI)
//   node scripts/jira.mjs comment <KEY> <verdict.json> <pr-url> <batch-url>
//                                                          → posts the AI verdict as a comment on the ticket
// Needs JIRA_BASE_URL (https://<site>.atlassian.net), JIRA_EMAIL and JIRA_API_TOKEN.
import fs from 'node:fs';

const { JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN } = process.env;
const [command, key, ...rest] = process.argv.slice(2);

if (!JIRA_BASE_URL || !JIRA_EMAIL || !JIRA_API_TOKEN) {
  console.error('Jira is not configured (JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN).');
  process.exit(2);
}
if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key ?? '')) {
  console.error(`Not a Jira key: "${key}"`);
  process.exit(2);
}

const base = JIRA_BASE_URL.replace(/\/+$/, '');
const auth = 'Basic ' + Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

async function jira(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) throw new Error(`Jira ${init.method ?? 'GET'} ${path} → ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

// Atlassian Document Format → markdown-ish text, enough for headings, lists, links and tables.
function adfToText(node, depth = 0) {
  if (!node) return '';
  const kids = (sep = '') => (node.content ?? []).map((c) => adfToText(c, depth)).join(sep);
  switch (node.type) {
    case 'doc': return kids('\n\n');
    case 'paragraph': return kids();
    case 'heading': return `${'#'.repeat(Math.min(6, (node.attrs?.level ?? 1) + 1))} ${kids()}`;
    case 'text': {
      const link = node.marks?.find((m) => m.type === 'link');
      return link ? `[${node.text}](${link.attrs.href})` : node.text;
    }
    case 'hardBreak': return '\n';
    case 'bulletList': return (node.content ?? []).map((li) => `${'  '.repeat(depth)}- ${adfToText(li, depth + 1)}`).join('\n');
    case 'orderedList': return (node.content ?? []).map((li, i) => `${'  '.repeat(depth)}${i + 1}. ${adfToText(li, depth + 1)}`).join('\n');
    case 'listItem': return (node.content ?? []).map((c) => adfToText(c, depth)).join('\n');
    case 'codeBlock': return '```\n' + kids() + '\n```';
    case 'inlineCard': case 'blockCard': return node.attrs?.url ?? '';
    case 'table': return (node.content ?? []).map((row) => '| ' + (row.content ?? []).map((cell) => adfToText(cell, depth).replace(/\n/g, ' ')).join(' | ') + ' |').join('\n');
    default: return kids();
  }
}

if (command === 'fetch') {
  const issue = await jira(`/rest/api/3/issue/${key}?fields=summary,description,issuetype,priority,reporter,status,labels`);
  const f = issue.fields;
  console.log(`# ${key} — ${f.summary}

**Type:** ${f.issuetype?.name ?? '-'} · **Priority:** ${f.priority?.name ?? '-'} · **Status:** ${f.status?.name ?? '-'} · **Reporter:** ${f.reporter?.displayName ?? '-'}
**Source:** Jira — ${base}/browse/${key}${f.labels?.length ? `\n**Labels:** ${f.labels.join(', ')}` : ''}

${adfToText(f.description) || '_(no description)_'}`);
} else if (command === 'comment') {
  const [verdictFile, prUrl, batchUrl] = rest;
  const v = JSON.parse(fs.readFileSync(verdictFile, 'utf-8'));
  const pass = v.verdict === 'pass';
  const counts = Object.entries(v.counts ?? {}).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ') || 'no differences';
  const text = (t, marks) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) });
  const link = (t, href) => text(t, [{ type: 'link', attrs: { href } }]);
  const body = {
    type: 'doc', version: 1, content: [
      { type: 'paragraph', content: [text(`${pass ? '✅' : '❌'} Visual review: ${pass ? 'PASS' : 'FAIL'}`, [{ type: 'strong' }]), text(' — posted by Claude, the AI visual reviewer (Applitools Eyes MCP)')] },
      { type: 'paragraph', content: [text(v.summary ?? '')] },
      { type: 'paragraph', content: [text(`Findings: ${counts}.`)] },
      { type: 'paragraph', content: [
        ...(prUrl ? [link('Pull request', prUrl)] : []),
        ...(prUrl && batchUrl ? [text(' · ')] : []),
        ...(batchUrl ? [link('Eyes batch', batchUrl)] : []),
        text(' · Baselines are not saved by the AI — a reviewer saves them in Eyes.'),
      ] },
    ],
  };
  await jira(`/rest/api/3/issue/${key}/comment`, { method: 'POST', body: JSON.stringify({ body }) });
  console.log(`Commented on ${key}`);
} else {
  console.error('Usage: jira.mjs fetch <KEY> | comment <KEY> <verdict.json> <pr-url> <batch-url>');
  process.exit(2);
}
