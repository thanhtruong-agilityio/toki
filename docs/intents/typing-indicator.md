# Intent: Typing indicator
Author: Thanh Truong

## Problem
When a person writes a message, the others who have the conversation open cannot tell that an answer is coming. They may start writing at the same time, or stop looking. The prototype shows a line under the message list, "Lan is typing…", while someone writes, and it goes away by itself. Nothing in the product sends or shows that signal yet.
The signal is not a message and is not kept. It must reach only the people who are members of that conversation, it must never be shown to the person who is typing, and it must clear by itself when the person stops, even if the typing person closes the tab or loses the connection without saying so. A person who types for a minute must not flood the server or the other screens with one signal per key.

## Proposed outcome
While a person types in the composer of a conversation, the browser sends a short "typing" signal over the WebSocket, at most once every few seconds. The server passes it, without keeping it, to the other people who are members of that conversation and have a connection open. Their screens show the line "<name> is typing…" with the three blinking dots of the prototype under the message list of that conversation. The line goes away five seconds after the last signal or when the typing person's message arrives. The person who types never sees their own signal, in any tab.
The line is the same in a channel and in a direct message, as in the prototype. The frames are written once in `packages/shared`.

## Affected users and systems
- Members and Admins with a conversation open: they see who is typing; they are the typing person too.
- The server app (`apps/server`): the client frame `typing` and its relay inside the `realtime` module, through the extension points of the gateway.
- The shared package (`packages/shared`): the schemas of the client frame and of the live frame, and the three numbers.
- The client-core package (`packages/client-core`): the store of who is typing now, and the sender that limits the signal.
- The component package (`packages/ui-web`) and the i18n package: the typing line and its texts.
- Neighbouring work: the WebSocket gateway (TOKI-038), reconnect (TOKI-039), the sync engine (TOKI-040), the message list (TOKI-041) and the composer (TOKI-043).

## Constraints
- The signal travels over the WebSocket; REST is used for every read and write. Source: Toki Blueprint technical design (API and realtime).
- The signal is heard by the members of the conversation only; a private channel, a DM and a channel the person has not joined never reach a connection that is not a member. Source: D-116, BR-09; WebSocket gateway spec (R15, R25, R27).
- One server process, about 200 people online. Source: D-009, D-113.
- The line reads "<name> is typing…" under the message list and clears after 5 seconds without typing. Source: Blueprint flow F11 (Send a message), which gives the 5 seconds; the prototype (`msgsHtml`, class `typing`) gives the wording and the look.
- The signal is not kept: no table, no event number. Source: technical design ("WebSocket only for the server to push events, plus the typing signal"); presence is held in memory.
- Every text goes through i18n; English is the default language. Source: i18n package spec (R1), D-018.
- Timing is tested with the injected clock, not with real timers. Source: test harness spec (R19).
- Milestone M3 "Real-time chat". Size: S. Needs: TOKI-038. Source: Toki Blueprint, ticket TOKI-044.

## Open questions
- Who sees the signal, and how often is it sent?
- What does the line say when two or more people type at the same time, and which name does it show?
- Does a thread reply box send the signal?
- Who clears the line when the typing person's message arrives, and who connects the socket to the store?
