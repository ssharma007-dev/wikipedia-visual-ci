# WIKI-12 — Search button is cut off on phones

**Type:** Task · **Priority:** High · **Status:** Done · **Reporter:** Shreya Sharma
**Source:** Jira — https://testing-visual-ci.atlassian.net/browse/WIKI-12
**Labels:** bug, visual

### Steps to reproduce

1. Open the portal (www.wikipedia.org) on a phone, e.g. Galaxy S25 Ultra (384px wide).
2. Look at the search bar under the logo.

### Actual

The blue Search button is pushed to the right, past the edge of the screen, and the page scrolls sideways.

### Expected

The Search button sits directly to the right of the search input, fully visible (design system: invariants 1 and 4).

### Environment

- Phone breakpoint (<= 480px). Desktop and tablet look correct.

### Must not change

- Desktop and tablet search bar.
- Everything else on the portal and article pages.
