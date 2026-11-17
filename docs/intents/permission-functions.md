# Intent: Shared permission functions
Author: Thanh Truong

## Problem
Toki has two roles in phase 1, Member and Admin, and a capability table that says who may do what (reviewed row by row in D-090). Today that table exists only as a document. The server must refuse what a role may not do, and the web app must hide the controls the person may not use. If each side writes its own checks, the two drift: a button shows that the server then refuses, or the server accepts what the screen hides. Without one agreed set of rules, every later feature ticket would invent its own role checks.
Source: Toki Blueprint, capability table (D-090, D-012), BR-09, ticket TOKI-027.

## Proposed outcome
- One set of pure rule functions in the `shared` package answers each phase 1 row of the capability table: given a role and a few facts, it says yes or no and gives a reason code when it says no.
- The server uses these functions to refuse a request; the web app uses the same functions to hide a control. The client check is never the only check.
- Later feature tickets call these functions instead of writing role checks of their own, and add a function for each new row they build.
Source: Toki Blueprint, Stack (permission rules live in `shared`), ticket TOKI-027.

## Affected users and systems
- Users: the builder (one person building with Claude), who writes every later feature on top of these rules. Members and Admins are affected indirectly: what they see and what the server allows follow the rules.
- Systems: the `shared` package, the server app, `client-core` and the web app.

## Constraints
- Belongs to the Sign-in and members area of milestone M2 (intent I04, member-management). Size: M.
- Needs: TOKI-019 (account tables, which hold each account's role). The package `shared` comes from TOKI-001.
- Needed by: TOKI-024 (member management API) and TOKI-029 (channel API).
- Two roles only, Member and Admin; there is no Owner (D-152). Guest is a phase 5 role (D-090 shows the Guest column; technical design: a guest role is added to the shared permission rules in phase 5).
- Only an Admin creates channels (D-084). An Admin removes people from a channel, deletes other people's messages and archives or restores a channel only in a channel they belong to, and never removes people from #general (D-047, D-085, D-034).
- An Admin invites with any role, changes roles and deactivates anyone but the last Admin and themselves; the last Admin cannot be demoted or deactivated, and nobody deactivates themselves (D-153).
- The functions are pure: they read no database, clock or network (technical design: pure functions in `shared`).
- Permission is checked on the server for every request (BR-09); private conversations and DMs are visible to members only.
- `shared` may not use browser or Node globals outside the allow list of TOKI-002, and adds no runtime dependency.
- Tests are written first (Vitest).

## Open questions
- Who restores an archived channel in which no Admin is a member, for example a private channel with no members left (D-184 is open)? The capability table says an Admin restores "where a member".
- Does Guest have any phase 1 behaviour? The source puts Guest in phase 5 and the capability table has a Guest column.
