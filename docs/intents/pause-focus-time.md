# Intent: Pause and Focus time
Author: Thanh Truong

## Problem
A person who has to concentrate has no way to make Toki quiet. Toasts, sounds and pushes keep arriving, and the only protection is to close the app and risk missing something. The prototype lets a person pause notifications for a while, or start Focus time, which also turns the presence dot to Do not disturb and sets the status "Focusing". Nothing of this exists on the server, so it would be lost on reload, would not reach the person's other devices, would not end when every tab is closed, and could not be read by the code that decides who gets a notification.
When the quiet period ends the person needs one short account of what arrived, and the status they had before Focus must come back by itself.

## Proposed outcome
From the account menu a person pauses notifications for 30 minutes, 1 hour or until tomorrow 08:00, or starts Focus time for 25 minutes or 1 hour. While either runs there is no toast, push or sound, reminders the person set included; badges and Activity still update. A strip at the top of the main area shows the end time, the time left and a button that ends it early, and the account card shows a countdown. Focus time also makes the presence Do not disturb and sets the status "Focusing". Starting Focus time while it runs extends it instead of starting a second one. Ending Focus time restores the earlier status. If a longer Pause is still running when Focus ends, notifications stay paused.
When the last of them ends, by time or by the person's button, one summary toast says how many things arrived and offers a button to Activity. Someone who opens a direct message with a person in Pause or Focus time sees a line that says so. The state belongs to the account and shows on every device.
The server stores the state, ends it on time with a job of the background queue, writes one event for each change, answers the question "is this person held at this moment" for the notification decision engine and for reminders, and counts what arrived for the summary.

## Affected users and systems
- Every Member and Admin: the account menu (Pause notifications, Focus time), the strip, the account card, the summary toast, the command palette actions, the header of a direct message, and, through the tickets that own them, the Preferences screen and the More sheet on narrow screens.
- The server app (`apps/server`): a new module for the state, its routes, the end job, the read for the decision engine, the change and the event.
- The shared package (`packages/shared`): lengths, schemas and the event payload.
- The client (`packages/client-core`, `packages/ui-web`, `apps/web`): API methods, the store, the strip component, the card countdown, the menu entries and the texts.
- Neighbours: the notification decision engine (TOKI-073), Later (TOKI-067), presence (TOKI-055), status (TOKI-056), the job queue (TOKI-064), notification preferences (TOKI-102).

## Constraints
- During Pause or Focus time there is no toast, push or sound, including reminders the person set; badges still update. Source: D-072, D-063, FR-15, AC-040.
- Pause lasts 30 minutes, 1 hour or until tomorrow 08:00; Focus time lasts 25 minutes or 1 hour; no demo choice ships. Source: F33, D-145.
- A strip at the top of the main area shows the end time, the time left and a button to end early; the account card shows a countdown. Source: F33, prototype `stripsHtml` and `.navclock`.
- Focus time also sets presence to Do not disturb and the status to "Focusing". Source: F33, F34, FR-45.
- Starting Focus time during Focus time extends it and does not nest; ending it restores the earlier status. Source: D-072, AC-042, TS-064.
- When Focus ends while a longer Pause is running, notifications stay paused under that Pause. Source: F33.
- When it ends, one summary lists what arrived, with a button to Activity. Source: D-072, AC-041, F33.
- It applies to the account on every device. Source: F33, D-142.
- Someone who opens a direct message with a person in Pause or Focus time sees a line under the header. Source: F25, F33.
- The end happens on the server through the job queue and is tested with the controllable clock. Source: technical design (background jobs), TOKI-064, TOKI-008 R19.
- Every text goes through i18n; English by default. Source: D-018, NFR-05.
- Needs TOKI-055, TOKI-056, TOKI-064, TOKI-073; milestone M5, size M. Source: plan, ticket list.

## Open questions
- Which ticket owns the class `.strip` that the Pause and Focus strip uses: TOKI-082 in M6, or a ticket of M5?
- When Focus time is started while it runs, how far does the end move?
- What does the summary show when nothing arrived, and when no device is open at the end?
- If the person changed their status during Focus time, which status is there at the end?
- Where is the state kept, and how do the other devices learn of a change?
- How do Pause and Focus time run together, and what does a second Pause do?
- Who builds the line under a direct message header, and what does the other person see?
- In which time zone is "until tomorrow 08:00"?
- Which lengths do the account menu and the command palette offer?
- How does Focus time reach presence?
