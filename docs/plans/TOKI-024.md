# TOKI-024 Member management API: plan

Ticket: TOKI-024 (issue 116) · Tier L · Branch `feat/toki-024-member-management-api`
Spec (source of truth, accepted in PR 173): `docs/specs/2026-11-17-member-management-api-design.md`. Requirement numbers `R1`..`R40` below are the spec's.

## Design

The design is the merged spec, section "Design" (data model, API, how the parts run, the contract with TOKI-097, layout). It is not repeated here. Decisions taken at the plan stage, approved by the Dev on 2026-11-19:

1. **Registration.** `registerMembersRoutes(scope, { db, mail, clock, appOrigin })` is exported from `modules/members/index.ts` and called in the `registerApi` callback of `buildApp` (`apps/server/src/app.ts`), next to `registerAuthRoutes`. `appOrigin` is `config.auth.appOrigin`, the value the Origin rule reads (R11). The module keeps no clock singleton: the routes read `clock.now()` once per request and pass `now` down; the four functions of R19 take `now` from their caller.
2. **Order of the checks (R1).** The session check is the `onRequest` hook of `auth`; `request.account` is the actor. Each handler then runs, in this order: `gate(request)` (`canOpenAdminPage`), the Zod `parse` of path, query, body and header, the permission function of the route. A refusal `role_not_allowed` is 403 `forbidden`; `self_target` and `last_admin` are 409; `fact_missing` and `unknown_role` throw a plain `Error`, which the error handler answers as 500 `internal_error`. Handlers are wrapped as `guarded()` of `auth/routes.ts` does, so a query error that carries an address never reaches the log (R32).
3. **Locks (R27, R39)** are taken with Drizzle `.for("no key update")` and `.for("share")`, rows ordered by `id`; `FOR UPDATE` is not used. One function, `lockAccounts(tx, workspaceId)`, returns the locked rows; the actor, the target and the count of active Admins are built from them.
4. **Migration.** `0003_member_management.sql` from `pnpm db:generate --name member_management`. The keys from the new tables to `users` are declared in `schema.ts` with `foreignKey({ name: "<table>_<column>_fkey" })` (inside the module, so Drizzle writes them). Appended by hand, each after `--> statement-breakpoint` and under a `-- Written by hand (R36)` comment: the three `workspace_id` keys and the append-only trigger with its function. The partial unique index is Drizzle's `uniqueIndex(...).where(...)`.
5. **The id of #general.** `addMemberToGeneral` returns a boolean today. The `conversations` module gets one more export, `getGeneralConversationId(tx, workspaceId): Promise<string>` (throws when there is none); `acceptInvitation` calls it after `addMemberToGeneral`. The existing function and its tests are not changed.
6. **`getLastUsedAtByUser(client, userIds): Promise<Map<string, Date>>`** in `auth/sessions.ts`, exported through `auth/api.ts`. A person with no session has no entry; an empty list makes no query.
7. **Mail failures in tests.** `fakeMail({ failFor?: string[] })` in `tests/fake-mail.ts`: `sendInvitationMail` to a listed address is recorded and answers `{ ok: false, reason: "unavailable" }`. The default stays as it is.
8. **Where tests live.** `apps/server/tests/members/` and `packages/shared/tests/members/`, the repository's convention since TOKI-022, not next to the source as the spec's Layout draws.
9. **The repeat rule (R13).** The request hash is the SHA-256 of `JSON.stringify([action, invitationId or null, parsed body])`, where the parsed body of a batch is `{ emails, role }` after the schema (the role default applied). The claim is one `INSERT ... ON CONFLICT DO NOTHING`; a conflict is resolved by reading the row under `FOR NO KEY UPDATE`.
10. **A lost race on the open-address index (R7).** The insert of an invitation runs in its own transaction for each address; error `23505` on `invitations_open_email_key` is caught outside that transaction, and the address is read again and reported as `already_invited`.
11. **`mail_status` after the send.** `UPDATE invitations SET mail_status = 'sent' WHERE id = $1 AND token_hash = $2`, so a Resend that replaced the token in between is not marked as delivered by the earlier mail.
12. **The list (R21 to R24).** One `sql` template: a union of accounts and of unclosed invitations whose address has no account, with the sort key `lower(coalesce(display_name, email)) COLLATE "C"`. The cursor is base64url of `JSON.stringify([key, id])`; the page condition is the row comparison `(key, id) > ($1, $2)`. The fold of R24 is one `sql` fragment, `fold(value)`, used on the column and on the query text. A deactivated account with an unclosed invitation is one account row with the invitation joined on `user_id`.
13. **The event (R40).** `events.ts` holds the listeners in a module-level array, as `auth/sessions.ts` does for `onSessionsEnded`; `publishMemberChanged` is called by the route after the transaction returns.
14. **Error codes (R2)** are added to `ErrorCodes` in `packages/shared/src/error.ts`; `forbidden` is there already.

