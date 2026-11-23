# Intent: client-core sync engine
Author: Thanh Truong

## Problem
The server now stores messages and pushes numbered events over a WebSocket (message API, TOKI-037; gateway, TOKI-038). Nothing on the client keeps what arrives. The conversation store of `client-core` holds the list of conversations and never changes after its first load, so a person who is added to a channel, a topic that changes, a new direct message or a newly sent message stays invisible until a reload. There is also no place that holds the messages of a conversation, no way to send a message so that it shows at once, and no rule for a message sent without a connection.
Four things are missing. First, one cache of the messages of each conversation, with a fixed order and no duplicate, that the message list, the composer and the later features (threads, reactions, edit, pins) all read. Second, the rules that apply each event of the gateway to the conversation store and to that cache, once and in order, so an open screen follows the server. Third, an optimistic send: the message shows at once, becomes solid when the server confirms, waits while there is no connection, is tried once when the connection returns, and otherwise ends as "Not sent" with Retry and Delete. Fourth, a waiting message must survive a reload of the page and must not survive another person signing in on the same browser.

## Proposed outcome
`packages/client-core` gains a sync engine. It reads the history of a conversation (latest, older, newer, around a message) and keeps the messages of each conversation in a window, ordered by the server's time and then by id, with no duplicate. It applies the events and live notices that the socket layer hands to it to the conversation store (entries, details, settings, people, the time of the last message of a direct conversation) and to the message windows. It sends a message with an id made on the client, keeps it in the list in one of three states until the server confirms it, and keeps the waiting messages in the browser through a storage port that the web app fills. It adds two typed request methods to the API client, a few commands to the conversation store, and a small wiring in `apps/web`.
It does not open the socket, retry it or ask for missed events (reconnect, TOKI-039); it does not draw anything.

## Affected users and systems
- Every person with Toki open: they see their conversations and messages follow the server without a reload, and their own messages show at once.
- `packages/client-core`: the new engine, new methods of the API client (send, history), additions to the conversation store.
- `apps/web`: the wiring file (`client.ts`) and a storage adapter for the waiting messages.
- Neighbouring work: reconnect (TOKI-039, which owns the socket and hands events to this engine), the virtualised list (TOKI-041), the message component (TOKI-042), the composer (TOKI-043), the typing indicator (TOKI-044), threads, reactions, edit and delete and pins (TOKI-045 to TOKI-048), the read pointer (TOKI-053), which all read or extend the engine.

## Constraints
- `client-core` uses no DOM or browser API, holds no text a person reads, and takes the clock and the timers as parameters. Source: `docs/specs/2026-11-17-client-core-design.md` (R1, R24), TOKI-008 R19.
- A message the person sends appears at once, slightly faded, and turns solid when the server confirms. Source: journey F11 (Toki Blueprint).
- While offline a message waits and sends itself when the connection returns; once online there is one automatic try, then "Not sent" with Retry and Delete, and Delete asks nothing. A message sent offline is delivered exactly once. Source: D-079, D-097, D-087, AC-072, TS-113, TS-114.
- A request with no answer after 10 seconds counts as failed. Source: D-126.
- A waiting message survives a reload, kept in the browser, and is dropped if someone else signs in on that browser. Source: D-132.
- Messages are ordered by the server's time and then by id; a repeat of a send stores one message. Source: `docs/specs/2026-11-20-message-api-design.md` (R5, R9), D-111.
- Each event has a number; events reach a client in number order, once; the client keeps the number it has applied. Source: `docs/specs/2026-11-20-messages-events-tables-design.md` (event contract), `docs/specs/2026-11-20-websocket-gateway-design.md` (R7, R14, R15).
- A grey system line raises no unread count; direct messages and groups are ordered by the time of their last message. Source: D-100, F09, message API spec R21.
- A message reaches another person in under 150 ms (p95) and switching to an opened channel takes under 100 ms. Source: NFR-13, D-113.
- A person who is no longer a member reads nothing of the conversation. Source: D-116, BR-09, BR-10.
- Milestone M3 "Real-time chat". Size: L. Needs: TOKI-037, TOKI-038. Needed by: TOKI-041, TOKI-043, TOKI-045, TOKI-046, TOKI-047, TOKI-048, TOKI-053. Source: Toki Blueprint, ticket TOKI-040.

## Open questions
- Where is the line with reconnect (TOKI-039): who owns the socket, the retry, the request for missed events, and who applies what they bring?
- Is a message that ended as "Not sent" kept through a reload, or only a waiting one?
- Does the cache of messages survive a reload, so that a person who opens the app without a connection can read it?
- What does the engine do when an event is out of date, repeated, or about a conversation it does not hold?
- When is a send "offline" and when is it a failed request, given that D-097 gives one automatic try?
