# Intent: Notification decision engine
Author: Thanh Truong

## Problem
Toki can show a toast, play a sound and send a system notification, but nothing decides who gets which of them. The facts that decide it are spread over several places: the level and the mute a person set for a conversation, the three switches of Preferences, Pause and Focus time, whether the person has Toki open and in use, and whether that very conversation is on the screen. Without one place that weighs them, each later screen would apply its own half of the rules, a muted conversation would still ring, a person would be told of their own message, and a push would arrive while the person is reading the message.
Several rules must hold whatever the screens show: your own action never notifies you; people outside a conversation are not notified; the level decides toast, push and sound; Mute also silences them, except that a mention still notifies while the person's switch for it is on; Pause and Focus time hold everything, reminders included, while the badges and Activity still update; no push arrives while the person is using Toki; and what is already on the screen is not announced again.

## Proposed outcome
The server decides, inside the transaction of each change that can notify, which people get a toast, a push and a sound, and writes that decision with the change: a numbered event to each person who may get an in-app toast or a sound, and a queued push for each person who has no Toki window in use. The decision reads the person's level and mute for the conversation, the three notification switches, Pause and Focus time, and whether any of the person's windows is in use.
The same engine gives the reminders of Later their real "is this person held" answer and their push, and gives a snoozed Activity item that comes back its toast.
Each open screen then applies one last check that only it can make: the window is in use, and the conversation, or the thread, is on screen. The check says whether the toast shows now, waits until the person returns, or is dropped, and whether the sound plays.
What the engine held during Pause or Focus time is recorded, so the one summary at the end can say how many things arrived.

## Affected users and systems
- Every Member and Admin on every device they are signed in on.
- The server app (`apps/server`): the `notifications` module (the engine, a table of open windows, a record of held notices), small edits to the change seam of `conversations`, the event handler of `realtime`, the job registry and one read of `conversations`.
- The shared package (`packages/shared`): the notice event, the window frame and the limits.
- The client (`packages/client-core`, `apps/web`): the check of a notice against the screen, and the report of whether the window is in use.
- The tickets that build on it: Web Push (TOKI-074), sound and in-app toasts (TOKI-075), Pause and Focus time (TOKI-076); the tickets it reads: Activity (TOKI-065), Later (TOKI-067), notification preferences (TOKI-102).

## Constraints
- Default level: 'Mentions only' for a channel, 'All messages' for a direct message or group. The level decides toast, push and sound; Mute also hides the badge and bold; 'Nothing' only stops toast, push and sound. Source: D-046, D-103.
- A mention in a muted conversation notifies only while the person's switch is on, and it is on by default. Source: D-088, AC-039.
- Pause and Focus time: no toast, push or sound, reminders included; badges still update; Focus during Focus extends it. Source: D-072, D-063.
- Your own action never notifies you; people outside the conversation are not notified. Source: D-071, D-058, D-135.
- A reaction gives an Activity item and no toast or push; a muted conversation still creates Activity items with no toast, push or sound; a system line notifies nobody. Source: F15, D-174, D-100.
- Editing in a mention notifies the newly mentioned person only; a push already sent cannot be recalled. Source: F16, "When you are mentioned" table.
- No push arrives while that conversation is on screen; with the app open and in use there is no push; with the tab hidden or the app closed there is. Source: F36, "When you are mentioned" table.
- The three switches belong to the person and are the same on every device; only the browser's push permission is per device. Source: D-142.
- Time and ordering use the controllable clock; every table carries the workspace. Source: TOKI-008, D-004.
- Milestone M5, size L. Needs TOKI-065. Source: Toki Blueprint, ticket TOKI-073.

## Open questions
- Does a reply in a thread notify (a follower's thread item, a reply under the level 'All messages'), and does an open thread panel count as the message being on screen?
- Do the items for being added to a channel, a changed role and a message deleted by an admin notify, or are they only Activity items?
- Do a reminder and a snoozed item that comes back play a sound, and does a snoozed item send a push?
- Does `@channel` notify in a muted channel?
- How long may a toast wait for the person to return to a hidden tab?
- Does a window that is visible and focused but untouched for a long time still count as in use?
- Where does the decision run, and how does a check on the screen fit?
- What do 'Desktop notifications' and 'Play a sound' control?
- Where is the line with Later (reminders) and with Pause and Focus time?
