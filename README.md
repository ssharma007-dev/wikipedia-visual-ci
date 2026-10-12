# From Jira ticket to merged pull request, reviewed by AI

A product manager writes a Jira ticket. A developer, or the AI, builds it. Playwright and
Applitools Eyes test it, and an AI reviews every visual change with the Applitools Eyes MCP.
No bugs → it merges by itself. Otherwise, a person decides.

## The flow

| Step | Who | What happens |
|---|---|---|
| 1. Link Jira with GitHub | Jira admin (once) | Installs **GitHub for Atlassian** and connects this repo. Each product gets a Jira key, e.g. **WIKI**, so tickets are numbered WIKI-1, WIKI-2, … |
| 2. Create the ticket | PM or team lead | Writes what should change and what must not. Optional labels: `bug`, `hotfix`, `human-review`. Decides who builds it: a developer or the AI. |
| 3. Create a branch | Developer, or Jira | **Development → Create branch** in the ticket, or `git switch -c feature/WIKI-17-…`. The key in the name links it to the ticket, and the ticket is copied to `tasks/WIKI-17-….md`. |
| 4. Build it and write tests | Developer **or** AI | A developer codes it, adds Playwright tests and opens a PR. Or anyone clicks **Run Agent 1** in Jira: the AI builds it, writes the tests and opens the PR (creating the branch if needed). |
| 5. Run the tests | GitHub Actions | Playwright drives the site; Applitools Eyes checks every screen on Chrome desktop and a Galaxy S25 Ultra, compared with the branch the PR merges into. |
| 6. AI review | AI + Eyes MCP | Asked for by the ticket → accepted. Not asked for, or breaks the design system → rejected as a bug. Unsure → left for a person. If the AI wrote the code, it fixes its own bugs and re-tests (up to 2 rounds). |
| 7. Report | Pipeline | A PDF (summary, bugs with evidence and fixes, before/after images) is attached to the Jira ticket, with a comment linking the PR and the Eyes results. |
| 8. Decide and merge | Pipeline, or a person | No bugs → baselines saved, PR merged, ticket moves to Done. Bugs it can't fix, or `human-review` → a person reads the PDF, then fixes or approves, saves and merges. |

## What's where

| Path | What it is |
|---|---|
| `site/` | The demo Wikipedia site |
| `tests/` | Playwright + Eyes tests |
| `guidelines/` | The rules the AI follows — plain text, edit to change its behaviour |
| `.github/workflows/` | The pipeline |
| `scripts/` | Helpers: Jira, Eyes, the PDF report |

## Setup

1. Install **GitHub for Atlassian** in Jira and connect this repository.
2. Add these repository secrets: `APPLITOOLS_API_KEY`, `APPLITOOLS_READ_KEY`, `APPLITOOLS_WRITE_KEY`,
   `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`), `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
3. Optional: a Jira Automation rule for the **Run Agent 1** button, calling this repo's
   `implement-task.yml` workflow with the ticket key.

## Run locally

```bash
npm ci && npx playwright install chromium
npm start              # http://localhost:3001/wikipedia
npx playwright test    # in a second terminal
```

## Why trust an AI reviewer?

An AI model is probabilistic: left alone, it might skim or stop early. The Applitools Eyes MCP adds
**deterministic guardrails for probabilistic code**:

- **No shortcuts** — the MCP walks the AI through every changed area, and the review isn't finished
  until every difference has been looked at.
- **Each decision from its own evidence** — every step is accepted, rejected or left unresolved based
  on its own image diff, DOM change and the ticket.
- **Nothing is final until saved** — accepts and rejects can be undone; saving is a separate step the AI never takes.

## Safety

The AI can accept or reject changes in Eyes, but it can never save baselines, push or merge — the
pipeline does that, and only when there are no bugs. It can change only `site/` and `tests/`.

This is a demo that merges straight into `main`. Adapt it to your branches (staging, QA, release)
and add a human code approval as your team needs.
