# Intent: client-core, API client and conversation store

Author: Thanh Truong

## Problem
The server answers the first load in one request (`GET /api/v1/bootstrap`) and has routes to open a direct message, to create, join, leave, edit, archive and restore a channel. No client code calls them. Every screen that needs the list of conversations would otherwise write its own request code, its own handling of errors and its own grouping, filtering and naming of the list, and the web and the later phone app would drift apart.
The technical design puts every decision about what to show, such as the sorted conversation list, in `client-core`, so that the two interfaces cannot drift apart. `client-core` is empty today, and it may touch no DOM or browser API.
The answers of the channel and direct-message requests are not the same shape as the entries of the first load (a channel answer carries no level, mute or star), so something must merge them into one list without losing the person's own settings.

## Proposed outcome
- An API client in `client-core`, typed from the shared schemas, with one way to send a request, one way to read an answer, one error type that holds the status and the stable `error.code`, and one rule for which kind of screen an error leads to (decision D-131).
- A conversation store in `client-core`: it holds the signed-in person, the workspace, the people, the conversations and the event number from the first load, applies the answers of later requests to the list, and gives screens the list already grouped into Starred, Channels and Direct messages, filtered by All, Unread or Mentions and by a name search, with the name of each conversation worked out.
- No screen, no text and no browser API: the store is plain TypeScript that a React hook or a phone screen can subscribe to.
- The shapes of later work (unread counts, the latest message, saving of level, mute and star) have a place to arrive without a change to what is built here.

## Affected users and systems
- Members and Admins: the sidebar list, Browse channels, the people picker and the conversation header read from this store (journeys "Open the app: the Home view", "The conversation list").
- `packages/client-core` (new code), `packages/shared` (read only: the schemas of the bootstrap, channel and direct-message requests and the error schema), and a small wiring file in `apps/web`.
- The tickets that build on it: the conversation list (TOKI-033), Browse channels and the people picker (TOKI-034), the conversation header and Details panel (TOKI-035), the sync engine (TOKI-040), the read pointer (TOKI-053) and the sign-in screens (TOKI-023), whose session state must hear every unauthenticated answer. Screens that call routes with no typed method go through the client's `request`, with an optional extra header and a longer timeout for one call (the Admin page, TOKI-025; the devices section, TOKI-099), and Sign out (TOKI-099) and the Join page (TOKI-097) reset the store.

## Constraints
- `client-core` touches no DOM or browser API, so React Native can reuse it. Source: Toki Blueprint, technical design, boundary rules; TOKI-002 rule 1 (an allow list of globals).
- Every decision about what to show (the sorted list, unread, grouping) lives in `client-core`. Source: Toki Blueprint, technical design, "What each client shares".
- The client uses the shared schemas and the error schema built in TOKI-004. Source: Toki Blueprint, ticket TOKI-032.
- Within `/api/v1`, fields are only added. Source: technical design, "Four things the server does now for React Native later".
- The list has three collapsible groups, Starred, Channels, Direct messages; channels are alphabetical; the filters are All, Unread, Mentions; the search filters by name. Source: flow F09 (the groups, the order, the filters and the search), D-143 (star and mute are personal, starred conversations sort to the top).
- Notification level defaults to "Mentions only" for channels and "All messages" for DMs; mute and star are personal. Source: D-046, D-103, D-143.
- An archived channel leaves everyone's list; a channel that is not joined cannot be read. Source: F26, D-029, D-116.
- Server status codes map to screens in one way for every feature: 400 field message, 403 and 404 one shared page, 409 and 410 a fresh copy, 429 wait, 5xx Retry with an error ID. Source: D-131.
- A request with no answer after 10 seconds counts as failed. Source: D-126.
- Application code takes the clock and timers as parameters. Source: TOKI-008 R19.
- Every text goes through i18n; `client-core` holds none. Source: NFR-05, D-018.
- All conversations are in the first load in phase 1; the store holds them all. Source: D-117.
- First load under 2 seconds and the initial JavaScript under 200 KB compressed. Source: NFR-13, D-113.
- Milestone: M2. Size: M. Needs: TOKI-031. Needed by: TOKI-033, TOKI-034, TOKI-035. Source: Toki Blueprint, ticket TOKI-032.

## Open questions
- Where does the Unread and Mentions filter get its data before the read pointer exists?
- In what order is the Starred group, which mixes channels and direct messages?
- Does the client reject a body that has a key the schema does not know, given that the API only adds fields?
- Does the conversation data live in the store or in the Query cache of the web app?
- Which ticket opens the app on the last viewed conversation and falls back to #general?
- Which ticket creates the web wiring (one client, one store) and connects the unauthenticated answer to the session state?
- How is a group direct message named, given that the first load carries a full name for each person and no short name?
