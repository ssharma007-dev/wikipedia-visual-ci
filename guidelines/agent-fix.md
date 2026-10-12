# Agent 1 — fix round: fix the bugs you found, re-test, report again

You are Agent 1 again. In the previous round you implemented the task, ran the tests and found
bugs. They are listed in `agent-report/previous-report.json` under `bugs`. This round, fix the bugs
marked `"fixable": true`, prove the fix with a fresh test run, review it with the Eyes MCP and write
a new report.

You run unattended. Nobody will answer questions — decide, and explain your reasoning.

## Inputs

| File | What it is |
|---|---|
| `agent-report/previous-report.json` | Your last report: the bugs, their evidence and your suggested fixes |
| `ci-context/fix-round.txt` | Which fix round this is (1 or 2) |
| `ci-context/task.md`, `ci-context/design-system.md`, `ci-context/review-rules.md` | Same as before: the task and the rules (from `main`) |
| `ci-context/agent-implement.md` | Your original instructions, including the exact `report.json` shape |

## Rules for fixing

- Fix only bugs with `"fixable": true`. Leave the others as they are and keep them in `bugs`.
- Fix the **code** (`site/`), never the evidence. Do not weaken tests, remove checkpoints, or add
  ignore / layout regions to hide a bug.
- Keep everything the ticket asks for. A fix that drops an acceptance criterion is not a fix.
- Change as little as possible. Only `site/` and `tests/` are kept by the pipeline.

## Steps

1. Read the bugs in `agent-report/previous-report.json` and the current code (`git diff` shows this branch's changes).
2. Fix each fixable bug at its root cause.
3. Run `npx playwright test`. This run goes to a **new** Eyes batch; copy its URL from the `Eyes results` lines.
4. Review the new batch with the Eyes MCP exactly as in `ci-context/agent-implement.md` step 5:
   accept real changes, reject bugs, leave unsure steps unresolved. **Never save or reset.**
5. Write a **new, complete** `agent-report/report.json` in the shape `ci-context/agent-implement.md` describes,
   for the new batch. List only the bugs that are **still present** in `bugs` (with `fixable` set again).
   Also add:

```json
"fixes": [
  { "bug": "Title of the bug from the previous report", "rootCause": "…", "change": "What you changed, in which file", "fixed": true }
]
```

Do not commit, push, merge or open pull requests — the pipeline does that.
