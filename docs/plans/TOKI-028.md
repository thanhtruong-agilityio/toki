# TOKI-028 Conversation tables: plan

Ticket: TOKI-028 (issue 114) · Tier L · Branch `feat/toki-028-conversation-tables`
Spec (source of truth, accepted in PRs 66 and 153): `docs/specs/2026-11-17-conversation-tables-design.md`. Requirement numbers `R1`..`R26` below are the spec's.

## Design

The approved design is the spec. In short:

- One migration `NNNN_conversation_tables` creates `conversations` and `conversation_members`, the functions and the triggers of R8, R10, R21 and R22, and nothing else. No row is inserted (R20).
- Tables live in `apps/server/src/modules/conversations/schema.ts`, not exported from `index.ts`. The foreign keys that leave the module (`workspace_id`, `created_by`, `user_id`) are plain `uuid` columns in Drizzle; their constraints are hand-written `ALTER TABLE ... ADD CONSTRAINT <t>_<c>_fkey ... ON DELETE RESTRICT` lines appended to the generated SQL (R16, as in TOKI-019). The composite key from `conversation_members` to `conversations` uses Drizzle's `foreignKey`. Checks, uniques and the index use the names of the spec's "Constraint and index names" table. Triggers and the order function are hand-written SQL in the same file (R8, R10, R21, R22).
- IDs: `.$defaultFn(() => uuidv7())`. No time column has a database default (R17).
- `packages/shared/src/conversations.ts` holds the limits, the pattern, the levels, `isValidChannelTopic`, `isValidChannelDescription` and `effectiveNotificationLevel` (R15).
- **Decided with the Dev (2026-11-18):** TOKI-027 is not built, so this ticket defines the type `ConversationFacts` in `packages/shared/src/permissions/types.ts`, exactly the shape of TOKI-027 R2 (`kind`, `isGeneral`, `archived`, `isMember`), and exports it from the package index. TOKI-027 extends that file with the other types and does not redefine `ConversationFacts`. This is a deviation from the spec text, which says TOKI-027 defines it; it changes no field.
- Module functions (R11, R18, R25, R26): `buildDmKey`, `getConversationFacts`, `isConversationMember`, `listMemberIds`, `createGeneralChannel`, `addMemberToGeneral`, exported from `index.ts`; `exports.test.ts` holds the one list of names.
- Constraint tests are plain SQL in `src/db/conversation-tables.db.test.ts`; rows of `workspaces` and `users` come from `src/db/test-rows.ts`; no test imports another module's table (R24).

## AC to step to test

| Req | Step | Test |
|---|---|---|
| R1, R19, R20 | S3 | `conversation-tables.db.test.ts`: two `CREATE TABLE` in the file; columns from `information_schema`; both tables empty after all migrations; TOKI-019 tests unchanged |
| R2, R17 | S3, S4 | own id kept (SQL); no id given gives version 7 (through Drizzle, in `general.db.test.ts`); `timestamptz`, no default; insert without `created_at` names the column |
| R3, R4 | S3 | name pattern cases by constraint name; unique incl. archived; two-connection same-name insert |
| R5, R6, R7 | S3 | DM/group shape cases; topic 250/251 letters and emoji; description 500/501 |
| R8, R9 | S3 | immutability trigger per column; general shape and name checks; general cannot be archived |
| R10 | S3 | key shape, order, size, unique; two-connection same-key insert |
| R11 | S2, S3 | `dm-key.test.ts` unit cases (S2); `dm-key.db.test.ts`: `[a,b]` then `[b,a]`, 200 random sets (S3) |
| R12, R13, R14 | S3 | member columns, pkey, index; per-row mute and star; level check |
| R15 | S2, S3 | `packages/shared` unit tests; one database test runs the same lists through the values and inserts |
| R16 | S3 | five foreign keys by name; `pg_constraint` `confdeltype='r'`; composite key mismatch refused |
| R18 | S4 | `exports.test.ts`; `facts.db.test.ts` for each kind, member and non-member, unknown id; `pnpm lint` |
| R21, R22 | S3 | member triggers incl. commit-time count; delete refused for three cases |
| R23 | S3 | one `TRUNCATE` naming the seven tables; harness already empties all public tables |
| R24 | S5 | search of the change for imports of `modules/members` or another `schema.ts` |
| R25, R26 | S4 | `general.db.test.ts` incl. second call, unknown user, two connections |

## Steps (test first)

