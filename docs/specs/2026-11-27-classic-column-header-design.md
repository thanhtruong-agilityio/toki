# Classic column header design

Date: 2026-11-27 · Status: draft for review
Intent: docs/intents/classic-column-header.md (Thanh Truong, lead)

## Goal
With the look Classic the conversation column is dark (TOKI-144), but its top is still the top of Focus: a heading "Conversations" with a Browse channels button, then the name search field and the chips. The owner's picture and the prototype show another top: the workspace name and an online dot on the left, a filter button and a compose button on the right, and under them a box "Find a conversation". This ticket draws that header in the app, in the dark column, in both schemes. It draws the header only: the quick links, the buttons of the rail and the workspace tile, and the Look cards are other tickets.

## Scope
- In: the header block of the column in the look Classic (the name, the online dot, the filter button, the compose button, the box "Find a conversation"); the style rules of that block in `conversation-list.css`; the props and labels that carry the name, the texts and the actions to the list; the menu of the filter button, the compose button, the box that puts the focus in the name search field, the dot that shows the connection (concerns 1 to 5); the heading "Conversations" and the Browse button hidden in Classic (concern 6); the translations; the tests; the edits of the specs that say what this ticket replaces.
- Out (not now): the quick links under the box (ticket 6); the rail's DMs, More, "+", sun, avatar and workspace tile (ticket 7); any change in Calm, Focus or the narrow layout; the Look cards and the saving of the look (ticket 9); the command palette itself (TOKI-071); a second workspace; reference images of the UI parity check for Classic (the ticket that updates the check adds them).

