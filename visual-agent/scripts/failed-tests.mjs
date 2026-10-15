// List the Playwright tests that failed (functional checks), from the JSON reporter's output.
//   node visual-agent/scripts/failed-tests.mjs test-results/results.json <out.json> <out.md>
import fs from 'node:fs';

const [input, outJson, outMd, outStats] = process.argv.slice(2);
let failed = [];
const stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
try {
  const report = JSON.parse(fs.readFileSync(input, 'utf-8'));
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        const last = (t.results ?? []).at(-1);
        if (last) { stats.total++; stats[last.status === 'passed' ? 'passed' : last.status === 'skipped' ? 'skipped' : 'failed']++; }
        if (last && !['passed', 'skipped'].includes(last.status)) {
          const error = (last.error?.message ?? last.errors?.[0]?.message ?? last.status).replace(/\u001b\[[0-9;]*m/g, '');
          failed.push({ name: spec.title, file: spec.file, line: spec.line, error: error.split('\n').slice(0, 6).join('\n') });
        }
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  (report.suites ?? []).forEach(walk);
} catch (err) {
  console.error(`No Playwright JSON results (${err.message})`);
}
fs.writeFileSync(outJson, JSON.stringify(failed, null, 2));
fs.writeFileSync(outMd, failed.length
  ? `## ❌ Functional checks failed (${failed.length})\n\nThese Playwright assertions failed. The PR cannot merge until they pass, whatever the visual review finds.\n\n` +
    failed.map((f) => `- **${f.name}** (\`${f.file}:${f.line}\`)\n\n  \`\`\`\n  ${f.error.replace(/\n/g, '\n  ')}\n  \`\`\``).join('\n') + '\n'
  : '');
if (outStats) fs.writeFileSync(outStats, JSON.stringify(stats, null, 2));
console.log(`Tests: ${stats.total} run, ${stats.passed} passed, ${stats.failed} failed, ${stats.skipped} skipped`);
