# Intent: 12 end-to-end flows
Author: Thanh Truong

## Problem
Every screen ticket proves its own screen, mostly against answers stubbed in the browser, and every server ticket proves its own routes. Nothing proves that the pieces work together the way a person uses them: sign in with a mailed code, create a channel as an Admin, send a message that another person sees, sign out. Before the first release the team needs one set of browser tests that runs the real web app, the real server, a real database, real mail and real file storage, as the people of the prototype's sample workspace, at the width of a desktop and at the width of a phone. A test that passes on any page (a smoke test) is not enough: each flow has to fail when the feature it covers is broken. Source: Toki Blueprint, TOKI-090, intent I15 (production-launch); requirements, "All 12 end-to-end flows pass at desktop and phone widths".

## Proposed outcome
A command `pnpm test:e2e:flows` that runs 12 flows in Chromium, each at a desktop width and at a phone width. The 12 flows are chosen from the phase-1 journeys that the product owner accepted on 13 November 2026, and include: an Admin creates the channel, there is no Owner role, a channel that was not joined shows no messages, and Sign out. Every flow starts from the same freshly seeded Hugepig Studio workspace, signs in through the real sign-in route, and proves its result in two ways: on the screen, and on the server's answers to the people it concerns. Waiting for a delay (60 seconds, 5 seconds) is done by moving the clocks, never by sleeping. A pull request that breaks a flow fails the CI job of the flows. Source: plan, TOKI-090; D-091, D-084, D-152, D-116, D-158, D-053.

## Affected users and systems
- The builder and the reviewer of every pull request, who get one answer to "does it work end to end".
- The product owner, who reads the list of 12 flows to see which journeys are proved.
- The Playwright setup of TOKI-008 and its sign-in setup (TOKI-023), the seed of TOKI-081, the server's start file (`apps/server/src/main.ts`), the job queue's worker (TOKI-064, `worker.ts`), and the CI workflow (TOKI-007).
- Every feature ticket of M1 to M5 that a flow passes through.

## Constraints
- The flows follow the journeys accepted on 13 Nov 2026 (reviewed: 8 rewritten, 16 corrected, 19 unchanged). The 12 are chosen from them by this ticket. Source: plan, TOKI-090; D-091.
- Four things must be among the flows: an Admin creates the channel, there is no Owner, a channel not joined shows no messages, Sign out. Source: plan, TOKI-090; D-084, D-151, D-152, D-116, D-158.
- Each flow is complete at a desktop width and at a phone width; the phone run uses the phone layout (bottom tabs, one pane at a time). Source: plan, TOKI-090; D-053, D-068.
- It uses the Playwright runner of TOKI-008: Chromium only for now, and a seeded flow runs on its own test database that is created, seeded and dropped by the run, never on the development database. Source: TOKI-008 R10, R22, concern 5.
- It starts from the prototype's sample workspace through `seedPrototypeWorkspace` of TOKI-081 (8 people, Member and Admin only), and writes no sample address outside test code. Source: TOKI-081 R17, R21, Hand-offs.
- A check must prove the flow: it fails when the feature is broken, and it does not pass for any page. Source: plan, TOKI-090; the brief of this ticket.
- Timing is never tested with a real timer: a delay is passed with a controllable clock. Source: TOKI-008 R8, R9, R19.
- Texts come from the i18n catalogs; English is the default language; there is no Owner. Source: TOKI-017; D-152.
- Sample and test data only: no real address, and no mail reaches a real mailbox. Source: TOKI-081 R5; TOKI-020 "Data safety".
- It needs TOKI-081 and TOKI-008, and every feature a flow passes through. Milestone M6, size L. Source: plan.
- Belongs to Blueprint intent I15 production-launch. Source: plan.

## Open questions
1. Which 12 journeys are the 12 flows, and which feature tickets does each one touch?
2. What do "desktop width" and "phone width" mean in numbers, and in which browsers?
3. How does a flow start from a known state, and how does a person get signed in without breaking the limits on code requests?
4. How does a flow pass a delay (60 seconds to ask again, 5 seconds to undo) without waiting for it?
5. What makes each flow a proof and not a smoke test?
6. Where do the flows run in CI, and what services do they need?