## Requirements
- R1. The header block. With `[data-look="classic"]` on a window of 720 px or more, the top of `.convs` is one block: a row `div.ch.clhead` with the workspace name, the online dot, a flexible space, the filter button and the compose button; and, under it, a box `button.srch.clsrch` with a search icon and the text "Find a conversation". Check: a DOM test of the block and its order, and a browser test in Classic that finds the row and the box in that order above the list.
- R2. The values are the prototype's. The row has the padding `14px 12px 8px 16px`; the name is 16 px, weight 700, `var(--side-ink)`; the dot is 9 px, round; the two buttons are 28 px square (`IconButton` size `sm`), with `var(--side-muted)` icons and, on hover, `var(--side-ink)` on `var(--side-hover)`; the box is 34 px high with the margin `0 12px 8px`, the padding `0 10px`, the background `var(--side-hover)`, a 1 px border of `var(--side-line)`, the text `var(--side-muted)` and the text left-aligned. The values are read from the Classic header rules of `e2e/prototype/index.html` (lines 854 to 861 and 780 as merged in PR #443). Check: the style-sheet test lists the rules and their declarations; the browser test reads the computed values of one element of each kind in both schemes.
- R3. No colour literal. The new rules hold only `var(--…)` of the 32 properties, the six side properties (TOKI-144 R1) or `transparent` (the shell spec R17). The colour of the dot is `var(--accent)` (concern 5). Check: the existing test of the names, run on the new rules.
- R4. The name of the workspace. The list takes the workspace name as a prop from the shell, which already has it (`workspace.name`, the app-shell spec R8 and TOKI-099): the list holds no text of its own and reads no store (TOKI-017 R2). The name is a plain label (a `span`, no chevron, not a button, not in the Tab order): the app has one workspace and the label does nothing when pressed (concern 4). With no name given, the row draws no name and keeps the dot and its two buttons. Check: a component test with and without the name.
- R5. The labels. Every label of the header ("Filter conversations", "New message", "Find a conversation", the label of the dot) is a prop of the list given by `apps/web`, and the translations hold it in every language of the app. Check: the component test reads the labels from props; the web test finds the labels in the translations of every language.
- R6. No dead control. As the list does for its other controls (TOKI-017 R25): a button is drawn only when the list is given the action it calls. The compose button is drawn only when `startDirect` is registered (concern 2); the filter button and the box are always drawn because the list owns what they do (concerns 1 and 3); the name and the dot are labels and are not controls. No button does nothing when pressed. Check: a component test per control with and without its action.
- R7. Keyboard and names. Each button is a `button` with an accessible name from its label and, in the Tab order, follows the markup (filter, compose, box; the name and the dot are not in it); a press by Enter or Space does what a click does; the box keeps a visible focus ring in both schemes. Check: a browser test of the Tab order and of the focus ring colour in Classic light and dark.
- R8. What Classic drops and keeps. In Classic the heading `h2` "Conversations" and the Browse channels `IconButton` of `div.ch` are hidden by the style sheet (`display: none`, so they are out of the Tab order), as the prototype does; `div.ch.clhead` is the header. Browse channels stays reachable through the row between the groups (TOKI-144 R8). The name search field and the chips of `div.cfilter` stay, drawn as TOKI-144 R3 says (concerns 1 and 3). Check: the browser test of the column in Classic reads the heading and the button as hidden, the row Browse channels as visible, and the field and the chips as visible.
- R9. Calm, Focus and the narrow layout are the same. No rule that applies to Calm, Focus or a window under 720 px changes; the new rules name `[data-look="classic"]` and sit in the `(min-width: 720px)` media block; the markup that only Classic shows is hidden from the other looks and from the narrow layout by the style sheet and is not in the tab order there. Check: a test that every new selector names `[data-look="classic"]` and no other look; the browser measurements of the list in Calm and Focus pass as they are; a browser test at 719 px in Classic.
- R10. The specs change with the code. The development of this ticket edits, in place and in its own pull request, each line that says what it replaces: the list spec (R3 on the header, R14 on the controls, and its Table A: the Classic header rules) and the shell spec (the note that the workspace name is hidden in Focus and Classic, if the name moves). Check: the diff of the pull request holds these edits.
- R11. The filter menu (concern 1). The filter button opens a `Menu` (TOKI-012) with the three choices All, Unread and Mentions, the current one marked as selected; choosing one sets the same filter as the chips (TOKI-017 R10) and saves it the same way (TOKI-017 R17, R18), so the chips and the menu always agree. The button has `aria-haspopup="menu"` and `aria-expanded`; Escape closes the menu and returns the focus to the button. Check: a component test (menu opens, a choice calls `filters.onChange` as a chip does, the selected choice follows the chips) and a browser test in Classic.
- R12. The compose button (concern 2). A press calls `startDirect` of the registry (TOKI-017 R25) with `{ returnFocusRef }` whose `current` is the button, so the same people picker opens as from the "+" of Direct messages (TOKI-034) and the focus returns to the button. Check: a component test with and without the registered opener, as for the "+" (TOKI-017 R25).
- R13. The box (concern 3). A press on the box puts the focus in the name search field of the list (the field inside `div.cfilter`); the list does this itself with a ref, so the box has no action prop. The field stays visible. The box does not open a palette: TOKI-071 may replace this action once the palette exists, as its own change. Check: a component test (a press puts `document.activeElement` on the field) and a browser test in Classic.
- R14. The dot (concern 5). The dot says whether the connection to the server is up: the list takes a boolean prop `online` and the pane gives it `isOnline()` of `apps/web/src/patterns/online.ts` (R17 of the list spec: TOKI-082 will own the state and calls `setConnectionCheck`; until then the browser's own flag is used), re-read when the window fires `online` and `offline`. Online: the dot is `var(--accent)`. Offline: the dot takes the look of the away dot of `PresenceDot` (fill `var(--side-bg)`, border `var(--side-muted)`), so it is hollow and not only another colour. The dot has `role="img"` and an accessible name from a label prop ("Online" or "Offline", translated, R5). It adds no request. Check: a component test of both states and their names; a browser test that emulates offline and reads the dot's computed colour in Classic light and dark.

## Design
### The block
`ConversationList` gets one optional prop for the Classic header: `classicHeader`, an object with the name, `online`, the labels and `onCompose`, each optional as R6 says (the compose action, the dot's `online` and its labels; the filter menu and the box need no action because the list owns them). The component always renders it, and the style sheet shows it only in Classic at 720 px and wider and hides the heading and the Browse button of `div.ch` there (R8); in the other looks the block is `display: none`, so it is out of the tab order and the reading order there. `apps/web` (`ConversationListPane`) builds the object from the store (the workspace name), the translations (the labels) and the registry of openers (`useListActions`, TOKI-017 R25).

### Table A: the prototype's values
| Part | Selector in the prototype | Values |
| :---- | :---- | :---- |
| Row | `.clhead` | padding `14px 12px 8px 16px` |
| Name | `.wsname` | flex, gap 4 px, 700, 16 px, `--side-ink` |
| Dot | `.okdot` | 9 px, round, `--accent`; offline: hollow, `--side-muted` ring (R14) |
| Buttons | `.clhead .ib` | 28 px, `--side-muted`; hover `--side-hover` and `--side-ink` |
| Box | `.clsrch` | 34 px, margin `0 12px 8px`, padding `0 10px`, `--side-hover`, border `--side-line`, `--side-muted` |

### Layout
```
packages/ui-web/src/conversation-list/ConversationList.tsx, conversation-list.css
packages/ui-web/tests/conversation-list/*.test.tsx, conversation-list.css.test.ts
apps/web/src/conversation-list/ConversationListPane.tsx, translations, its tests
e2e/classic-header.spec.ts
```

## Testing
- Written first, each seen to fail for the right reason: the component tests (R1, R4 to R6, R9), the style-sheet tests (R2, R3, R9), the web tests of the labels (R5), then the browser test `e2e/classic-header.spec.ts` (R1, R2, R7 to R9) in Classic light and Classic dark, at 1100 px, 720 px and 719 px, and a pass over Calm and Focus.
- No new library, no network: fake data and the fixture.
- Before the pull request: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` and `pnpm test:e2e:parity` run, and their results are in the pull request.

## Data safety
- Nothing is stored or sent by the header itself. The dot reads the connection flag the app already holds (R14) and adds no request; the filter menu saves the filter as the chips do.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Calm and Focus look and behave as now; the narrow layout keeps the bottom bar | R9 |
| The values of the header are the prototype's; no colour literal | R2, Table A, R3 |
| The list component carries no text of its own and reads no store | R4, R5, Design (the props) |
| Each of the four controls works or is plainly not built | R11 to R14, R6 |
| The quick links, the rail's buttons and tile, and the Look cards are not part of this work | Scope (Out); the header leaves the place under the box |

## Open questions from the intent
- What does the filter button do? Answered in concern 1: it opens a menu of All, Unread and Mentions, and the chips stay.
- What does the compose button do? Answered in concern 2: it opens the people picker of the "+" of Direct messages.
- What does the search box do, and does the name search field stay? Answered in concern 3: it puts the focus in the name search field, which stays.
- What does the workspace name with its chevron do? Answered in concern 4: it is a label with no chevron.
- What does the online dot say, and in which colour? Answered in concern 5: the connection to the server, in the accent colour.
- Does the Classic header drop the "Conversations" heading and the Browse channels button? Answered in concern 6: it drops both.

## Areas of concern
1. What the filter button does. Decided: it opens a menu with All, Unread and Mentions (R11), and the chips stay beside it in Classic, both setting the same filter. The button's absence was the other choice (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
2. What the compose button does. Decided: it opens the people picker of the "+" of Direct messages, `startDirect` (R12); no new flow. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
3. What the box "Find a conversation" does. Decided: it puts the focus in the name search field of the list, and the field stays (R13); the palette (TOKI-071) is not built and may replace the action later. The prototype hides the field in Classic; the owner keeps it, as the chips (TOKI-144 concern 3). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
4. What the workspace name with its chevron does. Decided: a plain label with no chevron and no action (R4), because the app has one workspace; the picture's chevron is not drawn. Accepted: the picture and the prototype show a chevron, so this differs from both until a second workspace exists. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
5. What the online dot says and its colour. Decided: it says whether the connection to the server is up (R14), in `var(--accent)` as the prototype draws it. Accepted: the picture's green is not drawn, because none of the 32 properties is green (`--live` is orange); the dot is teal with the default accent and follows the accent the person chose. The offline look (hollow, `--side-muted` ring, the away dot of `PresenceDot`) is taken from the existing presence dot and was not asked of the owner. Accepted: until TOKI-082 owns the connection state the dot follows the browser's own online flag, which does not see a network that is cut off from the server. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
6. Whether the Classic header drops the heading "Conversations" and the Browse channels button. Decided: it drops both, as the prototype does (R8); Browse channels stays in the row between the groups. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
