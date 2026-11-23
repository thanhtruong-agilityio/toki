# Intent: Presence
Author: Thanh Truong

## Problem
A person who opens a direct message, a member list or a profile wants to know whether the other person is at their screen, away, or not to be disturbed. Today no screen shows it: the avatar components can draw a presence dot, but nothing tells them which state to draw, and the server does not know who is using Toki.
Three things are missing. First, the server must work out each person's state from what it can see: which devices are connected, when each was last used, and whether the person is in Focus time. The log fixes the rule: Active while a device has Toki open and was used in the last 5 minutes, Away after 5 minutes without activity or with no device connected, Do not disturb during Focus time, and no separate Offline state. Second, the state must reach everyone who can see the person's dot, without one frame per change for every connected person when two hundred people arrive at nine o'clock. Third, the screens that show a dot (the direct message rows and header, the member lists, the account card, the mention list) need one agreed way to read it, so that the profile and People tickets that come later draw the same dot from the same data.
A person cannot set their presence by hand. To signal that they are busy they set a status or start Focus time.

## Proposed outcome
The browser tells the server, at a bounded pace, that the person is using Toki. The server keeps presence in memory (it is not stored in the database), counts the connections of each person, and decides Active, Away or Do not disturb with the clock, so that a person with two tabs, or a phone and a laptop, is Active while any of them was used in the last 5 minutes and Away when none is.
The server sends changes to every connected person in batches: one small frame that lists everyone whose state changed in the last moments, at most once every two seconds. Frames are live-only and are not replayed, so every time a client's connection comes online it reads the full current state from one light request and applies the batches that follow it in order.
The client keeps a store of who is in which state and a hook that gives a screen the dot and its accessible name for a person. This ticket draws the dot where the list, the header, the member lists, the account card and the mention list already have a place for it, and it gives the profile and People tickets the same hook. Focus time (a later ticket) tells the presence module when a person's Do not disturb starts and when it ends.

## Affected users and systems
- Members and Admins with Toki open: they see each other's dots, and their own dot on the account card.
- The server app (`apps/server`): a new `presence` module, one route, two small additions to the `realtime` module (connection opened and closed notices, the connection id given to a frame handler), the registration and one timer in `app.ts`.
- The shared package (`packages/shared`): the states, the limits, the activity frame, the live frame and the snapshot schema.
- The client core (`packages/client-core`): the presence store, the activity sender and one API method.
- The web app (`apps/web`): the browser activity source, the hooks, the wiring lines in `realtime.ts`, and the dots on the screens named in the spec.
- The i18n package: the `presence` texts, English and Vietnamese.
- Later tickets that use this one: Status (TOKI-056), the profile panel (TOKI-057), People (TOKI-079), Pause and Focus time (TOKI-076).

## Constraints
- Presence turns to Away after 5 minutes without activity. There is no separate Offline state. Source: D-036, FR-32, F34.
- Active means a device has Toki open and was used in the last 5 minutes; Away means no activity for 5 minutes or no device connected; Do not disturb means Focus time. Source: context, states table; F34.
- Presence cannot be set by hand; no screen offers a choice of presence. Source: F34, FR-45 (AC-129).
- Presence is kept in memory on the server, not in the database. Source: Toki Blueprint technical design, data rules.
- One server process, up to about 200 people online. Source: D-009, NFR-04.
- Presence updates are batched. Source: Toki Blueprint plan, TOKI-055.
- The dot appears on direct message rows, the direct message header, profiles, People, the mention list and member lists. Source: F34.
- The look of the dot (solid in the accent colour, hollow with a grey ring, red) is built in TOKI-013; there is no fourth state in phase 1 ('In a Meet' arrives in phase 4). Source: context states table; `docs/specs/2026-11-16-base-components-2-design.md` (R11).
- Timing rules are tested with the controllable clock, never with real timers. Source: TOKI-008 (R19).
- Every text goes through i18n; English is the default language. Source: D-018; `docs/specs/2026-11-16-i18n-package-design.md`.
- Phase 1 has no offline mode; the client shows the prototype's offline banner. Source: D-079, D-102, D-140.
- Server modules call each other only through public interfaces. Source: technical design, boundary rules; `.claude/rules/server.md`.
- Milestone M4, size M. Needs: TOKI-038, TOKI-039, TOKI-040. Needed by: TOKI-056, TOKI-057, TOKI-076, TOKI-079. Source: Toki Blueprint, ticket TOKI-055.

## Open questions
- Who hears whose presence: everyone in the workspace, or only people who share a conversation?
- Is a connection that merely reconnected, with nobody at the screen, Active?
- How many connections count, and what happens with several tabs and devices?
- How often does the browser report activity, and how often does the server send changes?
- What does a screen show while this device has no connection, since there is no Offline state?
- Does Do not disturb win when the person in Focus time has no connected device?
- What does the dot of a deactivated person show, and what do guests (a later phase) hear?
- Who draws the dot on each screen, and who writes the direct message header's second line?
