# Intent: Account tables
Author: Thanh Truong
## Problem
Toki has the `workspaces` table and nothing else. The server cannot store who a person is, which role they have, whether the account is active, which sign-in codes were issued, which sessions are open, or which devices a person registered. Sign-in, the first Admin, member management, sessions and the shared permission rules all need these records, and every table of the conversation area points to the account table.
## Proposed outcome
The database holds the account tables `users`, `login_codes`, `sessions` and `devices`, created by one migration on top of `workspaces`. Each table carries only the columns that a decided behaviour needs, and states its rules in the table itself so that any writer, not only the server code, keeps them. The tickets that sign people in, create the first Admin, invite and deactivate members, list sessions and register devices can start from these tables. Columns of the profile and of the preferences (job title, time zone, status text, look, accent, density) are not part of this work; the ticket that builds each feature adds them.
## Affected users and systems
- The builder (Thanh working with Claude), who builds the tickets that read and write these tables.
- The server app (`apps/server`): the `members`, `auth` and `notifications` modules.
- Every person with an account, Member or Admin, indirectly.
- The database and its migrations (TOKI-005).
## Constraints
- Scope is four tables: users, login_codes, sessions, devices. Source: Toki Blueprint, ticket TOKI-019.
- Every table carries `workspace_id`. IDs are UUIDv7, with the generator chosen in TOKI-005. Source: Toki Blueprint, data model notes; TOKI-005.
- Roles are Member and Admin; there is no Owner role (D-152, D-090). The last Admin cannot be demoted or deactivated, and nobody deactivates themselves (D-153).
- Deactivation keeps the account; inviting a deactivated person again reactivates the same account with its history and channels (D-094). There is no permanent deletion of accounts in phase 1 (F41).
- A display name is 1 to 80 characters and starts as the part of the email before the @ (D-033, D-150).
- English is the default language of an account (D-018).
- A sign-in code lasts 10 minutes, works once, is locked after the 5th wrong try and is cancelled by a newer code; the code and the session secret are stored hashed (D-136, D-137, D-082, D-011, technical design).
- A session lasts 30 days and renews on every use (D-011, D-138); a session ended by sign-out is refused on its next request (D-158).
- The signed-in devices list shows device kind, browser and last use (F06, D-158).
- Server modules never read each other's tables; a table definition lives in its own module (TOKI-002, TOKI-005).
- Milestone M2. Size: M. Needs: TOKI-005. Needed by: TOKI-020, TOKI-022, TOKI-027 and TOKI-028. Source: Toki Blueprint, ticket list.
## Open questions
- The Blueprint lists no open question for the spec on this ticket.
- Does this ticket also create the table of invitations (who invited whom, role, 7-day expiry, revoked), or does the ticket that manages invitations?
- Which columns does each table need, given that the Blueprint only names the groups of content?
