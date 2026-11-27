# Classic sidebar frame design

Date: 2026-11-27 · Status: draft for review
Intent: docs/intents/classic-sidebar-frame.md (Thanh Truong, lead)
Ticket: TOKI-144

## Goal
With the look Classic the app shows the frame of Focus (a rail of 68 px and a conversation column of 288 px) in the colours of the page. The owner's picture of Classic has a dark rail and a dark column in both schemes, with the Browse channels link under the channels. The prototype draws it. This ticket draws that frame in the app: the dark rail and column, the colours of everything in them, the Browse channels link between the groups, and nothing else. The header of the column, its search, the quick links and the buttons of the rail are the next tickets.

## Scope
- In: six new custom properties for the sidebar's colours, in the two Classic blocks of the tokens; the rules of `shell.css` and `conversation-list.css` that colour the rail, the column and what they hold, for the look Classic only; the place of the Browse channels link in Classic; the tests of these (tokens, style sheets, browser).
- Out (not now): the workspace header with its name, dot and buttons; the "Find a conversation" search; the quick links; the buttons of the rail (DMs, More, "+", the sun, the avatar with its presence dot); any change of a size; the Look cards; saving the look; reference images of the UI parity check for Classic (the ticket that updates the check adds them); Calm and Focus.

## Requirements
- R1. Six properties. The tokens give the two Classic blocks (`:root[data-look="classic"][data-scheme="light"]` and `…[data-scheme="dark"]`) six more custom properties: `--side-rail`, `--side-bg`, `--side-ink`, `--side-muted`, `--side-line` and `--side-hover`, with the values of Table A. The other four blocks and the device block do not declare them, so a Classic block declares 38 properties and the others 32 (the tokens spec R10 and R11 say so, R11). `getTheme` still returns the 32 properties; a new function `getSideColours(scheme)` returns the six. Check: a tokens test of the six values in both blocks, of the 38 and the 32, and of `getSideColours`; the comparison of the tokens with the prototype (`e2e/support/tokens-prototype.test.ts`) also compares the six.
- R2. The frame is dark. For `[data-look="classic"]` on a window of 720 px or more: the rail (`.nav`) has the background `var(--side-rail)` and a right border of `var(--side-line)`; the column (`.convs`) has the background `var(--side-bg)` and a right border of `var(--side-line)`; the text and icons of the rail are `var(--side-muted)` and, when pressed or hovered, `var(--side-ink)` on `var(--side-hover)`. The page, the main area and the side panel keep the colours of the scheme. Check: a table of these rules in the shell test (the selector and its declarations, as the existing tests list them) and a browser test of the computed colours in Classic light and Classic dark.
- R3. What the column holds, in Classic. The heading of the column, the headings of the groups (`.sec`, same capital letters and size as in Focus), the rows (`.cr`: glyph, name, draft, star), the count badges, the "+" button of a group, the search field and the filter chips, the notice and the empty state take their colours from the side properties: text `var(--side-ink)` or `var(--side-muted)`, lines `var(--side-line)`, a hover `var(--side-hover)`. A row that is unread keeps its bold name. The presence dot of an avatar has a ring of `var(--side-bg)` so it does not show the colour of the page. Check: the style-sheet test lists the rules, and the browser test reads the computed colour of one element of each kind in both schemes.
- R4. The open conversation. The row with `aria-current` has the background `var(--accent)` and the text and glyph `var(--on-accent)`, as in the prototype; the count badge on a row takes `var(--accent)` and `var(--on-accent)`. Check: the browser test reads both in the two schemes and with the accent indigo.
- R5. Readable on the dark ground. The text colours of R2 and R3 against their backgrounds have a contrast ratio of at least 4.5:1 for `--side-ink` and `--side-muted` on `--side-bg` and `--side-rail`, and `--on-accent` on `--accent` is at least 4.5:1 for the four accents in both schemes. Check: a unit test computes the ratios from the values.
- R6. The filter stays. The chips All, Unread and Mentions stay in Classic, drawn as R3 says, until the ticket that adds the quick links replaces them. The filter and its saved value work as in the other looks (TOKI-017 R17, R18). Check: the browser test of the list in Classic has the chips and filters the rows.
- R7. The Starred group and the collapse of a group stay in Classic as in the other looks. Check: the browser test of the list in Classic shows a Starred group when a row is starred, and collapses and opens a group.
- R8. The Browse channels link between the groups. In Classic the row `button.cr.browse` is shown between the group Channels and the group Direct messages, and after the group Starred when only that group comes before; in Calm and Focus it stays the last row of the list. This is done with the style sheet alone: in Classic `.clist` is a column that lays out its children, `.cgroup[data-group="starred"]` and `.cgroup[data-group="channels"]` come first, then `.cr.browse`, then `.cgroup[data-group="direct"]`, by the property `order`; the order of the elements in the page does not change. Check: the style-sheet test lists the rules, and the browser test reads the vertical order of the three in Classic and the last place of the link in Calm and Focus.
- R9. Nothing else moves. In Classic the rail stays 68 px and the column 288 px (356 px on Home), the narrow layout keeps the bottom bar, the shell's other rules stay as the shell spec's Tables F and J say. Check: the existing measurements of the shell in the browser, run for Classic, have the numbers of Focus.
- R10. Calm and Focus are the same. No rule that applies to Calm or Focus changes, and the new rules name `[data-look="classic"]` alone. Check: the browser measurements of the shell and the list in Calm and Focus pass as they are; a test that every new selector of R2, R3, R4 and R8 names `[data-look="classic"]` and no other look.
- R11. The rules use the design system's names. The new rules in `shell.css` and `conversation-list.css` hold no colour literal: every colour is `var(--…)` of the 32 properties, the six of R1, or `transparent` (the shell spec R17 says so, and its list of allowed names gains the six). Check: the existing test of the names.
- R12. The specs change with the code. The development of this ticket edits, in place and in its own pull request, each line that says what it replaces: the tokens spec (R10 and R11 on the 38 properties of a Classic block, R16 on the six compared with the prototype), the shell spec (R17 on the six names, Tables F and J: the Classic rows, and the note under Table F: the rules of colour are no longer shared with Focus), the list spec (R12 and its Table A: the Classic rules, and R8 on the place of the Browse row in Classic) and the UI parity spec (nothing: the reference images of Classic come with the ticket that updates the check). Check: the diff of the pull request holds these edits.

