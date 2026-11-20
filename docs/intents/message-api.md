# Intent: Message API
Author: Thanh Truong

## Problem
Conversations exist, but nobody can write in one or read what was written. The channel and direct-message requests, the permission functions and the tables are specified or built; no request stores a message or returns the history of a conversation.
Without this work the message list, the composer, the sync engine and the live events have nothing to call. Four rules must hold on the server whatever the screen shows: only a member writes and reads; an archived channel takes no new message; a repeat of the same send stores one message; a person who joins a channel reads its whole history.
Two things that earlier work left open land here: the grey system lines that a channel change causes ("Lan joined", "Lan added Minh"), and the rule that a new direct message stays out of the other person's list until its first message.

## Proposed outcome
The server answers a request to send a message, to load the latest messages of a conversation, to load older or newer ones, and to load the messages around one message.
A send carries an id made by the client, so a double press, a retry after a lost answer and two tabs store one message. A message holds up to 10,000 characters. Every member of a conversation reads its full history, an archived channel included, and nobody else reads any of it. Writing into an archived channel, or into a direct message whose other person is deactivated, is refused.
A change of a channel writes its grey system line in the same transaction. A new direct message appears in the other person's list when its first message is sent, and not before.

## Affected users and systems
- Members and Admins, who send and read messages in channels, direct messages and groups.
- The server app (`apps/server`): a `messages` module with the two routes and the system-line writer; small changes to `conversations` (the seam `recordChange`, the bootstrap read) and to the call that adds a newcomer to #general.
- The shared package (`packages/shared`): the request and response shapes, the limits and two error codes.
- `client-core`: the order of direct messages changes with the new `lastMessageAt` field.
- The neighbouring work: the tables of messages and events (TOKI-036), the WebSocket gateway (TOKI-038), the sync engine (TOKI-040), threads, reactions, edit and delete, pins, files, mentions and the read pointer, each of which adds to a message later.

## Constraints
- A message holds up to 10,000 characters and up to 10 files. Source: D-042, FR-09, FR-10.
- Writing needs membership; a person who has not joined a channel cannot read or write it; there is no preview. Source: D-077, D-116.
- Joining gives the full history; history is kept; channels are archived, never deleted. Source: D-029, FR-20.
- The client makes the message id and sending the same id again returns the stored message. Source: Toki Blueprint, technical design ("No duplicate sends"), D-111.
- An archived channel is read-only. Source: F26, BR-11, D-077; the functions of TOKI-027.
- A direct message with a deactivated person is read-only; a group stays writable. Source: F41, F25, D-091; TOKI-030 concern 1.
- A new direct message appears in the other person's list only when its first message is sent. Source: F25, D-091; TOKI-031 concern 1 and TOKI-030 concern 7 give this ticket the rule.
- A system line raises no unread count and no notification; a newcomer joining #general shows one. Source: D-100.
- Private channels, direct messages and groups are visible to their members only, and "no access" reads as "not found". Source: BR-09, BR-10, D-045.
- Permission is checked on the server for every request; routes are under `/api/v1` with one error format. Source: D-125, BR-09.
- A message is never rendered as raw HTML; the server stores the text as sent. Source: technical design, "Abuse limits".
- Milestone M3; size L. Needs TOKI-036. Source: Toki Blueprint, ticket TOKI-037.

## Open questions
- How many messages does one page of history hold?
- Does the rule that hides a new direct message until its first message also cover a group?
- Which channel changes write a system line, and does a change of the description?
- Which ticket stores the files of a message and enforces the limit of 10?
- By which key are messages ordered, when the client makes the id?
- Which code does a send into a read-only direct message get?
