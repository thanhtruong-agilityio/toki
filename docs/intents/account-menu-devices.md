# Intent: Account menu, Sign out and signed-in devices (screens)
Author: Thanh Truong

## Problem
The prototype has no way to sign out. Its account card opens a menu with Set status, Pause notifications, Focus time and Preferences, and nothing else, and its Preferences page does not say where a person is signed in. A person who signs in with an emailed code on a shared computer cannot leave it, and a person who loses a phone cannot end its session from another device.
The server already has the calls (TOKI-022 ends the session of the device in use, TOKI-026 lists a person's sessions and ends one or all of the others), and the app shell (TOKI-015) already draws the account card as a button that can open a menu. No screen uses any of it.

## Proposed outcome
A signed-in person presses their account card and sees a menu. The menu has an entry for Preferences and an entry for Sign out, and, as their own tickets are built, Set status, Pause notifications and Focus time. Sign out ends the session on this device, shows the sign-in page, and signs out the other tabs of the same browser at once. On a narrow screen the same entries are reached from the More sheet.
Preferences has a "Signed-in devices" section. Each row shows the kind of device, the browser and the last use, and the row of the device in use is marked "This device". Beside every other row a Sign out button, and below the list a "Sign out all other devices" button, each ask for confirmation naming what will be signed out. After a confirmation the row, or every other row, is gone.

## Affected users and systems
- Users: Member and Admin, each for their own account and sessions. There is no Owner role and no guest in phase 1. Source: journey F06, FR-46, FR-47, D-152.
- Systems: the web app (`apps/web`), `client-core` (the calls for the three session routes), `platform` (a way to tell the other tabs of a browser), and the i18n catalogs.
- Uses: the account card and the shell's contract (TOKI-015), the Menu and the layers (TOKI-014), the confirmation pattern (TOKI-093), the session state and the sign-in guard (TOKI-023), the sessions routes (TOKI-026), the sign-out route (TOKI-022), the API client (TOKI-032) and the date and time rules (TOKI-094).
- Used by: the More sheet (TOKI-092), which shows the same entries; Set status (TOKI-056), Pause and Focus time (TOKI-076), which add their entries to the menu; synced drafts (TOKI-051) and Web Push (TOKI-074), which are asked to run before the session ends; the Preferences screen (TOKI-078), which holds the devices section.

## Constraints
- Belongs to Blueprint intent I03 sign-in-by-email-code. Source: Toki Blueprint, intent list.
- Milestone: M2, Sign-in, members and conversations. Source: Toki Blueprint, milestone M2.
- Size: S. Source: Toki Blueprint, ticket TOKI-099.
- Needs: TOKI-014, TOKI-015, TOKI-093. Source: Toki Blueprint, ticket dependencies.
- Agreed scope: the account card's menu with Set status, Pause notifications, Focus time, Preferences and Sign out, where an entry appears when its own ticket is built; "Sign out" in the account menu and in the More sheet on narrow screens; a "Signed-in devices" section in Preferences with the device kind, browser and last use of each row, "This device" on the current one, a "Sign out" beside each other device and "Sign out all other devices", each asking for confirmation. Source: Toki Blueprint, ticket TOKI-099; D-158, D-067, D-069.
- This ticket owns the content of the account menu and renders the Menu on the shell's trigger, the signal to the other tabs on Sign out, the sign-out call, and the confirmation for signing out other devices. Source: Toki Blueprint, ticket TOKI-099; TOKI-015 spec, "Contract for TOKI-014 and TOKI-099".
- Pressing Sign out saves unsynced drafts to the server, ends this device's session, removes its push registration and shows the sign-in page. Source: journey F06.
- Signing out in one tab signs out every other tab of the same browser at once; the person's other devices stay signed in. Source: D-093, FR-46 AC-131, AC-132.
- After Sign out no address of Toki shows workspace content until someone signs in again, and the Back button does not bring it back. Source: FR-46 AC-130, TS-208, BR-01.
- Signing out another device asks for confirmation that names the device, Cancel changes nothing, and after confirming the row is gone; "Sign out all other devices" asks for confirmation and keeps the device in use. Source: FR-47 AC-134, AC-135; D-069.
- A reversible action never has both a confirmation and an Undo; signing out another device is confirmed, not undone. Source: D-069.
- When the connection is down every action other than sending a message is blocked with an explanation. Source: D-079, D-060.
- Every action works on a narrow screen and by touch, and no feature is hover-only; the smallest supported window is 360 by 560 pixels. Source: D-067, D-068, journey F38.
- There are two roles, Member and Admin; both see the same menu and the same section. Source: D-152.
- English is the default interface language and every text is in English and Vietnamese. Source: D-018, D-064.
- Times use the app's one format, 24-hour, and never show "Invalid Date". Source: D-073, D-123.

## Open questions
- Does "Sign out" on the current device ask for confirmation? D-158 and journey F06 state a confirmation only for other devices. The log has D-178 as Open, with a proposal: no confirmation, drafts saved first.
- Where does the "Signed-in devices" section live while the Preferences screen (TOKI-078) is in milestone M6 and this ticket is in M2?
- Which ticket sends the signal that makes the other tabs of the browser leave at once? TOKI-023 and TOKI-018 both name this ticket.
- What do the rows say for a device kind or a browser that the server cannot tell (`unknown`, `other`)? The log fixes the three items of a row and no word for an unknown one.
- What does a row show for the last use: a date and time or a relative time?
- What do the other tabs do with a draft that was not yet saved, when the session ends under them?
- What does the account card say under the name now that there is no Owner?
