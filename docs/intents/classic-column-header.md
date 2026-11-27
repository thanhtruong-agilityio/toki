# Intent: Draw the header of the Classic conversation column
Author: Thanh Truong (lead).

## Problem
With the look Classic the conversation column is now dark (TOKI-144), but its top is still the top of Focus: a heading "Conversations" with one small button that opens Browse channels, then the name search field and the filter chips. The owner's picture of the Classic sidebar shows a different top: the workspace name with a chevron and a green online dot on the left, a filter button and a compose button on the right, and under them a search box that reads "Find a conversation". The workspace name is today drawn only in the rail's header tile, and only as its first letter, so a person in Classic never sees the name of the workspace in the column. The prototype draws the Classic header (the merged prototype, `e2e/prototype/index.html`, the classes `clhead`, `wsname`, `okdot`, `clsrch`); the app does not.
Source: the owner's picture of the Classic sidebar (2026-11-26); `packages/ui-web/src/conversation-list/ConversationList.tsx` (the `.ch` heading and `.cfilter`); `packages/ui-web/src/layout/WorkspaceHeader.tsx`; `docs/specs/2026-11-27-classic-sidebar-frame-design.md`; the prototype of PR #443.

## Proposed outcome
- With the look Classic, on a window of 720 px and wider, the top of the conversation column is the prototype's header: the workspace name with a chevron, the online dot beside it, a filter button and a compose button on the right, and below them the search box "Find a conversation".
- The header is drawn in the dark column of TOKI-144, in both schemes, with the values the prototype draws.
- Each of the four things in the header does something, or is plainly not built yet: the owner decides, for each of the workspace name, the filter button, the compose button and the search box, what it does in this ticket and what is left to a later one.
- Calm and Focus keep their column top as it is; the narrow layout (719 px and below) is not changed.

## Affected users and systems
- Users: every person who chooses the look Classic, in the web app on a window of 720 px and wider.
- Systems: `packages/ui-web` (the conversation list and its styles, the shell if the workspace header moves), `apps/web` (what the buttons open, the workspace name that the shell already takes as a prop), the translations for the new labels, the list and shell specs and their browser tests, and the UI parity check (Classic rows).

## Constraints
- Calm and Focus look and behave as they do now; the narrow layout keeps the bottom bar in all three looks.
- The values of the header (sizes, colours, spacing) are those of the prototype; none is invented. The colours come from the six sidebar properties of TOKI-144 and the design system's names: no colour literal (TOKI-015 R17).
- The conversation list component carries no text of its own and reads no store (TOKI-017 R2): the workspace name, the labels and what the buttons do reach it through props.
- The quick links under the search (ticket 6), the rail's buttons and the workspace tile (ticket 7) and the Look cards (ticket 9) are not part of this work; the header leaves their place.
Source: `docs/specs/2026-11-16-app-shell-design.md` (R17); `docs/specs/2026-11-17-conversation-list-design.md` (R2); the plan of the sidebar tickets.

## Open questions
- What does the filter button do? The list has the chips All, Unread and Mentions (kept in Classic by the owner at TOKI-144). Does the button open a menu with the same three choices, replace the chips, or only draw as the prototype does and open nothing until a later ticket?
- What does the compose button do? The app already opens a people picker from the "+" of the Direct messages heading; is "New message" the same picker (a direct message), or a new flow?
- What does the search box do? In the prototype it opens a command palette; the app has the palette only as a spec (TOKI-071) and the shell's search box is not wired to anything. In Classic, does the box open the palette once it exists, focus the name search field of the list, or filter the list itself? And does the name search field of the column stay below it, or does the new box replace it?
- What does the workspace name with its chevron do? The app has one workspace today; does the chevron open a menu (which items), do nothing yet, or is it a plain label without a chevron?
- What does the online dot say: the person's own presence, the connection to the server (the list already has an offline notice), or a decoration? The prototype draws it in the accent colour and the picture in green; which one is the rule?
- The "Conversations" heading and the Browse channels button of the current header: does the Classic header drop them (Browse channels is reachable from the list's own link), as the prototype does?