## Dependencies found while exploring

- On `main`: the permission functions (TOKI-027), `endSessionsOfUser`, `reportSessionsEnded`, `createInvitationCode`, `checkInvitationCode`, `pruneInvitationCodes` (TOKI-022), `sendInvitationMail` (TOKI-021), `addMemberToGeneral` (TOKI-028), `parseEmail`, `getWorkspace`.
- `createInvitationCode` needs the `auth` runtime, so every test that makes a code builds the app through `createHarness` (`tests/auth/test-harness.ts`).
- The harness has no #general row; the tests of `acceptInvitation` create it with `createGeneralChannel`.
- `tests/conversation-tables.db.test.ts` names its tables in a fixed list; the three new tables are added there if its emptying step fails on their keys to `users`.
- The database tests read `TEST_DATABASE_URL` from the root `.env` of the worktree. Without it they run only in CI.

## AC to step to test

Test files are in `apps/server/tests/members/` unless the path says otherwise.

| Req | Step | Test |
|---|---|---|
| R2, R35 | S1 | `packages/shared/tests/members/address-list.test.ts`, `schemas.test.ts`, `limits.test.ts`; `packages/shared/tests/error.test.ts` (the ten codes) |
| R36, R38 | S2 | `member-tables.db.test.ts` (every column, check, key, index and the trigger by name; three `CREATE TABLE`; no inserted row) |
| R37 | S2 | `accounts.db.test.ts` (existing file: an address with only an invitation returns no account) |
| R31 | S3 | `record.db.test.ts` |
| R40 | S3, S4 | `events.db.test.ts` |
| R1, R3, R34 | S4, S5, S7 | `access.db.test.ts` (seven routes as a Member, with bad bodies; route list; the `GET` writes nothing; `fact_missing` gives 500) |
| R26, R28, R29, R30 | S4 | `people.db.test.ts` |
| R27, R39 | S4, S5, S6 | `people.race.db.test.ts` (two real connections; each pair of operations) |
| R4 to R10, R12 | S5 | `invite.db.test.ts` |
| R11 | S5 | `join-link.db.test.ts` |
| R13 | S5 | `idempotency.db.test.ts` |
| R14, R15, R16, R17, R18 | S5 | `resend-revoke.db.test.ts` |
| R19 | S6 | `invitation-functions.db.test.ts` |
| R20 | S6 | `accept.db.test.ts`; `apps/server/tests/conversations/general.db.test.ts` (`getGeneralConversationId`) |
| R21, R22, R23, R24 | S7 | `list.db.test.ts` |
| R25 | S7 | `apps/server/tests/auth/last-used.db.test.ts`, `list.db.test.ts` |
| R32, R33 | S8 | `safety.db.test.ts` |

Each test file covers the cases the spec's Testing section lists for its requirements; that section is the checklist of cases, word for word.

## Steps (test first)

Each new test is run and seen to fail for the right reason before its code. The whole server suite runs at the end of S2, S5 and S8.

1. **S1 Shared package.** Files: `packages/shared/src/members/{schemas,limits,address-list,index}.ts`, `packages/shared/src/error.ts`, `packages/shared/src/index.ts`, the tests above.
   - `limits.ts`: `INVITATION_BATCH_MAX` 50, `INVITATION_LIFETIME_DAYS` 7, `INVITATION_RESEND_SECONDS` 60, `INVITATION_TOKEN_PATTERN` `/^[A-Za-z0-9_-]{43}$/`, `IDEMPOTENCY_KEY_PATTERN` `/^[A-Za-z0-9_-]{1,64}$/`, `MEMBER_LIST_LIMIT_DEFAULT` 50, `MEMBER_LIST_LIMIT_MAX` 100.
   - `schemas.ts`: `InviteBodySchema`, `InviteResponseSchema`, `InvitationSchema`, `ResendResponseSchema`, `RevokeResponseSchema`, `MemberListQuerySchema`, `MemberListResponseSchema`, `MemberRowSchema`, `ChangeRoleBodySchema`, `AccountResponseSchema`, `IdParamSchema` (a UUID). The batch schema accepts any array length; the route answers `batch_too_large` itself (R4).
   - `parseAddressList(text): string[]` as R35 says.
   - The ten codes of R2 in `ErrorCodes`.
2. **S2 Tables.** Files: `apps/server/src/modules/members/schema.ts`, `apps/server/migrations/0003_member_management.sql`, `apps/server/migrations/meta/*`, `tests/members/member-tables.db.test.ts`, `tests/members/accounts.db.test.ts`, `tests/test-rows.ts` (`insertInvitation`), `tests/conversation-tables.db.test.ts` (the table list, only if needed).
   - Write the database test of every constraint by name first, then the schema, then generate, then append the hand-written SQL (decision 4).
