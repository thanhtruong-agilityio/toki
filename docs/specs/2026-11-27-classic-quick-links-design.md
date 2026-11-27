# Classic quick links design

Date: 2026-11-27 · Status: draft for review
Intent: docs/intents/classic-quick-links.md (Thanh Truong, lead)
Ticket: TOKI-150

## Goal
With the look Classic the column has a dark frame (TOKI-144) and a header (TOKI-149). The owner's picture and the prototype show, under the header, a block of six links before the groups: All unreads, Threads, Meet, Drafts, Saved and Directories. This ticket draws that block in the app, in the dark column, in both schemes, and wires All unreads to the unread filter. The other five are drawn as "not built yet": dimmed, and a press shows a message (concerns 1 to 3).

## Scope
- In: the block of six rows under the header of the Classic column; its style rules in `conversation-list.css`; the prop that carries the rows to the list; the unread count and the unread filter behind All unreads; how the other five show that they are not built and what a press on them does (concerns 1 to 3); the chips stay (concern 4); the translations of six labels; the tests; the edits of the specs that say what this ticket replaces.
- Out (not now): the header and its buttons (TOKI-149); the rail and the workspace tile (ticket 7); the Look cards (ticket 9); the pages Saved, Directories, Meet, Threads and Drafts; any change in Calm, Focus or the narrow layout; reference images of the UI parity check for Classic (the ticket that updates the check adds them).

## Requirements
- R1. The block. With `[data-look="classic"]` on a window of 720 px or more, `div.ch.clhead` and the box `button.clsrch` of TOKI-149 are followed by one block `nav.qlinks` (named by a label prop, for example "Quick links") that holds six rows in this order: All unreads, Threads, Meet, Drafts, Saved, Directories; and the block is followed by `div.cfilter` (the name search field and the chips stay, concern 4) and `div.clist`. A row is `.cr.ql` with a `span.gl` (the icon) and a `span.nm` (the label), the same row shape as a conversation row. Check: a DOM test of the order and the shape, and a browser test in Classic that reads the six labels in order between the box and the groups.
- R2. The values are the prototype's. The block has the padding `0 8px 6px`; a row has the minimum height `var(--row)`, the gap 9 px, the padding `3px 10px`, the radius `var(--radius-sm)`, the icon cell 18 px; the row colours are those of a conversation row in Classic (TOKI-144 R3): text `var(--side-ink)` or `var(--side-muted)`, hover `var(--side-hover)`; the count badge is the `.cnt` of the prototype (`var(--accent)` on `var(--on-accent)`, 11 px, 18 px high, round). The values are read from the Classic rules and the rows of `e2e/prototype/index.html` (lines 218 to 231, 875 to 886 and 1351 to 1354 as merged in PR #443). Check: the style-sheet test lists the rules and their declarations; the browser test reads the computed values of one row in both schemes.
- R3. No colour literal. The new rules hold only `var(--…)` of the 32 properties, the six side properties (TOKI-144 R1) or `transparent` (the shell spec R17). Check: the existing test of the names, run on the new rules.
- R4. Texts and data through props. The list takes one optional prop `quickLinks` (the label of the block and the six rows: `id`, `label`, `icon`, `count`, `pressed`; the label "not available yet"; `onToggleUnread` for All unreads and `onNotBuilt(id)` for the five others); it holds no text of its own and reads no store (TOKI-017 R2). `apps/web` (`ConversationListPane`) builds it from the translations, the store's unread count and the router. With no `quickLinks` the block is not drawn. Check: a component test with and without the prop; a web test of the labels in the translations of every language.
- R5. All unreads. The row All unreads sets the same filter as the chip Unread (TOKI-017 R17) and saves it the same way (R18), so the chips, the filter menu (TOKI-149 R11) and this row always agree; while the filter is Unread the row is marked pressed (`aria-pressed="true"`) and a second press sets the filter All (concern 4). The chips stay beside it (concern 4). The row shows in a badge the number of unread messages (concern 5), the sum of the unread counts of the conversations the person is in as the store holds them, whatever the filter now is, when the number is above 0 (TOKI-017 R7). A muted conversation adds nothing, as its row draws no badge (TOKI-017 R7); this was not asked of the owner. Check: a component test (a press sets the filter, a second press resets it, the badge follows the count, no badge at 0) and a browser test in Classic that filters the rows.
- R6. The other five rows. Threads, Meet, Drafts, Saved and Directories are all drawn as not built yet (concerns 1 and 3): in Classic, six rows are always drawn, Meet included. None is a link, and none shows a count (Drafts has no number). Check: a component test per row; the browser test reads that five rows are dimmed and All unreads is not.
- R7. A row that is not built. It is a `button.cr.ql.dim` drawn at the strength of the prototype's `dim` (`opacity: .5`); a press calls `onNotBuilt(id)` of the props, and `apps/web` answers with one toast, "Proposed for a later phase: <label>" (translated, the label of the row inside the text), as the prototype does (concern 2). The button is in the Tab order, and its accessible name is its label followed by a visually hidden text from a label prop ("not available yet", translated), so assistive technology is told what the toast says. The row is exempt from the contrast of TOKI-144 R5, as disabled text is under WCAG 1.4.3; it keeps the half strength of the prototype (concern 6). Check: a component test of the attributes and of the call; a browser test that a press shows the toast in Classic; the contrast test of TOKI-144 R5 lists the dimmed row as an exception with the reason.
- R8. Keyboard. All six rows are in the Tab order after the box and before the groups, in the order of the markup; Enter (and Space on a button) does what a click does; the focus ring is visible in both schemes. Check: a browser test of the Tab order and the ring colour in Classic light and dark.
- R9. Calm, Focus and the narrow layout are the same. No rule that applies to Calm, Focus or a window under 720 px changes; the component always renders `nav.qlinks` when `quickLinks` is given, so the style sheet hides it by default: `.qlinks` is `display: none` outside the media block, and only the rule `[data-look="classic"] .qlinks` inside `(min-width: 720px)` shows it. A block with `display: none` has no visible rows and no Tab stops. Every rule that styles the rows names `[data-look="classic"]` and sits in the same media block. Check: a test that the hiding rule is outside the media block and that every other new selector names `[data-look="classic"]` and no other look; the browser measurements of the list in Calm and Focus pass as they are; a browser test in which the block is not visible and none of its six buttons can be reached by Tab, in Calm and Focus at 1100 px, and in all three looks at 719 px, and is visible with the six buttons in the Tab order in Classic at 720 px.
- R10. The specs change with the code. The development of this ticket edits, in place and in its own pull request, each line that says what it replaces: the list spec (R3 on the order of the parts, R33 on the set of interactive elements, and Table A: the rules of the block), the spec of TOKI-149 (R1 and R8 on what follows the box) and the spec of TOKI-144 (its concern 3 and R6, which said the chips stay until the quick links replace them: now they stay). R33 of the list spec lists the interactive elements of the pane, each by role and accessible name; this ticket's edit adds to that list the six buttons of the block, named All unreads and, for the five rows that are not built, the label followed by the hidden text of R7 (Threads, Meet, Drafts, Saved and Directories, each followed by "not available yet"). The test renders the pane for a Member and for an Admin, with `quickLinks` given, and expects the set of R33 plus those six; with `quickLinks` absent it expects the set of R33 as it is today. In the browser the set is read from the accessibility tree: in Classic at 720 px the six are in it, and in Calm, Focus and under 720 px they are not (R9: `display: none` takes them out of the tree). The controls of the header (TOKI-149) are added to the same list by the edit of that ticket; whichever pull request merges second adds its own names to the list as it finds it. Check: the diff of the pull request holds these edits.

## Design
### The block
`ConversationList` gets one optional prop `quickLinks`. The component always renders the block when the prop is given and the style sheet shows it only in Classic at 720 px and wider (`display: none` elsewhere, so it is out of the tab order and the reading order). Every row renders as a `button`: All unreads sets the filter, and each of the five others calls `onNotBuilt`. `apps/web` gives the unread count from the store and the toast. No destination is given in this ticket; the ticket that builds a page turns its row into a link.

### Table A: the six rows
| Id | Label | Icon (prototype) | In the app | Prototype state |
| :---- | :---- | :---- | :---- | :---- |
| `unreads` | All unreads | inbox | toggles the filter Unread; badge with the count of unread messages | live |
| `threads` | Threads | reply | dimmed, a press shows the message | dim |
| `meet` | Meet | video | dimmed, a press shows the message | live (a page of the prototype) |
| `drafts` | Drafts | edit | dimmed, a press shows the message | dim |
| `saved` | Saved | bookmark | dimmed, a press shows the message | live (Later) |
| `dirs` | Directories | users | dimmed, a press shows the message | live (People) |

### Layout
```
packages/ui-web/src/conversation-list/ConversationList.tsx, conversation-list.css
packages/ui-web/tests/conversation-list/*.test.tsx, conversation-list.css.test.ts
apps/web/src/conversation-list/ConversationListPane.tsx, translations, its tests
e2e/classic-quick-links.spec.ts
```

## Testing
- Written first, each seen to fail for the right reason: the component tests (R1, R4 to R7, R9), the style-sheet tests (R2, R3, R9), the web tests of the labels (R4), then the browser test `e2e/classic-quick-links.spec.ts` (R1, R2, R5, R8, R9) in Classic light and Classic dark, at 1100 px, 720 px and 719 px, and a pass over Calm and Focus.
- No new library, no network: fake data and the fixture.
- Before the pull request: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` and `pnpm test:e2e:parity` run, and their results are in the pull request.

## Data safety
- Nothing is stored or sent by the block itself; a toast is shown and nothing is recorded. All unreads saves the filter on the device as the chips do (TOKI-017 R18).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Calm and Focus look and behave as now; the narrow layout keeps the bottom bar | R9 |
| The values of the block are the prototype's; no colour literal | R2, Table A, R3 |
| The list component carries no text of its own and reads no store | R4, Design (the prop) |
| A control that does something is a real control; a row that does nothing does not look or sound like one that works | R6, R7, R8 (every row answers a press and says it is not available) |
| The header, the rail, the Look cards and the destination pages are not part of this work | Scope (Out) |

## Open questions from the intent
- Which of the five links other than All unreads are live? Answered in concern 1: none, all five are drawn as not built.
- What does a press on a dimmed link do? Answered in concern 2: a toast, as the prototype does.
- Does Meet appear at all? Answered in concern 3: yes, dimmed like the others.
- Does All unreads replace the filter chips in Classic, and what does the row show while the filter is on? Answered in concern 4: the chips stay; the row is pressed while the filter is Unread.
- What is the number on All unreads, does it show at zero, and does Drafts show a count? Answered in concern 5: the number of unread messages; nothing at zero; Drafts has no count.
- Does a dimmed row keep the 4.5:1 contrast? Answered in concern 6: no, it is exempt.

## Areas of concern
1. Which of Threads, Meet, Drafts, Saved and Directories are links. Decided: none; all five are drawn as not built (R6), because `/later` and `/people` do not exist and Meet, Threads (TOKI-045) and Drafts are not built. Accepted: the ticket that builds a page turns its row into a link, and changes this spec's row then. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
2. What a press on a row that is not built does. Decided: it shows one toast, "Proposed for a later phase: <label>", as the prototype does (R7). Accepted: the rule of TOKI-017 R25 (no control without an action) is met because the press has an action, the toast. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
3. Whether Meet appears. Decided: yes, dimmed like the other four, so the six rows of the picture are all drawn (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
4. Whether All unreads replaces the chips. Decided: the chips stay, with the name search field, beside the row (R1, R5); the row is pressed while the filter is Unread and a second press sets All. This changes the promise of TOKI-144 concern 3 (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
5. What the number on All unreads counts. Decided: the unread messages (R5); no badge at zero (TOKI-017 R7); Drafts has no count (R6). Accepted: a muted conversation adds nothing, which follows the row badge and was not asked of the owner. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
6. Whether a dimmed row keeps the 4.5:1 contrast. Decided: it is exempt, as disabled text is under WCAG 1.4.3, and keeps the prototype's half strength (R7). Accepted: the toast and the hidden "not available yet" text tell what the dim shows. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
