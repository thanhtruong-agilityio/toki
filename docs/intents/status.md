# Intent: Status
Author: Thanh Truong

## Problem
A person has no way to tell colleagues what they are doing. Presence only says Active, Away or Do not disturb, and nobody can set it by hand. People need a short line of their own, such as "In a meeting" or "Back at 13:00", that others see next to the person's name, and that goes away by itself when it stops being true: a status left behind after lunch is worse than none.
The line has to be set in a few seconds from the account menu, from Preferences or from the person's own profile, it has to reach everyone at once, and when the person saves it from two devices the last save has to win. The time at which it clears has to be kept on the server, so it fires even when the person has closed every tab.

## Proposed outcome
A person sets a status: one of five presets (In a meeting, Focusing, Out for lunch, Commuting, Working remotely) or their own text of 1 to 100 characters, with "Clear after": Don't clear, 30 minutes, 1 hour or End of today. Saving an empty text, or pressing Clear, removes it at once. The account card shows the status in place of the role. Others see it in the header of a direct message, in the profile, in the mention list and on the People card. When the time comes the status disappears for everyone and its owner sees the toast "Your status was cleared".
The server stores the status, writes one event for each change so every device and every colleague sees it at once, and clears it on time with a job of the background job queue. The ticket also gives the Focus time ticket one function to set the status "Focusing" and to restore the earlier one.

## Affected users and systems
- Every Member and Admin: the account menu (Set status), the account card, the header of a direct message, the mention list, and, through the tickets that own them, the profile panel, the People cards and the Preferences screen.
- The server app (`apps/server`): the `members` module (one table, two routes, one job, the bootstrap read), the event handler of the WebSocket gateway, the job registry.
- The shared package (`packages/shared`): limits, schemas, the event payload, the person entry of the bootstrap answer.
- The client (`packages/client-core`, `apps/web`): the API methods, the person data and its event, the status dialog and its hooks, the account menu entry, the texts.
- Later tickets that build on it: Focus time (TOKI-076), the profile panel (TOKI-057), Preferences (TOKI-078), People (TOKI-079).

## Constraints
- A status is one of five presets or free text of 1 to 100 characters; the field refuses the 101st character. Source: FR-45, F32, D-172.
- "Clear after" offers Don't clear, 30 minutes, 1 hour and End of today; no demo choice ships. Source: AC-127, D-145.
- Saving an empty field, or pressing Clear, removes the status at once. Source: F32, AC-127.
- When two devices save, the last save wins and everyone sees it at once. Source: D-121, AC-128.
- Others see the status in the DM header, the profile, the mention popup and the People card. Source: FR-45, AC-126.
- No screen sets presence by hand. Source: F34, AC-129.
- Timers run on the server through the job queue, tested with the controllable clock. Source: technical design (background jobs: status expiry), TOKI-064, TOKI-008 R19.
- Starting Focus time sets the status to "Focusing" and ending it restores the earlier status. Source: F32, F33.
- Every text goes through i18n; English by default. Source: D-018, NFR-05.
- Needs TOKI-064, TOKI-055, TOKI-030, TOKI-031. Milestone M4, size M. Source: plan, ticket list.

## Open questions
- Where is the status kept, and how do the other people and the other devices learn of a change at once?
- How does the clearing at a given time work, and what happens when the worker is not running at that moment?
- What does "End of today" mean, and in which time zone?
- What is shown for a person whose account was deactivated?
- Does pressing Clear offer Undo, as other reversible actions do?
- Who sets "Focusing" and restores the earlier status when Focus time ends?
