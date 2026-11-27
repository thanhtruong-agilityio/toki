# Intent: Draw the frame of the Classic sidebar
Author: Thanh Truong (lead).

## Problem
Toki now has three looks (TOKI-142, TOKI-143), but Classic has no sidebar of its own. `shell.css` gives it the frame of Focus until a ticket separates it: a rail of 68 px and a conversation column of 288 px (356 px on Home), drawn in the page's colours, with the groups, the filter chips and the Browse channels row that Focus has. The owner's picture of Classic shows a different sidebar: a dark rail and a dark column in both the light and the dark scheme, a column that holds the groups Channels and Direct messages with the Browse channels link under the channels, and no filter chips. The prototype draws it (the merged prototype, `e2e/prototype/index.html`, look `classic`). A person who chooses Classic sees the Focus frame in the colours of the page, not the sidebar of the picture.
Source: the owner's picture of the Classic sidebar (2026-11-26); `packages/ui-web/src/layout/shell.css`; `docs/specs/2026-11-16-app-shell-design.md` (Tables F and J, the Classic notes); the prototype of PR #443.

## Proposed outcome
- With the look Classic, the rail and the conversation column are dark over the page in both schemes: light page, dark sidebar; dark page, a darker sidebar, with the values the prototype draws.
- The sizes stay those of the frame of Focus unless the build finds a number that has to change, and a change is written in the shell spec and its browser test together.
- The column holds the groups Channels and Direct messages as the picture shows them, the Browse channels link under the channels, and no filter chips; Calm and Focus keep their lists as they are.
- The header of the column, its search, the quick links and the buttons of the rail are not part of this work: they are the next tickets, and the frame leaves their place.
Source: the requirement of this run; the model spec (R5, concern 3, concern 6).

## Affected users and systems
- Users: every person who chooses the look Classic, in the web app on a window of 720 px and wider.
- Systems: `packages/ui-web` (`shell.css`, the conversation list and its styles), `apps/web` (the list's wiring if the groups change), the design tokens if the sidebar colours become properties, the shell and list specs and their browser tests, and the UI parity check (Classic rows).

## Constraints
- Calm and Focus look and behave as they do now; the narrow layout (719 px and below) keeps the bottom bar in all three looks.
- The values of the sidebar's colours are those of the prototype; none is invented.
- The shell's rules use the design system's names only: no colour literal (TOKI-015 R17).
- The conversation list component carries no text of its own and reads no store (TOKI-017 R2); what is Classic-only reaches it through its props or its style sheet.
Source: `docs/specs/2026-11-16-app-shell-design.md` (R17); `docs/specs/2026-11-17-conversation-list-design.md` (R2).

## Open questions
- Where do the sidebar's colours live: as new custom properties in the design tokens (more than the 32 of TOKI-009 R10, in the two Classic blocks), or in the style sheet of the shell? The model spec left this to this work (its concern 3 of TOKI-143).
- Does Classic keep the group Starred above Channels, and the collapse of a group, as the list has them today? The picture shows only Channels and Direct messages.
- Where is the filter (All, Unread, Mentions) in Classic when the chips are not shown? The quick link "All unreads" of the picture is a later ticket: until it exists, is the filter absent from Classic, or do the chips stay?
- Is the Browse channels link a row of the list (as today, last in the list) or part of the Channels group (as the picture shows it, under the channels, before Direct messages)?
- Do the headings of the groups in Classic keep today's capital letters and size, or follow the picture?
