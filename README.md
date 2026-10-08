# Wikipedia visual CI — Applitools MCP agent in the pipeline (Playwright)

> This is **`main`**, the Playwright (JS) version. A **Python + Selenium** version of the same pipeline lives on the **`python`** branch.

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
                       Claude + Applitools MCP  ──  guidelines/review-rules.md
                         · inspects every changed area (image diff + DOM diff)
                         · accepts expected changes, masks dynamic content, rejects regressions
                         · never saves baselines
                                              ▼
                         PR comment (summary + Eyes links)  +  ✅ / ❌ check
```

## Developer flow

1. Pick a ticket from [`guidelines/tasks/`](guidelines/tasks/) — e.g. `WIKI-102-brand-search-button.md`.
2. `git switch main && git pull && git switch -c feature/WIKI-102-brand-search-button`
3. Implement it — usually in `site/wikipedia/styles/custom.css` — following [`guidelines/design-system.md`](guidelines/design-system.md).
4. Push and open a PR (the template asks for the ticket). CI starts automatically.
5. The AI reviews every visual difference against **the ticket** and **the design system**, accepts or rejects it in Eyes, and comments ✅/❌ on the PR.
6. ❌ → fix and push again. ✅ → a reviewer approves, saves the baselines in Eyes, and merges.

The [`guidelines/`](guidelines/) folder is everything the AI judges against — see its README.

## How the AI decides (the rules)

After the visual tests finish, the AI agent reads **[`guidelines/review-rules.md`](guidelines/review-rules.md)** and applies these rules to every difference Eyes found. Edit that file to change the behavior — no code changes.

| The difference… | 🤖 AI action in Eyes | PR check |
|---|---|---|
| Matches what the PR description says should change (any size) | Accept | ✅ PASS |
| Shift of **2px or less**, no HTML change | Treat as noise, accept | ✅ PASS |
| **Not** explained by the PR and moves, hides or cuts a button, input or link | Reject | ❌ FAIL |
| **Not** explained by the PR and changes text or removes content | Reject | ❌ FAIL |
| **Not** explained by the PR and shifts layout **more than 2px** | Reject | ❌ FAIL |
| Expected change is **missing** on any browser or device | Reject | ❌ FAIL |
| AI isn't certain | Leave unresolved | 👤 a person decides |

Two thresholds apply at different times:

- **During the test run:** Eyes decides what counts as a difference, using its match level (`Strict`).
- **After the test run:** the AI applies the rules above, including the **2px** noise rule.

The AI **never saves baselines**. A person saves them in Eyes.

**What the AI may do in Eyes** is set by switches in the same file (section *Eyes MCP behaviour*): Auto-accept, Auto-reject, Mask dynamic content, and whether a decision applies to the same test on other browsers/devices. All **on** → the Eyes MCP resolves steps directly (`mode: "resolve"`). Any **off** → the MCP reads only (`mode: "inspect"`) and the AI just recommends for that part — useful for the first week of a trial.

## Feature flags (for demos)

`site/wikipedia/flags.json` lists the demo-runner feature flags, all `false` on `main`. Set one to `true` in a pull request and the server applies it (`flag-definitions.json` says what each one does), so a flag change is a normal, reviewable code change. Examples: `remove-banner`, `rename-login`, `cut-search`, `move-footer`.

## What's where

| Path | What it is |
|---|---|
| `site/wikipedia/` | Scraped Wikipedia pages and assets (from [applitools/demo-runner](https://github.com/applitools/demo-runner)) |
| `server.mjs` | Zero-dependency static server: `/wikipedia` → portal |
| `tests/wikipedia.spec.ts` | The two visual tests |
| `playwright.config.ts` | Eyes + Ultrafast Grid config |
| `.mcp.json` | Applitools MCP server for the agent |
| `guidelines/review-rules.md` | **The agent's policy** — classes, thresholds, output format. Edit the thresholds table to tune the gate. |
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
- `ANTHROPIC_API_KEY` **or** `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`) — runs the Claude agent

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
