# Shared permission functions design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/permission-functions.md (Thanh Truong)
Ticket: TOKI-027

## Goal
The builder needs one set of rules that says what a Member and an Admin may do, so the server can refuse what a role may not do and the web app can hide the same controls, with no second copy that drifts. This ticket puts those rules into `packages/shared` as pure functions: a role plus a few facts go in, a yes or no plus a reason code comes out. They follow the capability table that D-090 signed off. Later feature tickets call them and add the rows of their own features.

## Scope
- In: a module `packages/shared/src/permissions/` exported from `@toki/shared`: the types (role, actor, facts, decision, reason codes); one function for each phase 1 row of the capability table (Design, Table A) plus the rule that #general cannot be left (D-034); the unit tests, including a matrix test of every function for both roles; the rule for what a function does when a fact is missing or a role is unknown.
- Out (not now):
  - Guest. Guest is a phase 5 role (D-090, D-152; technical design, phase 5: "a guest role added to the shared permission rules"). Phase 1 has no Guest function. The ticket that builds guests adds the role, its rows and the guest permission suite of D-050.
  - Capability rows of phase 5: "Invite a guest to a channel", "Create automations", "See Analytics". The ticket that builds each feature adds its function to this module and its row to the matrix test (R14).
  - Loading the facts (membership, channel kind, archived, author) from the database, and the HTTP status and error text for a refusal: the API ticket that owns the endpoint. They are TOKI-024 (members), TOKI-029 (channels), TOKI-030 (DMs), TOKI-037 (send), TOKI-045 (threads), TOKI-046 (reactions), TOKI-047 (edit and delete), TOKI-048 (pins) and TOKI-050 (@channel).
  - Hiding a control on a screen: the screen ticket (for example TOKI-035 Details panel, TOKI-034 Browse channels). This ticket gives them the function to call.
  - Account status (active, invited, deactivated) and sessions. A deactivated person has no session (BR-29), so the server never reaches a permission function for them. Sign-in checks the status: TOKI-022.
  - Limits that are not permissions: a group DM holds up to 8 people (D-017), `@channel` asks for confirmation in a channel of 20 or more (D-041), channel name rules (D-040), a message holds up to 10,000 characters (D-042). The ticket of the feature owns each.
  - The role column and the table that stores it: TOKI-019. The first Admin from configuration: TOKI-020.
  - The record of administrative actions (D-110) and the repeat-request rule (D-111): TOKI-024.

