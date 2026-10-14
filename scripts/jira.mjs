// Jira Cloud helper for the visual-review pipeline (no dependencies).
//   node scripts/jira.mjs fetch <KEY>                       → prints the ticket as markdown (for the AI)
//   node scripts/jira.mjs comment <KEY> <verdict.json> <pr-url> <batch-url>
//                                                          → posts the AI verdict as a comment on the ticket
//   node scripts/jira.mjs labels <KEY>                      → prints the ticket's labels (comma-separated)
//   node scripts/jira.mjs type <KEY>                        → feature | bug | hotfix | refactor | chore | content | experiment | a11y | revert
//   node scripts/jira.mjs subtask <KEY> <summary> <file>    → creates a sub-task under <KEY>, prints its key
//   node scripts/jira.mjs transition <KEY> <status name>    → moves the ticket (e.g. "In Review")
//   node scripts/jira.mjs note <KEY> <file>                 → posts a plain-text comment
//   node scripts/jira.mjs attach <KEY> <file> [name]        → attaches a file (e.g. the PDF report)
//   node scripts/jira.mjs create <PROJECT>-0 <summary> <description.md> [labels] → creates a ticket, prints its key
//   node scripts/jira.mjs inspect <KEY>                     → status, labels, attachments, last comments
//   node scripts/jira.mjs needs-human <KEY> on|off          → label needs-human (+ assign to the reporter), or clear it
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
} else if (command === 'type') {
  // Work type for the agent: from the issue type, then labels.
  const f = (await jira(`/rest/api/3/issue/${key}?fields=issuetype,labels,priority`)).fields;
  const labels = (f.labels ?? []).map((l) => l.toLowerCase());
  const it = (f.issuetype?.name ?? '').toLowerCase();
  const order = ['hotfix', 'bug', 'refactor', 'chore', 'content', 'experiment', 'a11y', 'revert'];
  const fromLabel = order.find((t) => labels.includes(t));
  console.log(fromLabel === 'hotfix' ? 'hotfix' : it === 'bug' ? 'bug' : fromLabel ?? 'feature');
} else if (command === 'subtask') {
  // Create a sub-task under <KEY>: subtask <KEY> <summary> <description-file> [labels,comma,separated]
  const [summary, file, labelArg] = rest;
  const labels = labelArg ? labelArg.split(',').filter(Boolean) : ['visual', 'bug', 'found-by-agent'];
  const fixedByAi = labels.includes('fixed-by-ai');
  // Re-runs must not create the same bug twice: reuse an open sub-task with the same summary.
  const existing = ((await jira(`/rest/api/3/issue/${key}?fields=subtasks`)).fields.subtasks ?? [])
    // A bug the AI already fixed is a record, so it is not repeated even when Done.
    .find((t) => t.fields?.summary === summary.slice(0, 250) && (fixedByAi || t.fields?.status?.statusCategory?.key !== 'done'));
  if (existing) { console.log(`${existing.key} (already exists — not created again)`); process.exit(0); }
  const lines = fs.readFileSync(file, 'utf-8').split('\n').filter((l) => l.trim());
  const project = key.split('-')[0];
  const types = (await jira(`/rest/api/3/project/${project}`)).issueTypes;
  const sub = types.find((t) => t.subtask);
  const body = { fields: { project: { key: project }, parent: { key }, issuetype: { id: sub.id }, summary: summary.slice(0, 250), labels,
    description: { type: 'doc', version: 1, content: lines.map((l) => ({ type: 'paragraph', content: [{ type: 'text', text: l }] })) } } };
  const created = await jira('/rest/api/3/issue', { method: 'POST', body: JSON.stringify(body) });
  console.log(created.key);
} else if (command === 'attach') {
  // Attach a file to the ticket: attach <KEY> <file> [name]
  const [file, name] = rest;
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), name ?? file.split('/').pop());
  const res = await fetch(`${base}/rest/api/3/issue/${key}/attachments`, { method: 'POST', headers: { Authorization: auth, 'X-Atlassian-Token': 'no-check' }, body: form });
  if (!res.ok) throw new Error(`Jira attach → ${res.status} ${await res.text()}`);
  const [att] = await res.json();
  console.log(`Attached ${att.filename} to ${key}`);
  console.log(`ATTACHMENT_URL=${base}/secure/attachment/${att.id}/${encodeURIComponent(att.filename)}`);
} else if (command === 'needs-human') {
  // needs-human <KEY> on|off → add (or remove) the label needs-human; "on" also assigns the ticket to its reporter,
  // so the person who asked for the change is notified that a decision is waiting.
  const on = (rest[0] ?? 'on') !== 'off';
  const f = (await jira(`/rest/api/3/issue/${key}?fields=reporter,assignee`)).fields;
  const fields = on && f.reporter?.accountId ? { assignee: { accountId: f.reporter.accountId } } : {};
  await jira(`/rest/api/3/issue/${key}`, { method: 'PUT', body: JSON.stringify({ fields, update: { labels: [on ? { add: 'needs-human' } : { remove: 'needs-human' }] } }) });
  console.log(`${key}: needs-human ${on ? `on, assigned to ${f.reporter?.displayName ?? 'reporter'}` : 'off'}`);
} else if (command === 'create') {
  // create <PROJECT> <summary> <description-file> [labels,comma,separated] → prints the new key
  const project = key.split('-')[0];
  const [summary, file, labels = ''] = rest;
  const md = fs.readFileSync(file, 'utf-8').split('\n');
  const content = [];
  for (const line of md) {
    if (!line.trim()) continue;
    if (/^#+ /.test(line)) content.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: line.replace(/^#+ /, '') }] });
    else if (/^- /.test(line)) {
      const item = { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: line.slice(2) }] }] };
      const last = content.at(-1);
      if (last?.type === 'bulletList') last.content.push(item); else content.push({ type: 'bulletList', content: [item] });
    } else content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] });
  }
  const types = (await jira(`/rest/api/3/project/${project}`)).issueTypes;
  const type = types.find((t) => t.name === 'Task') ?? types.find((t) => !t.subtask);
  const created = await jira('/rest/api/3/issue', { method: 'POST', body: JSON.stringify({ fields: {
    project: { key: project }, issuetype: { id: type.id }, summary, labels: labels.split(',').filter(Boolean),
    description: { type: 'doc', version: 1, content } } }) });
  console.log(created.key);
} else if (command === 'inspect') {
  // inspect <KEY> → status, labels, attachments and the last comments (to check what the pipeline posted)
  const f = (await jira(`/rest/api/3/issue/${key}?fields=summary,status,labels,assignee,attachment,comment,subtasks`)).fields;
  console.log(`${key} — ${f.summary}\nStatus: ${f.status?.name} · Labels: ${(f.labels ?? []).join(', ') || '-'} · Assignee: ${f.assignee?.displayName ?? '-'}`);
  console.log(`Attachments: ${(f.attachment ?? []).map((a) => `${a.filename} (${Math.round(a.size / 1024)} KB)`).join(', ') || 'none'}`);
  console.log(`Sub-tasks: ${(f.subtasks ?? []).map((t) => `${t.key} ${t.fields.summary}`).join('; ') || 'none'}`);
  for (const c of (f.comment?.comments ?? []).slice(-3)) console.log(`--- comment ${c.created}\n${(c.body?.content ?? []).map((p) => (p.content ?? []).map((t) => t.text ?? '').join('')).join('\n')}`);
} else if (command === 'site-labels') {
  // site-labels <ANY-KEY> → every label used on the Jira site, with the tickets that use it
  const all = [];
  for (let at = 0; ; at += 1000) {
    const page = await jira(`/rest/api/3/label?startAt=${at}&maxResults=1000`);
    all.push(...(page.values ?? [])); if (page.isLast !== false) break;
  }
  for (const label of all) {
    const r = await jira(`/rest/api/3/search/jql?jql=${encodeURIComponent(`labels = "${label}"`)}&fields=summary&maxResults=50`);
    console.log(`${label}: ${(r.issues ?? []).map((i) => i.key).join(', ') || '(no tickets)'}`);
  }
} else if (command === 'remove-label') {
  // remove-label <ANY-KEY> <label> → removes the label from every ticket that has it
  const label = rest[0];
  const r = await jira(`/rest/api/3/search/jql?jql=${encodeURIComponent(`labels = "${label}"`)}&fields=summary&maxResults=100`);
  for (const i of r.issues ?? []) {
    await jira(`/rest/api/3/issue/${i.key}`, { method: 'PUT', body: JSON.stringify({ update: { labels: [{ remove: label }] } }) });
    console.log(`${i.key}: removed "${label}"`);
  }
  if (!(r.issues ?? []).length) console.log(`No ticket has "${label}"`);
} else if (command === 'labels') {
  const issue = await jira(`/rest/api/3/issue/${key}?fields=labels`);
  console.log((issue.fields.labels ?? []).join(','));
} else if (command === 'transition') {
  // Move the ticket to the named status, if the workflow allows it from where it is now.
  // Several names can be given with "|", e.g. "In Progress|Doing": the first one the workflow allows is used.
  const targets = rest.join(' ').toLowerCase().split('|').map((x) => x.trim());
  const target = targets.join(' / ');
  const { transitions } = await jira(`/rest/api/3/issue/${key}/transitions`);
  const t = targets.map((n) => transitions.find((x) => x.to?.name?.toLowerCase() === n || x.name.toLowerCase() === n)).find(Boolean);
  if (!t) { console.log(`${key}: no transition to "${target}" (now available: ${transitions.map((x) => x.to?.name).join(', ')})`); process.exit(0); }
  await jira(`/rest/api/3/issue/${key}/transitions`, { method: 'POST', body: JSON.stringify({ transition: { id: t.id } }) });
  console.log(`${key} → ${t.to?.name ?? t.name}`);
} else if (command === 'note') {
  // Post a plain-text comment (one paragraph per line of the given file).
  const lines = fs.readFileSync(rest[0], 'utf-8').split('\n').filter((l) => l.trim());
  // [text](url) and bare https:// URLs become clickable links
  const inline = (line) => {
    const out = [];
    const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)|(https?:\/\/[^\s)]+)/g;
    let last = 0, m;
    while ((m = re.exec(line))) {
      if (m.index > last) out.push({ type: 'text', text: line.slice(last, m.index) });
      const href = m[2] ?? m[3];
      out.push({ type: 'text', text: m[1] ?? href, marks: [{ type: 'link', attrs: { href } }] });
      last = re.lastIndex;
    }
    if (last < line.length) out.push({ type: 'text', text: line.slice(last) });
    return out;
  };
  const body = { type: 'doc', version: 1, content: lines.map((l) => ({ type: 'paragraph', content: inline(l) })) };
  await jira(`/rest/api/3/issue/${key}/comment`, { method: 'POST', body: JSON.stringify({ body }) });
  console.log(`Commented on ${key}`);
} else {
  console.error('Usage: jira.mjs fetch|labels <KEY> | transition <KEY> <status> | note <KEY> <file> | comment <KEY> <verdict.json> <pr-url> <batch-url>');
  process.exit(2);
}
