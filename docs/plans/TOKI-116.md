# TOKI-116 QA of the database connection, migrations and the workspaces table - implementation plan

**Goal:** TOKI-005 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-database-migrations-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-116-db-qa`. Documents and one bash script (with a TypeScript harness it writes into the temporary worktree); no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `b304159` (PR #128), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-001.*`, `TOKI-002.*`, `TOKI-004.*` and `TOKI-006.*`, with their lessons built in from the start: every part of a sentence of a requirement is a printed number; a row names one requirement; a row that loops prints how many it checked; a row that cannot run prints `Blocked`; a changed `Expected` is approved again; the script keeps every temporary file under one folder made in the current shell (`BASE`, exported as `TMPDIR`, also given to the processes it starts) and the last line shows that it was removed, that no process is left and that the repository is unchanged; the notes do not claim more than the evidence shows.

- `docs/qa/TOKI-005.checks.sh` reads files of `V` with `git show`. Rows that run the code use one temporary worktree of `V` (installed once, removed by an `EXIT` trap). Node 22 and `corepack pnpm` as before. `env -i` for the processes it starts; no `.env` is read or created.
- **Temporary PostgreSQL.** The script makes a cluster with `initdb` under `BASE` (user `qa`, trust authentication, UTF-8), starts it with `pg_ctl` on a free loopback port with no unix socket, and the trap stops it (`pg_ctl stop -m immediate`) and removes it. It is the Postgres 14.24 of this machine, not the 17 of Compose; the `Environment:` of the record says so. Each row that needs a database makes its own with `createdb` and drops it. The development database and the Docker services are not touched.
- **Harness.** A small `zz-harness.ts` written into `apps/server` of the temporary worktree (not committed) imports the server's own `createDb`, `loadConfig`, `runMigrations` and the `workspaces` table definition, runs the cases of rows T1, T4, T5, T7, T8, T9, T15 and T16 against the temporary Postgres and prints one JSON line. Direct `psql` queries read the catalog for the column types, the primary key and the constraints.
- **Commands** (`pnpm db:migrate`, `pnpm db:generate`, `pnpm --filter @toki/server test`) run from the temporary worktree with only the variables the row gives (`DATABASE_URL`, `TEST_DATABASE_URL`, `NODE_ENV`). `db:generate` (T3) edits `schema.ts` in the temporary worktree only and the worktree is restored.
- Output is counts, exit codes, type names and words. No password: the URL of T14 carries a made-up password and the row checks that it is absent from the output.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug the script on a mutated copy first; if I run a real row to debug it, I say so.

### Rows (one per requirement)

| ID | TOKI-005 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 1 1`: a client built from the value of the configuration module returns `1` for `select 1`; the connection test is the only test file that uses `DATABASE_URL` |
| T2 | R2 | `T2 1 1`: the server started without `DATABASE_URL` exits non-zero and the output contains the variable name |
| T3 | R3 | `T3 1 1 1 3`: after a table definition change the generate command adds one SQL file and one snapshot under `meta/`, updates the journal, and `git status` shows three paths in `apps/server/migrations/` |
| T4 | R4 | `T4 0 1 1`: `pnpm db:migrate` exits 0 on an empty database and `workspaces` exists; two migrations of which the second depends on the first apply in order |
| T5 | R5 | `T5 0 1 1`: a second apply exits 0, the schema is unchanged, and the migration table holds the same rows |
| T6 | R6 | `T6 0 1`: the apply command runs from the repository root as one pnpm script, exits 0 and `workspaces` exists |
| T7 | R7 | `T7 1 1 0`: a folder with the valid migration and a deliberately broken one makes the run reject; the output holds the Postgres error text; the table of the valid migration does not exist afterwards |
| T8 | R8 | `T8 uuid 1 7`: `workspaces.id` has type `uuid`, is the primary key, and an id made without passing one has `7` as its 13th hex digit |
| T9 | R9 | `T9 1 1 1 1`: no name fails with a not-null error that names `name`; an empty name and a 101-character name fail with the check constraint; a 100-character name succeeds |
| T10 | R10 | `T10 0 2 0`: connection strings with a password in the files the pull request changed; the `DATABASE_URL` and `TEST_DATABASE_URL` rows present in `.env.example`; how many of them have a value |
| T11 | R11 | `T11 1 4 6`: the README exists; four steps (edit the definition in its module, create the migration, apply it, commit the whole folder with `meta/`); six rollback statements (forward-only, no down migration, compatible with the previous release image, redeploy the previous image tag, no dependence on a backup, a mistake is fixed by a new migration) |
| T12 | R12 | manual: `dev:reset:db` on a development database that holds data exits 0, `workspaces` exists and holds no row; it wipes the development database, so the QA runs it by hand at the Version; `Blocked` until then |
| T13 | R13 | `T13 0 0 1 0 1 1 1`: two runs of the server tests pass, a marker row in a separate development-stand-in database is still there, no throwaway database is left (`\l`), a run with a non-loopback host in `TEST_DATABASE_URL` fails and says why, and a run with it unset fails and says why |
| T14 | R14 | `T14 1 1 1 1 0`: `db:migrate` without `DATABASE_URL` exits non-zero and names it; with Postgres unreachable it exits non-zero and says the database cannot be reached with host and database name, and neither the password nor the whole URL appears |
| T15 | R15 | `T15 1 1 1 1 1 1`: `created_at` is `timestamp with time zone`, not null, set by the database close to now, two rows are stored, the columns are exactly `id`, `name`, `created_at`, and the only constraints are the primary key and `workspaces_name_length` |
| T16 | R16 | `T16 1 1 1 1`: building the client on a loopback address where nothing listens does not throw; `select 1` through it rejects; the server started with that address as `DATABASE_URL` stays up; `/healthz` answers 200 |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-005.checks.sh` and the harness | run on a mutated copy (a missing constraint, a `default` removed, a README line removed, the loopback guard removed): the matching rows fail; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-005.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; I run T1 to T11 and T13 to T16; the QA runs T12 | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `b304159`), `trace.sh` | the TOKI-005 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no process, cluster or worktree left |

## What can break (riskiest first)

1. A database row that passes because it measured nothing: every part is a printed number and a case that must fail is paired with one that must pass.
2. The Postgres version: 14 instead of 17. A row whose answer depends on the version is `Blocked` with that note, not guessed; the catalog queries used are the same on both.
3. The cluster left running: the trap stops it and removes the folder, and the last line shows no `postgres` process of the script is alive.
4. T7 depends on the Drizzle migrator's transaction behavior (the spec's concern 11): the row records what happens, whichever it is.
5. T13 runs the whole server test suite several times and takes minutes.
6. A value of a connection string in evidence: the only password is a made-up one in T14 and the check proves it is absent from the output.
