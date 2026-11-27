# Intent: Draw the owner's rail, account menu and Settings dialog
Author: Thanh Truong (lead).

## Problem
The owner has pictures of how Toki should look around the conversations: a rail of section buttons, the menu that opens from the person's avatar, and a Settings dialog. The app does not match them. Its rail shows only the sections that have a screen, its account menu holds Preferences and Sign out, and Preferences is a page that lists the signed-in devices and nothing else. A person cannot see what Toki is going to offer, and the screens do not look like the owner's.
Source: the owner's three pictures (2026-11-27), described under Proposed outcome; `apps/web/src/layout/sections.ts`; `apps/web/src/account/AccountHost.tsx`; `apps/web/src/routes/preferences.tsx`.

## Proposed outcome
- The rail shows, from the top: the workspace tile; Home, DMs, Activity, Files, Later, Tasks, Calendar and More, each an icon over its label; and at the foot a new button (a plus), a light and dark button (a sun), and the person's avatar with a presence dot.
- Pressing the avatar opens a menu beside the rail with: a group Focus time (25 minutes, 50 minutes, 1 hour, 2 hours, Until…), a group Pause notifications (30 minutes, 1 hour, 2 hours, Until tomorrow, Custom…), and Settings. The owner's picture is cut off above Focus time.
- Settings opens a dialog titled Settings with a close button. On the left is the list of its parts: Profile & status, Notifications, Availability, VIPs, Sidebar, Appearance, Messages & media, Language & region, Accessibility, Mark as read, Search, Audio & video, Advanced.
- Profile & status shows the person's avatar, name and email, then a group Profile: the photo with Upload photo, Display name, Full name, Title, Pronouns, Phone, Time zone and Save.
- Everything that has no working feature behind it is shown and cannot be pressed or changed.
- Everything a person can do today stays possible: signing out, seeing and signing out their devices, opening Admin, and starting a message.
Source: the owner's three pictures and the requirement of this run ("match the picture, and disable what does not exist yet"); the preview of this change that the owner saw and accepted on 2026-11-27.

## Affected users and systems
- Users: every signed-in person who uses the web app.
- Systems: the web app's shell (the rail and its sections), the account menu, the Preferences page and the signed-in devices on it, the interface texts in both languages, the icon set, the prototype, the decisions about the shell, the account menu, the Preferences screen, Pause and Focus time, and the looks, and the check that compares the app with the prototype.
Source: `packages/ui-web/src/layout/`; `apps/web/src/account/`; `docs/specs/`.

## Constraints
- A button, menu item, part or field with no working feature behind it is disabled. This work adds no new feature to the server and stores nothing new.
- The app shows no information about a person that it does not have: a field with no data is empty.
- Every interface text exists in English and in Vietnamese.
- The conversation column and the main area of the two column frame stay as the frame decisions say.
- The features behind the disabled items are built by their own work, not here: Focus time and Pause notifications, status, the profile, the choices of the Preferences screen, and the screens of the sections.
Source: the requirement of this run; `docs/specs/2026-11-27-calm-two-column-frame-design.md`; `docs/specs/2026-11-16-i18n-package-design.md`.

## Open questions
- Which looks get this rail: all three, or Classic only, as the prototype draws it?
- The preview made Classic the default so that it matched the pictures. Does the default stay Calm, as decided, or become Classic?
- The decision on the two column frame says the rail shows only the sections that work. Does this work replace that rule, and does Preferences leave the rail?
- Does the Settings dialog replace the Preferences page that is planned at its own address, or sit beside it? Where do the signed-in devices live?
- Admin is not in the picture. Is it reached from More, and what does More show for a person who is not an Admin?
- The decision on Pause and Focus time offers other durations than the picture. Which list is right?
- What do the plus and the sun do now? In the preview the plus opens New message and the sun changes light and dark until the page is loaded again.
- Is a presence dot that is always "active" on the person's own avatar acceptable before presence exists?
- Sign out is not in the picture. Is it kept in the menu, below Settings?
- On a window narrower than 720 px, are the menu and Settings reached, and how?
- Is this work built after the two column frame is merged, or does it include it?
