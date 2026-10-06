# Wikipedia visual CI — Applitools MCP agent in the pipeline

A pull request on this repo triggers a GitHub Actions build that:

1. starts a local copy of the Wikipedia portal (`server.mjs`, port 3001),
2. runs two Playwright tests with Applitools Eyes on the Ultrafast Grid (Chrome 1200×800 and Galaxy S25 Ultra),
3. hands the results to a **Claude agent with the Applitools MCP server**, which reviews every visual difference against what the PR says it changes,
4. posts the agent's verdict as a PR comment and **passes or fails the check**.

```
PR opened ─► GitHub Actions ─► site up ─► Playwright + Eyes (UFG)
                                              │
                         PR title/description + compact diff + Eyes batch URL
                                              ▼
                       Claude + Applitools MCP  ──  .github/prompts/visual-review.md
                         · inspects every changed area (image diff + DOM diff)
                         · accepts expected changes, masks dynamic content, rejects regressions
                         · never saves baselines
                                              ▼
                         PR comment (summary + Eyes links)  +  ✅ / ❌ check
```

## What's where

| Path | What it is |
|---|---|
| `site/wikipedia/` | Scraped Wikipedia pages and assets (from [applitools/demo-runner](https://github.com/applitools/demo-runner)) |
| `server.mjs` | Zero-dependency static server: `/wikipedia` → portal |
| `tests/wikipedia.spec.ts` | The two visual tests |
| `playwright.config.ts` | Eyes + Ultrafast Grid config |
| `.mcp.json` | Applitools MCP server for the agent |
| `.github/prompts/visual-review.md` | **The agent's policy** — classes, thresholds, output format. Edit the thresholds table to tune the gate. |
| `.github/workflows/visual-tests.yml` | The pipeline |
| `scripts/compact-diff.mjs` | Shrinks diffs of minified lines to just the changed part, so the agent can read them |

## Guardrails

- The agent can **inspect, accept, reject and add match regions** in Eyes.
- It **cannot save or reset baselines** (`eyes_resolve_save` / `eyes_resolve_reset` are disallowed), edit code, or run shell commands.
- A human saves baselines in Eyes after approving the PR.

## Setup

Repository secrets (Settings → Secrets and variables → Actions):

- `APPLITOOLS_API_KEY` — runs the tests
- `APPLITOOLS_READ_KEY` — lets the MCP read results
- `APPLITOOLS_WRITE_KEY` — lets the MCP accept/reject and add regions
- `ANTHROPIC_API_KEY` — runs the Claude agent

Baselines come from the first run on `main` (or a manual run via **Actions → Visual tests → Run workflow**).

## Run locally

```bash
npm ci && npx playwright install chromium
npm start                # http://localhost:3001/wikipedia
npx playwright test      # in a second terminal
```

## Demo script

1. Show the open PR **"Remove the Apple App Store badge"** — the description says only the iOS badge goes.
2. The diff also carries a one-character "tidy-up" in the mobile search CSS. Nobody mentions it.
3. Open the PR's **Checks** tab → *Visual tests* → watch the tests run, then the agent review.
4. The PR comment: the badge removal is **Expected** and accepted; the search button pushed off-screen on the Galaxy is a **Regression**, rejected, with the culprit line from the diff. Check is ❌.
5. Push the one-line fix → the pipeline reruns → ✅. Approve, merge, save the baseline in Eyes.
