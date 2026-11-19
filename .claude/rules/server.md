---
paths:
  - "apps/server/**"
---

# Server rules

Each statement is followed by its source. Rules of this project come first; rules of the tool are kept apart in "External standard".

## This project

- Configuration is read and checked once, in one module. `process.env` is read nowhere else in `apps/server/src`.
  Source: `docs/specs/2026-11-12-server-skeleton-design.md`, R2.
- `buildApp` receives the config; a module never imports it, it receives it from the app.
  Source: server-skeleton spec, R16.
- Every error response has a body that passes the one error schema of `packages/shared`: `{ "error": { "code", "message", "details"? } }`.
  Source: server-skeleton spec, R8.
- An unexpected error answers 500 with code `internal_error`, a fixed English message and no stack trace; the error and its stack go to the log.
  Source: server-skeleton spec, R9.
- Every route is registered under `/api/v1`; the only path outside it is `/healthz`.
  Source: server-skeleton spec, R5 and R10.
- A module lives in `apps/server/src/modules/<name>/`, and its only public entry is `index.ts`. Another module or a file outside `modules/` imports that file and nothing else of it.
  Source: server-skeleton spec, R17; lint rule `toki/module-entry` in `eslint.config.js`.
- The server does not translate the `message` of an error body.
  Source: server-skeleton spec, R12.
- The server's own logger writes one JSON object per line to standard output; a startup failure goes to standard error.
  Source: server-skeleton spec, R6.
- `pnpm db:generate` creates a migration from a change to the table definitions in `apps/server/src/modules/*/schema.ts`. Commit the whole `apps/server/migrations/` folder (the SQL file and `meta/`); never edit it by hand.
  Source: `apps/server/src/db/README.md`; `.prettierignore`.
- `pnpm db:migrate` applies every pending migration to the database in `DATABASE_URL` (it reads the root `.env` when it exists). It needs the services up in development.
  Source: `apps/server/src/db/README.md`; `apps/server/package.json`.

## External standard

- A route plugin stays encapsulated. Wrapping a plugin with `fastify-plugin` makes what it registers visible to the parent, so wrap only what other plugins must share. (The page's examples use decorators; the database connection is this project's example of such a thing.)
  Source: [Fastify, Encapsulation](https://fastify.dev/docs/latest/Reference/Encapsulation/).
- Details of a validation error are in the response by default; the error handler (`setErrorHandler`) decides what to expose.
  Source: [Fastify, Validation and Serialization](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/).
- Store a moment in time as `timestamptz`, not `timestamp`; store text as `text`, not `varchar(n)`, unless a length limit is a real rule.
  Source: [PostgreSQL wiki, Don't Do This](https://wiki.postgresql.org/wiki/Don't_Do_This).
