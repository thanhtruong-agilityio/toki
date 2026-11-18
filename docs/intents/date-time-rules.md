# Intent: Shared date and time rules
Author: Thanh Truong

## Problem
Toki shows and checks dates and times in many places: the time of a message, the day dividers in a conversation, the time an Activity item comes back from snooze, the time of a reminder, the time a status clears, the end of Pause and Focus time, a person's local time on the profile.
The prototype writes these with many separate helper functions and one direct call to the browser's date formatter. They do not agree: one form shows a weekday without a date ("Mon 09:00"), one shows a weekday with a date, one shows a date without a weekday, and none of them ever shows a year or reads a time zone.
The decision log fixes the rules (D-073, D-123), but the `shared` package holds no code for them. If every screen and every server route writes its own check and its own format, the rules drift apart again, and the phase 1 measure "'Invalid Date' never appears" (NFR-08) cannot be kept in one place.

## Proposed outcome
There is one place in the repository that knows how Toki writes a time, a date and a date with a time, and how it checks a date or time that a person entered.
A screen and a server route that need the same rule use the same code, so a reminder time refused by the screen is also refused by the server, for the same reason.
Every date and time on every screen has the same form, uses 24-hour time, shows the year when it is not the current year, and never shows 'Invalid Date'.
The builder (Thanh and Claude) can build Activity, Later, status, Pause and Focus time and the profile without deciding a date format again.

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every Member, Admin and Guest, who read the dates and times. Source: Toki Blueprint, intent I02 design-system.
- Systems: `packages/shared` (created empty by TOKI-001). Later users of the rules: the server (`apps/server`), `packages/client-core` and `packages/ui-web`.
- Tickets that use the result: TOKI-042 Message component (time of a message, day dividers), TOKI-035 Details panel (creation date of a channel), TOKI-056 Status, TOKI-057 Profile panel, TOKI-063 Files, TOKI-066 Activity screen, TOKI-067 Later, TOKI-076 Pause and Focus time, TOKI-079 People screen, TOKI-025 Admin page (last active, invitation date), TOKI-099 Account menu (last use of a device). The plan lists none of them as needing TOKI-094; the spec asks for that change.

## Constraints
- Belongs to Blueprint intent I02 design-system, whose "done when" includes "the Undo, confirmation and date-rule patterns exist". Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Size: S. Needs: TOKI-001. Source: Toki Blueprint, ticket TOKI-094.
- Agreed scope: validation and formatting in `shared`: required fields, no past where a future time is needed, the year shown when it differs, one format with 24-hour time everywhere. Source: Toki Blueprint, ticket TOKI-094.
- Required date and time fields cannot be left empty. Source: D-073.
- Where a future time is needed, the past is rejected. Source: D-073; also D-055 (a start time in the past is rejected) and D-056 (a past expiry date is rejected).
- The year is shown whenever it is not the current year. Source: D-073.
- One format across the app. Source: D-073, NFR-08.
- 'Invalid Date' never appears. Source: D-073, NFR-08.
- Time is 24-hour everywhere, for every language. Source: D-123.
- In the reminder and snooze menus, a choice whose time has already passed is hidden; 'In 3 hours' takes the place of 'Today 15:00'. Source: D-114.
- The local time on a profile comes from the time zone the person set, not from where they are now. Source: D-144.
- `packages/shared` may use only the globals on the allow list of the lint rules (the language built-ins and a short list of others); no browser API. Source: spec of TOKI-002, R5.
- "Now" comes from the clock in `packages/shared/src/clock` built by TOKI-008; no second clock is built. Source: spec of TOKI-008, R8.
- English is the default interface language and every text goes through i18n. Source: Toki Blueprint, ticket TOKI-017.

## Open questions
- Do the names of days and months, and number formats, follow the interface language? The decision log lists this as open (D-189).
- In which time zone does a person see the times on their own screens: the zone of the device, or the zone set in the profile? No decision row covers it; D-144 covers only the local time shown on a profile.
- Which written form is "the one format"? D-073 asks for one format but does not write it out, and the prototype uses several.
