# Database connection, migrations and the workspaces table design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/database-migrations.md (Thanh Truong)
Ticket: TOKI-005

## Goal
The builder (Thanh working with Claude) needs the server to reach Postgres and one repeatable way to change the database structure.
The first table, `workspaces`, must exist, because every later table carries `workspace_id`.
Later tickets then add their tables the same way, and the test harness can run against a real Postgres.

## Scope
- In: the Postgres connection in `apps/server`; the migration workflow (create a migration, apply migrations); the first migration, which creates `workspaces`; the edit to the `dev:reset:db` script from TOKI-003 that adds the "apply all migrations" step after the wipe; a short note on how a later ticket adds a table.
- Out (not now):
  - Docker Compose, `dev:up`, `dev:down` and the `dev:reset*` scripts: TOKI-003. TOKI-003 ships `dev:reset:db` as a wipe only; this spec supplies the migrate command and adds the step that calls it (R12).
  - Reading and validating environment variables, `/healthz`, logs, the error format: TOKI-004.
  - The inventory of environment variables and `.env.example`: TOKI-096.
  - Lint and package boundary rules: TOKI-002. CI: TOKI-007.
  - Vitest against a real Postgres, the test database, the controllable clock: TOKI-008. TOKI-008 also moves the tests of this change to the test database (concern 7).
  - The other account tables (`users`, `login_codes`, `sessions`, `devices`): TOKI-019.
  - The background job queue (pg-boss): TOKI-064.
  - Creating the first workspace row, the Owner account and #general on an empty database (flow F01). That is TOKI-020; see concern 6.
  - Prototype seed data and `dev:seed`: TOKI-081. Production image and deploy: TOKI-084, TOKI-085.

## Requirements
- R1. With the development services running, the server opens a connection to Postgres from the connection setting in the environment. Check: an integration test runs `select 1` through the server's database client and gets `1`.
- R2. When the connection variable is missing, the server does not start and prints the name of the missing variable. Check: start the server without it; the process exits non-zero and the output contains the variable name.
- R3. One command creates a new migration file from a change to the schema definition. Check: change the schema, run the command, and a new file appears in the migrations folder; `git status` shows it.
- R4. One command applies all pending migrations, in order. Check: run it on an empty database; `\dt` in `psql` then lists `workspaces`.
- R5. Applying migrations twice is safe. Check: run the apply command a second time; it exits 0 and the schema is unchanged.
- R6. The apply command runs from the repository root as one pnpm script, so `dev:reset:db` (TOKI-003) can call it. Check: run the script from the root on a wiped database; it exits 0 and `workspaces` exists.
- R7. A migration that fails stops the run. Check: apply a deliberately broken migration in a test; the command exits non-zero and the output names the migration.
- R8. `workspaces.id` is the primary key, of Postgres type `uuid`, and holds a UUIDv7. Check: insert a row in a test; the 13th hex digit of the id is `7`.
- R9. `workspaces` holds the workspace name, which is required. Check: an insert without a name fails with a not-null error.
- R10. No connection value is committed. Check: `git grep` over the repository finds no connection string with a password; only a placeholder in `.env.example`.
- R11. A short note explains how a later ticket adds a table. Check: `apps/server/src/db/README.md` exists and lists the steps: edit the schema, create the migration, apply it, commit the file.
- R12. After this ticket, `dev:reset:db` wipes the development database and then applies all migrations. Check: run `dev:reset:db` from the root on a development database that holds data; it exits 0, `workspaces` exists and holds no row.

## Design
### Data model
`workspaces` (the only table in this change):
- `id`: `uuid`, primary key, UUIDv7. Source: Blueprint data model notes.
- `name`: text, required. Source: flow F01 says the workspace name comes from an environment variable.
- No other column is decided. See concern 1.
- The table is created empty. No row is inserted by this change.

### Errors
- Connection variable missing -> the server does not start and prints the variable name (Blueprint, flow F01 rule).
- A migration fails -> the apply command exits non-zero and names the migration (R7).
- Postgres unreachable at server start -> not decided. See concern 5.

### Layout
Assumption: the folder and script names below are proposals; the Blueprint fixes only `apps/server` and Drizzle.
```
apps/server/
├─ drizzle.config.ts        Drizzle Kit settings (schema path, migrations path)
├─ migrations/              generated SQL files, committed to git
└─ src/db/
   ├─ client.ts             opens the connection; the only place that reads the connection setting
   ├─ migrate.ts            applies pending migrations
   ├─ schema/workspaces.ts  the workspaces table definition
   └─ README.md             how to add a table
package.json (root)         scripts db:generate and db:migrate; dev:reset:db (from TOKI-003) gains the db:migrate step
```
- The connection variable name is the one in the TOKI-096 inventory; this ticket invents no name. `DATABASE_URL` is used in this spec only as a stand-in, and the final name is the one in the inventory. Decided by Thanh Truong (lead, as product owner) on 2026-11-12.
- Migrations are applied by command only, not at server start. Outside development the command runs as a step of the automated deploy (TOKI-085). See concern 4.

## Testing
- Written test-first, as the Blueprint asks for backend work.
- Integration tests with Vitest against the development Postgres from TOKI-003: connect (R1), apply on an empty database (R4), apply twice (R5), broken migration (R7), id is UUIDv7 (R8), name required (R9), reset then migrate (R12).
- R2, R3, R6, R10 and R11 are checked by running the command or looking for the file.
- Fake data only. The tests of this change use the development database for now; TOKI-008 moves them to the test database (concern 7).

