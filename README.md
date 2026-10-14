# From Jira ticket to merged pull request, reviewed by AI

A product manager writes a Jira ticket. A developer, or the AI, builds it. Playwright and Applitools Eyes test it, and an AI reviews every visual change with the Applitools Eyes MCP. No bugs → it merges by itself. Otherwise, a person decides.

## The flow

### Step 1: Connect Jira and GitHub (once)

A Jira admin installs **GitHub for Atlassian** and picks which repositories Jira can see, such as `wikipedia-visual-ci`.

Each product gets its own Jira project with a short key, for example **WIKI**. Tickets are then numbered WIKI-1, WIKI-2, and so on. That key is how Jira and GitHub find each other.

### Step 2: Write the ticket

The PM or team lead writes a Jira ticket with two lists: **what should change** and **what must not change**.

- It's a feature by default. Add the label `bug` or `hotfix` if it's one of those.
- Add the label `human-review` if a person must approve before anything is merged.
- The PM decides who builds it: a developer or the AI agent.

### Step 3: Create a branch

Put the ticket key in the branch name, for example `feature/WIKI-17-make-donate-bold`. You can create it in two ways:

- **In Jira:** open the ticket and click **Development → Create branch**.
- **In git:** create the branch yourself and push it.

Either way, the branch is linked to the ticket, and a copy of the ticket is added to the branch as `tasks/WIKI-17-….md`.

### Step 4: Build it and write the tests

- **A developer** makes the change, adds or updates the Playwright tests, and opens a pull request.
- **Or the AI:** anyone clicks ⚡ **Run Agent 1** in Jira. The AI makes the change, writes the tests (plus a regression test for a bug), runs them, and opens the pull request. If there's no branch yet, it creates one.

The tests check both behaviour (Playwright) and appearance (Applitools Eyes).

### Step 5: Tests run automatically

When the pull request opens, GitHub Actions starts the site and runs the tests. Applitools Eyes captures every important screen on Chrome desktop and a Galaxy S25 Ultra phone in a single run.

Each screen is compared with the **branch the pull request will merge into** (usually `main`). Every branch keeps its own baselines in Eyes, so branches never overwrite each other, and `main` only changes when code is merged.

### Step 6: The AI reviews every difference

Using the Applitools Eyes MCP, the AI goes through every difference Eyes found and checks it against the ticket and the design system:

- **Asked for by the ticket** → accepted.
- **Not asked for, or breaks the design system** → rejected as a bug, with evidence and a suggested fix.
- **Not sure** → left for a person.

If the AI wrote the code, it fixes its own bugs and runs the tests again (up to 2 times).

### Step 7: A report goes to Jira

A PDF is attached to the Jira ticket. It shows a summary, before and after images, and each bug with why it's a bug and how to fix it. A comment on the ticket links to the PDF and the pull request. If the AI did the work, each bug it couldn't fix also becomes a Jira sub-task.

### Step 8: Merge, or ask a person

- **No bugs left:** the baselines are saved, the pull request is merged, and the ticket moves to Done. Nobody has to do anything.
- **Bugs the AI couldn't fix, or a `human-review` label:** a person reads the PDF, fixes or approves the change, then saves the baselines and merges.

## What's where

| Path | What it is |
| --- | --- |
| `site/` | The demo Wikipedia site |
| `tests/` | Playwright + Eyes tests |
| `guidelines/` | The rules the AI follows: plain text, edit to change its behaviour |
| `.github/workflows/` | The pipeline |
| `scripts/` | Helpers: Jira, Eyes, the PDF report |

## Setup

For the full step-by-step guide ( with screenshots ) to set this up in your own project, see [INSTALLATION.md](INSTALLATION.md). What each folder does, and what to reuse: [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md).

1. Install **GitHub for Atlassian** in Jira and connect this repository.
2. Add these repository secrets: `APPLITOOLS_API_KEY`, `APPLITOOLS_READ_KEY`, `APPLITOOLS_WRITE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`), `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
3. Optional: a Jira Automation rule for the **Run Agent 1** button, calling this repo's `implement-task.yml` workflow with the ticket key.

## Run locally

```bash
npm ci && npx playwright install chromium
npm start              # http://localhost:3001/wikipedia
npx playwright test    # in a second terminal
```

## Why trust an AI reviewer?

An AI model is probabilistic: left alone, it might skim or stop early. The Applitools Eyes MCP adds **deterministic guardrails for probabilistic code**:

- **No shortcuts**: the MCP walks the AI through every changed area, and the review isn't finished until every difference has been looked at.
- **Each decision from its own evidence**: every step is accepted, rejected or left unresolved based on its own image diff, DOM change and the ticket.
- **Nothing is final until saved**: accepts and rejects can be undone; saving is a separate step the AI never takes.

## Safety

The AI can accept or reject changes in Eyes, but it can never save baselines, push or merge: the pipeline does that, and only when there are no bugs. It can change only `site/` and `tests/`.

`main` is protected: every change goes through a pull request, and two checks must pass before anyone can merge: **Branch links to a Jira ticket** and **Visual review** (the AI review, functional checks included). The AI works as its own GitHub account, `eyes-mcp-visual-agent[bot]`, so everything it does is visible and checked like a developer's.

Want a person to approve every change too? Run `scripts/set-merge-policy.sh code-approval` (back with `auto`). How often people agree with the AI: **Actions → Trust report**.

This is a demo that merges straight into `main`. Adapt it to your branches (staging, QA, release) and add a human code approval as your team needs.
