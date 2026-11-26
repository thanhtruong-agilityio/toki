# Intent: Access-control test suite
Author: Thanh Truong

## Problem
Toki's server decides who may see and change what in many places: the session check, the role checks, the membership checks of every conversation, and the rule that a person who has no access gets the same answer as for something that does not exist.
Each feature ticket tests its own routes, and those tests are good, but they are written one route at a time by the people who wrote the route. Nobody tests the whole surface from the side of the person who must be refused: signed out, a Member on an Admin request, an Admin outside a private channel, a person who has not joined a public channel, a person who found a file address or a search word.
The worst failure here is quiet. A new route added next month, without a refusal test, still works for everyone it should work for, and nothing goes red while it also works for people it should not.
The product owner has decided the rules (D-047, D-084, D-090, D-116, D-131). They need one suite that proves them for every endpoint, and that fails when an endpoint appears that it does not know.

## Proposed outcome
One test suite in the server app runs against the real application and the real PostgreSQL test database. It is built from a registry of endpoints, and the registry is checked against the routes the application really registers, so a route with no entry, or an entry for a route that is gone, turns the build red.
For every endpoint the suite makes the request as each person who must be refused and as one person who must succeed, and checks the answer, the body, and that nothing changed.
It covers: signed out; a Member on Admin requests and on creating a channel; anyone, an Admin included, outside a private channel or a direct message; the messages of a channel that was not joined; and the same people reaching the same data through search, file lists, file addresses, jumps to a message and the live stream.
A refused request about something the person may not know exists is answered exactly as a request for something that does not exist.

## Affected users and systems
- Everyone who uses Toki: the suite protects their private channels, direct messages and files.
- The builder and reviewers: a pull request that adds an endpoint must add its registry entry, and the check says so.
- The server app (`apps/server`): tests only; the suite adds files under `apps/server/tests/access/` and changes no route.
- Every module that exposes data: messages, threads, reactions, pins, channels and members, files and thumbnails, link previews, search, shared items, Activity, Later, quiet time, notification preferences, push registration, drafts, status, presence, the live stream and the member and invitation routes.
- The test setup of TOKI-008 (real PostgreSQL, the controllable clock) and the test helpers of the sign-in and channel tests.

## Constraints
- Signed-out requests are refused on every route that is not marked public. Source: TOKI-022 R24, D-125.
- A Member is refused on Admin requests and on creating a channel; only an Admin creates channels. Source: D-090, D-084.
- An Admin has no extra reach into private channels or direct messages: deleting messages, removing people and archiving apply only where the Admin is a member. Source: D-047.
- A person cannot see the content of a channel they have not joined; there is no preview. Source: D-116.
- No access is answered like not found: a private channel, a direct message or a file the person may not see gets the same answer as an id that does not exist. Source: BR-10, D-131, D-051.
- The same holds through search, file lists, direct links and the live stream. Source: AC-083, AC-029, TS-129, TS-045.
- A new endpoint without an access test fails a check. Source: the plan line of TOKI-088.
- The suite uses the real-PostgreSQL setup and the controllable clock of TOKI-008; no real timers. Source: TOKI-008 R2, R19.
- Server modules reach each other's data through public interfaces only. Source: technical design, boundary rules.
- Milestone M6, size M. Needs TOKI-070 and the data routes listed in the spec. Source: Toki Blueprint, ticket TOKI-088.

## Open questions
- How does a new endpoint without an access test fail a check?
- A person who has not joined a public channel: is the answer 403 or 404?
- Does a group direct message that has no message yet count as hidden from the other members?
- What does a Later row show for a message the person can no longer read?
- Do the tests call the routes over HTTP or call the permission functions?
- Does the suite cover Guests?
- What happens to routes of tickets that are not built when this ticket starts?
