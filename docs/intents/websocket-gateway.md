# Intent: WebSocket gateway
Author: Thanh Truong

## Problem
When one person sends a message, changes a topic, adds someone to a channel or archives a channel, every other person who has Toki open must see it without reloading. Today the server can only answer requests. Nothing pushes what happened to the people it concerns, and nothing decides who may hear about which conversation.
Three things are missing. First, a connection that the server can trust: it must belong to a signed-in person, and it must end when that person's session ends (signing out, being signed out from another device, deactivation). Second, a rule for who hears what: a private channel, a direct message or a channel the person has not joined must never reach a connection that is not a member, and a person who is added or removed must start or stop hearing at the right event. Third, a way to push in the right order, once, and without letting one slow browser hurt the others.
The event log (the numbered record of changes) is built by the messages and events tables ticket, and the channel and direct-message requests already call a seam, `recordChange`, that does nothing yet. Without this ticket the log has no reader and the seam has no effect.

## Proposed outcome
One WebSocket address, `/ws`, lets a signed-in browser (cookie) or app (header token) open a connection. The server checks the session the way every request is checked, tells the client where in the event stream the connection starts, and then pushes every event that concerns the person: the events of the conversations the person belongs to, the events addressed to the person alone, and the few live-only notices that are not numbered.
The server keeps in memory which conversations each connected person listens to. It reads the new rows of the event log after each commit and sends each one, in number order, to the people it concerns, applying membership changes in the same order, so that a person who is added hears everything from the adding event on and a person who is removed hears the removal and nothing after it.
A connection whose session ends is closed with a code that tells the client why. A connection that stops answering is closed. A connection that cannot keep up is closed, and the client catches up from its last event number. The channel and direct-message changes write their events through `recordChange`, so they reach the open screens of the members: the new channel, a person who joined or left, a changed topic, an archived or restored channel, a change of a person's own star, mute or level on another device.
The shapes of every frame are written once in `packages/shared`, so the server and the client use the same definitions.

## Affected users and systems
- Members and Admins with Toki open: they see changes of conversations they belong to without reloading, and are signed out of an open screen when the session ends.
- The server app (`apps/server`): the gateway inside the `realtime` module, the event writes of `recordChange` in the `conversations` module, one export added to the `auth` module, one read added to the `conversations` module, and the registration in `app.ts`.
- The shared package (`packages/shared`): the frames, the event kinds of the conversation changes, the limits and the close codes.
- The web dev server proxy (`apps/web/vite.config.ts`): a `/ws` entry.
- The sign-in work (TOKI-022, TOKI-026), whose session check guards the connection and whose `onSessionsEnded` ends it.
- The members work (TOKI-024), whose `onMemberChanged` is carried as a live notice.
- The messages and events tables (TOKI-036), whose log the gateway reads; the message API (TOKI-037), which writes message events through the same log.
- Later tickets: reconnect (TOKI-039), the sync engine (TOKI-040), the typing indicator (TOKI-044), presence (TOKI-055) and the production proxy (TOKI-084).

## Constraints
- A person cannot see the content of a channel they have not joined, a private channel or a DM they are not in; Admins do not automatically see private channels or DMs. Source: D-116, BR-09, `docs/specs/2026-11-17-permission-functions-design.md` (R5).
- One server process, up to about 200 people online. Source: D-009, D-113.
- A message sent reaches another person in under 150 ms (p95), measured by TOKI-089. Source: NFR-13, D-113.
- The path is `/ws`; the proxy routes `/api` and `/ws`; `/healthz` is the only other path outside `/api/v1`. Source: Toki Blueprint technical design (architecture figure); web-skeleton spec concern 2; server-skeleton spec R10.
- The connection belongs to a valid session and ends with it; the other tabs of a browser share the session. Source: sign-in API spec (R44, R50), D-093, D-158.
- Reconnect works from the last event number; the event log has no gap a transaction in flight can fill. Source: technical design, API and realtime; bootstrap spec R11.
- A DM appears in the other person's list only after the first message; an archived channel is announced to its members while they have it open. Source: F25, F26, D-091.
- Reconnect attempts wait 1, 2, 5, 10 and then 30 seconds. Source: D-129 (the client side, TOKI-039).
- Phase 1 has no offline mode; the client shows the prototype's offline banner. Source: D-079, D-060.
- Server modules call each other only through public interfaces, never each other's tables. Source: technical design, boundary rules.
- Milestone M3 "Real-time chat". Size: L. Needs: TOKI-036. Needed by: TOKI-039, TOKI-040, TOKI-044, TOKI-055. Source: Toki Blueprint, ticket TOKI-038.

## Open questions
- Where does a client learn why a connection was refused or closed, since a browser does not show the status of a refused upgrade?
- Who writes the events of a channel change, and when are they pushed: inside the change, or after it?
- How does the gateway know which conversations a person listens to, and how does that stay right when a person is added, removed or a DM is first revealed?
- What happens to an open connection when its session ends, when a person is deactivated, or when a role changes?
- What does the gateway do about a dead connection and about a client that reads too slowly?
- What is the line with reconnect (TOKI-039), the sync engine (TOKI-040) and the typing indicator (TOKI-044)?
