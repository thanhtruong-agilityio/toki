# Intent: Security review
Author: Thanh Truong

## Problem
Toki will be reachable from the public internet on its own domain (D-020), for about 200 people (D-009), and the specs of M1 to M5 each made their own security choices: a session cookie, a limit on code requests, a guard on the addresses the server fetches, a rule that files never run in the browser. Nobody has read those choices together against what is built, and four things were handed to this ticket by name because they cannot be settled while a single feature is designed:

- The headers. The production proxy sets the headers that cannot break a feature. The Content-Security-Policy and any other header need the real screens in front of them (the app opens a WebSocket, posts files to a second host and runs a service worker), so they were left here.
- The rate limits. Only the sign-in routes, the emergency-link route, link previews and the WebSocket have a limit. The three public Join routes and every route that needs a session have none, and the sign-in spec records a guessing budget for the 6-digit code that it left for this review.
- The cookies and cross-site requests. The sign-in spec chose a host-only cookie, JSON-only bodies and an `Origin` rule, and asked for a review of that choice and for a guarantee that no `GET` route changes anything.
- The dependencies. The server and the web app depend on third-party packages, the build runs install scripts and workflow actions, and nothing checks them for known advisories.

Without this work the first installation goes public with limits and headers that nobody has checked as a whole. Source: Toki Blueprint, TOKI-091; decisions D-020, D-009, D-095, D-136, D-137; technical design, "Abuse limits"; TOKI-084 concern 7; TOKI-022 concerns 3 and 9.

## Proposed outcome
A written review of headers, cookies, rate limits and dependencies, with its findings recorded in one file in the repository, and the changes the review calls for, built and tested:

- A Content-Security-Policy and two more headers on the app host, proved in a real browser against the production stack.
- A rate limit for every class of request: the public routes that have none, requests from a signed-in person, and failed sign-in checks; a limit on the size of a request body; the address of a client counted correctly behind the proxy and for IPv6.
- Tests that keep the cookie, the cross-site rules and "no `GET` changes anything" true for every route added later.
- A check of known advisories on every change to the dependencies and every week, exact versions only, and workflow actions pinned to a commit.
- What the review finds but this work does not fix is written down with its owner, not lost.

Authorization (who may do what, and the refusals for everyone else) is TOKI-088 and is not repeated here. Source: plan, TOKI-091; TOKI-084 concern 7.

## Affected users and systems
- The operator of an installation, who gets a stack with headers, limits and an advisory check that have been reviewed.
- Every person who signs in: a limit that is too low would refuse them, so the numbers are checked against normal use.
- `infra/Caddyfile` (headers), `apps/server` (limits, body size, response headers), `packages/shared` (limit constants), `.github/workflows` (advisory check, pinned actions), the dependency files, and `docs/security/`.
- TOKI-084 (the proxy and the stack check this work extends), TOKI-088 (the route registry this work reuses), TOKI-089 (its load run must not meet a limit).

## Constraints
- Milestone M6, size M. Needs TOKI-084. Source: Toki Blueprint, ticket TOKI-091.
- The scope is headers, cookies, rate limits and dependencies. Source: plan, TOKI-091.
- Public internet, one VPS of 2 vCPU and 4 GB, one company of about 200 people; no new service. Source: D-020, D-009, NFR-04, NFR-07; TOKI-084 R23.
- Files are always downloaded and never run in the browser; every type is accepted up to 100 MB; no virus scan in phase 1; storage has no quota. Source: D-095, D-014, D-186, NFR-15.
- Link previews refuse internal addresses; message content is never rendered as raw HTML; code requests are rate limited and a code is cancelled after 5 wrong tries; the sign-in page never reveals which emails are members. Source: technical design, "Abuse limits"; D-038, D-137, BR-04.
- The limits already decided stay as they are: 5 code requests per address in 15 minutes, 60 seconds between codes, 5 wrong tries, 20 requests in 15 minutes per network address on the sign-in routes. Source: D-038, D-082, D-137; TOKI-022 R4, R5, R12, R56.
- The content of the Content-Security-Policy, the rate limits, the cookies and the dependency review belong here; the headers of TOKI-084 R20 stay with that ticket, and this work edits the Caddyfile and the app through its own change. Source: TOKI-084 concern 7.
- Authorization is tested by TOKI-088. Source: plan, TOKI-088.
- Dependencies are exact versions, at least two weeks old when added. Source: TOKI-064 R1, TOKI-038.
- Every text a person reads goes through i18n; English is the default. Source: NFR-05.
- No backup in phase 1. Source: D-092.

## Open questions
- What is the Content-Security-Policy, given what the web app does? Source: TOKI-084 concern 7.
- Which routes need a rate limit, and at what numbers, given that only the numbers of the sign-in routes are decided? Source: TOKI-084 concern 7; TOKI-022 concern 3.
- Does the guessing budget of the 6-digit code (about 0.24% a day for one address, about 38% a day for all 200 addresses of a workspace) need a further limit? Source: TOKI-022 concern 3.
- Is the cookie and cross-site choice of TOKI-022 enough, and how is "no `GET` changes anything" kept true for later routes? Source: TOKI-022 concern 9.
- Where are findings recorded, and what is the line with the access-control tests? Source: plan, TOKI-088 and TOKI-091.
