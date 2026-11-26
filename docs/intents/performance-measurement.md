# Intent: Performance measurement
Author: Thanh Truong

## Problem
The first version of Toki promises six speed figures: a message reaches another person in under 150 ms (p95), the first load on 4G takes under 2 seconds, the initial JavaScript is under 200 KB compressed, switching to a channel opened before takes under 100 ms, a channel of 10,000 messages scrolls at 60 frames per second, and a search across 1 million messages takes under 200 ms (p95). The product owner accepted them with 200 people online as the load (D-113).
Today nothing measures them. The tests of the earlier tickets read query plans and count statements on purpose, because a test may not wait for a real timer, so no test shows what a person on a busy server would feel. Several merged specs (the message tables, the gateway, the search index and the search request, the client engine and the message list) say that the figure is measured by this ticket and leave a risk open until it is. One of them already shows that a very common short search prefix is slower than 200 ms on 1 million messages.
Without this work, the milestone's last check ("the 6 performance targets pass with 200 people online") cannot be answered, and the first installation on a real machine is the first time anyone learns the numbers.

## Proposed outcome
A script that fills a fresh production stack with the load of the technical design (200 people, 50 channels, 1 million messages), keeps 200 people connected, measures the six figures through the same entry the people use (Caddy), and writes one result file that says, for each figure, what was measured, how, with how many samples, and whether it is under the target. Running it is a person's decision on a machine of the size of the first VPS; it is not a check of the pull-request pipeline.
The 200 KB figure reuses the measurement of the web skeleton and the CI ticket, on the files the production image serves.

## Affected users and systems
- The builder and the lead, who need the six figures before the first release and a way to repeat the run after a change.
- The product owner, who decides what the targets mean where the log gives only a number (what "4G" is, which searches count).
- The production stack of TOKI-084 (it runs against it), the message tables and requests, the WebSocket gateway, the search index and request, presence, the job queue, the conversation list and the message list (they are measured, not changed).
- The installation guide (TOKI-087) and the milestone acceptance, which read the result.

## Constraints
- The six targets and their numbers are those of D-113 and NFR-13: p95 under 150 ms for a message reaching another person, first load on 4G under 2 seconds, initial JavaScript under 200 KB compressed, switching to an opened channel under 100 ms, 60 frames per second scrolling 10,000 messages, search across 1 million messages p95 under 200 ms. Source: D-113, NFR-13.
- The load is 200 people online. Source: D-113, D-009, NFR-04.
- The load script creates 200 people, 50 channels and 1 million messages. Source: technical design, Testing.
- The 200 KB figure is the one of the web skeleton and the CI ticket: gzip, the first-load set of `index.html`, 200,000 bytes. Source: TOKI-006 R10, TOKI-007 R7.
- It runs against the production stack of TOKI-084, through Caddy, on a machine of the first VPS: 2 vCPU, 4 GB RAM, 80 GB. Source: TOKI-084 (Scope, Hand-offs), technical design, Deployment, NFR-04, NFR-07.
- The messages are created in bulk outside the app, and the indexes the real database has are documented. Source: TOKI-089 plan line; TOKI-069 R4, R11 and TOKI-036 R11.
- The results are recorded in a file, not as a pass or fail of the shared pipeline. Source: the plan line of this ticket; the shared pipeline is a pull-request check (TOKI-007).
- The measurement uses real time, and no other test of the repository does. Source: TOKI-008 R19 (no real timers in tests).
- No real person's data and no secret: every account, message and secret is made for the run. Source: TOKI-084 R27 (secrets stay in `.env` and in no image or file of the repository).
- Milestone M6, size L. Needs TOKI-084. Source: plan, ticket TOKI-089.

## Open questions
- What exactly is "first load on 4G": which network speed, a cold or a warm cache, signed in or not, and which moment ends the load?
- Which searches make up the 200 ms p95: ordinary words only, or also a very common one- or two-letter start of a word?
- Is "60 frames per second" an average, or a share of frames, and is "under 100 ms" a median, a p95 or every switch?
- On which machine is the reference run made, and where does the script run in relation to the stack?
- When a figure is over its target, what happens to the milestone?
- Is the 200 KB figure measured on the source tree or on what the image serves?
