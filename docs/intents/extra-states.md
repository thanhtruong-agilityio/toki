# Intent: Extra states
Author: Thanh Truong

## Problem
The prototype draws Toki only while everything works. Four situations that every real session meets are missing or are held together by plain stand-ins in the tickets built before this one: the first seconds while data loads, a connection that is gone, a page that does not exist or that the person may not open, and a request that never answers.
Today a person who opens the app sees an empty list and an empty main area until the data arrives, and sees the same empty screen for ever when the first load fails. A tab that loses the network shows nothing at all, and the code that blocks writes while disconnected reads only the browser's own flag, which does not see a network that is up but cut off from the server. A link to a conversation the person may not open, and an address that does not exist, show the plain words "Page not found" (TOKI-006). Every screen that reads from the server words its own failure and its own Retry, so the same failure looks different on each screen.

## Proposed outcome
The app shows a skeleton of the layout at once and replaces it with data when it arrives. When the connection is down, a strip "Offline: showing saved messages" stays at the top of the main area and of the conversation list for the whole time, with no "reconnecting" state and no toast when the connection returns. Loaded content stays readable. A message the person sends waits and goes out by itself; every other write is blocked with an explanation and never shows a false success. One shared page serves a page that does not exist and a page the person may not open, and tells the two apart to nobody. A request that has had no answer after 10 seconds counts as failed and shows Retry; a server error also shows a short error ID. A first load that fails shows the offline strip when the network is the cause, tries again by itself, and offers Retry.

## Affected users and systems
- Every Member and Admin on every screen that loads data, and on narrow screens, where the conversation list is the whole screen.
- The web app (`apps/web`): the layout route, the conversation list pane, the root and conversation routes, the Admin no-access view, and the loading and failure stand-ins that earlier tickets left (listed in the spec).
- The component package (`packages/ui-web`): the `Strip`, a `Skeleton`, and one new prop of the conversation list that lets it draw a skeleton or a failure in place of its groups.
- The texts (`packages/i18n`): a namespace for these states, in English and Vietnamese.
- Neighbours: the sync engine (TOKI-040) and the connection (TOKI-039) whose state is read, the Undo, confirmation and online-gate patterns (TOKI-093) whose check is set here, the Pause and Focus strip (TOKI-076) and the update-available strip (TOKI-104), which use the same strip class.

## Constraints
- While offline the banner "Offline: showing saved messages" shows the whole time; there is no separate reconnecting state; when the connection returns the banner goes away and no toast is shown. Source: D-102, D-140, F37.
- A drop of under 3 seconds shows no strip. Source: F37, D-091.
- Loaded content stays readable while the connection is down; messages being sent wait and send themselves; every other action is blocked with an explanation, never a false success. Source: D-079, D-060, F37.
- Server 403 and 404 show one shared page; a 5xx shows Retry with a short error ID. Source: D-131.
- A request with no answer after 10 seconds counts as failed and shows Retry. Source: D-126.
- A skeleton of the layout appears at once when the app opens. Source: F08.
- With no connection at open, the offline banner shows and the app retries on its own. Source: F08.
- Every screen and wording in quotes that the prototype does not contain is a proposal. Source: D-139.
- The page for a conversation the person may not open does not reveal the channel's name. Source: journey F10 line on a link to a private channel.
- Every text goes through i18n; English by default. Source: D-018, NFR-05.
- Timing is tested with the controllable clock. Source: TOKI-008 R19.
- Needs TOKI-040, TOKI-093 and TOKI-039; milestone M6, size M. Source: plan, ticket list.

## Open questions
- Which ticket builds the class `.strip`: this one (the plan and TOKI-012) or the Pause and Focus ticket TOKI-076, which proposes to build it?
- What does the shared page for "not found" and "no access" say, given that the journeys word the two cases apart?
- Which text does a blocked write show: "A connection is needed" (F37) or the text TOKI-093 already ships?
- Does the product banner keep the prototype's "Go online" button, which flips the prototype's simulator?
- What does a tab show whose socket the server closed because the person has too many tabs open?
- How often does the app retry a first load that failed?
- Where is the banner drawn when the list and the main area are both on screen?
