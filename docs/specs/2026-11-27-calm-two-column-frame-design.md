# Calm two column frame design

Date: 2026-11-27 · Status: draft for review
Intent: docs/intents/calm-two-column-frame.md (Thanh Truong, lead)
Ticket: TOKI-145

## Goal
A person who uses the look Calm sees a rail of section buttons and, on Home, the list of conversations beside it, as in Focus and Classic. Today Calm shows one sidebar of 272 px, and Calm is the default look, so the rail is never seen.

## Scope
- In: the frame of Calm on a window of 720 px or more (rail, conversation column, what each holds, and the numbers that follow); the Preferences button on the Calm rail; the same frame in the prototype; the reference images of the UI parity check for Calm; the tests; the lines of earlier specs that describe the Calm sidebar.
- Out (not now): Focus and Classic; the layout under 720 px; rail buttons for sections that have no screen yet; a screen or control that changes the look; the default look; the rows, headings, filter and search field of the conversation list; colours and radii of Calm.

## Requirements
- R1. Home. With the look Calm, on a window of 720 px or more, on Home with a list, the rail is 68 px wide, the conversation column is 288 px wide and ends at x 356, and the main area starts at x 356. Check: the browser test at 1100 and at 720 px.
- R2. Other sections. Outside Home, Calm shows the rail alone: the conversation column is not displayed and the main area starts at x 68. Check: the browser test in the section Activity.
- R3. The rail. The Calm rail holds what the Focus rail holds, drawn the same way: the workspace as its letter tile without the name and head count, the search as an icon with no text, each section as an icon over its label in a row 50 px high, the badges on the icons, and the account at the foot as the avatar alone. The rail has a line of 1 px on its right. Check: the browser measurements of the Focus rail also pass in Calm.
- R4. Calm stays Calm. The colours, the radii and the shadows are those of Calm in light and dark. The main area and the side panel stay cards with a margin of 12 px above, below and on the right, and none on the left. The conversation list keeps Calm's header padding, filter padding, row height of 32 px and group heading padding. The conversation column has no line on its right. Check: the browser test reads the margins, the radius of the main area, the height of a row and the border of the column.
- R5. Preferences. The Calm rail shows a Preferences button, and pressing it opens the Preferences page. The field `calmHidden` of a navigation section and the attribute `data-calm-hidden` no longer exist. The account menu keeps its Preferences entry. Check: a unit test of the section list and the component, and a browser test that presses the button in Calm and finds the menu entry.
- R6. Short windows. In windows 1100 px wide and 560, 480 and 420 px high, with the sections of an Admin and two more, the rail's items scroll when they do not fit, each keeps its height, and the workspace tile, the search button and the account lie inside the window. The 240 px floor of the Calm conversation column and its custom property `--shell-convs-min` no longer exist, because the column has the whole height. Check: the browser test.
- R7. Panel and toasts. From 720 to 1099 px a side panel overlays the main area and does not change its box. From 1100 px it is a column. The toast anchor has the box of the main area, and from 956 to 1099 px with the panel open it also leaves out the panel's 360 px and the 12 px margin. In Calm on Home the widths are those of Table A. Check: the browser test at the five widths.
- R8. Nothing else moves. Focus and Classic on any width, and all three looks under 720 px, look and behave as before. Check: their browser measurements pass without a change of a number.
- R9. The prototype. `e2e/prototype/index.html` draws the Calm frame of R1 to R6. Its phone layout and its guest view do not change. Check: a browser test measures the rail, the column and the main area of the prototype in Calm.
- R10. The parity check. Every reference image of a Calm screen is made again from the changed prototype, never from the app, and the new hash is recorded in `e2e/parity/prototype.sha256`. Check: `pnpm test:e2e:parity` runs with no missing reference, and the pull request holds its report.
- R11. The earlier specs. The pull request that changes the code also changes, in place, each line that describes the Calm sidebar: the app shell spec (R5, R18, R19, R20, "The three layouts", "The sidebar scrolls", Tables E, F and J, concern 7), the look and scheme model spec (R5), the conversation list spec (R24 a), the account menu spec (R21), the Preferences screen spec (the Calm hiding of the Preferences row), the component preview spec (what Calm means) and the app shell QA spec (R18). Check: no line of `docs/specs/` states the 272 px sidebar or the hidden Preferences row as current behaviour.

## Design
### Table A: widths in Calm on Home
Computed from the rules above. The browser test confirms them.

| Window width | 720 | 800 | 956 | 1099 | 1100 |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Main area, no panel (today in brackets) | 352 (436) | 432 (516) | 588 (672) | 731 (815) | 732 (816) |
| Main area, panel open | 352 | 432 | 588 | 731 | 360 (444) |
| Toast anchor, panel open | 352 | 432 | 228 (312) | 371 (455) | 360 (444) |

