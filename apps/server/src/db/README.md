# Database

Drizzle on Postgres. The server builds its client once at startup with
`createDb(url)` from `client.ts`; the connection opens on the first query, so an
unreachable Postgres does not stop the server from starting.

## Add a table

1. Edit or add the table definition in `schema.ts` inside its own module
   (`src/modules/<module>/schema.ts`). Do not export it from the module's
   `index.ts`: other modules reach the data through the module's interface.
2. Create the migration from the root: `pnpm db:generate`.
3. Apply it to the development database: `pnpm db:migrate` (needs `.env` with
   `DATABASE_URL`, and `pnpm dev:up` running).
4. Commit the whole `apps/server/migrations/` folder: the SQL file and the
   `meta/` files. Without `meta/` the migrator skips the new SQL file and the
   next `pnpm db:generate` compares against a stale snapshot.

Every table carries a UUIDv7 `id` made in the server: use
`.$defaultFn(() => uuidv7())` from the `uuidv7` package, as `workspaces` does.
Other tables point to `workspaces.id`.

## Table conventions

The rules every server table follows (TOKI-019). A ticket that needs another
rule says so in its own spec.

1. **Ids.** `uuid`, primary key, UUIDv7 made in the server by
   `.$defaultFn(() => uuidv7())`. A table that only joins two others may use
   the pair of keys as its primary key. Every table has a required
   `workspace_id` that points to `workspaces.id`.
2. **Names.** Tables are plural `snake_case` nouns; columns are `snake_case`;
   a reference is `<singular>_id`; a time is `<event>_at`; a flag that is a
   time (used, cancelled, ended) is a nullable `<event>_at`, never a boolean.
   Drizzle properties are `camelCase`, mapped by explicit column name.
   Constraints and indexes are named `<table>_<column or purpose>_<kind>`,
   where kind is `pkey`, `check`, `key`, `fkey` or `idx`; pass every name
   explicitly (Drizzle's default for a unique is `_unique`, not `_key`).
3. **Time.** `timestamptz`, written by the server from the clock (TOKI-008),
   so tests can move it. A new table gives no time column a database default.
   The one exception is `workspaces.created_at`, which keeps the default of
   TOKI-005.
4. **Closed lists of values.** `text` with a named check constraint, not a
   Postgres enum: adding a value is a one-line migration.
5. **Soft deactivation.** An account is never deleted and a session is ended,
   not deleted: use `users.status` and `sessions.ended_at`. No foreign key
   cascades a delete. Old `sign_in` rows of `login_codes` and the `devices`
   row of an ended session are removed by the tickets that own them. Phase 1
   has no erasure of an account and no pruning of ended sessions.
6. **Foreign keys.** `ON DELETE RESTRICT`. A key that crosses a module
   boundary is written as SQL in the migration, because a schema file may not
   import another module's table. Every key of the account tables crosses a
   boundary, so none is declared in Drizzle.
7. **Hashes.** 64 lower-case hexadecimal characters of a SHA-256 or an
   HMAC-SHA-256, in a `text` column with a check.
8. **Migrations.** One migration per ticket that changes the structure, made
   with `pnpm db:generate --name <slug>` (lower case, underscores), so the
   file is `<number>_<slug>.sql`; forward-only. Two branches that each add a
   migration both take the next number: the one that merges second runs
   `db:generate` again after rebasing.

### The foreign keys of the account tables

`drizzle-kit generate` compares the TypeScript schema with the last snapshot
and never reads the SQL files, so these keys, which the schema does not
declare, do not make it write a new file. A migration that is regenerated
(rule 8) loses them: append this block again, each statement after its own
`--> statement-breakpoint` line, before the migration is applied anywhere. The
test of `pg_constraint` in `account-tables.db.test.ts` fails when one is
missing. Never use `drizzle-kit push`: it sees these keys as drift. If the
file was already applied to the development database, run `pnpm dev:reset:db`.

```sql
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "devices" ADD CONSTRAINT "devices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "devices" ADD CONSTRAINT "devices_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT;
```

## Rollback

Migrations are forward-only: no down migration is generated. Every migration
must stay compatible with the image of the previous release, so a rollback is
redeploying the previous image tag, and it does not depend on a database backup
(backup is deferred, D-092). A mistake in a migration is fixed by a new
migration. In development, `pnpm dev:reset:db` wipes the database and applies
all migrations again.

## Tests

Tests that create tables or insert rows run on a throwaway database that
`src/test/throwaway-db.ts` makes on the server of `TEST_DATABASE_URL` and drops
when done. It refuses a host that is not loopback. Only the connection test
reads `DATABASE_URL`, and it writes nothing.
