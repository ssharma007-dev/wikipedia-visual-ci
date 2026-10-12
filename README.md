# From Jira ticket to merged pull request, reviewed by AI

A product manager writes a Jira ticket. A developer, or the AI, builds it. Playwright and
Applitools Eyes test it, and an AI reviews every visual change with the Applitools Eyes MCP.
No bugs → it merges by itself. Otherwise, a person decides.

## The flow

1. **Jira ticket** — what should change, and what must not.
2. **Branch** — its name contains the ticket key (e.g. `feature/WIKI-17-…`), so it links to the ticket.
3. **Build it** — a developer, or click **Run Agent 1** in Jira and the AI builds it and writes the tests.
4. **Test** — Playwright + Applitools Eyes on desktop and mobile, compared with the branch the PR merges into.
5. **AI review** — accepts what the ticket asked for, rejects bugs. If the AI wrote the code, it fixes its own bugs.
6. **Report** — a PDF with before/after images is attached to the Jira ticket.
7. **Merge** — automatic when there are no bugs. Add the label `human-review` to always involve a person.

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
