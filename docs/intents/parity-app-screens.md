# Intent: Compare more screens of the app with the prototype in the UI parity check
Author: Thanh Truong

## Problem
The UI parity check compares the screens that a ticket declares. Only the Admin page and the two steps of the sign-in page are declared. The conversation page, the Details panel, Browse channels, New message and Preferences have a counterpart in the prototype and are built in the app, but they are not in the check, so nothing tells a builder or a reviewer where they differ. A run made by hand on the prototype's own sample data found differences that became tickets (the spacing of the Details panel, Browse and New message).
Source: the UI parity check (`e2e/parity/`); the run on these five screens (2026-11-26).

## Proposed outcome
- The check compares the conversation page, the Details panel, Browse channels, New message and Preferences with the prototype, in Calm and Focus, at the widths where both draw the same screen.
- The app is shown with data made as the prototype's sample workspace, so that a difference is not only another name.
- The differences that stay for a reason (a feature that is not built yet, or a wording or a layout that a spec decided) are recorded with their reason, so a run lists them as known and not as new.
Source: the requirement of this run.

## Affected users and systems
- Users: the builder who runs the check and the reviewer who reads its report.
- Systems: the UI parity check (`e2e/parity/`, `e2e/support/`). The app and the prototype are not changed.

## Constraints
- The reference images are made from the prototype, never from the app.
- The check stays inside the Playwright container and uses fake data only.
- A screen that the prototype and the app do not draw in the same way at a width is not compared at that width.
- The screens that are declared today produce the same rows as before.
Source: `docs/specs/2026-11-24-ui-parity-check-design.md`; `docs/specs/2026-11-26-parity-app-root-design.md`.

## Open questions
- At a narrow width the prototype shows the list of conversations and the app the open conversation: are these screens compared at the wide and the middle widths only?
- Is the sample data a stub of the check, or the seeded workspace of the prototype's seed data ticket, which is not built yet?
- Are the differences of these rows listed as known, with the ticket that fixes each, or left as new?
