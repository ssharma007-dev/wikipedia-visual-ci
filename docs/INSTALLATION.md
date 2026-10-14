# Installation guide: AI visual review for your project

This guide explains how to set up the sample project's flow in your own project. Please follow the steps in order. To understand how the pieces work together first, see [FLOW.md](FLOW.md).

*Flow*

- Jira ticket: the PM or team lead creates a ticket with what should change and what must not change.
- Implementation: a developer [ or ] the AI agent implements the change and writes the test cases.
- Tests: Playwright and Applitools Eyes run the test cases on the defined devices ( set in `playwright.config.ts` ).
- AI review: the AI checks every visual difference against the ticket and the design system, using the Eyes MCP Server ( deterministic agentic workflow ).
- Report: a PDF report is attached to the Jira ticket.
- Merge: if no bugs are found, it is merged automatically. If bugs are found, a person decides.

Time needed: about one hour. Requirement: admin rights on the GitHub repository and the Jira project.

Note: images with a dashed border are placeholders. Take that screenshot in your own setup and save it with the same file name in `docs/installation/images/`.

---

## Before you start

| You need | Why | Where to get it |
|---|---|---|
| A GitHub repository with your web app | The code and the pipeline live here | - |
| A Jira Cloud site | Tickets, statuses and the PDF reports | [atlassian.com](https://www.atlassian.com/software/jira) |
| An Applitools account | Visual testing on many browsers and devices | [applitools.com](https://applitools.com) |
| A Claude subscription or Anthropic API key | The AI agent that builds and reviews | [claude.com](https://claude.com) |
| Node.js 20 on your laptop | To try the tests locally | [nodejs.org](https://nodejs.org) |

---

## Step 1: Copy the pipeline into your repository (one-time setup)

**Requirement:** a developer with access to your repository.

Copy these folders and files from this sample into the root of your repository:

| Copy | What it is |
|---|---|
| `.github/workflows/` | The automation: tests, AI review, Agent 1, Ticket check, Jira updates |
| `scripts/` | Helpers: Jira, Eyes, the PDF report, the trust report |
| `guidelines/` | The rules the AI follows (you will edit these in Step 3) |
| `.mcp.json` | Connects the AI to the Applitools Eyes MCP server |
| `.github/pull_request_template.md`, `.github/CODEOWNERS` | Optional, recommended |

```bash
# from the folder that contains both repositories
cp -r wikipedia-visual-ci/.github wikipedia-visual-ci/scripts wikipedia-visual-ci/guidelines your-repo/
cp wikipedia-visual-ci/.mcp.json your-repo/
```

Then add the test tools to your project and ignore the pipeline's working folders:

```bash
cd your-repo
npm install --save-dev @playwright/test @applitools/eyes-playwright
npx playwright install chromium
printf 'test-results/\nplaywright-report/\nci-context/\nreview/\nagent-report/\n' >> .gitignore
```

---

## Step 2: Point the pipeline at your app (one-time setup)

**Requirement:** a developer who knows how your app is started.

The pipeline starts your app in GitHub Actions and tests it. You only tell it **how to start** the app,
**where it runs**, and **which folders the AI may change**. You set these as repository variables in Step 8:

| Variable | Example | Meaning |
|---|---|---|
| `APP_START_COMMAND` | `npm run build && npm run preview -- --port 4173` | Starts your app in CI (it runs in the background) |
| `APP_URL` | `http://localhost:4173` | The pipeline waits until this answers, then runs the tests against it |
| `AGENT_ALLOWED_PATHS` | `src/ public/ tests/` | The only folders Agent 1 may change; anything else is thrown away |

Now set up Playwright with Applitools Eyes. Copy `playwright.config.ts` from this sample and change only:

```ts
appName: 'Your app name',
browsersInfo: [                                   // the browsers and devices Eyes checks
  { name: 'chrome', width: 1200, height: 800 },
  { chromeEmulationInfo: { deviceName: 'Galaxy S25 Ultra', screenOrientation: 'portrait' } },
],
```

Leave the rest as it is. It already takes care of Eyes branching, saving and `failTestsOnDiff: false`, so that the AI decides about the differences instead of Playwright.

Write your test cases (functional and visual) in `tests/`. Use the app address from `SITE_URL`, which the pipeline sets for you:

```ts
import { test, expect } from '@applitools/eyes-playwright/fixture';

const BASE = process.env.SITE_URL ?? 'http://localhost:4173';

test('Home page', async ({ page, eyes }) => {
  await page.goto(BASE);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();   // functional check
  await eyes.check('Home', { fully: true });                             // visual check
});
```

Try it locally: start your app, then run `APPLITOOLS_API_KEY=<your key> npx playwright test`.
The results appear in your Applitools dashboard.

---

## Step 3: Write your rules (one-time setup)

**Requirement:** the design team and QA lead agree on the rules.

The AI checks every change against the plain text files in `guidelines/`. You can edit them like documents, no code is needed:

| File | What to put in it |
|---|---|
| `guidelines/design-system.md` | Your colours, fonts, spacing, breakpoints and component rules |
| `guidelines/review-rules.md` | How strict the AI is (e.g. a shift of 2px or less is noise) and what it may do in Eyes |
| `guidelines/agent-implement.md` | How Agent 1 works. Replace the sample's paths (`site/wikipedia/…`) with your own folders |
| `guidelines/agent-fix.md` | How Agent 1 fixes its own bugs. Usually no change needed |

The rules are always read from `main`, so a pull request can't change the rules it is judged by.

---

## Step 4: Get your Applitools keys (one-time setup)

**Requirement:** an Applitools account admin.

You need three keys:
- **API key:** runs the tests.
- **Read key:** lets the AI look at the results.
- **Write key:** lets the AI accept or reject differences.

![Applitools API keys](installation/images/p05-applitools-keys.png)

---

## Step 5: Get a Claude token for CI (one-time setup)

**Requirement:** a Claude subscription or an Anthropic API key.

On your laptop, run:

```bash
npm install -g @anthropic-ai/claude-code
claude setup-token
```

Copy the token it prints. You can use an Anthropic API key (`ANTHROPIC_API_KEY`) instead.

![Claude token](installation/images/p06-claude-token.png)

---

## Step 6: Set up Jira and link it with GitHub (one-time setup)

**Requirement:** the Jira admin installs and configures GitHub for Atlassian.

**6.1 Create one project per product.** The key (e.g. `WIKI`) is how Jira and GitHub find each other:
tickets become WIKI-1, WIKI-2, … and branch names contain that key.

![Create the Jira project](installation/images/p01-jira-create-project.png)

**6.2 Statuses ( must do ).** The workflow needs four statuses: New → In Progress → In Review → Done, and every new ticket must start in New. By default Jira may start new tickets in another status ( in this sample it started them in Done ), so check it:

1. Space settings → Work types → Task → **Edit workflow**.
2. Check the four statuses exist: New, In Progress, In Review, Done. Add a missing one with **Add status**. Delete extra ones ( e.g. Doing, To Do ).
3. Check that each status has the **Any** marker ( work items can move to it from any status ). The pipeline needs this, e.g. to move a ticket from In Review back to In Progress.
4. **The START arrow must point to New.** Click the arrow from START, and set its target status to **New** ( or drag the arrowhead onto New ).
5. Click **Update workflow**. One workflow can cover several work types ( Task, Subtask, Epic ), shown next to "Workflow for".

![Jira workflow: the START arrow must point to New](installation/images/jira-workflow.png)

In the screenshot, START points to New and every status has the Any marker: this is the correct setup.

Board: the columns should be the same four ( Board → ⋯ → Configure board → Columns ).

**6.2b Show every ticket on the board ( must do ).** A Scrum board only shows tickets in the active sprint, and Jira puts every new ticket in the Backlog. Choose one:

(1) Turn sprints off and create tickets from the board ( used in this demo ):
- Space settings → **Features** → **Sprints** → off. The board then shows tickets by status ( New · In Progress · In Review · Done ).
- Create tickets from the board: Board → **New** column → **+ Create**. The ticket appears in New straight away. The **+ Create** button at the top of Jira puts new tickets in the Backlog instead; move them with Backlog → right-click → **Move to board**.

![Jira Features: Sprints turned off](installation/images/jira-sprints-off.png)

![Creating a ticket from the New column on the board](../docs/images/jira-create-ticket.gif)

(2) Keep sprints: add a Jira Automation rule that puts every new ticket in the active sprint.
1. Space settings → **Automation** → **Create rule** ( or "Create from scratch" ).
2. Trigger: **Work item created**.
3. Condition ( recommended ): **Work item fields condition** → Work type is one of **Task** ( sub-tasks follow their parent's sprint ).
4. Action: **Edit work item fields** → **Sprint** → **Active sprint** ( or "Current sprint" ), so the rule keeps working when the next sprint starts.
5. Name it "New tickets → active sprint" and turn it on.

Check: create a ticket. It should appear on the board in the New column.

**6.3 Connect GitHub.** A Jira admin installs **GitHub for Atlassian** (Jira → Apps → Explore more apps),
connects your GitHub organisation and selects your repository. Branches, commits and pull requests then
appear on each ticket under **Development**.

![GitHub for Atlassian](installation/images/p04-github-for-atlassian.png)

**6.4 Create an API token** for the pipeline at
[id.atlassian.com → Security → API tokens](https://id.atlassian.com/manage-profile/security/api-tokens).
Use a service account if you have one, not a personal login.

![Atlassian API token](installation/images/p03-jira-api-token.png)

---

## Step 7: Create the AI's GitHub account, a GitHub App (one-time setup)

**Requirement:** the owner of the GitHub account or organisation.

The AI works with its own GitHub account. This way its pull requests are checked the same way as a developer's, and everything it does is visible.

1. Go to **github.com/settings/apps/new**, or your organisation's Settings → Developer settings → GitHub Apps.
2. Name: e.g. `Eyes MCP Visual Agent`. On pull requests it appears as `eyes-mcp-visual-agent[bot]`.
3. Homepage URL: your repository's URL.
4. Webhook: untick Active.
5. Repository permissions: set Contents, Pull requests and Issues to Read and write.
   Leave everything else as it is.
6. Where can this app be installed: Only on this account.
7. Click **Create GitHub App**. Copy the **App ID**, then click **Generate a private key**. A `.pem` file downloads.
8. Click **Install App** → **Only select repositories** → choose your repository.

![New GitHub App](installation/images/p07-github-app-permissions.png)

![Install the GitHub App](installation/images/p08-github-app-install.png)

---

## Step 8: Add secrets and variables to the repository (one-time setup)

**Requirement:** a repository admin.

Go to your repository → **Settings → Secrets and variables → Actions**.

**Secrets** tab (values are hidden once saved):

| Secret | Value |
|---|---|
| `APPLITOOLS_API_KEY` | Applitools API key (Step 4) |
| `APPLITOOLS_READ_KEY` | Applitools read key (Step 4) |
| `APPLITOOLS_WRITE_KEY` | Applitools write key (Step 4) |
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude token (Step 5), or set `ANTHROPIC_API_KEY` instead |
| `JIRA_BASE_URL` | `https://<your-site>.atlassian.net` |
| `JIRA_EMAIL` | The email of the Jira account that owns the API token |
| `JIRA_API_TOKEN` | The Jira API token (Step 6.4) |
| `BOT_APP_PRIVATE_KEY` | The whole content of the `.pem` file (Step 7). Delete the file afterwards |

![Repository secrets](installation/images/p09-repo-secrets.png)

**Variables** tab:

| Variable | Value |
|---|---|
| `BOT_APP_ID` | The App ID (Step 7) |
| `APP_START_COMMAND` | How to start your app (Step 2) |
| `APP_URL` | Where your app runs in CI (Step 2) |
| `AGENT_ALLOWED_PATHS` | Folders Agent 1 may change (Step 2) |
| `MERGE_POLICY` | `auto` (merge when the AI review passes) or `code-approval` (also needs one person's approval) |

![Repository variables](installation/images/p10-repo-variables.png)

---

## Step 9: Protect `main` (one-time setup)

**Requirement:** a repository admin.

Go to your repository → **Settings → Rules → Rulesets → New branch ruleset**:

| Setting | Value |
|---|---|
| Name | `Protect main` |
| Enforcement | Active |
| Target branches | Default branch |
| Bypass list | Your GitHub App (Always). Repository admin (For pull requests only) |
| Rules | Restrict deletions · Block force pushes · **Require a pull request before merging** · **Require status checks to pass:** `Branch links to a Jira ticket` and `Visual review` |

From now on every change goes through a pull request. A PR without a valid Jira ticket, or with a failed review, cannot be merged.

![Protect main](installation/images/p11-ruleset.png)

---

## Step 10: Add the ⚡ Run Agent 1 button in Jira (one-time setup)

**Requirement:** a Jira project admin, and a GitHub token that can start workflows.

**10.1 A GitHub token for Jira.** Go to
[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new):
- **Repository access:** only your repository.
- **Permissions:** **Actions: Read and write**. Nothing else.

**10.2 The rule.** Go to your Jira project → **Space settings → Automation → Create rule** (or "Create from scratch"):

| Field | Value |
|---|---|
| Trigger | **Manual trigger** (from a work item) |
| Action | **Send web request** |
| URL | `https://api.github.com/repos/<owner>/<repo>/actions/workflows/implement-task.yml/dispatches` |
| Method | `POST` |
| Body | Custom data: `{"ref":"main","inputs":{"key":"{{issue.key}}"}}` |
| Headers | `Authorization` = `Bearer <token from 10.1>` (tick **Hidden**) · `Accept` = `application/vnd.github+json` · `Content-Type` = `application/json` |
| Wait for response | Ticked (the audit log then shows `204` when it worked) |

Recommended: add the condition **Status is not Done** to the rule, so the button is not used on finished tickets.

Name it **⚡ Run Agent 1** and turn it on.

![Jira automation rule](installation/images/p12-jira-automation-rule.png)

---

## Step 11: Create the first baseline (one-time setup)

Go to **Actions → Visual tests → Run workflow** on `main`. The first run saves every screen as the baseline
in Eyes. Every later change is compared with it.

---

## Step 12: Use it, every day

A ticket can be implemented in two ways: (1) the AI agent builds it, [ or ] (2) a developer builds it.

### (1) The AI agent builds it

**1. The PM or team lead creates the ticket** with two lists: *what should change* and *what must not change*.
Optional labels: `bug`, `hotfix`, `human-review`.

**2. Anyone clicks ⚡ Automation → Run Agent 1** on the ticket. It moves to **In Progress**.

![Run Agent 1 in Jira](installation/images/p13-jira-run-agent.png)

**3. Agent 1 works in GitHub Actions.** It creates the branch, builds the change, writes the tests, runs
them in Eyes and reviews every difference with the Eyes MCP. If it caused a bug, it fixes it and tests again.

![The Agent 1 run](installation/images/05-actions-run.png)

**4. The pull request is opened by the AI's account,** with a summary of what changed:

![Pull request opened by the bot](installation/images/06-pr-opened-by-bot.png)

**5. The checks run on the PR.** The Ticket check confirms which Jira ticket it belongs to:

![Ticket check](installation/images/07-pr-ticket-check.png)

**6. The PDF report** is attached to the Jira ticket and linked on the PR:

![PDF link on the PR](installation/images/09-pr-pdf-link.png)

It contains the summary, each bug with why it's a bug and how to fix it, and before / after / difference
images for every change:

![PDF report summary](installation/images/10-pdf-summary.png)

![Before, after and differences](installation/images/11-pdf-before-after.png)

**7. The decision:**
- No bugs found: the baselines are saved, the PR is merged and the ticket moves to Done. No manual effort is needed.
- Bugs the AI cannot fix, or the `human-review` label: the PR and the ticket get the label `needs-human`, the ticket moves to In Review and is assigned to the person who created it, and the PR is blocked.

![A PR blocked because of a bug](installation/images/12-pr-blocked-bugs.png)

![The ticket afterwards](installation/images/p14-jira-result.png)

### (2) A developer builds it

1. Create the branch from the ticket: (1) in Jira, **Development → Create branch** [ or ] (2) in git, with the
   ticket key in its name, e.g. `feature/WIKI-17-make-donate-bold`. Either way it is linked to the ticket.
2. Make the change, add or update the tests, push, and open a pull request.
3. The same checks, AI review, PDF and decision happen automatically. The AI reports bugs but never
   changes a developer's code.

---

## Settings you can change later

| What | How |
|---|---|
| A person must approve this ticket | Add the label `human-review` to the Jira ticket |
| A person must approve every change's code | `scripts/set-merge-policy.sh code-approval` (back with `auto`) |
| How strict the AI is | Edit `guidelines/review-rules.md` |
| Your design rules | Edit `guidelines/design-system.md` |
| Browsers and devices | `browsersInfo` in `playwright.config.ts` |
| How often people agree with the AI | **Actions → Trust report → Run workflow** |

---

## Troubleshooting

| You see | Meaning | Fix |
|---|---|---|
| ❌ *No Jira ticket found* on the PR | The branch name has no key, or the key doesn't exist | Rename the branch: `git branch -m feature/WIKI-17-…`, push, and open a new PR |
| Clicking Run Agent 1 does nothing | The Jira rule's request failed | Jira rule → **Audit log**: `401`/`403` = token or its permission, `404` = URL typo |
| *Site did not start* in the run | `APP_START_COMMAND` or `APP_URL` is wrong | Run the command locally and open the URL |
| *AI visual review paused: usage limit* | The Claude usage limit was reached | Re-run later: Actions → the run → Re-run jobs |
| *The PDF was NOT attached* warning | The Jira token can't add attachments | Check the `JIRA_*` secrets; the PDF is also in the run's artifacts |
| The agent's PR doesn't get checks | The GitHub App isn't installed on the repository | Step 7.8, and `BOT_APP_ID` / `BOT_APP_PRIVATE_KEY` in Step 8 |
| *Functional checks failed* | A Playwright `expect` failed | Fix the code or update the test. The PDF lists the failed checks |

---

## Reference

- Applitools Eyes MCP Server: https://applitools.com/docs/eyes/integrations/mcp-servers/applitools-mcp
- Reviewing test results in Eyes: https://applitools.com/docs/eyes/concepts/reviewing-tests/test-maintenance
- Playwright with Applitools Eyes: https://applitools.com/tutorials/playwright
- Ultrafast Grid browsers and devices: https://applitools.com/docs/eyes/concepts/test-execution/ultrafast-grid-devices-browsers
- GitHub for Atlassian: https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-github/
- GitHub rulesets: https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets
