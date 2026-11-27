# Intent: Draw the quick links of the Classic conversation column
Author: Thanh Truong (lead).

## Problem
With the look Classic the column has a dark frame (TOKI-144) and, once TOKI-149 is built, the header with the workspace name, the filter and compose buttons and the box "Find a conversation". Under the header the owner's picture shows a block of six links, one under the other, before the groups: All unreads, Threads, Meet, Drafts (with a pencil at its right), Saved and Directories. The app has no such block. The prototype draws it (the merged prototype, `e2e/prototype/index.html`, the list `ql` and the classes `qlinks`, `cr ql`, `dim`): All unreads shows the unread count and toggles the unread filter; Saved and Directories go to pages; Threads and Drafts are drawn at half strength (`dim`) and answer with a message that they belong to a later phase; Meet goes to a page of the prototype. In the app, of these only the unread filter exists today; the pages of Saved (`/later`) and Directories (`/people`) have no route yet, and Meet, Threads and Drafts are not features of the first phase. The plan of the sidebar tickets says "unbuilt items dimmed", and the list's rule of TOKI-017 R25 says the component draws no control for which it has no action; the two have to be reconciled by the owner. TOKI-144 said that the filter chips stay until the quick links replace them, and TOKI-149 decided that the chips stay beside the filter menu; whether the quick links now replace them is open.
Source: the owner's picture of the Classic sidebar (2026-11-26); the prototype of PR #443 (lines 1351 to 1354 and 2437, rule `.cr.ql.dim`); `docs/specs/2026-11-27-classic-sidebar-frame-design.md` (concern 3); `docs/specs/2026-11-27-classic-column-header-design.md` (R11, concern 1); `docs/specs/2026-11-17-conversation-list-design.md` (R25); `apps/web/src/layout/sections.ts`.

## Proposed outcome
- With the look Classic, on a window of 720 px and wider, a block of quick links sits between the header (and its box) and the groups of the list: All unreads, Threads, Meet, Drafts, Saved and Directories, in that order, as rows of the dark column, drawn with the values the prototype draws, in both schemes.
- All unreads shows the number of unread conversations and sets the unread filter, as the prototype does.
- Each of the other five does something, or is plainly drawn as not built yet: the owner decides, for each, which of the two it is in this ticket and what a press on a not-built one does.
- The owner decides whether the quick links replace the filter chips in Classic.
- Calm and Focus keep their column as it is; the narrow layout (719 px and below) is not changed.

## Affected users and systems
- Users: every person who chooses the look Classic, in the web app on a window of 720 px and wider.
- Systems: `packages/ui-web` (the conversation list and its styles), `apps/web` (the unread count and the filter the block uses, the routes the links go to, the translations for six labels), the list spec and its browser tests, and the UI parity check (Classic rows).

## Constraints
- Calm and Focus look and behave as they do now; the narrow layout keeps the bottom bar.
- The values of the block (row height, icon size, spacing, the strength of a dimmed row) are those of the prototype; none is invented. The colours come from the six sidebar properties of TOKI-144 and the design system's names: no colour literal (TOKI-015 R17).
- The conversation list component carries no text of its own and reads no store (TOKI-017 R2): the six labels, the unread count and what each link does reach it through props.
- A control that does something is a real control (a link or a button with a name, in the Tab order); a row that does nothing must not look or sound like one that works.
- The header and its buttons (TOKI-149), the rail and the workspace tile (ticket 7), the Look cards (ticket 9) and the pages the links lead to (Saved, Directories, Meet, Threads, Drafts) are not part of this work.
Source: `docs/specs/2026-11-16-app-shell-design.md` (R17); `docs/specs/2026-11-17-conversation-list-design.md` (R2, R25); the plan of the sidebar tickets.

## Open questions
- Which of the five links other than All unreads are live and which are "not built yet" in this ticket? The app has no route for Saved and Directories and no feature for Meet, Threads and Drafts. Does each of the five go to the page that will exist (or to the shell's not-found view), or is it drawn dimmed?
- What does a press on a dimmed link do: the prototype's message "Proposed for a later phase" (a toast), nothing (the row marked disabled for assistive technology), or is the row not drawn at all, as the list's rule of TOKI-017 R25 asks for a control with no action?
- Does Meet appear at all? It is in the picture and the prototype but is not a section of the first phase (`sections.ts` holds no row for it); is it drawn dimmed like the others, or left out until the feature exists?
- Does All unreads replace the filter chips (All, Unread, Mentions) in Classic, as TOKI-144 said it would, or do the chips stay beside it, as TOKI-149 decided for the filter menu? And what does the row show when the unread filter is on: a pressed state, and a second press that turns it off, as the prototype does?
- What is the number on All unreads: the count of unread conversations, or of unread messages (the prototype adds the unread counts of the conversations)? Does the number show when it is zero, and does Drafts show a count like the picture's pencil?
- A dimmed row has half strength in the prototype; against the dark column this may be below the 4.5:1 contrast that TOKI-144 R5 asks of text. Is a dimmed row exempt, as disabled text is under WCAG, or does it keep the ratio?
