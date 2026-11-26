# Intent: Space the sections of the Details panel as the prototype does
Author: Thanh Truong

## Problem
In the Details panel of a conversation, the sections (About, Members, Notifications, Settings) have no space above their headings. The "Edit" button of About sits about 5 px above the heading "MEMBERS · 8", and the same holds for the headings after it, so the panel reads as one block. The prototype puts 18 px above each heading. A run of the UI parity check on the prototype's own sample data (Channel details, Calm and Focus, 1280 and 900 px) found it, and the cause is in the styles: the panel's rule that removes the top space of a heading that is the first child of its box (`.sb h3:first-child`) is meant for the first heading of the panel, but each section of the app draws its heading as the first child of its own `section`, so every heading loses its top space.
Source: the report and the images of a run of the UI parity check on the Channel details screen (2026-11-26); `packages/ui-web/src/layout/shell.css` (`.sb h3`, `.sb h3:first-child`); `apps/web/src/conversation/AboutSection.tsx`, `PeopleSection.tsx`, `NotificationsSection.tsx`, `SettingsSection.tsx`; `e2e/prototype/index.html` (`.sb h3`).

## Proposed outcome
- Each heading of the Details panel, except the first, has the same space above it as in the prototype, whether or not the buttons Edit and Add people are shown.
- The first heading of the panel keeps no space above it.
- The same holds for any panel that draws its sections in the same way.
Source: the requirement of this run.

## Affected users and systems
- Users: every member who opens the Details panel of a channel or a group.
- Systems: `packages/ui-web/src/layout/` (the panel's styles) and the Details panel of `apps/web/src/conversation/`.

## Constraints
- What the specs of the panel decided stays: the buttons Edit and Add people, the Remove buttons, the order of the sections, the members sorted by name.
- The space follows the design tokens and the values of the prototype; no new colour.
- On a narrow screen the controls stay at least 40 px tall.
Source: `docs/specs/2026-11-17-conversation-header-details-design.md`; `docs/specs/2026-11-17-add-remove-people-design.md`.

## Open questions
- Is the fix made in the shared rule of the panel (so that every panel gets it) or in the Details panel only?
