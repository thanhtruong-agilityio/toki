# Rail, account menu and Settings dialog design

Date: 2026-11-27 · Status: draft for review
Intent: docs/intents/rail-menu-settings.md (Thanh Truong, lead)
Ticket: TOKI-147

## Goal
A signed-in person sees the rail, the account menu and the Settings dialog of the owner's pictures. What Toki cannot do yet is shown and disabled, and everything a person can do today stays possible.

## Scope
- In: the rail and its buttons in the three looks on a window of 720 px or more; the account menu; the Settings dialog with Profile & status and Advanced; the new icons and texts; the prototype; the UI parity check; the tests; the lines of earlier specs that say something else.
- Out (not now): any server change; anything newly stored; Focus time, Pause notifications, status, presence, editing a profile, the choices of the Preferences screen, the other parts of Settings, and the screens of DMs, Activity, Files, Later, Tasks and Calendar; the content of More; the layout under 720 px; a change of the default look.

## Requirements
- R1. The rail. In the three looks, from 720 px, the rail shows the workspace tile and then Home, DMs, Activity, Files, Later, Tasks, Calendar, Admin (for an Admin only) and More, in this order, each an icon over its label. Check: a unit test of the rows for each role and a browser test of the order in each look.
- R2. Sections with no screen. DMs, Activity, Files, Later, Tasks, Calendar and More carry `aria-disabled="true"`, are drawn dimmed, and a press or Enter changes neither the address nor the page. More is disabled for every role. Check: a unit test and a browser test that presses each one.
- R3. Admin. For an Admin, the rail button Admin opens the Admin page and is marked current on that page. For a Member there is no Admin button. Check: a unit test for each role and a browser test for the Admin.
- R4. The foot of the rail. Above the avatar are two round buttons. The plus is named "New message", opens the New message dialog and returns focus to itself when the dialog closes; it is disabled while that dialog is not available. The sun changes the page between light and dark and is named for the scheme it changes to; the choice is not stored, so a reload follows the default again. Check: a browser test of both buttons.
- R5. The avatar. The account card on the rail shows the person's avatar with the presence dot "Active". The dot does not change. Check: a unit test of the card's props.
- R6. The account menu. Pressing the avatar opens a menu with, in this order: the group Focus time (25 minutes, 50 minutes, 1 hour, 2 hours, Until…), the group Pause notifications (30 minutes, 1 hour, 2 hours, Until tomorrow, Custom…), Settings and Sign out. Every item of the two groups is disabled. Settings opens the dialog of R7. Sign out works as before. From 720 px the menu opens beside the rail with its foot level with the avatar and stays inside the window. Check: a unit test of the entries and a browser test of the place and of the two working items.
- R7. The Settings dialog. It is a modal dialog titled "Settings" with a close button. Escape and the close button close it, and focus returns to the avatar. On the left are, in this order: Profile & status, Notifications, Availability, VIPs, Sidebar, Appearance, Messages & media, Language & region, Accessibility, Mark as read, Search, Audio & video, Advanced. Only Profile & status and Advanced can be opened; the others are disabled. It opens on Profile & status, and the current part is marked. Check: a unit test and a browser test.
- R8. Profile & status. It shows the avatar, the person's display name and email, and a group "Profile" with the photo and Upload photo, the fields Display name, Full name, Title, Pronouns, Phone and Time zone, and Save. Display name holds the person's display name, Time zone holds the time zone of the device, and the four other fields are empty. Every field and both buttons are disabled. No request is sent. Check: a unit test of the values and a browser test that counts the requests.
- R9. Advanced. It shows the signed-in devices of the person, with the same texts, actions and confirmations as the Preferences page has today. Check: the existing tests of the devices also run against this part.
- R10. Preferences. The rail has no Preferences button and the menu has no Preferences entry: Settings takes its place. The address `/prefs` still opens the Preferences page. Check: a browser test of the address.
- R11. Narrow windows. Under 720 px nothing of this is added: the bottom bar and the panes are as before, and the two buttons of R4 are not displayed. Check: the existing narrow tests pass without a change of a number.
- R12. Default look. The default stays Calm in the scheme of the device, and the call in `apps/web/src/main.tsx` is not changed. Check: the existing test of the call passes without a change.
- R13. Texts. Every new text exists in English and in Vietnamese. Check: `pnpm i18n:check`.
- R14. Icons. The icon set gains `house`, `chats`, `tasks`, `calendar`, `sun`, `timer` and `gear`, used by Home, DMs, Tasks, Calendar, the sun button, the Focus time items and Settings. Each path is the same in the prototype's icon table. Check: the icon tests.
- R15. The prototype. `e2e/prototype/index.html` draws the rail, the menu and the dialog of R1 to R9, with the disabled parts drawn as disabled. Check: a browser test of the prototype.
- R16. The parity check. The reference images that change are made again from the prototype, never from the app, and the new hash is recorded. Check: `pnpm test:e2e:parity` runs with no missing reference.
- R17. The earlier specs. The pull request that changes the code also changes, in place, each line that says something else: the app shell spec (the rows of the rail and what a section can be), the two column frame spec (the rail shows disabled sections and has no Preferences button, and the menu has Settings in place of Preferences), the account menu spec (the order, the Settings entry and the rule that the menu never shows an entry that is not built), the icon set spec (the names), the look and scheme specs (what the sun button does), the Preferences screen spec (its choices are to live in the Settings dialog) and the Pause and Focus time spec (the durations of the picture). Check: no line of `docs/specs/` states the old behaviour as current.

