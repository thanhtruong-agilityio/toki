---
noteId: "5b49e520e27011f19e6a4905cb6cf940"
tags: []

---

# TOKI-005 Database connection, migrations and the workspaces table

Spec: docs/specs/2026-11-12-database-migrations-design.md
Intent: docs/intents/database-migrations.md

## Design
Approved by Thanh, 2026-11-17. Technical design only; the requirements stay in the spec (R1 to R16).

### Choices that settle concerns 3 and 11
- Postgres driver: `postgres` (postgres.js) with `drizzle-orm/postgres-js`. It connects on the first query, so building the client with Postgres down does not throw (R1, R16).
- UUIDv7 generator: the `uuidv7` package (small, no dependencies). `workspaces.id` uses `.$defaultFn(() => uuidv7())`, so the id is made in the server (R8). TOKI-019 reuses it.
- Concern 11: the R7 test is written first. It applies a folder with one valid and one broken migration to a throwaway database and checks: non-zero exit, Postgres error text in the output, and the valid migration's table absent. If the stock migrator is not atomic, R7's state check is changed to match what the run shows, and the PR says so.

### Table
`apps/server/src/modules/workspace/schema.ts`, not exported from the module's `index.ts`:
- `id` uuid, primary key, default UUIDv7.
- `name` text, not null, CHECK `char_length(name) between 1 and 100`.
- `created_at` timestamptz, not null, default `now()`.
No other column, no row inserted.

### Files
- `apps/server/drizzle.config.ts`: schema glob `src/modules/*/schema.ts`, output `migrations/`.
- `apps/server/migrations/`: generated SQL and `meta/`, committed whole.
- `apps/server/src/db/client.ts`: `createDb(url)`; reads no environment.
- `apps/server/src/db/migrate.ts`: `runMigrations(url, folder)` plus the command entry; the entry reads the value through the TOKI-004 `config.ts` function that checks only `DATABASE_URL`. Prints only the variable name when it is missing and only host and database name when Postgres is unreachable (R14).
- `apps/server/src/db/README.md`: steps to add a table and the forward-only rollback rule (R11).
- `apps/server/src/config.ts` (TOKI-004): `DATABASE_URL` required, plus the single-variable check (R2).
- Root `package.json`: `db:generate`, `db:migrate`; `dev:reset:db` (TOKI-003) gains the migrate step (R12).

### Testing
Test first. Vitest integration tests; each file makes its own throwaway database on the server of `TEST_DATABASE_URL`, refuses a non-loopback host before any statement, and drops it with `DROP DATABASE ... WITH (FORCE)` (R13). Only the R1 test reads `DATABASE_URL`, read-only. R2, R3, R6, R11, R12, R14 and the by-hand part of R16 are checked by hand and the output goes in the PR.

### Prerequisites and risks
- TOKI-003 (Compose, `dev:reset:db`) and TOKI-004 (`config.ts`, Vitest setup) are not on `main` of this checkout; the build cannot start before they are available.
- Issue 103 carries the `Blocked` label until concerns 3 and 11 are recorded as decided in the spec on `main`.
- The `uuidv7` and `postgres` versions are pinned when added and named in the PR.

## Build notes
- Prerequisites now met: TOKI-003 and TOKI-004 are on `main`. TOKI-004's `config.ts` already holds the `database` area, so R2 needed no change there; `db:migrate` reads it with `loadProcessConfig(["database"])`.
- Concern 11 result (test R7, run first): the stock migrator applied nothing from a folder with one valid and one broken migration, so the run is atomic; the error text carries the Postgres message (the bad type name) but not the file name. R7 stands as written.
- Entry of `db:migrate` is `src/db/migrate-cli.ts` (not `migrate.ts`) so importing `runMigrations` in a test starts nothing.
- `apps/server/tsconfig.json` gets `skipLibCheck`: the declaration files of drizzle-orm for the dialects we do not use fail the type check otherwise. `apps/server/migrations/` is in `.prettierignore` (written by Drizzle Kit).
- `db:migrate` uses `--env-file-if-exists`, so it also runs where the values are in the environment and there is no `.env` (the deploy step).
- `apps/server/vitest.config.ts` loads the root `.env` when present, so `pnpm test` finds `DATABASE_URL` and `TEST_DATABASE_URL`.
- `scripts/smoke.test.sh` counts the marker table instead of every table, because `dev:reset:db` now leaves the migrated tables.
- Not done in this change: the server does not build a client in `main.ts`, because no route reads the database yet (R16 is checked on `createDb`).
