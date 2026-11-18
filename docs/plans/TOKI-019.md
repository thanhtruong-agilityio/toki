# TOKI-019 Account tables: plan

Ticket: TOKI-019 (issue 64) · Tier L · Branch `feat/toki-019-account-tables`
Spec (source of truth, accepted in PR 149): `docs/specs/2026-11-17-account-tables-design.md`. Requirement numbers `R1`..`R27` below are the spec's.

## Design

The approved design is the spec. In short:

- One migration `NNNN_account_tables` creates `users`, `login_codes`, `sessions`, `devices` after `workspaces`, and nothing else.
- Tables are defined in the module that owns them: `users` in `modules/members/schema.ts`; `login_codes` and `sessions` in `modules/auth/schema.ts`; `devices` in `modules/notifications/schema.ts`. A schema file imports no other module. Each module gets an `index.ts` that exports no table.
- Every foreign key (the `workspace_id` ones and the ones between these tables) crosses a module boundary, so none is declared in Drizzle. They are `ALTER TABLE ... ADD CONSTRAINT <table>_<column>_fkey ... ON DELETE RESTRICT` statements written by hand at the end of the generated SQL file (R22). Because the Drizzle schema does not declare them, running `db:generate` again produces no new file.
- Checks and partial indexes are declared in Drizzle (`check(...)`, `index(...).where(...)`) with the names listed in the spec under "Constraint and index names".
- IDs use `.$defaultFn(() => uuidv7())`. No time column has a default (R6).
- Constraint tests are plain SQL in `src/db/account-tables.db.test.ts`; module tests use the module's own table for R3, R6, R12. `src/db/test-rows.ts` is the one helper that inserts valid rows by SQL (R26).

## AC to step to test

| Req | Step | Test |
|---|---|---|
| R1, R2, R25 | S3 | `account-tables.db.test.ts`: four `CREATE TABLE` in the file; columns from `information_schema`; empty tables; `workspaces` row survives a second run |
| R3 | S2 | each module's `schema.db.test.ts`: insert without id, 13th hex digit is 7 |
| R4, R5, R22 | S3 | FK error per table; `pg_constraint` `confdeltype='r'`; FK names found |
| R6 | S2 | `information_schema` null defaults; insert without `created_at` fails; search finds no `defaultNow` or `now()` in the three schema files |
| R7 to R12 | S2, S3 | `users` checks by constraint name; status round trip keeps session and device |
| R13 to R15, R19 | S2, S3 | `login_codes` checks, unique `request_hash`, partial indexes |
| R16 to R18 | S2, S3 | `sessions` checks, `sessions_ended_check`, `sessions_user_id_live_idx` |
| R20, R27 | S2, S3 | `devices` checks, unique `session_id`, `devices_user_id_idx` |
| R21 | S5 | `pnpm lint`; test reads the three `index.ts` for the four table names; no cross-module import in the schema files |
| R23 | S3 | by hand: `pnpm db:generate --name account_tables`, one new SQL file and `meta/` updates; again, no new file |
| R24 | S4 | README section "Table conventions" lists the 8 rules |
| R26 | S1 | tests of each helper function: no values inserts a row, an override is stored |

## Steps (test first)

1. **S1 Tests and helper.** Write `account-tables.db.test.ts`, the three module `schema.db.test.ts` files and the test of `test-rows.ts`. Run them and see them fail for the right reason (a missing table or module, not a typo). Then write `test-rows.ts`.
2. **S2 Schemas.** `members/schema.ts`, `auth/schema.ts`, `notifications/schema.ts`, and the three `index.ts` files.
3. **S3 Migration.** `pnpm db:generate --name account_tables`; append the foreign keys by hand; commit the SQL and `meta/`. Run the tests until they pass.
4. **S4 README.** Add "Table conventions" to `apps/server/src/db/README.md`.
5. **S5 R21 check.** Test of the `index.ts` files, then lint and typecheck.
6. **S6 Verify.** Whole server test run, `pnpm typecheck`, `pnpm lint`, `db:generate` twice, read the migration by eye, record the output for the PR.

## Decisions from the review of this plan

Checked by the advisor (Opus); each point below is a plan change. Claims about drizzle-kit were not run yet: S3 confirms them.

1. **Foreign keys and regeneration.** `drizzle-kit generate` diffs the TypeScript schema with the last `meta` snapshot and never reads the SQL, so a second run makes no file. But a migration that is regenerated (convention 8, after a rebase) loses the appended `ALTER TABLE` lines. The exact foreign-key SQL block goes in the README section "Table conventions", with the rule to re-append it after a regenerate and never to use `drizzle-kit push`. The `pg_constraint` test of R22 is what catches a loss.
2. **Breakpoints.** Each appended `ALTER TABLE` has its own `--> statement-breakpoint` line before it, because `runMigrations` splits on those lines. The file is edited before any `db:migrate` on the dev database; if it was already applied, run `pnpm dev:reset:db`.
3. **Table order (R1).** The schema glob is read alphabetically (auth, members, notifications), so the generated `CREATE TABLE` order is likely `login_codes, sessions, users, devices`. S3 reorders the blocks by hand to `users, login_codes, sessions, devices` (the snapshot is unaffected) and the R1 test asserts the order. The test finds the file by the pattern `*_account_tables.sql`, not by a fixed number.
4. **R1 with existing rows.** The test copies the migrations to a temporary folder with the journal cut to `0000`, applies it, inserts a `workspaces` row, then runs `runMigrations` on the real folder and finds the row unchanged.
5. **R26.** S1 adds a search test that no file other than `*.test.ts` imports `test-rows.ts`. The `workspaces` helper passes a fixed `created_at` too, although the table has a default.
6. **R3, R4, R6 traps.** Raw SQL inserts always pass an `id` (no table has an id default in the database). The R6 Drizzle insert without `createdAt` is cast with `as never`, as the `workspace` test does. The README states the `workspaces.created_at` exception to convention 3.
7. **Names.** Every unique, check and index name is passed explicitly in S2 (Drizzle's default for a unique is `_unique`, the spec wants `_key`). Index tests match the `WHERE` text that Postgres returns, for example `WHERE (purpose = 'sign_in'::text)`, with a pattern rather than the source text.
8. **R21.** The lint rule `toki/module-entry` already covers all of `apps/server/src`, so S5 lint enforces the module boundary.

## What can break, and the riskiest step

- **Riskiest: S3.** The foreign keys are hand-written SQL outside the Drizzle snapshot. If the next `db:generate` wants to add or drop them, R22 fails. Mitigation: the schema declares no `references`, and S6 runs generate again and expects no file.
- **Hand-edited migration and `meta/`.** A hand edit of the SQL after generation does not change the snapshot; the statement-breakpoint markers must stay so `runMigrations` runs each statement.
- **`lower()` and `[[:space:]]` in Postgres checks.** They depend on the database collation. The tests use the cases of R7 and run against the real test database.
- **Number clash with TOKI-028.** Both add a migration; the second to merge regenerates (convention 8). Not a risk for this PR alone.
- **Tests need Postgres.** The `.db.test.ts` files need `TEST_DATABASE_URL`; without it they fail instead of skipping (TOKI-008 R7). If the user's database is not up, S1 to S3 cannot be run here: stop and ask the user to run it in their terminal.
- **Out of scope:** reads, writes, routes, invitations, profile columns, the clock. No other spec is edited.