## Design
### Screens
1. The rail (R1 to R5).
2. The account menu beside the rail (R6).
3. Settings, Profile & status (R7, R8).
4. Settings, Advanced (R7, R9).

### Errors
- A request of the signed-in devices fails in Advanced -> the message and "Try again" that the devices part already shows.
- The New message dialog is not available -> the plus is disabled.

### The shell package
A navigation section gains an optional disabled form. The shell gains a place for buttons at the foot of the rail, above the account card. The package still holds no text and reads no store.

### The app
The app builds the rows of the rail itself: Home and Admin come from the section list with its role rule, and the others are fixed disabled rows. The Focus time and Pause groups use the existing registry of account entries, with every item disabled, in the order Focus time then Pause notifications. The Settings dialog is part of the account code and uses the existing modal, field, select, button, avatar and devices components.

### Layout
```
packages/ui-web/src/icons/paths.ts
packages/ui-web/src/layout/{NavSection.tsx,AppShell.tsx,shell.css}
apps/web/src/layout/{sections.ts,RailActions.tsx}
apps/web/src/account/{AccountHost.tsx,AccountMenu.tsx,account-entries.tsx,SettingsDialog.tsx,account.css,settings.css}
apps/web/src/routes/app-layout.tsx
packages/i18n/src/messages/{en,vi}/
e2e/prototype/index.html, e2e/parity/, e2e/*.spec.ts
docs/specs/ (the files of R17)
```

