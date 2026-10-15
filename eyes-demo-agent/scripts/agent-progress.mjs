// Live progress for the CI log: reads Claude's stream-json on stdin and prints
// one line per tool call or short note, so the review isn't a silent 10 minutes.
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
const started = Date.now();
const elapsed = () => {
  const s = Math.round((Date.now() - started) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

rl.on('line', (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const content = msg.message?.content;
  if (msg.type === 'assistant' && Array.isArray(content)) {
    for (const block of content) {
      if (block.type === 'tool_use') {
        const name = block.name.replace('mcp__applitools-mcp__', 'eyes › ');
        const input = block.input ?? {};
        const detail = [input.scope, input.mode, input.action, input.file_path?.split('/').pop()]
          .filter(Boolean).join(', ');
        console.log(`[${elapsed()}] 🔧 ${name}${detail ? ` (${detail})` : ''}`);
      } else if (block.type === 'text' && block.text.trim()) {
        console.log(`[${elapsed()}] 💬 ${block.text.trim().split('\n')[0].slice(0, 160)}`);
      }
    }
  }
  if (msg.type === 'result') {
    console.log(`[${elapsed()}] ✅ Review finished: ${msg.num_turns} turns, ${Math.round((msg.duration_ms ?? 0) / 1000)}s`);
  }
});
