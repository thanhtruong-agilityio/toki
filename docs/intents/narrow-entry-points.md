# Intent: Entry points on narrow screens
Author: Thanh Truong

## Problem
The wide layouts of Toki reach Search, People, Preferences, Admin and the account menu (Set status, Pause notifications, Focus time, Sign out) from the sidebar, the rail and the account card. Under 720 px the sidebar and the card are not drawn, and the bottom bar holds only Home, Activity, Later and Files. The shell draws the More tab only when something gives it a sheet, so today a phone has no way to reach these features except by typing an address, and no way at all to set a status, pause notifications, start Focus time or sign out.
The log says every phase 1 action has an entry point on narrow and touch screens, and names the More sheet as the place for search, the account menu, status, Pause and Focus time. The tickets that build those features each say "the More sheet reads this" and none builds the sheet.

## Proposed outcome
A phone shows a More tab in the bottom bar. Pressing it opens a sheet that rises from the bottom edge. The sheet lists Search, People, Preferences and, for an Admin only, Admin, and then an account section with Set status, Pause notifications, Focus time and Sign out. Choosing a row closes the sheet at once and then does what the row says: opens the search palette, the People or Preferences or Admin page, the status dialog, starts a pause or a Focus period, or signs the person out. Nothing a person can do on a wide screen is missing on a phone.
The sheet draws what the other tickets register, so an entry appears in it when its own feature is built and never shows a dead row.

## Affected users and systems
- Members and Admins on a screen narrower than 720 px. An Admin sees one more row than a Member.
- The web app (`apps/web`): the shell's route, one new sheet, its styles and its tests; one small change to merged TOKI-099 code, in the account menu registry.
- Uses: the app shell and its More tab (TOKI-015), the Sheet layer (TOKI-014), the account entries and Sign out (TOKI-099), Set status (TOKI-056), the command palette (TOKI-071), Pause and Focus time (TOKI-076), the People section row (TOKI-079), and the Preferences section row (TOKI-099, with its page frame in TOKI-078).
- Used by: the phone runs of the end-to-end flows (TOKI-090), which reach Search, Preferences, Admin and Sign out through the sheet.

## Constraints
- Belongs to Blueprint intent I13 preferences-and-people. Source: Toki Blueprint, intent list.
- Milestone M6, size M. Needs TOKI-015, TOKI-056, TOKI-071 and TOKI-076. Source: Toki Blueprint, ticket TOKI-092.
- The sheet holds Search, People, Preferences, Admin (with permission) and an account section with Set status, Pause notifications, Focus time and Sign out. Source: journey F38, ticket TOKI-092, D-053 (search, account menu, status, Pause, Focus time), D-158 (Sign out).
- Admin is drawn for an Admin only. Source: D-090, journey F08.
- No feature is hover-only or desktop-only; every action has an entry point on narrow and touch screens. Source: D-067, D-053, NFR-02.
- The sheet closes as soon as a destination is chosen. Source: ticket TOKI-092 (GAP-39).
- Sign out in the sheet ends the session on that device and shows the sign-in page. Source: FR-46 AC-130, TS-209, D-158.
- Every control is at least 40 px tall (the sheet's rows are 48 px, as in the prototype); toasts appear above the tab bar, never over it. Source: journey F38, D-078.
- The smallest supported window is 360 by 560 px. Source: D-054, D-068.
- When the connection is down every action other than sending a message is blocked with an explanation. Source: D-079.
- There are two roles, Member and Admin. Source: D-152.
- English is the default interface language and every text is in English and Vietnamese. Source: D-018, D-064.

## Open questions
- Does the sheet show who is signed in (name, status) above the account section? The phone draws no account card, so nothing else shows it.
- In which order are People, Preferences and Admin drawn? The ticket and the journey list Preferences before Admin; the section list of the shell has Admin before Preferences.
- The account menu has a Preferences entry and the sheet has a Preferences row. Is it drawn once or twice?
- Does Sign out close the sheet like every other row, although its wait must be seen? TOKI-099 concern 12 says it closes; how the wait is then shown on a phone is open.
- Does the sheet close when the window grows past 720 px while it is open?
- What does the Back button do while the sheet is open? TOKI-014 concern 2 (merged) says Back closes the topmost dialog or sheet.
