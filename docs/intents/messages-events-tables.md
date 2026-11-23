# Intent: Messages and events tables
Author: Thanh Truong

## Problem
Chat is the core of Toki, and the database holds no message and no record of what happened.
Three things have to exist before the message API, the WebSocket gateway, the file tables and the search index can be built.
First, a place for messages: channel messages, direct messages, thread replies and the grey system lines ("Lan joined"), with a stable id that a client can make before it sends, so that sending the same message twice stores it once.
Second, a way to load a long conversation page by page, in both directions, that stays fast with a million messages.
Third, a numbered record of changes, the event log, that a client can use to ask for everything it missed after a dropped connection.
The log has one rule that is easy to break: a client that holds a number that is too high loses an event and gets no error. Numbers are handed out in order but transactions commit out of order, so a reader could see number 12 while number 11 is still in flight. The bootstrap call already returns the event number and returns 0 until this log exists.

## Proposed outcome
Three tables exist after a migration: `messages`, `events` and a small counter table that hands out event numbers.
A message row holds its conversation, its author, its text, its place in a thread (a reply points to a root, one level deep, and may also be shown in the channel), its edit and delete times, and, for a system line, its type and the people it is about instead of a text. It is never deleted from the table, and the columns that fix its place never change.
Two indexes serve the two ways a conversation is read: the main list of a conversation (roots, system lines and replies also sent to the channel) and the list of one thread, each ordered by time and then id, so a page, the page before it and the page after it come from the index with no sort.
An event row holds a number that is unique in the workspace and rises by one, who it is for (everyone in the workspace, the members of one conversation, or one person), a type and a JSON payload. The number is taken from the counter row inside the transaction of the change and the counter row stays locked until the commit, so events become visible in number order with no gap. One function writes an event and one reads the last number; the bootstrap call uses the second, so its `eventNumber` is real. Events older than 7 days are removed in a regular run, and the numbers never restart.
The tickets that follow (message API, gateway, reconnect, files, search index, read pointer) build on these tables and add their own columns only where the spec says so.

## Affected users and systems
- Everyone who chats, indirectly: nothing on screen changes with this ticket.
- The server app (`apps/server`): a new `messages` module (the `messages` table) and a new `realtime` module (the `events` and counter tables, the functions that write and read the log, the pruning); the bootstrap call, which reads the event number.
- The shared package (`packages/shared`): the message length limit, the message kinds, the event scopes and the retention period.
- The database and its migrations (TOKI-005).
- The conversation tables (TOKI-028) and the account tables (TOKI-019), which the new tables point to.
- Later tickets that use the tables: the message API (TOKI-037), the gateway (TOKI-038), reconnect (TOKI-039), file storage (TOKI-058), the Vietnamese search index (TOKI-069), the read pointer (TOKI-053).

## Constraints
- Messages and thread replies are one table; there is a stored reply count and a search column, which later tickets maintain. Source: Toki Blueprint, technical design, data tables.
- Ids are UUIDv7; every table carries `workspace_id`; the client makes the message id and sending the same id again returns the stored message. Source: technical design, data model notes and "No duplicate sends"; D-004.
- A message holds up to 10,000 characters. Source: D-042.
- History is kept indefinitely; a deleted message keeps its thread; an admin's deletion is shown differently from the author's. Source: technical design, data model notes; D-013, D-029, D-049.
- Threads are one level deep; a reply sent "also to the channel" is one message shown in both places. Source: technical design, data model notes; D-160.
- A system line (join, leave, add, pin, channel creation, details change) is a line of the conversation that raises no unread count and notifies nobody; its words come from translation keys, not from stored text. Source: D-100, D-165, flows F22 to F24; NFR-05.
- The event log is numbered and pruned after 7 days; the client remembers the last number and asks for what it missed. Source: technical design, data tables and "Reconnect".
- Every event is written in the same transaction as the change that causes it, and the number a reader sees has no gap that a transaction still in flight can fill; 0 means "no event"; the first event is 1. Source: bootstrap spec TOKI-031, R11.
- A message reaches another person in under 150 ms (p95) and 10,000 messages scroll at 60 frames per second; the measurement is TOKI-089's, so the design must not put a slow step in the send transaction. Source: NFR-13, D-113.
- Server modules call each other only through public interfaces, never each other's tables. Source: technical design, boundary rules; `.claude/rules/server.md`.
- Needs TOKI-028; needed by TOKI-037, TOKI-038, TOKI-058 and TOKI-069. Milestone M3, size M. Source: plan, ticket list and Needs column.
- Belongs to Blueprint intent I06 realtime-messaging.

## Open questions
- Who writes the system lines, the events and the Activity items of a channel change? (Answered for the channel API by the product owner; the question here is what this ticket must give them.)
- Which ticket hides a new direct message from the other person until its first message, and what does it need from the messages table?
- Which ticket owns the unread data, and what does it need from the messages table?
- By which order are messages paged: the id, or the time the server stored them?
- How does the event number stay free of gaps when transactions commit out of order?
- Who removes events older than 7 days?
