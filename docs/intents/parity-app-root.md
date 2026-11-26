# Intent: Let the UI parity check capture pages outside the app shell
Author: Thanh Truong

## Problem
The UI parity check takes a picture of the element `.app` on both sides and compares them. That element exists only in the shell of the signed-in app (the sidebar, the list and the main area). A page outside the shell, such as the sign-in page, has no `.app`, so the check cannot take its picture, and the sign-in page has no declared screen. To compare it, a person had to change the code of the check by hand.
Source: `e2e/support/parity.ts` and `e2e/parity/screens.spec.ts` (the picture is of `.app`); `packages/ui-web/src/layout/AppShell.tsx` (where `.app` is drawn); the run of the check on the sign-in page (2026-11-26).

## Proposed outcome
- A screen that is declared for the check can say which element of the app is captured, and a screen that says nothing keeps the behaviour it has.
- The two steps of the sign-in page (the email step and the code step) are declared screens of the check, with reference images made from the prototype's guest sign-in card, so that a run of the check reports on them.
- The README of the check says how to declare a screen outside the shell.
Source: the requirement of this run.

## Affected users and systems
- Users: the builder who declares screens, and the reviewer who reads the report.
- Systems: the UI parity check (`e2e/support/parity.ts`, `e2e/parity/screens.spec.ts`, `e2e/parity/screens/`, `e2e/parity/reference/`, `e2e/parity/README.md`). The app and the prototype are not changed.

## Constraints
- The screens that are declared today produce the same pictures and the same rows as before.
- The reference images are made from the prototype, never from the app.
- The check stays inside the Playwright container and uses fake data only.
Source: `docs/specs/2026-11-24-ui-parity-check-design.md` (the reference images, the container).

## Open questions
- Is the element captured named for the app side only, or for both sides? The prototype opens its guest sign-in inside `#app`, the app's page has no such element.
- How many widths and looks do the sign-in screens run in? The check's default is both looks at three widths.
- Does the check list the differences of the sign-in screens as new, or are they recorded as known until the sign-in card is fixed by its own ticket?