## Design
### Table A: the six values (the prototype as merged, PR #443)
| Property | Classic light | Classic dark |
| :---- | :---- | :---- |
| `--side-rail` | `#0F1719` | `#0A0E0F` |
| `--side-bg` | `#16201D` | `#12181A` |
| `--side-ink` | `#E4EBE8` | `#E8EDEB` |
| `--side-muted` | `#9AA8A3` | `#96A29D` |
| `--side-line` | `#26332F` | `#232C30` |
| `--side-hover` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.07)` |

The values are read from the two Classic blocks of `e2e/prototype/index.html` (its hash is in `e2e/parity/prototype.sha256`).

### The tokens
`tokens.ts` holds `sideColours: Record<Scheme, SideColours>`; `css.ts` writes the six declarations at the end of each Classic block; `theme.ts` exports `getSideColours(scheme)`. The 32 properties and `getTheme` are not changed.

### The style sheets
- `shell.css`: the rules of R2, written for `[data-look="classic"]` on a window of 720 px or more, after the shared rules of Table F, so they win by order.
- `conversation-list.css`: the rules of R3, R4 and R8 in the same media block (`(min-width: 720px)`), for `[data-look="classic"]`.
- No component changes: the list is the same component with the same markup in all looks.

### Layout
```
packages/tokens/src/{tokens,theme,css,index}.ts, tokens.css, tests/tokens.test.ts
packages/ui-web/src/layout/shell.css, conversation-list/conversation-list.css
packages/ui-web/tests/layout/shell.css.test.ts, conversation-list/conversation-list.css.test.ts, a contrast test
e2e/classic-frame.spec.ts, e2e/support/tokens-prototype.test.ts
```

## Testing
- Written first, each seen to fail for the right reason: the tokens tests (R1), the contrast test (R5), the style-sheet tests (R2, R3, R4, R8, R10, R11), then the browser test `e2e/classic-frame.spec.ts` (R2 to R4, R6 to R9) in Classic light and Classic dark, at 1100 px and at 720 px, with the fixture of the shell and with the list.
- No new library, no network: fake data, the fixture and the generated tokens.
- Before the pull request: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` and `pnpm test:e2e:parity` run, and their results are in the pull request.

## Data safety
- Nothing is stored or sent: colours and the order of a link on the screen.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Calm and Focus look and behave as now; the narrow layout keeps the bottom bar | R9, R10 |
| The values of the sidebar's colours are the prototype's | Table A, R1 (the comparison with the prototype) |
| The shell's rules use the design system's names only | R1 (the six are properties of the tokens), R11 |
| The list component carries no text of its own and reads no store | No component change (Design); R8 is the style sheet alone |

## Open questions from the intent
- Where do the sidebar's colours live? Answered in concern 1: six new properties in the two Classic blocks of the tokens.
- Does Classic keep the group Starred and the collapse of a group? Answered in concern 2: yes.
- Where is the filter in Classic when the chips are not shown? Answered in concern 3: the chips stay, drawn dark, until the quick links replace them.
- Is the Browse channels link a row of the list or part of the Channels group? Answered in concern 4: the row stays where the markup has it and is shown between the groups by the style sheet.
- Do the headings of the groups keep today's capital letters and size? Answered in concern 5: yes.

## Areas of concern
1. Where the sidebar's colours live: new properties of the tokens, or colour literals in the shell's style sheet. The shell spec R17 forbids literals, so literals would change that rule. Decided: six new properties in the two Classic blocks of the tokens (R1), and the shell and list rules use `var()`. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
2. Whether Classic keeps the group Starred and the collapse of a group, which the picture does not show. Decided: it keeps both (R7), so no feature of the list is lost. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
3. What happens to the filter chips in Classic, since the picture has none and its "All unreads" quick link is a later ticket. Decided: the chips stay, drawn on the dark ground, until the ticket that adds the quick links replaces them (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
4. The place of the Browse channels link. The picture shows it under the channels; the markup has it last in the list. Decided: the style sheet alone moves it (R8), with `order` and no change of the markup. Accepted: the order of the Tab key follows the markup, so the link is reached after the Direct messages rows although it is seen between the groups; the ticket that moves the link into the markup, if the owner wants it, changes the component and the list spec R8 for all looks. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
5. The headings of the groups. Decided: they keep today's capital letters, size and place and take the new colours (R3). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
6. The colours of the six values are drawn by the prototype, and the owner has not confirmed them one by one. Accepted: the values of Table A are used as merged; a change of a value later is a change of the prototype, then of the tokens, with the comparison of R1 as the check. Owner: Thanh Truong.