## Requirements
- R1. `packages/shared/src/permissions/` exists and everything in R2 to R12 is exported from `@toki/shared` (`packages/shared/src/index.ts`). `pnpm typecheck` at the repository root exits 0 with an import of every exported name from `@toki/shared` in a test file.
- R2. The module exports the type `Role` with exactly the values `"member"` and `"admin"` (no Owner, D-152); the type `Actor` `{ id: string; role: Role }`; the type `ConversationFacts` `{ kind: "public_channel" | "private_channel" | "dm" | "group_dm"; isGeneral: boolean; archived: boolean; isMember: boolean }` (`isMember` is whether the actor is a member of that conversation); the type `MessageFacts` `{ authorId: string }`; and the result type `Decision`: `{ allowed: true }` or `{ allowed: false; reason: DenyReason }`. `DenyReason` is exactly: `fact_missing`, `unknown_role`, `role_not_allowed`, `not_a_member`, `not_a_channel`, `private_channel`, `channel_is_general`, `channel_archived`, `not_author`, `self_target`, `last_admin`.
- R3. Every function is pure: it reads no database, clock, network, environment or global, it does not change its arguments (a test passes deeply frozen arguments), it does not throw, and it returns the same result for the same arguments. A function that gives a yes or no for several reasons returns the first reason in this order: `fact_missing`, `unknown_role`, `role_not_allowed`, `not_a_member`, `not_a_channel`, `private_channel`, `channel_is_general`, `channel_archived`, then the reasons about the message or the target person (`not_author`, `self_target`, `last_admin`).
- R4. Missing facts deny. When an argument a function needs is missing, `null`, of the wrong type, or (for `kind` or `role`) not one of the listed values, the function returns `{ allowed: false, reason: "fact_missing" }`; a `role` that is a string but is not `"member"` or `"admin"` (for example `"guest"` or `"owner"`) returns `unknown_role`. A function never defaults a missing fact to a permissive value. Each function checks only the facts it uses, as listed in Table A. Check: a table test calls every function with each of its facts removed in turn and with the role `"guest"`, and expects `fact_missing` or `unknown_role` every time, never `allowed: true`.
- R5. Reading and writing a conversation (D-077, D-116, BR-09, BR-11). `canReadConversation(actor, conv)` is allowed for a Member and an Admin who is a member of the conversation, whatever its kind and whether or not it is archived; otherwise `not_a_member`. `canPostInConversation(actor, conv)` is allowed when the actor is a member and `archived` is false; an archived conversation gives `channel_archived`. It answers sending, replying in a thread, reacting and attaching files. An Admin who is not a member of a private channel or a DM is refused both (`not_a_member`): an Admin has no extra right to read (D-047).
- R6. `canUseAtChannel(actor, conv)` and `canPinMessage(actor, conv)` (pin and unpin) are allowed for any Member or Admin who is a member of a channel or a DM and where `archived` is false (D-041, FR-36); a non-member gets `not_a_member`, an archived conversation `channel_archived`.
- R7. Messages (BR-24, FR-11, FR-12, FR-13). `canEditMessage(actor, conv, msg)` is allowed only when the actor is the author (`msg.authorId === actor.id`), is a member, and the conversation is not archived: a Member and an Admin alike; for another person's message it gives `not_author`, also for an Admin. `canDeleteMessage(actor, conv, msg)` is allowed for the author, and for an Admin who is a member of the conversation (`as: "admin"`); a Member who is not the author gets `not_author`. The allowed result carries `as: "author"` or `as: "admin"` (an Admin deleting their own message is `author`), so the caller can show 'Message deleted by an admin' and tell the author (D-049). In an archived conversation both give `channel_archived`; for a non-member both give `not_a_member`.
- R8. Creating conversations. `canCreateChannel(actor)` is allowed only for an Admin; a Member gets `role_not_allowed` (D-084, D-090). `canCreateDirectConversation(actor)` is allowed for a Member and an Admin (DMs and group DMs).
- R9. Channel membership and state, for `public_channel` and `private_channel` only (a `dm` or `group_dm` gives `not_a_channel`, because people cannot be added to or removed from a group DM, D-045): `canJoinChannel(actor, conv)`: allowed for a Member or an Admin on a public channel that is not archived; a private channel gives `private_channel` (it is rejoined only when a member adds the person back, D-051); an archived one `channel_archived`. It needs no `isMember` fact. `canAddPeopleToChannel(actor, conv)`: allowed for a Member or an Admin who is a member of the channel, not archived (D-041, D-090). `canRemovePeopleFromChannel(actor, conv)`: allowed only for an Admin who is a member of the channel, never in #general (`channel_is_general`), not archived (D-085, D-047). A Member gets `role_not_allowed`. `canLeaveChannel(actor, conv)`: allowed for a member of a channel other than #general (D-034); in #general it gives `channel_is_general`. A leave from an archived channel is allowed. `canArchiveChannel(actor, conv)` and `canRestoreChannel(actor, conv)`: allowed only for an Admin who is a member of the channel, never #general (D-085, D-034, D-047). They check the role and membership, not whether the channel is already archived: that conflict belongs to the API (TOKI-029).
- R10. Workspace pages. `canUseWorkspaceViews(actor)` (Activity, Later, Files, People and Ctrl+K) is allowed for a Member and an Admin. `canOpenAdminPage(actor)` is allowed only for an Admin; a Member gets `role_not_allowed` (D-090). The Admin page lists members, so the member list endpoint of the Admin page uses `canOpenAdminPage`.
- R11. Invitations. `canInviteMember(actor, { role })` is allowed only for an Admin, for the invited role `"member"` or `"admin"` (D-153); an invited role that is not one of the two gives `unknown_role`. `canManageInvitations(actor)` (resend, revoke, list invitations) is allowed only for an Admin.
- R12. Accounts (D-153, BR-27, BR-28). `target` is `{ id: string; role: Role }` and `activeAdminCount` is the number of active Admins in the workspace, counted by the caller, target included. `canChangeRole(actor, target, newRole, activeAdminCount)`: allowed only for an Admin. Making an Admin a Member (a demotion) when `activeAdminCount` is 1 or less gives `last_admin`, also when the Admin demotes themselves; with two or more Admins an Admin may demote any Admin, themselves included. Promoting, and setting the role a person already has, is allowed. `canDeactivateAccount(actor, target, activeAdminCount)`: allowed only for an Admin; the actor deactivating themselves gives `self_target`; deactivating an Admin when `activeAdminCount` is 1 or less gives `last_admin`; any other Member or Admin is allowed. `canReactivateAccount(actor)`: allowed only for an Admin. `activeAdminCount` that is not a whole number of 0 or more gives `fact_missing`.
- R13. Both roles, every function: for each exported `can…` function a test states the expected result for a Member and for an Admin, including the reason code of every refusal in R5 to R12, in the matrix of R14. The orders of R3 are checked with arguments that break two rules at once (for example a Member, not a member of the channel, archived: `role_not_allowed` for `canArchiveChannel`; an Admin who is not a member of an archived channel: `not_a_member`).
- R14. A matrix test lists the phase 1 rows of the capability table (Table A, 17 rows, in the words of the table) each with the function names that answer it and the expected result for Member and Admin, and fails when an exported `can…` function is in no row or a row names a function that does not exist. A later ticket that adds a function must add its row in the same change.
- R15. The module has no import from any package or file outside `packages/shared`, no runtime dependency is added to `packages/shared/package.json`, and its source uses no global outside the allow list of TOKI-002 (`pnpm lint` exits 0). It runs the same in Node and a browser.
- R16. One place for role checks. Outside `packages/shared/src/permissions/` and its tests, no source file in `apps/` or `packages/` compares a role to `"admin"` or `"member"` to decide an action. Check: `grep -rnE "role\s*[!=]==?\s*[\"']" apps/*/src packages/*/src` lists no line outside the module, the tests and the fixtures of the tables (TOKI-019). A later ticket may turn the search into a lint rule through TOKI-002.
- R17. The functions work on the server and in the client with the same arguments and give the same result. A test file in `packages/shared` runs the matrix once in the Node test environment; the same functions are imported by `apps/server` and `apps/web` through `@toki/shared` by the tickets that use them, with no copy and no second implementation (R16).

