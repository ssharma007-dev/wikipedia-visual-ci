# From Jira ticket to merged pull request, reviewed by AI

A product manager writes a Jira ticket. A developer, or the AI, builds it. Playwright and
Applitools Eyes test it, and an AI reviews every visual change with the Applitools Eyes MCP.
No bugs → it merges by itself. Otherwise, a person decides.

## The flow

**Step 1: Link Jira with the GitHub project (one-time setup)**
The Jira admin installs and configures **GitHub for Atlassian**. It connects Jira to GitHub and lists the
repositories Jira can access (e.g. `wikipedia-visual-ci`).
Create one Jira project per product, e.g. Wikipedia → key **WIKI**. Jira numbers its tickets automatically
(WIKI-1, WIKI-2, …), and that key is used in branch names.

**Step 2: Create the Jira ticket**
The PM or team lead creates a ticket in the product's Jira project, describing what should change
(acceptance criteria) and what must not change.
The work type is a feature by default; add the label `bug` or `hotfix` for those. Add `human-review` if a
person must approve before merging.
The PM decides who implements it: a developer, or the AI agent (via ⚡ **Run Agent 1**).

**Step 3: Create a branch from the ticket**
1. In the Jira ticket, go to **Development → Create branch**. Select the repository, branch from `main`, and
   keep the ticket key in the branch name (e.g. `feature/WIKI-17-…`). The branch is linked to the ticket
   automatically, and the ticket details are copied to `tasks/WIKI-17-….md` on the branch.
2. Or a developer creates the branch themselves, following the naming convention (it must contain the key,
   e.g. `WIKI-17`). Once pushed to GitHub, it's linked to the ticket and the ticket details are added the same way.

**Step 4: Implement the change and create test cases (functional and visual)**
1. A developer implements the change, adds or updates the Playwright test cases, and opens a pull request (PR).
2. Or someone clicks ⚡ **Run Agent 1** in Jira, and the AI implements the change, writes the test cases itself
   (plus a regression test for bugs), runs them, and opens the PR. If no branch exists yet, it creates one.

**Step 5: Run the tests automatically**
GitHub Actions starts the site and runs the Playwright tests (functional and visual) with Applitools Eyes.
The Applitools Ultrafast Grid renders each checkpoint on every browser and device defined in
`playwright.config.ts` (here Chrome desktop and a Galaxy S25 Ultra phone). One test run covers all of them,
with no extra test code per device.
**What is it compared against? The parent branch.** Eyes branching mirrors git: each branch gets its own
baselines, starting from the branch the PR merges into (usually `main`). Baselines saved on a feature branch
never affect `main` until the PR is merged.

**Step 6: AI review using the Eyes MCP**
The AI checks every visual difference against the Jira ticket and the design system:
- intended changes are accepted,
- unexpected changes are rejected as bugs, with evidence and suggested fixes,
- uncertain cases are left for a person.

If the AI wrote the code, it fixes its own bugs and re-tests (up to 2 rounds).

**Step 7: Generate the report**
A PDF report (summary, bugs with evidence and fixes, before/after images) is attached to the Jira ticket,
and a Jira comment links to the report and the PR. When the AI agent did the work, bugs found are also
created as Jira sub-tasks.

**Step 8: Decide and merge**
- No bugs found (or the AI fixed them): baselines are saved, the PR is merged automatically, and the ticket moves to Done.
- Bugs it can't fix, or the `human-review` label is present: a person reviews the PDF, fixes or approves,
  then saves the baselines and merges the PR.

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
