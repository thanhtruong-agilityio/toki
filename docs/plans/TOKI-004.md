# TOKI-004 Server skeleton

Spec: docs/specs/2026-11-12-server-skeleton-design.md
Intent: docs/intents/server-skeleton.md

## Design
Approved by Thanh, 2026-11-17. Technical design only; the requirements stay in the spec (R1 to R20).

### Stack
Fastify, Zod, `tsx` (runs `dev` and the process test from source), Vitest. Exact versions are pinned in `apps/server/package.json`.

### Files
- `packages/shared/src/error.ts`: `ErrorResponseSchema` (Zod), the registry of the six codes, the type from `z.infer`. `code` is typed as a string (concern 14).
- `apps/server/src/config.ts`: the only reader of `process.env`. `loadConfig(env, areas)` with two areas, `server` (`NODE_ENV`, `SERVER_PORT`, `SERVER_HOST`, `LOG_LEVEL`) and `database` (`DATABASE_URL`). Names come from `docs/environment-config.md`. A failure lists names only, never values (R3, R4).
- `apps/server/src/errors.ts`: `AppError`, the one error handler, the not-found handler, `frameworkErrors` and `clientErrorHandler` (R8, R9).
- `apps/server/src/app.ts`: `buildApp({ config, logStream?, registerRoutes? })`; built-in request logging off, one completion line per request from an `onResponse` hook (R7, R16).
- `apps/server/src/health.ts`: `GET /healthz`, no database call (R5, R20).
- `apps/server/src/api/index.ts`: the `/api/v1` scope, where `registerRoutes` runs (R10).
- `apps/server/src/main.ts`: load config, build, listen, SIGTERM and SIGINT call `app.close()` then exit 0 (R1, R15).
- `apps/server/src/modules/`: folder only (R17). The placeholder `src/index.ts` is removed.
- `apps/server/package.json`: `dev` (`tsx watch --env-file=../../.env src/main.ts`) and `test` (`vitest run`); no `build` or `start`.
- Root `package.json`: `test` runs the `test` script of every project that has one (approved 2026-11-17; R11 names the root `test` script and `main` has none).

### Choices
- `DATABASE_URL` is required at startup, because the server loads both areas; the server never connects to Postgres in this ticket (R19, R20).
- Request ids come from `randomUUID`.
- Requests are validated by the route with Zod; the handler maps `ZodError` and Fastify validation errors to `validation_failed` with `details.issues` (path and code only). No type-provider package.

### Testing
Test first. Config, error, log and route-list tests use `buildApp` with `inject()`. One process test starts `main.ts` with `node --import tsx` and a fake environment, not through pnpm (R1, R3, R4, R5, R6, R8, R15, R20). Fake values only.