## Design
### Table A. The capability table and the function that answers each row
The rows are the rows of the capability table in the Blueprint (reviewed in D-090). Phase 1 uses 17 of its 20 rows; the three of phase 5 are in Out. Facts: A = actor (id, role); C = conversation facts; M = message facts; T = target person; N = active Admin count.

| # | Row of the capability table | Member / Admin / Guest (table) | Function | Facts |
|---|---|---|---|---|
| 1 | Sign in with an emailed code | yes / yes / yes | none here: no role decides it; the account status does (TOKI-022) | |
| 2 | Read and post in public channels | yes / yes / not allowed | `canReadConversation`, `canPostInConversation` | A, C |
| 3 | Read and post in private channels | if a member / if a member / invited channel only | the same two functions | A, C |
| 4 | Create public and private channels | not allowed / yes / not allowed | `canCreateChannel` | A |
| 5 | Join public channels; add people to a channel you are in | yes / yes / not allowed | `canJoinChannel`, `canAddPeopleToChannel` | A, C |
| 6 | Create DMs and group DMs | yes / yes / not allowed | `canCreateDirectConversation` | A |
| 7 | Threads, reactions, sending files | yes / yes / yes | `canPostInConversation` | A, C |
| 8 | Pin messages, use @channel | yes / yes / not allowed | `canPinMessage`, `canUseAtChannel` | A, C |
| 9 | Edit and delete your own messages | yes / yes / yes | `canEditMessage`, `canDeleteMessage` | A, C, M |
| 10 | Delete other people's messages | not allowed / where a member / not allowed | `canDeleteMessage` | A, C, M |
| 11 | Activity, Later, Files, People, Ctrl+K | yes / yes / not allowed | `canUseWorkspaceViews` | A |
| 12 | Remove people from a channel | not allowed / where a member / not allowed | `canRemovePeopleFromChannel` | A, C |
| 13 | Archive and restore channels | not allowed / where a member / not allowed | `canArchiveChannel`, `canRestoreChannel` | A, C |
| 14 | Open the Admin page | not allowed / yes / not allowed | `canOpenAdminPage` | A |
| 15 | Invite members | not allowed / with any role / not allowed | `canInviteMember`, `canManageInvitations` | A, invited role |
| 16 | Deactivate and reactivate | not allowed / anyone but the last Admin and themselves / not allowed | `canDeactivateAccount`, `canReactivateAccount` | A, T, N |
| 17 | Change roles | not allowed / yes, except demoting the last Admin / not allowed | `canChangeRole` | A, T, new role, N |