### Screens
1. Home in Calm: rail, conversation column, main card, and the side panel when open.
2. Any other section in Calm: rail and main card.

### The style sheet
In `packages/ui-web/src/layout/shell.css`:
- The Calm block keeps only the rules of the main area, the side panel and the toast anchor. Its rules for the sidebar, the navigation, the workspace header, the search box, the items and the account card are removed.
- The rules that draw the sidebar, the rail, the column's frame and the account name the three looks.
- The rules of Focus and Classic for the side panel's border, the section header, the section body and the toolbar keep naming those two looks, so Calm keeps its own spacing there.
- One new rule takes the line off the right of the Calm conversation column.
- `conversation-list.css` is not changed.

### The components and the wiring
`NavSection` loses `calmHidden`, and `NavItem` no longer writes `data-calm-hidden`. `sections.ts`, the route that maps the rows and the shell fixture lose the field. The app still gives the list to the shell on every section; the style sheet shows it on Home only, as it does for Focus.

### The prototype
The rules of the prototype that give Focus and Classic their rail and column also name Calm. The Calm rules inside the wide layout that size the one sidebar and hide Preferences are removed. The Calm rules for the main area, the side panel and the list rows stay. The guest view keeps its own grid.

### Layout
```
packages/ui-web/src/layout/{shell.css,NavSection.tsx}
packages/ui-web/tests/layout/{shell.css.test.ts,AppShell.test.tsx}
apps/web/src/layout/sections.ts, src/routes/app-layout.tsx, scripts/shell-fixture/Fixture.tsx
apps/web/tests/layout/sections.test.ts
e2e/prototype/index.html, e2e/app-shell.spec.ts, e2e/parity/{prototype.sha256,reference/}
docs/specs/ (the files of R11)
```

## Testing
- Written first, each seen to fail for the right reason: the section list and component tests (R5), the style-sheet tests (R3, R4, R6, R8), then the browser tests of the shell in Calm (R1 to R7) and of the prototype (R9).
- The other browser tests that run in Calm are run, and each one that looked for the conversation list or the workspace name outside what R2 and R3 show is changed to reach it the new way.
- Fake data only: the shell fixture and the sample data of the prototype.
- Before the pull request: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` and `pnpm test:e2e:parity` run, and their results are in the pull request.

## Data safety
- Nothing is stored or sent. The change is layout only.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Focus and Classic look and behave as they do now | R8 |
| The narrow layout (719 px and below) does not change in any look | R8, R9 |
| The rail shows only the sections that already work | Scope (Out); the section list gains no row |
| The default look stays Calm | Scope (Out); the call in `apps/web/src/main.tsx` is not changed |
| The app and the prototype do not disagree about Calm once this work is done | R9, R10 |

## Open questions from the intent
- Does the account menu keep its Preferences entry in Calm now that the rail has a button for it? Yes, the menu keeps its entry (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- On a window of 720 px the chat in Calm becomes about 84 px narrower than today. Is that acceptable, or does Calm need another width? It is accepted: Calm uses the widths of Focus at every width from 720 px (R1, Table A). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Is the change of the prototype part of the same ticket as the app, or a ticket of its own that comes first? The same ticket (R9, R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- The Calm column in the preview has no dividing line before the chat card. Is that the intended look? Yes: the rail has a line and the conversation column has none (R3, R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.

## Areas of concern
1. The account menu entry. `apps/web/src/account/AccountHost.tsx` adds Preferences to the account menu in every look, and Focus already shows both the rail button and the menu entry. Decided: the menu keeps the entry in Calm (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
2. A narrower chat. The main area loses 84 px at every width from 720 px (Table A). With a panel open from 956 to 1099 px, a toast has 228 to 371 px, and Focus has 240 to 383 px there. Accepted: Calm uses the widths of Focus, with no width of its own. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
3. One ticket or two. The parity check compares the app with the prototype, so a change of only one of them shows differences on every Calm screen until the other follows. Decided: one ticket changes both. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
4. The dividing lines. Decided: the rail has a line on its right, and the conversation column has none because the main card's shadow separates them (R3, R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
5. The card beside the rail. Outside Home the main card touches the rail's line, because it has no left margin. The prototype's guest view gives its Calm card a left margin of 12 px. Decided: no left margin outside Home either (R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
6. The open QA ticket of the app shell checks the 272 px sidebar. Decided: the pull request that changes the code changes the line of its spec (R11); a QA run made before that merge checks today's numbers. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
