# Wikipedia design system

The rules every page must follow, in every pull request. Owned by the design team; changes go
through their own reviewed PR (see `.github/CODEOWNERS`). The visual review agent checks every
visual change against this file, and **it overrides tickets**: a ticket cannot approve a violation.

## 1. Color tokens

| Token | Value | Use |
|---|---|---|
| `color-base` | `#202122` | Body text |
| `color-subtle` | `#54595D` | Secondary text, captions, article counts |
| `color-progressive` | `#3366CC` | Links and primary actions on **article pages** |
| `color-brand-primary` | `#0E7C7B` | Primary actions on the **portal** (2026 brand refresh) |
| `color-inverted` | `#FFFFFF` | Text on primary buttons |
| `background-base` | `#FFFFFF` | Page background |
| `background-subtle` | `#F8F9FA` | Secondary buttons, panels |
| `border-base` | `#A2A9B1` | Input and button borders |

- Use only these tokens. No new colors without a design-system change.
- Text contrast is at least **4.5:1** against its background (3:1 for text 24px and larger).

## 2. Typography

- Portal and UI: system sans-serif stack. Article headings: serif (Linux Libertine / Georgia).
- Labels use **sentence case**: "Log in", "Create account", "Search" — never "LOG IN" or "Log In".
- Text never truncates or overflows its container.

## 3. Layout and breakpoints

| Breakpoint | Width | Notes |
|---|---|---|
| Phone | ≤ 480px | Single column; search bar spans the content width |
| Tablet | 481–899px | |
| Desktop | ≥ 900px | |

- No horizontal scrolling at any breakpoint.
- Spacing on a 4px grid. Elements do not shift unless a ticket asks for it.

## 4. Components

**Portal search bar** — input plus a primary "Search" button directly to its right, same height
(44px). Button: `color-brand-primary` background, `color-inverted` icon, 2px radius on the right corners.

**Article header search** — input plus a secondary "Search" button: `background-subtle`,
`color-base` text, `border-base` border. It is a *secondary* button and is not a primary action.

**Header links** — "Donate", "Create account", "Log in": `color-progressive`, sentence case, one line.

**App badges** — "Get it on Google Play" and "Download on the App Store", side by side, same
height, centered in the "Download Wikipedia" box.

**Logo** — the globe and the "Wikipedia" wordmark never overlap.

## 5. Invariants — must never break

1. Every interactive element (button, input, link, menu) is **fully visible**: not covered, cut or off-screen.
2. Tap targets are at least **44 × 44px** on phone.
3. The logo globe and wordmark **never overlap**.
4. **No horizontal scrolling** on any breakpoint.
5. Only the **color tokens** above are used, and contrast rules hold.
6. A primary-action color is used **only** for the primary action of that page type (portal: brand
   teal; article pages: progressive blue). Secondary buttons stay secondary.
