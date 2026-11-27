# Intent: Give Calm the rail and the conversation column
Author: Thanh Truong (lead).

## Problem
The owner expects every look of Toki to show two side columns: a rail of section buttons and, beside it, the list of conversations. Focus and Classic do. Calm shows one sidebar of 272 px that stacks the workspace name, the search box, the section buttons, the conversation list and the account card. Calm is the look a person sees until they have another one, and today the app has no screen that changes it, so a person who runs Toki never sees the rail. The one sidebar is not a defect of the code: the shell decision, the look decision and the prototype all draw it.
Source: the requirement of this run (2026-11-27); `apps/web/src/main.tsx`; `docs/specs/2026-11-16-app-shell-design.md` (R18); `docs/specs/2026-11-26-look-and-scheme-model-design.md` (R5); `e2e/prototype/index.html`.

## Proposed outcome
- With the look Calm, on a window of 720 px and wider, the app shows a rail and, on Home, a conversation column beside it, with the sizes Focus has: a rail of 68 px and a column of 288 px.
- Outside Home, Calm shows the rail alone, as Focus does.
- Calm keeps its own character: its colours in light and dark, its rounded corners, its row spacing, and the chat and the side panel drawn as cards.
- The workspace and the search are reached from the rail, drawn as in Focus: the workspace as its letter tile without the name, the search as an icon.
- Preferences has a button on the Calm rail.
- The prototype and the decisions that describe Calm say the same as the app.
- This replaces three earlier decisions: Calm has one sidebar of 272 px; Calm keeps that sidebar in the look model; Preferences is hidden from the Calm sidebar.
Source: the requirement of this run; the preview of this change that the owner saw and accepted on 2026-11-27.

## Affected users and systems
- Users: every person who uses Calm in the web app on a window of 720 px and wider. This is everyone who has not been given another look.
- Systems: the web app's shell and its list of sections; the prototype; the decisions about the shell, the look model and the Preferences entry; the browser measurements of the shell; the check that compares the app's screens with the prototype.
Source: `packages/ui-web/src/layout/shell.css`; `apps/web/src/layout/sections.ts`; `e2e/`.

## Constraints
- Focus and Classic look and behave as they do now.
- The narrow layout (719 px and below) does not change in any look.
- The rail shows only the sections that already work. The buttons of the owner's picture that have no screen yet (DMs, Files, Later, Tasks, Calendar and the others) are not part of this work.
- The default look stays Calm.
- The prototype stays the picture the app is compared with: the app and the prototype do not disagree about Calm once this work is done.
Source: the requirement of this run; `docs/specs/2026-11-27-look-and-scheme-in-the-app-design.md` (R7, R13).

## Open questions
- Does the account menu keep its Preferences entry in Calm now that the rail has a button for it?
- On a window of 720 px the chat in Calm becomes about 84 px narrower than today. Is that acceptable, or does Calm need another width for its column or its margins between 720 and 1099 px?
- Is the change of the prototype part of the same ticket as the app, or a ticket of its own that comes first?
- The Calm column in the preview has no dividing line before the chat card. Is that the intended look?
