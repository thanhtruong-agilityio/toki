# QA record: TOKI-005
Ticket: TOKI-005
Spec: docs/specs/2026-11-12-database-migrations-design.md
Version: b304159
Environment: a temporary worktree of the Version under Node 22 (`~/.nvm`), pnpm through corepack, macOS; a temporary PostgreSQL 14.24 (Homebrew) cluster made with `initdb` on a loopback port (not the PostgreSQL 17 of Compose); the development database and the Docker services are not touched; the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows; the QA runs T12.

Each command row runs `V=b304159 bash docs/qa/TOKI-005.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-005.evidence.txt`. `b304159` is the merge commit of PR #128, decided in concern 1 of the spec of this record. The rows T1, T4, T7, T8, T9, T15 and T16 use a small TypeScript harness that the script writes into the temporary worktree; it calls the server's own `createDb`, `loadConfig`, `runMigrations` and the `workspaces` table definition. The only password is a made-up one in row T14, and the row checks that it is absent from the output. No `.env` is read or created.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 1 1`: a client built from the value of the configuration module returns `1` for `select 1`; one test file reads `DATABASE_URL` from the environment |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 1 1`: the server started without `DATABASE_URL` exits non-zero and the output contains the variable name |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 1 1 1 3`: after a table definition change the generate command adds one SQL file and one snapshot under `meta/`, updates the journal, and `git status` shows three paths in `apps/server/migrations/` |  | P1 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 0 1 1`: `pnpm db:migrate` exits 0 on an empty database and `workspaces` exists; two migrations of which the second depends on the first apply in order |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 0 1 1`: a second apply exits 0, the schema is unchanged, and the migration table holds the same rows |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 0 1`: the apply command runs from the repository root as one pnpm script, exits 0 and `workspaces` exists |  | P1 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 1 1 0`: a folder with the valid migration and a deliberately broken one makes the run reject; the output holds the Postgres error text; the table of the valid migration does not exist afterwards |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 uuid 1 7`: `workspaces.id` has type `uuid`, is the primary key, and an id made without passing one has `7` as its 13th hex digit |  | P1 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 1 1 1 1`: no name fails with a not-null error that names `name`; an empty name and a 101-character name fail with the check constraint; a 100-character name succeeds |  | P1 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 0 2 0`: connection strings with a password in the files the pull request changed; the `DATABASE_URL` and `TEST_DATABASE_URL` rows present in `.env.example`; how many of them have a value |  | P1 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 1 4 6`: the README exists; four steps (edit the definition in its module, create the migration, apply it, commit the whole folder with `meta/`); six rollback statements (forward-only, no down migration, compatible with the previous release image, redeploy the previous image tag, no dependence on a backup, a mistake is fixed by a new migration) |  | P2 |  |  |  |
| T12 | R12 | manual | At the Version, in a checkout with your own `.env` and the development services up (`pnpm dev:up`): put a row in the development database, run `pnpm dev:reset:db` from the root, then check with `psql` that the exit code was 0, `\dt` lists `workspaces` and it holds no row. It wipes the development database. Paste the three results (exit code, table present, row count), no value. | `dev:reset:db` on a development database that holds data exits 0, `workspaces` exists and holds no row; it wipes the development database, so the QA runs it by hand |  | P2 |  |  |  |
| T13 | R13 | command | `checks T13` | `T13 0 0 1 0 1 1 1`: two runs of the server tests pass; a marker row in a separate development-stand-in database is still there; no throwaway database is left; a run with a non-loopback host in `TEST_DATABASE_URL` fails and says it is not a loopback address; a run with it unset fails and says so |  | P1 |  |  |  |
| T14 | R14 | command | `checks T14` | `T14 1 1 1 1 0`: `db:migrate` without `DATABASE_URL` exits non-zero and names it; with Postgres unreachable it exits non-zero and says the database cannot be reached at host and database name only; neither the password nor the whole URL appears |  | P1 |  |  |  |
| T15 | R15 | command | `checks T15` | `T15 1 1 1 1 1 1`: `created_at` is `timestamp with time zone`, not null, set by the database close to now; two rows are stored; the columns are exactly `id`, `name`, `created_at`; the only constraints are the primary key and `workspaces_name_length` |  | P1 |  |  |  |
| T16 | R16 | command | `checks T16` | `T16 1 1 1 200`: building the client on a loopback address where nothing listens does not throw; `select 1` through it rejects; the server started with that address as `DATABASE_URL` stays up; `/healthz` answers 200 |  | P1 |  |  |  |

## Not covered
- None: every requirement R1 to R16 of the spec has a row.
