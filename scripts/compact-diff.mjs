// Readable diff for minified files: for each changed line, print only the part
// that changed plus some context, instead of the whole (possibly 100 KB) line.
// Usage: git diff -U0 <base>...HEAD | node scripts/compact-diff.mjs
const CONTEXT = 120;
const MAX = 600;

const clip = (s) => (s.length > MAX ? `${s.slice(0, MAX)}… (${s.length - MAX} more chars)` : s);

function describePair(before, after) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < before.length - start && end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) end++;
  // Widen to whole tokens (e.g. a full CSS declaration) so a change like
  // "-5.6rem" -> "-9.6rem" isn't shown as a lone digit next to a stray "-".
  const boundary = /[;{}<>,\s"']/;
  while (start > 0 && !boundary.test(before[start - 1])) start--;
  while (end > 0 && !boundary.test(before[before.length - end])) end--;
  const from = Math.max(0, start - CONTEXT);
  const pre = before.slice(from, start);
  const post = before.slice(before.length - end, before.length - end + CONTEXT);
  const removed = before.slice(start, before.length - end);
  const added = after.slice(start, after.length - end);
  return `  …${pre}[-${clip(removed)}-]{+${clip(added)}+}${post}…`;
}

const input = await new Promise((resolve) => {
  let s = '';
  process.stdin.on('data', (d) => (s += d)).on('end', () => resolve(s));
});

let minus = [];
let plus = [];
const out = [];
function flush() {
  const pairs = Math.min(minus.length, plus.length);
  for (let i = 0; i < pairs; i++) out.push(describePair(minus[i], plus[i]));
  for (const l of minus.slice(pairs)) out.push(`- ${clip(l)}`);
  for (const l of plus.slice(pairs)) out.push(`+ ${clip(l)}`);
  minus = [];
  plus = [];
}

for (const line of input.split('\n')) {
  if (line.startsWith('--- ') || line.startsWith('+++ ')) continue;
  if (line.startsWith('-')) minus.push(line.slice(1));
  else if (line.startsWith('+')) plus.push(line.slice(1));
  else {
    flush();
    if (line.startsWith('diff --git')) out.push(`\n### ${line.split(' b/')[1] ?? line}`);
    else if (line.startsWith('@@')) out.push(line.replace(/^(@@[^@]*@@).*/, '$1'));
  }
}
flush();
console.log(out.join('\n').trim());