1. **S1 Shared package.** Write the unit tests for `conversations.ts` (R15) and the type test for `ConversationFacts`; see them fail; write `packages/shared/src/conversations.ts` and `permissions/types.ts`; export both from `packages/shared/src/index.ts`.
2. **S2 Key builder.** `dm-key.test.ts` holds the unit cases of R11 only (no database); then `dm-key.ts`. The database parts of R11 (`[a,b]` then `[b,a]`, the 200 random sets) go to `dm-key.db.test.ts`, written in S3 after the tables exist.
3. **S3 Tables and migration.** Write `conversation-tables.db.test.ts` (R1 to R10, R12 to R14, R16, R17, R19 to R23), see it fail for a missing table; write `schema.ts`; `pnpm db:generate --name conversation_tables`; edit the generated SQL by hand as in "Decisions from the review" (function first, foreign keys, triggers, each followed by `--> statement-breakpoint`); commit the SQL and all of `meta/`. Run the tests until they pass.
4. **S4 Module functions.** `facts.db.test.ts`, `general.db.test.ts`, `exports.test.ts`, then `facts.ts`, `general.ts`, `index.ts`.
5. **S5 Checks.** R24 search, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, the full test run; add a "conversation tables" note to `apps/server/src/db/README.md` only if a convention changed (none expected).

## What can break, and the riskiest step

- **Riskiest: S3 hand-written SQL.** Triggers and functions are not in the Drizzle snapshot, so a later `db:generate` must not drop them and the harness must still `TRUNCATE` (R22 blocks DELETE, not TRUNCATE). Test: R23 statement; run `db:generate` again and expect no new file.
- **Deferred constraint trigger (R21).** It must fire at commit, so tests need real transactions on one connection, not autocommit. Test both the commit refusal and the accepted pair.
- **Sort agreement (R10, R11).** Byte-order sort in SQL (`COLLATE "C"`) against JavaScript's default sort; the 200 random sets prove it.
- **Concurrency tests (R4, R10, R26).** Two connections must not deadlock the harness; use the throwaway database helper and short timeouts.
- **Local Postgres.** The database tests need `TEST_DATABASE_URL`, set in the user's `.env`, which this session cannot read. They run in the user's Terminal panel (with their yes). Unit tests and lint run here.
- **`ConversationFacts` defined here.** If TOKI-027's spec drifts from R2, the two definitions differ; the field list is copied from R2 and checked by the type test.

## Decisions from the review of this plan

The advisor (Opus) grilled this plan in one round; these changes follow from it.

1. **Order of the SQL.** The immutable order function is created first in the migration file, before `CREATE TABLE`, because the Drizzle check calls it. Every hand-written statement is followed by `--> statement-breakpoint`.
2. **Composite foreign key.** Declared with `foreignKey({ name: "conversation_members_conversation_id_fkey", ... }).onDelete("restrict")`; the generated SQL is read to confirm `RESTRICT`.
3. **R2 test.** The id default is made in the client, so "no id gives UUIDv7" is tested through Drizzle (`general.db.test.ts`); the SQL file keeps only "own id kept".
4. **Database parts of R11** move to `dm-key.db.test.ts` (S3). The spec's Layout names one `dm-key.test.ts`; this plan splits it, and the PR says so.
5. **Foreign-key order.** In the SQL, `conversation_members_workspace_id_fkey` comes before the composite key, and `conversation_members_fixed_trg` passes through when its conversation row is missing, so each R16 refusal names the key under test.
6. **NULL in checks.** Each check states `is not null` where a NULL would pass (channel without a name, general row with a null name, DM key rules); every refusal fixture is otherwise valid.
7. **Trigger errors carry a name.** Triggers raise with `ERRCODE = '23514'` and `CONSTRAINT = '<trigger name>'`, so tests assert the name as for checks. The commit-time refusal rejects from `sql.begin`, not from the insert.
8. **Deferred trigger.** `conversations_members_complete_trg` fires only for `kind <> 'channel'`. Tests insert a DM or group with its members in one transaction through a helper. R23 commits before its `TRUNCATE`.
9. **The 200 random sets** get fresh `users` rows per set and unique sets, each in its own transaction with its members.
10. **Concurrency tests** use two separate clients and poll `pg_stat_activity` (`wait_event_type = 'Lock'`) for the second backend before the first commits.
11. **Missing test rows added** to S3 and S4: R25 (unknown `createdBy` writes nothing, member count stays 1, `isGeneral` in the facts), R26 (no #general throws and writes nothing, own workspace only, other member untouched), R16 (delete of a referenced `users` or `workspaces` row, unknown id per key), R18 (table object in exports fails the test, `facts.ts` mapping unit tests), R9 (general row in a second workspace). A "fails, nothing written" call runs in its own transaction or savepoint.
12. **`ConversationFacts`.** Created as `permissions/types.ts` plus `permissions/index.ts`, exported from the package index with `export * from "./permissions/index.js"`, so TOKI-027 only adds lines. Its shape is tested against a literal with `expectTypeOf`. The deviation is written in the PR and in a comment on issue 112.
