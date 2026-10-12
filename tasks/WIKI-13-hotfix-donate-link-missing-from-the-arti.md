# WIKI-13 — HOTFIX: Donate link missing from the article header during the fundraising campaign

**Type:** Task · **Priority:** Highest · **Status:** Done · **Reporter:** Shreya Sharma
**Source:** Jira — https://testing-visual-ci.atlassian.net/browse/WIKI-13
**Labels:** bug, hotfix, visual

### Impact

The year-end fundraising campaign is live. Readers cannot find the Donate link on article pages, so donations are dropping right now.

### Steps to reproduce

1. Open any article page, e.g. /wiki/Functional_testing, on desktop.
2. Look at the header links at the top right.

### Actual

Only "Create account" and "Log in" are shown. "Donate" is gone.

### Expected

"Donate", "Create account" and "Log in" are all shown, as before (design system: Header links).

### Environment

- All breakpoints, article pages. Appeared after the "Refactor: consolidate search bar and header menu styles" commit.

### Must not change

- Anything except restoring the Donate link — this is a hotfix, keep the change minimal.