## Testing
- Written first, each seen to fail for the right reason: the unit tests of the rail rows, the entries and the dialog (R1 to R3, R6 to R8), the style-sheet tests, then the browser tests (R1 to R12) and the prototype test (R15).
- Existing tests of the layout, the account menu, the icons and the sections are changed where this spec replaces what they check.
- Fake data only: the shell fixture, the faked signed-in session of the browser tests and the sample data of the prototype.
- Before the pull request: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e` and `pnpm test:e2e:parity` run, and their results are in the pull request.

## Data safety
- Nothing new is stored or sent. The dialog shows only the signed-in person's own name and email, which the app already holds.
- The scheme chosen with the sun stays in the open page.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| A button, menu item, part or field with no working feature behind it is disabled; no new server feature and nothing new stored | R2, R3, R6, R7, R8; Data safety |
| The app shows no information about a person that it does not have | R8; the presence dot of R5 is an accepted exception (concern 8) |
| Every interface text exists in English and in Vietnamese | R13 |
| The conversation column and the main area of the two column frame stay as the frame decisions say | Scope; no requirement changes them |
| The features behind the disabled items are built by their own work | Scope (Out) |

## Open questions from the intent
- Which looks get this rail: all three, or Classic only? All three looks (R1). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Does the default stay Calm, or become Classic? It stays Calm (R12). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Does this work replace the rule that the rail shows only the sections that work, and does Preferences leave the rail? Yes, both rules are replaced (R1, R2, R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Does the Settings dialog replace the planned Preferences page, and where do the signed-in devices live? The Settings dialog takes the place of the planned Preferences page: its choices are to live in Settings, the devices are under Advanced, and `/prefs` still opens until then (R9, R10, R17). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Is Admin reached from More, and what does More show for a person who is not an Admin? Admin has its own rail button for an Admin, and More is disabled for everyone (R2, R3). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Which list of Pause and Focus time durations is right? The list of the picture (R6, R17). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- What do the plus and the sun do now? As in the preview: the plus opens New message, and the sun changes light and dark without storing it (R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Is a presence dot that is always "active" acceptable before presence exists? Yes, the dot is drawn (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Is Sign out kept in the menu, below Settings? Yes, it stays below Settings (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- On a window narrower than 720 px, are the menu and Settings reached, and how? Nothing changes under 720 px in this work (R11). Decided by Thanh Truong (lead, as product owner) on 2026-11-27.
- Is this work built after the two column frame is merged, or does it include it? The two column frame is merged first, and this work builds on it. Decided by Thanh Truong (lead, as product owner) on 2026-11-27.

## Areas of concern
1. The looks. The prototype draws this rail for Classic only; Calm and Focus show People, Admin, Preferences, a search button and other rows. Decided: the rail is the same in all three looks, and the prototype changes with it (R1, R15). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
2. The default look. The preview used Classic to match the pictures; the look decision says Calm. Decided: the default stays Calm (R12). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
3. Two requirements of the two column frame spec, which is merged and not yet developed, say that the rail shows only the sections that work and has a Preferences button. Decided: this spec replaces both (R1, R2, R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
4. Settings and Preferences. The Preferences screen spec plans nine sections on a page at `/prefs`; the picture shows a dialog with thirteen parts. Decided: the Settings dialog takes the place of that page. The ticket of the Preferences screen builds its choices in the dialog, and its spec changes with R17; `/prefs` still opens until then. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
5. Admin is not in the picture. Decided: an Admin has a rail button for it, and More is disabled for everyone (R2, R3). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
6. Durations. The Pause and Focus time spec has Pause for 30 minutes, 1 hour and until tomorrow 08:00, and Focus time for 25 minutes and 1 hour. Decided: the list of the picture is right. The server rules for 50 minutes, 2 hours, Until… and Custom… belong to the ticket of Pause and Focus time, which enables the items (R6, R17). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
7. The two buttons at the foot of the rail. Decided: the plus opens New message, and the sun changes light and dark without storing it (R4). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
8. A fixed "Active" dot states something Toki does not measure. Accepted: the dot is drawn on the person's own avatar until presence exists (R5). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
9. Sign out is not in the picture. Decided: it stays in the menu below Settings (R6). Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
10. Narrow windows. A phone reaches neither the menu nor Settings, as today. Accepted: this work changes nothing under 720 px (R11); the entry points on narrow screens are other work. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
11. The order. The two column frame changes the same files. Decided: it is merged first, and this work builds on it. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
12. The top of the menu. The owner's picture is cut off above Focus time. Decided: nothing is drawn above Focus time. Decided by Thanh Truong (lead, as product owner) on 2026-11-27. Owner: Thanh Truong.
