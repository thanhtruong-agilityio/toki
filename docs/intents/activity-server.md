# Intent: Activity (server)

Author: Thanh Truong

## Problem
A person who belongs to many conversations cannot watch all of them. Something may be addressed to them there: a message that names them, a reply in a thread they took part in, a reaction to their message, an addition to a channel, a change of their role, an administrator deleting their message. Today nothing records these. The navigation has an Activity entry and a badge slot, and the messages carry the facts (who is mentioned, who replied, who reacted), but no place keeps "what needs this person's attention" for them.
Several rules must hold whatever a screen shows: nobody is notified of their own action; an item completes itself when the thing it asks for is done; an item goes away when its source message is deleted or the mention is edited out; leaving a channel clears the person's open items of it; a muted conversation still creates items; and a person never stops following a thread they joined.

## Proposed outcome
The server keeps, for each person, a list of Activity items of six kinds: mention, thread reply, reaction, added to a channel, role changed, and message deleted by an admin. Items are created, updated and removed inside the transaction of the change that causes them, so an item and its cause commit together.
The server also keeps who follows each thread: the root author, everyone who replied, and everyone mentioned in a reply. Each new reply gives every follower except its sender one thread item. There is no way to stop following.
A person can read their list newest first, filter it by kind, and see counts. A person can mark items read, mark all read, mark one done and take it back, snooze one until a time and unsnooze it. A snoozed item returns on time to the top of the list, unread, marked as back from snooze, even when no screen is open.
Every open screen and device of the person learns of a change: new, updated and removed items arrive as numbered events, and the person's own actions reach their other devices as a notice.
The later tickets get a clear contract: the Activity screen (TOKI-066) reads and acts through the routes; the notification decision engine (TOKI-073) reads the items that a change created and decides toast, push and sound.

## Affected users and systems
- Every Member and Admin, on every device they are signed in on.
- The server app (`apps/server`): a new `activity` module (tables, handler of changes, routes, two jobs, a listener of role changes); small edits to the change seam of `conversations`, the event handler of `realtime`, the job registry, and one read of `messages`.
- The shared package (`packages/shared`): the item, its states, the requests and answers, the event and notice shapes.
- The tickets that read the result: the Activity screen (TOKI-066) and the notification decision engine (TOKI-073).

## Constraints
- Your own action never notifies you; an item becomes done on its own once the thing it asks for is done; Activity is newest first and every kind has a filter chip. Source: D-071.
- A mention gives the person mentioned exactly one item; `@channel` gives every member except the sender the same item; a mention in a thread reply opens the thread at that reply. Source: FR-14, AC-036, F13.
- The root author, everyone who replied and everyone mentioned in the thread follow it automatically; each new reply gives every follower except its sender a thread item; there is no way to stop following. Source: D-119, FR-34, AC-089, AC-091.
- A reaction by another person gives the message's author one item for the message, updated with the latest names; removing a reaction removes that person from the item; reacting to your own message gives none. Source: D-163, FR-35, AC-095, F15.
- In a muted conversation items are still created and counted; no toast, push or sound is caused by this work. Source: D-174, D-088.
- An item is removed when its source message is deleted or the mention is edited out; a person's open items of a channel are cleared when they leave it. Source: F13, AC-111, D-133.
- Being added to a channel, a changed role and a message deleted by an admin each give the person an item; the admin's delete says by whom. Source: F22, F40, F42, D-049, concern 1 of the add-and-remove-people spec.
- Done removes the item and can be taken back; Snooze takes it out of the main list until a time and then returns it to the top, unread, labelled "Back from snooze"; the count of every chip equals the rows it shows. Source: FR-41, D-069, D-074, F27.
- The Activity badge is the number of unread items. Source: AC-108.
- Every table carries the workspace; time comes from the controllable clock. Source: D-004, TOKI-008.
- Milestone M5, size L. Needs TOKI-045, TOKI-046, TOKI-050 and TOKI-068. Source: Toki Blueprint, ticket TOKI-065.

## Open questions
- When a reply mentions a person who also follows the thread, is that one item or two, and under which chip?
- Does a person mentioned in the root message follow the thread, and does `@channel` make everyone a follower?
- When does an item become read by itself (message on screen, message opened, pointer moved), and does "done on its own" in D-071 remove the item or only mark it read?
- Does a new reaction on a message whose item was already read, or done, bring the item back unread at the top?
- Does a channel created with people give those people an "added you" item?
- How long does the label "Back from snooze" stay?
