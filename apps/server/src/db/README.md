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
