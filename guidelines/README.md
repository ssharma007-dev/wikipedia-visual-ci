# Guidelines — what the AI reviewer checks against

Every pull request is reviewed by an AI agent (Claude + the Applitools Eyes MCP) after the visual
tests run. It judges each visual difference Eyes finds using the files in this folder.

| File | Question it answers | Owner | Read from |
|---|---|---|---|
| [`design-system.md`](design-system.md) | What must **always** be true, in every PR? | Design team | `main` |
| **The Jira ticket** (snapshot in `tasks/WIKI-xxx-*.md` on each branch) | What is **this** PR allowed to change — and what must stay unchanged? | Product | Jira (snapshot on the PR's branch) |
| [`review-rules.md`](review-rules.md) | How does the AI decide (thresholds), and what may it do in Eyes? | QA / platform | `main` |

## Order of precedence

1. **Design system** — always applies. A ticket cannot approve a violation.
2. **Ticket** — defines the expected change.
3. **Review rules** — thresholds and Eyes actions.

## How the AI decides, per difference

```
Not asked for by the ticket                         → 👎 reject   (regression)
Asked for, but breaks the design system             → 👎 reject   (design violation — 👤 a person decides)
Asked for and follows the design system             → 👍 accept
Shift ≤ 2px with no HTML change                     → 👍 accept   (noise)
Unsure                                              → 👤 left unresolved for a person
```

The AI **never saves baselines** — a person saves them in Eyes after approving the PR.

## Governance

- `design-system.md` and `review-rules.md` are read from **`main`**, so a PR cannot change the
  rules it is judged by. If a PR edits them, the AI says so and ignores the edit.
- Changes to this folder need approval from its code owners (`.github/CODEOWNERS`).

## Tickets and branches

Tickets live in **Jira**. A branch is named after its ticket — e.g. `feature/WIKI-8-taller-search-phone` — and
carries a snapshot of it in `tasks/WIKI-8-*.md`, so the PR records exactly what was asked even if the
ticket is edited later. The rules in this folder exist **once, on `main`**: branches cannot change them.
