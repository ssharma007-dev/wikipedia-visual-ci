# Project structure

This document explains what each folder and file in this project does, why it is important, and how you can reuse it for your own project.

The project has two parts:

- The sample app: a copy of the Wikipedia site with a few Playwright tests. You replace this with your own app.
- The pipeline: the GitHub workflows, scripts and guidelines that connect Jira, Playwright, Applitools Eyes and the AI agent. You reuse this almost as it is.

For the setup steps, see [INSTALLATION.md](INSTALLATION.md).

---

## Overview

```
wikipedia-visual-ci/
├── .github/
│   ├── workflows/          The pipeline (GitHub Actions)
│   ├── CODEOWNERS          Who must approve changes to the rules and the pipeline
│   └── pull_request_template.md
├── guidelines/             The rules the AI follows (plain text)
├── scripts/                Helpers used by the workflows (Jira, Eyes, PDF report)
├── tests/                  Playwright test cases (functional and visual)
├── site/                   The sample app (Wikipedia copy)
├── server.mjs              Starts the sample app locally
├── tasks/                  Copy of the Jira ticket, only on feature branches
├── docs/installation/      Screenshots used in INSTALLATION.md
├── playwright.config.ts    Playwright + Applitools Eyes settings
├── .mcp.json               Connects the AI to the Applitools Eyes MCP Server
├── package.json            Test tools (Playwright, Applitools Eyes)
├── README.md               The flow in short
├── INSTALLATION.md         Step-by-step setup for your own project
└── PROJECT_STRUCTURE.md    This document
```

How to read the "Reuse" notes below:

- Keep: copy it as it is.
- Adapt: copy it, then change a few values for your project.
- Replace: use your own instead.
- Optional: useful, but you can leave it out.

---

## .github/workflows/: the pipeline

What it does: these files are the automation. GitHub runs them on pull requests, on pushes to `main`, when a branch is created, or when someone clicks Run Agent 1 in Jira.

Importance: high. This is the heart of the project.

| File | When it runs | What it does | Reuse |
|---|---|---|---|
| `implement-task.yml` | Run Agent 1 in Jira, or a commit message with a ticket key | Agent 1: creates the branch, implements the ticket, writes the test cases, runs them, reviews the results with the Eyes MCP Server, fixes its own bugs, creates the PDF report, opens the PR, updates Jira, and merges if there are no bugs | Keep |
| `visual-tests.yml` | Every pull request, and every push to `main` | Runs the tests, the AI review of a developer's PR, the PDF report, the Jira comment and the `Visual review` check. On `main` it updates Eyes' baseline after a merge and moves the ticket to Done | Keep |
| `ticket-check.yml` | Every pull request | Checks that the branch name contains a Jira key that exists. If not, the PR is blocked with a comment on how to fix it | Keep |
| `sync-task-on-branch.yml` | A new branch is created | Copies the Jira ticket into `tasks/<KEY>-….md` on that branch | Keep |
| `clean-task-snapshots.yml` | A push to `main` that contains `tasks/` | Removes the ticket copies from `main` again | Keep |
| `trust-report.yml` | Every Monday, or on demand | Compares the AI's verdicts with what people did afterwards (agreement rate) | Optional |
| `jira-ticket.yml` | On demand | Creates or inspects a Jira ticket with the pipeline's Jira credentials (useful for demos and checks) | Optional |

Reuse: copy the whole folder. Your project-specific values (how to start the app, its URL, which folders the AI may change) are repository variables, so you don't need to edit the workflows. See Step 2 and Step 8 in [INSTALLATION.md](INSTALLATION.md).

---

## .github/CODEOWNERS and pull_request_template.md

What they do:

- `CODEOWNERS`: names the people who must approve changes to the rules (`guidelines/`) and to the pipeline (`.github/`).
- `pull_request_template.md`: the form a developer fills in when opening a PR, including the Jira ticket.

Importance: medium. CODEOWNERS makes sure nobody, including the AI, can quietly change the rules it is judged by.

Reuse: Adapt. Replace `@ssharma007-dev` with your design lead, QA lead or platform team.

---

## guidelines/: the rules the AI follows

What it does: plain text files that tell the AI how to work and how to decide. There is no code here. The AI always reads them from `main`, so a pull request cannot change the rules it is judged by.

Importance: high. This is where your team's knowledge goes. Better rules mean better decisions.

| File | What it contains | Reuse |
|---|---|---|
| `design-system.md` | Colours, fonts, spacing, breakpoints and component rules every page must follow | Replace with your own design system |
| `review-rules.md` | How the AI classifies each difference (real change, bug, noise, dynamic content, …), the thresholds (e.g. 2px or less is noise), and what it may do in Eyes | Adapt: tune the thresholds to your team |
| `agent-implement.md` | Agent 1's instructions: how to implement a ticket, which tests to write, the report format, the work types (feature, bug, hotfix, …) | Adapt: replace the sample's paths (`site/wikipedia/…`) with your own folders |
| `agent-fix.md` | How Agent 1 fixes a bug it caused and tests again (up to 2 rounds) | Keep |
| `README.md` | Explains the files above and the order of priority (design system first, then ticket, then rules) | Keep |