Rule outside the table: #general cannot be left or archived (D-034): `canLeaveChannel` (and R9). The Guest column is not built (Out). 

Guest in phase 1: none. Guests exist only from phase 5; until then a caller that passes `"guest"` is refused with `unknown_role` by every function (R4), which is the safe default.

### What a caller must pass, and what a function does when a fact is missing
- Actor: `id` and `role` of the signed-in person, from the session. The server reads the role from the account at each request, not from a value the client sent.
- Conversation facts: `kind` (a channel is public or private and fixed at creation, D-040; DMs and group DMs are their own kinds), `isGeneral` (true for #general only), `archived` (always false for a DM in phase 1) and `isMember`. The server reads them in the same request, from the conversation tables (TOKI-028). The client reads them from the data it already holds.
- Message facts: `authorId`. Target person and `activeAdminCount`: the server reads the count in the same transaction as the change, so two Admins demoting each other at the same moment cannot both pass (TOKI-024 owns that transaction).
- A fact that is absent or malformed never turns into "allowed": the function returns `fact_missing` (R4). A caller that cannot supply a fact must refuse the request or hide the control.

### How the server uses them
Each endpoint loads the facts, calls the function and, on `allowed: false`, refuses the request before any change. The reason code is for the server log and the response body's code; the status and text belong to the endpoint's ticket. When a person is not a member of a private conversation, the refusal reads the same as "not found" (BR-10, so a channel name does not leak): the endpoint maps `not_a_member` that way. The check runs on every request, whatever the screen showed (BR-09). Tests in each API ticket send the forbidden request straight to the server and expect a refusal (the Member's edit request in FR-11, Mai's delete in FR-13, the Admin outside the private channel in FR-13); this ticket proves the rule, the API ticket proves that the endpoint calls it.

### How the client uses them
The web app calls the same functions with the signed-in person's role and the facts it holds, and hides or disables a control when the result is `allowed: false`. The `reason` lets a screen choose whether to hide the control (`role_not_allowed`) or show it disabled with a text where the screen design says so. The client check only shapes the screen: it is never the only check, because the server repeats every check (BR-09, D-050 for guests later). How `client-core` obtains the role and the facts is built with the bootstrap and the conversation store (TOKI-031, TOKI-032); the dependency of `client-core` on `shared` is declared by the first ticket that imports it (TOKI-001 concern 4).

### Adding a row later
The ticket that builds a new feature with a role rule adds, in the same change: a function in `packages/shared/src/permissions/`, its tests, its row in the matrix (R14), and the call on the server and in the client. No ticket writes a role comparison elsewhere (R16). Examples: guests, automations and analytics in phase 5; the ticket of each.

### Layout
```
packages/shared/src/permissions/
├─ types.ts          Role, Actor, ConversationFacts, MessageFacts, Decision, DenyReason
├─ checks.ts         the shared checks in the order of R3 (facts, role, member, archived)
├─ conversation.ts   read, post, @channel, pin, edit, delete
├─ channel.ts        create, join, add, remove, leave, archive, restore, direct conversations
├─ account.ts        workspace pages, invitations, roles, deactivate, reactivate
├─ index.ts          the exports
└─ *.test.ts         one file per source file, and capability-matrix.test.ts
```
Decided in this spec: the module is split by subject and not by role, because a rule such as "an Admin where a member" mixes a role and a fact; a function per question is easier to find and to call from both sides.

### Errors
- Missing or malformed fact -> `fact_missing`; unknown role -> `unknown_role`; neither throws (R4).

## Testing
Test first with Vitest in `packages/shared`, using fake ids and names only.
- R1, R15: a type check and a lint run over the module; a test imports every export from the package entry; `pnpm lint` shows no global outside the allow list.
- R2: a type-level test (`expectTypeOf`) for the types and a runtime test that the reason codes are exactly the list.
- R3: frozen arguments, repeated calls give equal results, a spy on `Date`, `Math.random` and `fetch` is never called; order tests with two broken rules at once.
- R4: a table test removes each fact of each function in turn, sets a wrong type, and passes `"guest"` and `"owner"` as role; expects `fact_missing` or `unknown_role` and never `allowed: true`.
- R5 to R12: one test file per source file with a positive and a negative case for each sentence: a Member and an Admin, a member and a non-member, archived and not archived, #general and another channel, own and another person's message, one Admin and two Admins, deactivating oneself, demoting oneself with one Admin and with two. The Admin who is not a member of a private channel cannot read, post, delete, remove, archive or restore.
- R13, R14: `capability-matrix.test.ts` holds the 17 rows and the exported function names read from the module; it fails when a function has no row.
- R16: the `grep` of R16 is run in review and its result written in the pull request; a lint rule is a later option.
- R17: the matrix runs once under the Node environment of the harness (TOKI-008 picks up `*.test.ts` under any package with no configuration change). `packages/shared` gets its Vitest script from whichever of TOKI-094 or this ticket lands first, in the same form.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to M2, intent I04; size M | Scope covers only the module in `shared` and its tests. |
| Needs TOKI-019; `shared` from TOKI-001 | The role strings `"member"` and `"admin"` are the values of the role of an account (R2); the module imports nothing from the tables (R15). |
| Needed by TOKI-024 and TOKI-029 | Functions for invitations, roles, deactivation (R11, R12) and for channels (R8, R9) are named for them. |
| Two roles only, no Owner; Guest in phase 5 | R2 (`Role`), R4 (`"guest"` and `"owner"` are `unknown_role`), Scope Out. |
| Only an Admin creates channels | R8. |
| Admin removes, deletes others' messages, archives and restores only where a member; never remove from #general | R7, R9, R5 (no extra right to read). |
| Admin invites with any role, changes roles, deactivates anyone but the last Admin and themselves | R11, R12. |
| Pure: no database, clock or network | R3, R15. |
| Permission is checked on the server for every request | Design, "How the server uses them" and "How the client uses them"; R16, R17; the API tickets test the refusal. |
| No globals outside the allow list, no runtime dependency | R15. |
| Tests first with Vitest | Testing. |

## Open questions from the intent
- Who restores an archived private channel that has no members left? The log has the question open (D-184): an Admin restores only a channel they belong to, so no Admin can restore a channel with no members. Not answered. Carried forward as concern 1.
- Does Guest have any phase 1 behaviour? No: Guest is a phase 5 role (D-090, D-152; technical design, phase 5). A guest role passed in phase 1 is refused with `unknown_role` (R4). Answered here; see concern 4.

## Areas of concern
1. Restoring a private channel with no members. The capability table and D-085 say an Admin restores and archives only where they are a member, and D-051 archives a private channel when its last member leaves. D-184 asks who restores such a channel and is open. The functions follow the table: `canRestoreChannel` needs membership, so nobody can restore it through them. Not decided. A proposal only, from the log's text of D-184: any Admin may restore it and becomes its member; it would need a changed rule or an extra fact in `canRestoreChannel`. Owner: Thanh Truong (product owner).
2. An Admin who is a member of a DM or group DM. The table and D-047 say an Admin deletes another person's message "where a member", with no exception for DMs, so `canDeleteMessage` allows it in any conversation the Admin belongs to (R7). Decided in this spec: follow the table literally, because the log makes no exception for DMs. Owner: Thanh Truong.
3. Archived conversations. The state table says an archived conversation is hidden from lists, read-only and still searchable, and BR-11 requires a conversation that is not archived for writing. Decided in this spec: reading stays allowed; posting, reacting, pinning, `@channel`, editing, deleting, joining, adding people, removing people refuse with `channel_archived`; leaving a channel stays allowed (leaving changes no content). The log does not list these cases one by one; they are the consequence of BR-11. Owner: Thanh Truong.
4. Guest rules arrive later. Decided in this spec: phase 1 has no Guest function and refuses an unknown role (R4); the ticket that builds guests adds the role and the permission suite of D-050. Owner: Thanh Truong.
5. Race between two role changes. A pure function cannot see a change made at the same moment. Decided in this spec: the caller reads `activeAdminCount` inside the transaction that makes the change (Design). TOKI-024 owns the transaction and a test with two requests together. Owner: Thanh Truong.