## Data safety
- The connection value lives in `.env`, never in git. `.env.example` holds a placeholder only.
- The connection value is never written to logs or error output; only the variable name is printed.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Scope is fixed to three things: Postgres connection, the migration workflow, the first table | Scope In lists only these three plus a short note; R1 to R11 |
| Database tooling is already decided: Drizzle on Postgres 17, with Node 22 and TypeScript | Design Layout uses Drizzle and Drizzle Kit in `apps/server`; no other tool is added. Driver choice is concern 3 |
| Every table carries `workspace_id` to keep a path to multi-tenant. IDs are UUIDv7 | R8 for the id. How the rule applies to `workspaces` itself is concern 2 |
| Server modules call each other only through public interfaces, never each other's tables | `src/db/client.ts` is the one shared entry; table ownership by module is concern 8 |
| Secrets live in `.env`, never in git | R10 and Data safety |
| Milestone: M1 "Foundation and design system" | Planning fact; no design impact |
| Size: S (about half a working session with Claude) | Scope is kept to one table and two commands; no seed, no test harness |
| Needs: TOKI-003 and TOKI-004 | Planning fact. The design uses the Postgres service from TOKI-003 and the environment validation from TOKI-004; the connection variable name comes from the TOKI-096 inventory |
| Needed by: TOKI-008, TOKI-019 and TOKI-064 | R3, R4 and R11 give later tickets one way to add tables; their own work is in Scope Out |
| The `dev:reset:db` script from TOKI-003 wipes Postgres and re-runs migrations | R6 and R12. This ticket adds the migration step to the wipe-only script from TOKI-003 (concern 9) |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; no design impact |

## Open questions from the intent
- The Blueprint lists nothing as open for the spec on this ticket. Confirmed: the Blueprint extract shows "-" in the "Open for the spec" column for TOKI-005. Nothing to answer.
- The Blueprint does not say which information the workspaces table holds. What must it record? Partly answered. The Blueprint extract supports an id that is UUIDv7 (data model notes) and the workspace name (flow F01). The rest is not answered. Carried forward as concern 1.

## Areas of concern
1. The full column list of `workspaces` is not in the Blueprint. Only `id` and `name` are supported. Proposal, not decided: add `created_at` and `updated_at` timestamps and nothing else. Also not stated: a length limit for the name, and whether more than one row may exist in a single-tenant install. Owner: Thanh Truong.
2. "Every table carries `workspace_id`" is unclear for `workspaces` itself. Proposal, not decided: `workspaces.id` is the workspace id and the table has no separate `workspace_id` column. Owner: Thanh Truong.
3. The Blueprint does not say where a UUIDv7 is made (in the server or in the database) or which Postgres driver Drizzle uses. Assumption: Postgres 17 has no built-in UUIDv7 function, so the server would make the id. Both choices add a dependency. Owner: Thanh Truong.
4. How migrations are applied outside development is not stated: by a command during deploy, or by the server at start. Answered: as a step of the automated deploy. The scope of TOKI-085 is "Build the image on merge, deploy, run migrations, roll back". This matches the command-only design of this spec; the server does not migrate at start. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-085. Owner: Thanh Truong.
5. Behaviour when Postgres is unreachable at server start is not stated: fail fast, or retry. Also not stated: whether `/healthz` (TOKI-004) reports the database state. Proposal, not decided: exit non-zero with a clear message; leave `/healthz` to TOKI-004. Owner: Thanh Truong.
6. Flow F01 creates the workspace row from an environment variable when the database is empty, but the extract names no ticket that owns it. Answered: TOKI-020 "First admin from environment variables" (M2, needs TOKI-019) owns it: "Create the Owner, the workspace and #general when the database is empty". This spec correctly leaves the table empty. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-020. Owner: Thanh Truong.
7. TOKI-008 owns the test database, and no reset may touch it. Until TOKI-008 exists, the tests of this change can only use the development database, which they would have to wipe. Decided: TOKI-004 adds a minimal Vitest setup. TOKI-005 uses the development database for its tests for now. TOKI-008 extends the Vitest setup and moves the TOKI-005 tests to the test database. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
8. The boundary rule says modules do not touch each other's tables, but no module owns `workspaces` yet. Answered in part: the technical design lists a server module named `workspace` (modules: auth, workspace, members, conversations, messages, reactions, files, search, activity, later, notifications, presence, realtime, jobs), so that module owns the table, not an "accounts" module. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Technical design tab, Code structure, Server modules. Still open: where the table definition lives until the `workspace` module is first built, and which ticket moves it. Owner: Thanh Truong.
9. `dev:reset:db` is in TOKI-003, which is built before this ticket, so its migrate step has nothing to call at first. It is not stated which ticket wires the call. Decided: TOKI-003 ships `dev:reset:db` as a wipe only. TOKI-005 adds the "re-run migrations" step to `dev:reset:db` (R12). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
10. Rolling back a migration is not mentioned in the Blueprint. Proposal, not decided: forward-only; a mistake is fixed by a new migration, and in development by `dev:reset:db`. Owner: Thanh Truong.
