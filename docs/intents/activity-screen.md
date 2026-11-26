# Intent: Activity screen

Author: Thanh Truong

## Problem
The server keeps, for each person, a list of things that need their attention (mentions, replies in threads they follow, reactions, additions to a channel, a changed role, a message deleted by an admin), but a person cannot see it. The navigation has an Activity entry with no page behind it and no number on it.
Without the screen a person cannot read the list, filter it by kind, open the message an item points at, mark items read, finish an item or put it off until later. Several rules must hold on the screen: a count on a chip always equals the rows shown; Done and Snooze must work on a phone, where nothing may depend on hover; Done can be taken back for five seconds; a snoozed item returns at the chosen time, unread and labelled; and a time choice that is already past is never offered.

## Proposed outcome
- An Activity page at its own address, reached from the Activity item of the navigation and from the Activity tab of the bottom bar on a narrow screen. The page lists the person's items newest first, each with an unread dot, who did it, a sentence, the conversation and the time.
- Filter chips: All, Mentions, Threads, Reactions, one chip for the other kinds, and "Snoozed · n" only while something is snoozed. A chip shows exactly the items of its kind.
- Pressing an item marks it read and opens the message it points at (or the thread panel at a reply). "Mark all read" marks every item read and removes none.
- Every item has Done and Snooze. Done removes the item at once and offers Undo for five seconds. Snooze offers In 1 hour, Today 15:00 and Tomorrow 09:00, with In 3 hours in place of a choice that is past. A snoozed item shows when it comes back and can be brought back by hand.
- The Activity item of the navigation and the Activity tab show the number of unread items.
- The list, the chip counts and the number stay right while other people act, while the person acts on another device, and after the connection has been lost.
- The labels, the hook and the menu body of the time choices are built here once, for Activity and Later.
- An empty list says so and offers a way to the conversations.

## Affected users and systems
- Every Member and Admin, on a desktop and on a phone. Source: Toki Blueprint, ticket TOKI-066, flow F27.
- The web app (`apps/web`): a page, a route, a section row, a badge on the navigation, a client store, and the time-choice pieces.
- `packages/client-core` (a store and the API methods), `packages/i18n` (new texts in English and Vietnamese) and `packages/ui-web` (two optional props of the section frame: a toolbar slot and the attributes of the scrolling body) and one small option of the existing list hook `useMoreOnScroll`.
- Read as they are: the Activity server (TOKI-065), jump to message (TOKI-068), the destructive-action patterns (TOKI-093), the date and time rules (TOKI-094), the sync engine (TOKI-040), the app shell (TOKI-015) and the translation package (TOKI-017).

## Constraints
- A filter chip exists for every kind of item, and the count of a chip equals the rows shown. Source: D-071, D-074.
- Your own action never notifies you; Activity is newest first. Source: D-071.
- Pressing an item marks it read and opens the conversation at that message, or the thread panel for a thread reply; "Mark all read" marks every item read without removing any. Source: FR-40, AC-109, TS-171, TS-172.
- Done removes the item without a confirmation and shows a toast with Undo for 5 seconds. Source: D-069, D-061, FR-41, AC-112.
- A snoozed item leaves the main list, is listed under "Snoozed · n", and returns at the chosen time at the top, unread and labelled "Back from snooze"; Unsnooze returns it as unread. Source: FR-41, AC-113, F27.
- The Snooze menu offers In 1 hour, Today 15:00 and Tomorrow 09:00; a past choice is hidden and "In 3 hours" takes its place. Source: D-114, AC-114.
- Done and Snooze are visible on narrow and touch screens without hovering. Source: D-053, D-067, AC-115.
- The Activity badge is the number of unread items. Source: AC-108.
- An empty list has an empty state centred in the content area, written for the filter. Source: D-074, F27.
- Dates and times use the one format of the app, 24-hour; a past time is never offered where a future one is needed. Source: D-073, D-123.
- While disconnected, writes are blocked with an explanation. Source: D-079.
- Every text goes through the translation files, in English and Vietnamese; a wording the prototype does not contain is a proposal. Source: NFR-05, D-018, D-139.
- Milestone M5, size M. Needs TOKI-017, TOKI-065, TOKI-093 and TOKI-094. Source: Toki Blueprint, ticket TOKI-066.

## Open questions
- What is the chip for the kinds "added to a channel", "role changed" and "message deleted by an admin" called, and does it hold all three?
- Do the chips other than "Snoozed" show a number?
- What makes an item read by itself (the message on screen, the message opened, the read pointer passing it), and does "done on its own" remove the row or only mark it read?
- What are the sentences of the kinds the prototype does not draw, the text of the Done toast and the other texts the prototype lacks?
- What time does a row show when the item is not from today?
- What does pressing an item that points at no message do?
- What does a person see and do when the connection is down?