---

## scripts/: helpers used by the workflows

What it does: small Node.js scripts the workflows call. You don't run them by hand.

Importance: high, but you rarely need to change them.

| File | What it does | Reuse |
|---|---|---|
| `jira.mjs` | Talks to Jira: reads the ticket, comments, attaches the PDF, moves the status, creates sub-tasks for bugs, adds the `needs-human` label | Keep |
| `eyes-save.mjs` | Saves the baselines in Eyes through the Eyes MCP Server, but only when nothing is unresolved. The AI itself is never allowed to save | Keep |
| `eyes-evidence.mjs` | Collects the before / after / differences images from Eyes for the PDF | Keep |
| `render-report.mjs` | Builds the HTML report (and the PR summary) from the AI's results | Keep |
| `report-pdf.mjs` | Turns the HTML report into the PDF that is attached to Jira | Keep |
| `failed-tests.mjs` | Lists the functional checks (Playwright `expect`) that failed, for the PR, PDF and Jira | Keep |
| `compact-diff.mjs` | Shortens code diffs so the AI can read them | Keep |
| `agent-progress.mjs` | Prints the AI's progress in the GitHub Actions log | Keep |
| `trust-report.mjs` | Calculates how often people agree with the AI | Optional |
| `set-merge-policy.sh` | Switches between `auto` (merge when the AI review passes) and `code-approval` (also needs one person's approval) | Keep |

---

## tests/: the test cases

What it does: Playwright test cases for the app. Each test can have functional checks (`expect(...)`) and visual checks (`eyes.check(...)`). Agent 1 adds new tests here when it implements a ticket.

Importance: high. The AI can only review what the tests capture.

Reuse: Replace with your own test cases. Use the app address from `process.env.SITE_URL`, which the pipeline sets for you. Keep the import from `@applitools/eyes-playwright/fixture`.

---

## site/ and server.mjs: the sample app

What they do:

- `site/wikipedia/pages/` and `assets/`: a saved copy of the Wikipedia portal and article pages.
- `site/wikipedia/styles/custom.css`: the team stylesheet. Most tickets in the demo change this file.
- `site/wikipedia/flags.json` and `flag-definitions.json`: demo feature flags (e.g. remove a banner) to create visual changes on purpose.
- `server.mjs`: a small server that shows the site on `http://localhost:3001/wikipedia`.

Importance: only for the demo.

Reuse: Replace with your own app. Then set `APP_START_COMMAND` and `APP_URL` so the pipeline knows how to start it, and `AGENT_ALLOWED_PATHS` to the folders the AI may change (e.g. `src/ tests/`).

---

## tasks/: the ticket copy on each branch

What it does: when a branch is created for a ticket, the pipeline copies the Jira ticket into `tasks/<KEY>-….md` on that branch. This way the ticket travels with the code, and the AI can still work if Jira is not reachable.

Importance: medium. The ticket in Jira is always the source of truth.

Reuse: Keep. Nothing to do: the folder is created and removed automatically, and it never stays on `main`.

---

## playwright.config.ts: Playwright and Applitools Eyes settings

What it does: sets the Applitools app name, the browsers and devices Eyes checks (here Chrome desktop and Galaxy S25 Ultra), Eyes branching (compare each branch with the branch it merges into), and `failTestsOnDiff: false` so that the AI decides about differences instead of Playwright.

Importance: high.

Reuse: Adapt. Change `appName` and `browsersInfo`. Leave the branching settings as they are.

---

## .mcp.json: connection to the Applitools Eyes MCP Server

What it does: tells the AI how to start the Applitools Eyes MCP Server and which keys to use. The keys come from the repository secrets.

Importance: high. Without it, the AI cannot see the Eyes results.

Reuse: Keep.

---

## package.json and package-lock.json

What they do: list the test tools: `@playwright/test` and `@applitools/eyes-playwright`.

Reuse: Adapt. Add these two packages to your own `package.json` instead of copying the file.

---

## docs/installation/: screenshots for the guide

What it does: the images used in [INSTALLATION.md](INSTALLATION.md). Files starting with `p` are placeholders for screenshots you take in your own Jira and GitHub setup.

Reuse: Optional.

---

## Summary: what to copy for your own project

| Keep as it is | Adapt | Replace with your own | Leave out |
|---|---|---|---|
| `.github/workflows/`, `scripts/`, `guidelines/agent-fix.md`, `guidelines/README.md`, `.mcp.json` | `playwright.config.ts`, `guidelines/review-rules.md`, `guidelines/agent-implement.md`, `.github/CODEOWNERS`, `package.json` | `site/` and `server.mjs` (your app), `tests/` (your test cases), `guidelines/design-system.md` (your design system) | `tasks/` (created automatically), `docs/` (only needed for the guide) |

Note: the only values you set per project are repository variables (`APP_START_COMMAND`, `APP_URL`, `AGENT_ALLOWED_PATHS`, `MERGE_POLICY`, `BOT_APP_ID`) and secrets. Everything else is the same for every project.
