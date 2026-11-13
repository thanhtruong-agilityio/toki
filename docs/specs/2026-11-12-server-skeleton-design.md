# Server skeleton design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/server-skeleton.md (Thanh Truong)
Ticket: TOKI-004

## Goal
The builder needs one basic Toki server that all later server work builds on. It settles in one place how the server reads configuration, logs, reports errors and where its API addresses live. Without it, TOKI-005 and later tickets cannot start, and each would decide these things for itself.

## Scope
- In: the Fastify app in `apps/server`; reading and checking configuration at startup; `GET /healthz`; structured logs; one error handler for every error response; the `/api/v1` prefix for all API routes; the error response schema in `packages/shared`; the `dev` script of `apps/server` (the development start command for the server); a minimal Vitest setup in `apps/server`; tests for the above.
- Out (not now):
  - Monorepo, packages and shared TypeScript config, and the root `pnpm dev` script: TOKI-001. This ticket does not edit the root script.
  - The inventory of environment variables, `.env.example` and how secrets are kept: TOKI-096. This spec only reads the values, under exactly the names in that inventory.
  - ESLint, Prettier and the boundary rules: TOKI-002.
  - Postgres, MinIO and Mailpit for development, and the `dev:*` scripts: TOKI-003.
  - Postgres connection, Drizzle, migrations and any table: TOKI-005.
  - Web skeleton and the dev proxy to the server: TOKI-006.
  - CI: TOKI-007. Test harness (real Postgres, Playwright, controllable clock): TOKI-008.
  - Sending mail: TOKI-021. Background job queue and worker: TOKI-064. Production image and Compose: TOKI-084.
  - WebSocket, sign-in, creating the first admin and workspace, and any business route: later tickets. The intent does not ask for them.

## Requirements
- R1. With a valid `.env`, the `dev` script of `apps/server` starts the server and the log shows one line with the address it listens on.
- R2. Configuration is read and checked once, at startup, in one module. A search for `process.env` in `apps/server/src` finds it in that module only.
- R3. When a required variable is missing, the server does not start: the process exits with a non-zero code and prints the name of the missing variable.
- R4. When a variable is present but fails its check, the server does not start: the process exits with a non-zero code and prints the name of the variable, never its value.
- R5. `GET /healthz` returns status 200 while the server is running.
- R6. Every log line written to standard output parses as one JSON object.
- R7. Each handled request writes one log line that holds the method, the path and the response status.
- R8. An unknown path, a request that fails validation and an error thrown in a route all return a body that passes the same single error schema from `packages/shared`: `{ "error": { "code": "<stable string>", "message": "<English text for developers>", "details": <optional> } }`. One test checks the three cases against that schema.
- R9. A response for an unexpected error has status 500 and its body holds no stack trace and no internal error message. The details go to the log.
- R10. A route registered through the API module answers under `/api/v1/` and returns 404 at the same path without the prefix.
- R11. The server tests run with one command from `apps/server`, need no database and no network, and pass.
- R12. The server does not translate the `message` of an error body: the same failing request sent with `Accept-Language: vi` and with `Accept-Language: en` returns the same `code` and the same English `message`.
- R13. Every variable name that the configuration module reads is a name in the TOKI-096 inventory; the module reads no other name.
- R14. `apps/server` has a `dev` script, and this ticket leaves the root `dev` script from TOKI-001 unchanged; root `pnpm dev` starts the server through the `apps/server` script.

## Design
### API
| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Says the server process is up. Assumption: it sits at the root, outside `/api/v1` (concern 3). |
| any | `/api/v1/*` | Prefix for all API routes. This ticket adds no business route. Within a version, fields are only added. |

### Errors
- Required variable missing at startup -> the server does not start and prints the variable name (Blueprint, flow F01 note).
- Variable present but invalid at startup -> same behaviour. Assumption: the Blueprint states only the missing case.
- Unknown path -> 404 in the one error format.
- Request fails validation -> Assumption: 400 in the one error format.
- Unexpected error -> 500 in the one error format, with no internal detail in the body.
- The one error format is `{ "error": { "code": "<stable string>", "message": "<English text for developers>", "details": <optional> } }` (concern 1). The HTTP status carries the class of error. The client translates to Vietnamese or English from `code`; the server does not translate `message`. Each ticket that introduces a new error adds its `code`.
- All error bodies are built in one handler, so the format is set in one place. The schema lives in `packages/shared`.

### Layout
Assumption: file names below are a proposal; the Blueprint fixes only `apps/server` and `packages/shared`.
```
apps/server/src/
├─ main.ts          load config, build the app, listen
├─ app.ts           build the Fastify app (used by main and by tests)
├─ config.ts        the only reader of process.env; schema and typed config
├─ errors.ts        the one error handler and the not-found handler
├─ health.ts        GET /healthz
└─ api/index.ts     registers every API route under /api/v1
packages/shared/    the error response schema (data contracts live here)
```
- Stack from the Blueprint: Fastify, Node 22, TypeScript. No version beyond these is fixed here.
- Assumption: the configuration schema is written with Zod, which is in the Blueprint stack; the Blueprint does not say which tool checks the environment.
- The names of the variables that `config.ts` checks, which are required, and their defaults come from the TOKI-096 inventory, which is done first; this ticket invents no name (concern 2).
- `apps/server` gets its own `dev` script. The root `pnpm dev` script is made by TOKI-001 and runs the `dev` script of every workspace project that has one, so it picks this one up; this ticket does not edit the root script (concern 5).
- Later modules of the modular monolith register their routes through `api/index.ts`, so none can leave the prefix.

