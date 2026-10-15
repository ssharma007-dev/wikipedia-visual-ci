# From Jira ticket to merged pull request, reviewed by AI

A product manager creates a Jira ticket, and the team lead or dev manager reviews it and adds the details. Once the ticket is Ready, they choose who builds it: a developer [ or ] the AI agent ( ⚡ Run Agent 1 in Jira ). Playwright and Applitools Eyes test the change on the devices listed in the ticket ( or the defaults in `playwright.config.ts` ), and the AI reviews every visual difference against the ticket and the design system using the Applitools Eyes MCP Server.

If no bugs are found, a person approves the pull request with one click and it is merged, or, with the label `auto-ai-merge`, it is merged automatically. The ticket then moves to Done, with a PDF report attached. If the AI caused a bug, it fixes it and tests again. If there are bugs it cannot fix, or the ticket has the `human-review` label, the ticket moves to In Review and a person decides.

The goal: QA and developers no longer compare screenshots by hand. People only step in when a decision is really needed.

## Ticket flow

![Ticket flow: New → Ready → In Progress → In Review or Done](docs/images/ticket-flow.png)

## How it works

1. Create the ticket ( Jira status: New ): the product manager creates the ticket in Jira with what should change and what must not change.

   <img src="docs/images/jira-create-ticket.gif" width="560" alt="Creating a ticket from the New column, adding the description and the text label">
2. Review the ticket ( Jira status: Ready ): the team lead or dev manager reviews the New ticket, adds more details and moves it to Ready. Ready means the ticket is ready to be picked up. In Ready, they choose who handles it: assign a developer [ or ] click ⚡ Run Agent 1 for the AI agent. Optional labels: `feature`, `bug`, `hotfix`, `text`, `human-review`, `auto-ai-merge`, `tests-only` ( no label = feature ). To add a label: open the ticket → Details panel on the right → Labels → type the label → Enter.

   Moving the ticket from New to Ready: open the ticket → click the status ( New ) → Ready.

   <img src="docs/images/jira-new-to-ready.gif" width="560" alt="Changing the Jira ticket status from New to Ready">

   <img src="docs/images/jira-labels.gif" width="360" alt="Clicking Labels in the Jira ticket's Details panel shows the available labels">

   Jira only lists labels that are already used on a ticket. The first time, type the new label ( e.g. `human-review` ) and press Enter to create it; after that it appears in the list.
