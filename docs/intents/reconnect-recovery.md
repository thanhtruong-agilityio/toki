# Intent: Reconnect
Author: Thanh Truong

## Problem
A person leaves Toki open for hours. The network drops, a laptop sleeps, the server is restarted for a deployment. When the connection comes back the screen must be right again without the person doing anything: every message and change that happened in the meantime must be there, once, and nothing that happened while away may be lost or shown twice.
The gateway (TOKI-038) pushes events to a connected client, but it does not replay what a client missed while it was not connected, and it does not say how a client should behave after each kind of close. The client has no socket yet: nothing opens the connection, nothing waits before trying again, nothing remembers the last event number the client has, nothing asks the server for the events after that number, and nothing decides what to do when the client has been away so long that the server no longer keeps those events (the log keeps 7 days).
Without this, a dropped connection leaves the screen stale until the person reloads, a person whose session has ended keeps retrying forever, and a client that comes back after a long absence either shows a hole or shows nothing.

## Proposed outcome
The web app opens one connection to `/ws` once the person is signed in and the first load is done. When the connection is lost it tries again after 1, 2, 5, 10 and then 30 seconds, with a little randomness so that every client does not return at once, and it goes back to 1 second once a connection has held. When the connection is up the client compares the event number the server starts from with the last number it has applied, asks the server for the events in between through a new request, hands them in order to the code that applies them to the cache, and then continues with the live events, without applying any event twice.
The server answers that request with the events that concern the person, by the same audience rule as the live push, in pages. When the client's number is older than the oldest event the server still keeps, the server says so and the client reloads everything it shows instead of fetching.
Each close code of the gateway has one defined behaviour on the client: reconnect, or stop and say why (the session ended, this browser signed out, too many open tabs). The client exposes its connection state so that the offline banner and the waiting messages can follow it, and it shows nothing itself.

## Affected users and systems
- Members and Admins with Toki open, on a flaky network, after a sleep, or during a deployment.
- The client core (`packages/client-core`): the connection, the retry rule, the catch-up and its hand-off, one new request method.
- The web app (`apps/web`): the one place that creates the connection, the address of the socket, the start and stop with the session, the browser's `online` signal.
- The server (`apps/server`): one new route that returns the events a client missed, in the `realtime` module.
- The shared package (`packages/shared`): the schema of the answer, the delays and limits of the client, one error code.
- Neighbouring work: the gateway and its close codes (TOKI-038), the event log and its reads (TOKI-036), the message API (TOKI-037), the sync engine that applies events and resends waiting messages (TOKI-040), the typing indicator that sends and receives live frames (TOKI-044), the offline banner and the blocking of writes (TOKI-082).

## Constraints
- Reconnect attempts wait 1, 2, 5, 10 and then 30 seconds, with a little randomness. Source: D-129.
- Loaded content stays readable while the connection is down; messages being sent wait and send themselves when it returns; the banner reads 'Offline: showing saved messages' the whole time, with no separate reconnecting text and no toast when the connection returns. Source: D-079, D-060, D-102, D-140.
- A drop of under 3 seconds shows no strip; after a long absence the app reloads everything instead of fetching what was missed. Source: journey F37, accepted as the baseline by D-091.
- Reconnect works from the last event number the client has; the server returns what was missed; the log keeps 7 days. Source: technical design (Reconnect), `docs/specs/2026-11-20-messages-events-tables-design.md` (R20 to R22, R26).
- A person gets only the events of the conversations they belong to, the events addressed to them and the events of the workspace; an Admin does not get those of a private channel or a DM they are not in. Source: D-116, BR-09.
- A message is delivered exactly once when the connection flaps. Source: FR-27 AC-072 (TS-113, TS-114).
- A close that means the session has ended is handled as a 401 of a request; a client that was told to stop does not retry. Source: sign-in screens spec (R39); `docs/specs/2026-11-20-websocket-gateway-design.md` (R21).
- `client-core` uses no DOM or browser API beyond the allow list, and holds no text a person reads. Source: boundary rule 1 (TOKI-002), client-core spec (R24).
- Timing is tested with the controllable clock and timers, never with real timers. Source: test harness spec (R19).
- Server modules call each other only through public interfaces. Source: technical design, boundary rules.
- Milestone M3 "Real-time chat". Size: M. Needs: TOKI-038. Source: Toki Blueprint, ticket TOKI-039.

## Open questions
- What does the client do after each close code of the gateway, in particular 4401 and 4430?
- Who asks the server for the missed events, with what request, and what does the server return for a number that is no longer kept?
- Who applies the events to the cache: this ticket or the sync engine?
- What does the person see while the connection is down and when it returns, and is a short drop shown?
- What does the person see in a tab that the server closed because the person has too many tabs open?