## Testing
- Tests are written first. They build the app with `app.ts` and send requests in memory; no port, no database, no network.
- Config tests pass fake environment objects: all valid, one required value missing, one value invalid.
- Error tests use a route that exists only in the test and throws, plus an unknown path and an invalid request.
- This ticket adds a minimal Vitest setup in `apps/server`. TOKI-008 later extends it into the full harness (concern 6).
- Fake values only. No real secret appears in a test or a fixture.

## Data safety
- Secrets come from `.env`, which is never in git. This ticket adds no value to any committed file.
- A startup failure prints variable names only, never values.
- Error bodies sent to clients hold no stack trace, no file path and no configuration value.
- Which request fields the logs must hide is not decided (concern 4).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Part of Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; no design impact. Scope names the neighbouring tickets so the work does not overlap. |
| Milestone M1: Foundation and design system. Size M (about one working session with Claude) | Planning fact. Scope is kept to the five outcomes of the intent so it fits size M. |
| Needs TOKI-001 (monorepo and TypeScript) and TOKI-096 (configuration for each environment) | Scope: the code lands in `apps/server` made by TOKI-001; R2 and R13 read the values listed by TOKI-096, which is done first, under exactly its names (concern 2). |
| Needed by TOKI-005, TOKI-021 and TOKI-084; through TOKI-005, TOKI-008 also depends on it | Planning fact. Layout gives them fixed places to extend: `config.ts`, `api/index.ts`, `app.ts`. |
| The server is built with Fastify on Node 22 and TypeScript, as a modular monolith | Layout: Fastify app in `apps/server`; one route entry point for later modules. |
| The API prefix is `/api/v1`. Within a version, fields are only added | R10 and the API table. The add-only rule applies to the error format too (R8, concern 1). |
| The health check address is `/healthz` | R5 and the API table. |
| The configuration values come from the inventory made in TOKI-096. Secrets live in `.env`, never in git | R2, R3, R4, R13 and Data safety. |
| M1 exit check that this ticket supports: `pnpm dev` runs and CI is green | R1, R14 and R11. TOKI-001 owns the root `pnpm dev` script and this ticket adds the `apps/server` `dev` script it runs (concern 5); CI itself is TOKI-007. |

## Open questions from the intent
- What is the error format returned to clients? Answered: a JSON body `{ "error": { "code", "message", "details" (optional) } }`, with the HTTP status carrying the class of error; `message` is English and is not translated by the server. See concern 1.

## Areas of concern
1. The error format returned to clients is not decided, so R8 cannot name its fields and `packages/shared` cannot hold the final schema. Decided: the body is `{ "error": { "code": "<stable string>", "message": "<English text for developers>", "details": <optional> } }`. The HTTP status carries the class of error. The client translates to Vietnamese or English from `code`; the server does not translate `message`. Each ticket that introduces a new error adds its `code`. The schema lives in `packages/shared`. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
2. The TOKI-096 inventory does not exist yet, so this spec cannot name the variables the server checks (for example the port and the environment name), which are required, or their defaults. The build of this ticket waits for that list. Decided: TOKI-096 is done first and names every phase 1 variable; the names, the required flags and the defaults come from the TOKI-096 inventory, and TOKI-004 uses exactly those names and invents none. TOKI-004 already needs TOKI-096, so the ticket order does not change. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
3. The intent says all API addresses sit under `/api/v1` and also that the health address is `/healthz`. This spec assumes `/healthz` is at the root and is the only route outside the prefix. Its response body is also not stated, and neither is whether it should later report the database state once TOKI-005 lands. Owner: Thanh Truong.
4. "Structured logs" is not defined in the intent or the Blueprint. This spec assumes JSON lines on standard output. Not decided: the log level per environment, a request id on each line, and which fields must be hidden (codes, tokens, email addresses). Owner: Thanh Truong.
5. The Blueprint does not say which ticket owns the root `pnpm dev` script. TOKI-001, TOKI-003, TOKI-004 and TOKI-006 all touch it. Decided: TOKI-001 creates the root `dev` script, which runs the `dev` script of every workspace project that has one. TOKI-004 adds only the `apps/server` `dev` script and does not edit the root script; root `pnpm dev` from TOKI-001 picks it up. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
6. Backend work is test-first, but the test harness is TOKI-008, which comes after this ticket. Decided: TOKI-004 adds a minimal Vitest setup, and TOKI-008 extends it. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
7. The status for a request that fails validation (400 assumed) and the behaviour for a variable that is present but invalid (R4) are assumptions; the Blueprint states only the missing-variable case. Owner: Thanh Truong.