3. Build the change ( Jira status: In Progress ): the Ready ticket is picked up in one of two ways.
   - (1) Developer: the developer assigns the ticket to themselves [ or ] the team lead or dev manager assigns it to a developer. The developer moves it to In Progress and creates the branch in one of two ways:
     - (a) From Jira: open the ticket → Development panel on the right → Create branch. Jira names the branch with the ticket key ( e.g. `feature/WIKI-17-make-donate-bold` ). Then `git fetch` and `git switch` to it on your laptop.
     - (b) The normal git flow: `git pull` on `main`, `git switch -c feature/WIKI-17-make-donate-bold` ( the ticket key must be in the name ), push, and open a pull request.

     Either way, the branch is linked to the ticket because its name contains the ticket key. The developer then builds the change and opens the pull request.
   - (2) AI agent: the team lead, dev manager or developer clicks the ⚡ ( Automation ) button on the ticket → **Agent 1** ( not the "Agents" button, which is Atlassian's own AI ). The ticket moves to In Progress automatically.

     <img src="docs/images/jira-run-agent-1.png" width="560" alt="Running the custom agent: the ⚡ ( Automation ) button → Agent 1">

     The AI agent then:
     - creates a new branch by itself, following the naming convention ( e.g. `feature/WIKI-21-…`, `bugfix/…` or `hotfix/…` from the ticket's type );
     - follows the steps written in the Jira ticket ( Should change, Must not change, Test on below devices );
     - writes the test cases and runs them with Applitools Eyes;
     - accepts or rejects every difference automatically; with the `human-review` label, a person approves before anything is saved or merged;
     - opens the pull request, with a detailed PDF summary report attached to the Jira ticket and linked on the pull request.

   Run Agent 1 can be clicked at any time before Done. If a developer has already started, the AI continues on the same branch ( see "Run Agent 1 at each status" below ).

   | (1) Developer: creates the branch from Jira ( Development panel → Create branch ) [ or ] in git, with the ticket key in the name | (2) The AI agent: ⚡ ( Automation ) → Agent 1 | The AI agent at work in GitHub Actions |
   |---|---|---|
   | <img src="docs/images/jira-create-branch.png" width="260" alt="Create branch from the Jira ticket"> | <img src="docs/images/jira-run-agent-1.png" width="260" alt="The Agent 1 custom agent in the Jira Automation menu"> | <img src="docs/installation/images/05-actions-run.png" width="260" alt="The Agent 1 run in GitHub Actions"> |
4. Test cases ( Jira status: In Progress ):
   - AI agent: creates the test cases, using the Applitools Eyes MCP Server to add the visual checkpoints, and runs them.
   - Developer: (1) writes the test cases in their IDE, with the help of the Applitools Eyes MCP Server ( Claude Code, Copilot or Cursor ), following the same guidelines as the AI agent. This is the fastest way: write, run and see the Eyes result before pushing. See step 13 in [docs/INSTALLATION.md](docs/INSTALLATION.md) [ or ] (2) pushes the code, adds the label `tests-only` and clicks ⚡ Run Agent 1. The AI keeps the developer's code exactly as it is, and only writes and runs the test cases on the developer's branch. If the developer's code has a bug, the AI reports it, it doesn't fix it. Then `git pull` to get the tests.
   - Applitools Eyes visually tests every screen, component or important area that the Jira ticket names: the full page, or only a component ( e.g. the header links ) when the change is local. It runs on the devices listed in the ticket under "Test on below devices", or, if the ticket lists none, on the defaults in `playwright.config.ts` ( here Chrome desktop and Galaxy S25 Ultra ).
5. AI review ( Jira status: In Progress ): once the results are there, the AI reviews them using the Eyes MCP Server. Every difference is checked against the ticket and the design system.
6. Acceptance ( Jira status: In Progress ):
   - Without the `human-review` label: the AI automatically accepts or rejects each change based on the available information ( the ticket, the design system, the image and DOM differences ).
   - With the `human-review` label: the AI gives its review, and a person approves before anything is saved or merged.
7. Auto fix ( Jira status: In Progress ): if the AI's change causes an issue, the AI fixes it and tests again ( up to 2 rounds ). For every bug it fixed, it creates a Jira sub-task in Done status with the details: what the issue was, why it was a bug, what it fixed and how. If it cannot fix a bug, it creates an open sub-task for a person.
8. Report ( Jira status: In Progress ): after each execution, a PDF summary report is attached to the Jira ticket and linked on the pull request. It shows the results at a glance ( test cases run, passed and failed, visual checkpoints with and without differences, differences accepted or rejected by the AI, bugs found, fixed and left ), the actions the AI took, and the before / after / difference images for every change.
9. Decision ( Jira status: Done or In Review ):
   - No bugs found: the baselines in Eyes are saved, and:
     - by default, a person approves the pull request ( one click ). GitHub then merges it, and the ticket moves to Done;
     - with the label `auto-ai-merge`, the pipeline merges it by itself, and the ticket moves to Done.
   - Bugs it cannot fix, unclear changes, or the `human-review` label ( Jira status: In Review ): the ticket gets the label `needs-human` and is assigned to the person who created it. A person reads the PDF and fixes or approves. When the developer pushes a fix, the AI reviews it again.

   Note: In Review means the work is waiting for a person's decision. It is not used for reviewing the ticket itself ( that happens between New and Ready ).

## Jira status: who is involved when

The Jira ticket moves through five statuses: New → Ready → In Progress → In Review → Done. Anyone ( dev manager, team lead, developer ) can involve the AI agent at any time before Done by clicking the ⚡ ( Automation ) button on the ticket → Agent 1. If a developer has already started, the AI continues on the same branch.

| Jira status | Who | What happens | Screenshot |
|---|---|---|---|
| New | Product manager | Creates the ticket with what should change and what must not change. | <img src="docs/images/status-1-new.png" width="260" alt="Jira ticket in New"> |
| Ready | Team lead or dev manager | Reviews the ticket, adds more details and moves it to Ready. Then chooses who handles it: assigns a developer [ or ] clicks ⚡ Run Agent 1 for the AI agent. | <img src="docs/images/jira-new-to-ready.gif" width="260" alt="Jira ticket moved from New to Ready"> |
| In Progress | Developer [ or ] AI agent | (1) Developer: the assigned developer moves the ticket to In Progress, builds the change, writes the test cases and opens a pull request. The AI then reviews the pull request. (2) AI agent: after Run Agent 1 is clicked, the ticket moves to In Progress automatically, and the AI builds the change, writes and runs the test cases, reviews the results with the Eyes MCP Server and fixes its own bugs. | <img src="docs/images/status-3-in-progress.png" width="260" alt="Jira ticket in In Progress"> |
| In Review | A person ( developer, team lead or dev manager ) | Only when a person needs to decide: bugs the AI could not fix, unclear changes, failed functional checks, or the `human-review` label. The ticket gets the label `needs-human`, is assigned to the person who created it, and has the PDF report attached. The developer fixes and pushes, and the AI reviews again. | <img src="docs/images/status-4-in-review.png" width="260" alt="Jira ticket in In Review"> |
| Done | Pipeline ( automatic ) | The pull request is merged and the baselines in Eyes are updated. The PDF report stays attached to the ticket. | <img src="docs/images/status-5-done.png" width="260" alt="Jira ticket in Done"> |

*Who is involved, in order*

- AI agent path: product manager ( New ) → team lead or dev manager ( Ready, clicks Run Agent 1 ) → AI agent ( In Progress ) → a person only if needed ( In Review ) → Done.
- Developer path: product manager ( New ) → team lead or dev manager ( Ready, assigns a developer ) → developer ( In Progress ) → AI review on the pull request → developer again only if the AI found bugs ( In Review ) → AI review again → Done.

Note:
- The pipeline moves the ticket to In Progress ( AI path ), In Review and Done. New is the status of every new ticket; the team lead or dev manager moves it to Ready.
- If your Jira uses other names ( e.g. "Doing" instead of "In Progress" ), the pipeline accepts "In Progress" or "Doing" by default. You can set your own names with the repository variables `JIRA_STATUS_IN_PROGRESS`, `JIRA_STATUS_IN_REVIEW` and `JIRA_STATUS_DONE`.
- To move the ticket to In Progress automatically when a developer creates a branch, add a Jira Automation rule: trigger "Branch created", action "Transition work item to In Progress".

*Run Agent 1 at each status ( current behaviour )*

| Jira status when clicked | What the AI agent does |
|---|---|
| New / Ready | Creates a new branch from `main`, builds the change, writes and runs the test cases, reviews them and opens the pull request. The ticket moves to In Progress. |
| In Progress ( a developer already started ) | Continues on the developer's branch: builds what is still missing according to the ticket, writes and runs the test cases, reviews everything and pushes to the same pull request. It works from the ticket and the current code. It does not know what the developer planned to do next. |
| In Progress, with the label `tests-only` | Keeps the developer's code as it is. Only writes and runs the test cases on the developer's branch and reviews them. Bugs in the developer's code are reported in the PDF and as Jira sub-tasks, not fixed. Needs the developer's branch to exist. |
| In Review ( the review found bugs ) | Moves the ticket back to In Progress, continues on the same branch and reviews everything again. It may fix the bugs, because it checks the ticket and the design system again, but it does not read the previous review. |
| Done | Not useful: the branch was deleted when it was merged, so the AI starts again from `main` and finds nothing left to do. Tip: in the Jira rule, add the condition "Status is not Done". |

Good to know: when the AI continues on a developer's pull request and the review passes, the pull request still waits for one person's approval by default. With the `auto-ai-merge` label, the pipeline merges it by itself, including the developer's code.

*When the AI review runs ( current behaviour )*

- Automatically on every pull request: when it is opened and on every push to it ( developer path ).
- As part of Run Agent 1: the AI reviews its own work before it opens the pull request ( AI path ).
- On demand, from GitHub: Actions → Visual tests → Run workflow → enter the pull request number. There is no Jira button for a review only, yet.

## Writing a Jira ticket ( sample )

The AI builds and reviews the change based on what the ticket says, so a clear ticket gives a better result. Most important: the "Must not change" list. This is what the AI uses to tell a real change from a bug.

*Fields*

| Field | Required / Optional | What to write | Why it matters |
|---|---|---|---|
| Summary | Required | One line: what changes, where. e.g. "Make the Donate link bold in the article header" | Becomes the branch name and the PR title |
| Should change | Required | The changes you expect, one per line, with the page and the device if it matters | The AI accepts only these differences as real changes |
| Must not change | Required | What must stay exactly as it is ( other pages, other devices, nearby elements ) | Anything on this list that changes is reported as a bug |
| Why | Optional | The reason for the change | Helps the reviewer and the AI understand the intent |
| Pages / screens | Optional | Where the change is visible | Helps the AI find the relevant test cases |
| Test on below devices | Optional | e.g. "Galaxy S25 Ultra", "Chrome desktop 1200×800" | The devices Applitools Eyes tests this ticket on. Without it, the defaults in `playwright.config.ts` are used |
| Design reference | Optional | A design system rule or a Figma link | Checked together with `visual-agent/guidelines/design-system.md` |
| Steps to reproduce, Actual, Expected | Required for a bug or hotfix | How to see the bug, what you see now, what you should see | The AI first reproduces the bug, then fixes it and adds a regression test |
| Labels | Optional | `feature`, `bug`, `hotfix`, `text` ( a text-only change: the AI expects only text to change and checks the new text fits ), `human-review`, `auto-ai-merge` ( merge without waiting for a person's approval ), `tests-only` ( the developer built it; the AI only writes and runs the tests ) ( extra types: `refactor` = no visual change expected, `a11y` = accessibility ) | Tells the AI the type of work ( no label = feature ). `human-review` means a person approves before the merge |
| Work type | Optional | Task ( default, treated as a feature ) or Bug | A Bug work type is treated like the `bug` label |

*Template ( copy into the Jira description )*

```
Why:
<optional: the reason for the change>

Should change:
- <change 1, with the page / device if it matters>
- <change 2>

Must not change:
- <what must stay exactly as it is>
- <other pages, other devices, nearby elements>

Pages / screens: <optional>

Test on below devices ( optional ):
- <e.g. Chrome desktop 1200×800>
- <e.g. Galaxy S25 Ultra>

Design reference: <optional: design system rule or Figma link>
```

Note: "Test on below devices" decides where Applitools Eyes tests this ticket. The pipeline reads the list and runs the tests on exactly these devices. Without the list, the defaults in `playwright.config.ts` are used ( here Chrome desktop 1200×800 and Galaxy S25 Ultra ). How to write a device:
- Desktop browser: `Chrome`, `Firefox`, `Safari` or `Edge`, with the size, e.g. `Chrome desktop 1200×800` ( default size 1200×800 ).
- iPhone or iPad: the device name, e.g. `iPhone 15`.
- Other phones and tablets: the device name, e.g. `Galaxy S25 Ultra`, `Pixel 7`.

The device names must be supported by the Applitools Ultrafast Grid ( see the Reference in [docs/INSTALLATION.md](docs/INSTALLATION.md) ).

*How it looks in Jira*: create the ticket from the board's New column, paste the description, add the label, Save.

<img src="docs/images/jira-create-ticket.gif" width="560" alt="Creating a ticket from the New column, adding the description and the text label">

*Sample 1: a text change*

```
Summary: Change the portal tagline to "The Free Encyclopedia for everyone"
Labels: text

Why:
Marketing wants the portal to feel more welcoming for first-time visitors.

Should change:
- On the Wikipedia portal page, the tagline under the Wikipedia wordmark reads
  "The Free Encyclopedia for everyone" instead of "The Free Encyclopedia".

Must not change:
- The wordmark, the language links around it and the search bar.
- Anything else on the portal page.
- The article pages.

Test on below devices:
- Chrome desktop 1200×800
- Galaxy S25 Ultra
```

*Sample 2: a bug*

```
Summary: Search button is cut off on phones
Work type: Bug ( or label: bug )

Steps to reproduce:
1. Open the Wikipedia portal on a phone ( e.g. Galaxy S25 Ultra ).
2. Look at the search bar.

Actual:
The Search button is cut off at the right edge of the screen.

Expected:
The whole Search button is visible, next to the search field.

Must not change:
- The search bar on desktop.
- The rest of the portal page.

Test on below devices:
- Galaxy S25 Ultra
- Chrome desktop 1200×800
```

Tip: add the label `human-review` when the change is sensitive ( e.g. checkout, legal text ) and a person must approve before the merge.

## Documents

All the documents are in the [`docs/`](docs/) folder. Please read them in this order:

1. [FLOW.md](docs/FLOW.md): how it works, step by step, and which files are involved in each step.
2. [PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md): what each folder does, why it is important, and what to keep, adapt or replace for your own project.
3. [INSTALLATION.md](docs/INSTALLATION.md): how to set it up in your own project, with screenshots.

## Who is it for (user journey)

*The problem today*

- Developers change a component and nobody tells the design team. Often the only trace is a Slack message between a designer and a developer.
- The QA team finds these differences late, by comparing the product with the design by hand, and then starts a discussion with the developer or the product team.
- Every UI change needs someone to open the visual test results and decide, one by one, if each difference was intended.

*How each person uses this flow*

- Product manager: creates the Jira ticket with what should change and what must not change. Gets a PDF report in the ticket, without chasing anyone for the status.
- Team lead / dev manager: reviews the ticket, moves it to Ready and chooses who builds it: a developer [ or ] the AI agent.
- Developer: creates the branch from the ticket, or lets the AI agent build it. Gets the review in the pull request within minutes, before the change reaches QA.
- QA team: no longer compares every screen by hand. The AI does the first review, and QA looks only at what was flagged: bugs, design rule breaks and unclear changes. The PDF ( differences classified by severity, with evidence ) becomes the starting point for the discussion with design and development.
- Design team: the design system is written once in `visual-agent/guidelines/design-system.md`, and every pull request is checked against it. An undocumented change to a component is caught in the build, not in production.
- Engineering manager: sees in the trust report how often people agree with the AI, before deciding how much to automate.

*Example*

The product manager creates WIKI-21: "Rename Free learning resources to Free learning materials on the portal", with "Test on below devices: Firefox desktop 1280×800, Galaxy S25 Ultra". The team lead reviews it, adds the labels `text` and `auto-ai-merge`, moves it to Ready and clicks ⚡ Run Agent 1. About 9 minutes later the change is implemented, tested on exactly those two devices ( 8 test cases passed, 12 visual differences accepted, 0 bugs ), merged, and the ticket is Done with the PDF attached. No one had to compare a screenshot.

*Coming next*

Comparing the implementation directly with the Figma design ( Eyes MCP Server + Figma MCP ), so that a build which doesn't match the design fails before it reaches QA.

## The flow

```mermaid
%%{init: {"flowchart": {"wrappingWidth": 260, "nodeSpacing": 30, "rankSpacing": 45, "curve": "basis"}}}%%
flowchart TD
    subgraph S1["Jira status: New"]
        A["👩‍💼 <b>Product manager</b><br/>creates the ticket: what should change, what must not"]
    end
    subgraph S2["Jira status: Ready"]
        B["🧑‍💼 <b>Team lead / dev manager</b><br/>reviews the ticket, adds details and moves it to Ready"]
        C{"Who builds it?"}
    end
    subgraph S3["Jira status: In Progress"]
        D["👩‍💻 <b>Developer</b><br/>builds the change, writes the test cases, opens a pull request"]
        E["🤖 <b>AI agent</b><br/>builds the change, writes the test cases, opens a pull request"]
        F["🧪 <b>Tests run automatically</b><br/>Playwright + Applitools Eyes, on the defined devices"]
        G["🔍 <b>AI review with the Eyes MCP Server</b><br/>every difference vs the ticket and the design system · PDF report to Jira and the PR"]
        H{"Result?"}
        I["🔧 <b>AI fixes its own bug</b><br/>and tests again ( max 2 rounds )"]
    end
    subgraph S4["Jira status: In Review"]
        J["👤 <b>A person decides</b><br/>reads the PDF, then fixes or approves · label needs-human · Jira sub-task per bug"]
    end
    subgraph S5["Jira status: Done"]
        K["✅ <b>Merged</b><br/>baselines saved in Eyes, PDF stays on the ticket"]
    end

    A -->|"ready for review"| B
    B --> C
    C -->|"assign a developer"| D
    C -->|"⚡ Run Agent 1"| E
    D --> F
    E --> F
    F --> G
    G --> H
    H -->|"no bugs: approved, or auto-ai-merge"| K
    H -->|"a bug the AI caused"| I
    I --> F
    H -->|"bugs it can't fix · unsure · human-review"| J
    J -->|"developer pushes a fix"| F
    J -->|"approved and merged"| K

    classDef person fill:#FFF4E5,stroke:#E8A33D,color:#3B2A12
    classDef ai fill:#E8F1FF,stroke:#4A7BD0,color:#14284B
    classDef auto fill:#EEF7F0,stroke:#4E9A64,color:#173B22
    classDef good fill:#DFF3E4,stroke:#2E8B57,color:#123D24,stroke-width:2px
    classDef decide fill:#FBE9E7,stroke:#C8553D,color:#4A1C12,stroke-width:2px
    class A,B,D person
    class E,G,I ai
    class F auto
    class K good
    class J decide
    style S1 fill:#FAFAFA,stroke:#B0B7C3
    style S2 fill:#FAFAFA,stroke:#B0B7C3
    style S3 fill:#F4F8FF,stroke:#8FA8D6
    style S4 fill:#FFF6F4,stroke:#D9A093
    style S5 fill:#F3FBF5,stroke:#8CC29E
```

How to read it: each grey or coloured band is a Jira status ( New → Ready → In Progress → In Review → Done ), so you can see where the ticket is and who has it. Orange = a person, blue = the AI agent, green = automatic. The same diagram as an image, for slides or a blog: [user-flow.png](docs/images/user-flow.png).

Each band is explained step by step in [How it works](#how-it-works) above, and with the files involved in [docs/FLOW.md](docs/FLOW.md).

## What's where

| Path | What it is |
| --- | --- |
| `visual-agent/` | The reusable part: copy it into your own project |
| `examples/wikipedia/` | The demo: the Wikipedia site ( `site/` ) and its Playwright + Eyes tests ( `tests/` ) |
| `docs/` | The documents: how it works, project structure, installation guide |
| `visual-agent/guidelines/` | The rules the AI follows: plain text, edit to change its behaviour |
| `.github/workflows/` | The pipeline |
| `visual-agent/scripts/` | Helpers: Jira, Eyes, the PDF report |

## Setup

For the full step-by-step setup in your own project ( with screenshots ), see [docs/INSTALLATION.md](docs/INSTALLATION.md).

1. Install **GitHub for Atlassian** in Jira and connect this repository.
2. Jira workflow ( must do ): five statuses New → Ready → In Progress → In Review → Done, and the START arrow pointing to **New**, so every new ticket starts in New. See step 6.2 in [docs/INSTALLATION.md](docs/INSTALLATION.md).
3. Jira board ( must do ): create tickets from the board's New column ( + Create in the column ), because the + Create button at the top of Jira puts them in the Backlog. If your team uses sprints, add a Jira Automation rule "Work item created → Sprint = Active sprint". See step 6.2b in [docs/INSTALLATION.md](docs/INSTALLATION.md).
4. Add these repository secrets: `APPLITOOLS_API_KEY`, `APPLITOOLS_READ_KEY`, `APPLITOOLS_WRITE_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`), `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`.
5. A Jira Automation rule for the **Run Agent 1** button, calling this repo's `implement-task.yml` workflow with the ticket key. See step 10 in [docs/INSTALLATION.md](docs/INSTALLATION.md).

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

The AI can accept or reject changes in Eyes, but it can never save baselines, push or merge: the pipeline does that, and only when there are no bugs. It can change only the folders in `AGENT_ALLOWED_PATHS` ( here `examples/wikipedia/site/` and `examples/wikipedia/tests/` ).

`main` is protected: every change goes through a pull request, and two checks must pass before anyone can merge: **Branch links to a Jira ticket** and **Visual review** (the AI review, functional checks included). A PR that only changes docs or the pipeline needs no Jira ticket and no visual review. The AI works as its own GitHub account, `eyes-mcp-visual-agent[bot]`, so everything it does is visible and checked like a developer's.

By default a person approves every pull request. To let the pipeline merge without approval for the whole repository, run `visual-agent/scripts/set-merge-policy.sh auto` (back with `code-approval`), or use the `auto-ai-merge` label per ticket. How often people agree with the AI: **Actions → Trust report**.

This is a demo that merges straight into `main`. Adapt it to your branches (staging, QA, release) and add a human code approval as your team needs.
