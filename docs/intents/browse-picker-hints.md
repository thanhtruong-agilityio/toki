# Intent: Keep the member count and the search hint visible in Browse channels and New message
Author: Thanh Truong

## Problem
A run of the UI parity check on the Browse channels and New message dialogs, on the prototype's sample data, found two differences in what the dialogs already show that the dialogs' spec does not decide:
- A row of Browse channels shows the topic and the member count on one line joined by " · ", and cuts the line with an ellipsis. When the topic is long the cut falls in the topic and the member count is not shown at all: "Everything for the 1.0 launch: checklist, builds, announcemen…". The prototype lets the line wrap and always shows "· 8 members".
- The search box of New message has no visible hint: its label "Search people" is read by a screen reader only. The search box of Browse channels, next to it, shows its label as a placeholder, and the prototype shows a placeholder in both.
Source: the report and the images of a run of the UI parity check on the Browse and New message screens (2026-11-26); `apps/web/src/features/channels/BrowseRow.tsx` (the sub line `.ell`); `apps/web/src/features/people/PeoplePicker.tsx` and `packages/i18n/src/messages/en/picker.ts`; `docs/specs/2026-11-17-browse-channels-people-picker-design.md` (R4, R6, R18).

## Proposed outcome
- A row of Browse channels always shows its member count, however long the topic is.
- The search box of New message shows a visible hint, as the search box of Browse channels does.
Source: the requirement of this run.

## Affected users and systems
- Users: every member who browses channels or starts a message.
- Systems: `apps/web/src/features/channels/`, `apps/web/src/features/people/`, `packages/i18n` (the text of the hint).

## Constraints
- What the specs decided stays: the rows show only name, topic and member count; the "Join" and "Open" buttons; the dialogs lists people only in New message (no channels); the buttons Cancel and Start.
- The hint does not replace the label of the field.
- On a narrow screen the controls stay at least 40 px tall and both dialogs fit the window (R27 of the dialogs' spec).
Source: `docs/specs/2026-11-17-browse-channels-people-picker-design.md`.

## Open questions
- For a long topic, does the row wrap the line (as the prototype does) or cut only the topic and keep the member count at the end?
- Is the hint of the New message box the existing label, "Search people", or another text?
