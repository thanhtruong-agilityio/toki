# Intent: Read pointer
Author: Thanh Truong

## Problem
A person who is in many conversations needs to see where something new was written and to lose that sign once it has been read, on every device they use.
Today the conversation list has a place for an unread count and an @ mark (the store of TOKI-032 and the rows of TOKI-033), but nothing fills it: the server remembers nothing about what a person has read, and no client counts.
Without this work the New divider, the badges, the Home count, the Unread and Mentions filters and the browser tab title (TOKI-054) have no data, and the Unread and Mentions chips stay empty.
Several rules must hold whatever a screen shows: a conversation is read only when it is open, the window is in use and the list is at the bottom; a grey system line, a thread reply and a person's own message raise no count; leaving a channel clears its count; and nobody, the sender included, can learn who has read a message.

## Proposed outcome
The server keeps, for each person and each conversation they belong to, one read pointer: the message they have read up to.
A request moves the pointer forward and never back, and a repeat changes nothing.
The server answers, for every conversation of a person, how many messages are unread, whether one of them mentions the person, and which message is the first unread; the bootstrap call carries it, one request returns it again, and a notice reaches the person's other open devices when a pointer moves.
The client keeps these numbers up to date as messages arrive, marks a conversation read when it is open, the window is in use and the list is at the bottom, and fills the unread data of the conversation store, so the list rows, the filters and the New divider can read it.

## Affected users and systems
- Every person who reads conversations, on every device they are signed in on.
- The server app (`apps/server`): the `conversations` module gains the pointer columns and their reads; the `messages` module gains the count and the request that moves the pointer; the bootstrap call gains the counts; the `bootstrap` folder gains the shared builder of the counts and the route that returns them again; the `mentions` module (TOKI-050) is asked for one read and one index.
- The shared package (`packages/shared`): the shapes of the unread record, the two requests and the live notice.
- The client packages: the conversation store and a new tracker in `packages/client-core`; the web app (`apps/web`) for the window-in-use adapter and the wiring in the conversation page.
- The tickets that read the result: the New divider, badges and filters (TOKI-054) and the conversation list (TOKI-033).

## Constraints
- A conversation counts as read when it is open, the window is in use and the person is at the bottom of the list; read state never depends on AI. Source: D-052, FR-08.
- Nobody sees who has read a message; the sender does not know. Source: D-048, AC-023.
- A grey system line raises no count and no notification. Source: D-100, D-165.
- A thread reply that is not also sent to the channel does not raise the channel's count; a reply also sent to the channel counts as a normal message. Source: F14, D-160.
- Leaving a channel clears its count. Source: D-133.
- A muted conversation keeps its count and the screen hides the badge; the level `none` keeps both the count and the badge. Source: D-103.
- A mention in a thread reply raises the @ mark and not the count. Source: F13.
- Unread state is one pointer per person and conversation; counts are the same on every device of the person. Source: technical design, data model notes ("Unread is one pointer per person per conversation").
- Mark as unread is a later phase. Source: D-120.
- Milestone M4, size L. Needs TOKI-040 and TOKI-041. Source: Toki Blueprint, ticket TOKI-053.

## Open questions
- Does a person who joins a channel find its earlier history unread?
- When a message is deleted or edited so that it no longer mentions the person, does it leave the count?
- A message that commits after a message with a later time: is it counted by a pointer that has moved past it?
- Does a window that is visible and focused but left alone for a long time still count as in use?
- Where does the first unread message come from for the New divider, and who owns it?
- Does the @ dot clear when the mention message is on screen (F13 step 5) or at the bottom of the list with the count (D-052)?
- How does a second device learn that the first one has read?