3. **S3 Record and event.** Files: `modules/members/{record,events}.ts`, their tests.
   - `recordAction(tx, { workspaceId, actorId, action, targetUserId?, targetEmail?, detail, at })`.
   - `onMemberChanged(listener): () => void`, `publishMemberChanged(event, log)`.
4. **S4 Person routes.** Files: `modules/members/{routes,accounts,index}.ts`, `apps/server/src/app.ts`, `tests/members/{people,people.race,access,events}.db.test.ts`.
   - `lockAccounts`, then `changeRole`, `deactivate`, `reactivate`, each `(db, { actor, targetId, now, ... })` returning the account, the ended session ids and the event or null.
   - The routes call `reportSessionsEnded` and `publishMemberChanged` after the transaction returns.
5. **S5 Invitations.** Files: `modules/members/{invitations,idempotency,routes}.ts`, `tests/fake-mail.ts`, `tests/members/{invite,join-link,idempotency,resend-revoke,access}.db.test.ts`.
   - `invitationState(row, now)`, `makeToken()`, `hashToken(token)`, `codeSecret(token, serial)`, the internal `makeCode(tx, invitation, token)`.
   - `inviteBatch`, `resendInvitation`, `revokeInvitation`; the claim, the fence, the replay and the pruning of R13 and R33.
6. **S6 Functions for TOKI-097.** Files: `modules/members/{invitations,accept,index}.ts`, `modules/conversations/{general,index}.ts`, `tests/members/{invitation-functions,accept,people.race}.db.test.ts`, `tests/conversations/general.db.test.ts`.
   - `findInvitationByToken`, `issueInvitationCode`, `acceptInvitation` with the shapes of the contract table.
7. **S7 The list.** Files: `modules/members/{list,routes}.ts`, `modules/auth/{sessions,api}.ts`, `tests/members/list.db.test.ts`, `tests/auth/last-used.db.test.ts`.
8. **S8 Safety and the whole suite.** Files: `tests/members/safety.db.test.ts`. Then `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, and the Commands section of `CLAUDE.md` if a command was added (none is expected).

## Decisions from the review of this plan

Round 1 of the review, answered by the Dev on 2026-11-19. Round 2 found nothing new.

1. **Database tests run on this machine.** The Dev copies `.env` to the root of the worktree and allows the database tests to run there. A step is not finished until its tests were seen to fail and then pass against the real database.
2. **A lock mode of R39 that a test proves wrong stops the build.** The Dev is told with the failing test; the code is not changed to another mode on its own, because R39 is the lock order of the whole server.
3. **Files of other tickets.** Allowed without asking: the export `getGeneralConversationId` in `conversations`, `getLastUsedAtByUser` in `auth`, `failFor` in `tests/fake-mail.ts`, and a table list or a count in an existing test that fails only because three tables were added. Each is listed in the pull request. A change to the behaviour of another module stops the build.
4. **Repetitions of a race.** 20 for the three races of R27 (two Admins demote each other, two Admins deactivate each other, three Admins); 5 for every other pair of operations.

## What can break, and the riskiest step

- **Riskiest: S4 and S6 under concurrency (R27, R39, R20).** The lock modes come from the PostgreSQL documentation and have not been run. Mitigation: the races are tested with two real connections from `createMigratedDb().connect()`, the waiting side is detected through `pg_locks` as `tests/first-admin.db.test.ts` does, and each race is repeated (review decision 4). If a pair deadlocks, the order of R39 is checked first; a wrong mode stops the build (review decision 2).
- **S5, the repeat rule (R13).** A claim, a takeover and a fence have many orders. Mitigation: each case of the Testing section is its own test, the takeover is driven by the test clock, and the fence is tested by finishing the first request after the takeover.
- **An insert that fails inside a transaction aborts it.** Mitigation: decision 10; the test invites one address from two connections at the same moment and expects one row and one `already_invited`.
- **The fold expression of R24.** The `\u` escapes pass through a JavaScript template and then a SQL string. Mitigation: the first test of S7 is `nguyen` finding `Nguyễn` in decomposed and in composed form; if the escape does not survive, the combining marks are passed as a bound parameter built in JavaScript.
- **The row comparison with `COLLATE "C"` in the cursor.** Mitigation: the test reads 120 rows in pages of 50, with upper and lower case and one accented name, and expects each row once in order.
- **Existing tests that count tables or keys** (`account-tables.db.test.ts`, `conversation-tables.db.test.ts`, `isolation.db.test.ts`). Mitigation: the whole suite runs at the end of S2, before any route exists.
- **`db:generate` rewrites the migration.** A second run would drop the hand-written SQL. Mitigation: generate once, after the schema test is complete; a later schema change is made by editing the SQL and the snapshot together, and `db:generate` is run again only to confirm it makes no file.
- **The size of the change.** One branch and one pull request by the working agreement. Mitigation: one commit per step, each with its tests green, so a reviewer reads eight slices.
- **No database on this machine without `.env`.** Mitigation: review decision 1; the first command of S2 is a database test, so a missing file shows at once.
