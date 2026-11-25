# Intent: Later
Author: Thanh Truong

## Problem
A person reading a conversation often sees a message that needs an answer or an action, but not now. Today there is nowhere to put it: the message scrolls away, and the person has to remember it or search for it.
The prototype has a Later screen for this: a bookmark on a message saves it, the saved messages wait in a personal list with two states (In progress and Completed), and a reminder can bring a message back at a chosen time. Nothing of it exists on the server or in the web app. Without it the bookmark of the action bar and the "Remind me about this" entry of the More menu have nothing to call, the Later item of the navigation has no page and no badge, and a reminder cannot fire.
Several rules must hold whatever the screen shows: a person's Later list is theirs alone; a reminder time must be in the future; a reminder fires on time, also when the server was restarted in between; a reminder that falls due during Pause or Focus time makes no toast, push or sound but still raises the badge; a saved message whose source was deleted stays in the list as a replacement row and the chip counts still equal the rows shown; removing a message from Later can be undone.

## Proposed outcome
A person saves a message from its action bar, or saves it and sets a reminder in one step from its More menu. The Later page lists the person's saved messages under two chips, In progress and Completed, each with a count equal to the rows shown. A row can be completed, given a reminder (In 1 hour, Today 15:00, Tomorrow 09:00, with In 3 hours in place of a choice already past), changed, or removed with an Undo. Pressing a row opens the message at its place in its conversation. When a reminder falls due the row moves to the top and is marked due, the Later badge rises, and the person is told by a toast unless Pause or Focus time is on. The list and the badge are the same on every device of the person.

## Affected users and systems
- Members and Admins, each with their own list. A Guest is a phase 5 role and is not built here.
- The server app (`apps/server`): a new `later` module with a table, routes, a reminder job and an event; the job queue and the event log are used as they are.
- The web app (`apps/web`) and `packages/client-core`: the Later page, the bookmark and the reminder entry in the message action bar and menu, the badge of the navigation, a store that follows the event.
- The tickets next to this one: the job queue (TOKI-064), jump to message (TOKI-068), the message action bar (TOKI-052), Pause and Focus time (TOKI-076), the notification decision work (TOKI-073), the Activity screen (TOKI-066, which shares the time choices).

## Constraints
- Saving adds the message to that person's list only; nobody else sees it. Source: FR-24, AC-062, journey F28.
- A reminder time must be in the future; the past is rejected; one minute ahead is accepted. Source: D-073, FR-24, AC-063.
- The choices are In 1 hour, Today 15:00 and Tomorrow 09:00; a choice already past is hidden and In 3 hours takes its place. Source: D-114, journey F28, prototype.
- During Pause or Focus time there is no toast, push or sound, reminders you set yourself included; badges still update; when it ends one summary lists what arrived. Source: D-072.
- A count on a chip always equals the rows shown. A saved message whose source was deleted is a replacement row that can still be completed or removed. Source: D-074, journey F28 cases.
- Removing from Later is reversible and shows an Undo for 5 seconds. Source: D-061, D-069.
- A message is opened through the one hook of the jump work. Source: TOKI-068.
- Nothing works by hover alone; Later is reachable on narrow screens. Source: D-067, journey F38.
- While the connection is down, writes are blocked with an explanation and are not faked. Source: D-079.
- Every text goes through i18n with English as the default; a wording the prototype does not contain is a proposal. Source: NFR-05, D-139.
- Milestone M5, size M. Needs the job queue, jump to message and the message and sync tickets. Source: Toki Blueprint, ticket TOKI-067.

## Open questions
- What happens to a pending reminder when the item is completed, and to a completed item that is given a reminder?
- What does a Later row show when the person can no longer read the conversation of the message?
- Who fires a reminder that fell due during Pause or Focus time, and when?
- Is there a limit on the number of saved messages, or a furthest reminder time?
- Can a message of an archived channel be saved?
- Who owns the time choices that Later and Activity share?
