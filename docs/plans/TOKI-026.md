# TOKI-026 Sessions and emergency access (server) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the list of a person's own sessions, ending one or all other sessions, and the `emergency:link` command with the endpoint and the web page that turn its link into a session.

**Architecture:** Everything session-related stays in the `auth` module of `apps/server`. Shared Zod schemas and value lists live in `packages/shared`; the web page follows the pattern of `routes/login.tsx` with a call in `packages/client-core`. The command is a separate entry under `src/cli/` that reads only the config it needs and never reaches the mail module.

**Tech Stack:** Fastify 5, Drizzle 0.45 + Postgres (postgres-js), Zod, pino 10.4.0, Vitest, React + TanStack-style router, Playwright.

**Spec:** `docs/specs/2026-11-17-sessions-emergency-access-design.md` (R1 to R49, concerns 1 to 17). Requirement numbers below are the spec's.

## Global Constraints

- API under `/api/v1`; fields only added; errors use `{ error: { code, message, details? } }`.
- Node 22.x, pnpm 12.21.0 (`export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"`, call `corepack pnpm`); remote is `github`.
- Server tests live in `apps/server/tests/`, never beside the source; `*.db.test.ts` need a loopback `TEST_DATABASE_URL` (in `.env`, which this work never reads or creates; the user runs them in the Terminal panel, CI is the proof otherwise).
- No token, link, hash or address in any log line, error body or stderr line (R36).
- No inline `eslint-disable` (`noInlineConfig`); no new `modules/*` folder.
- Commits: Conventional Commits, lowercase subject, ticket in the footer-free subject `(TOKI-026)`; branch `feat/toki-026-sessions-emergency-access`.
- The 10 minutes is `EMERGENCY_LINK_TTL_SECONDS = 600`; the limit is the 20 requests in 15 minutes of `CODE_IP_REQUESTS_MAX` / `CODE_REQUESTS_WINDOW_SECONDS`.

## Design

Approved by the user on 2026-11-19. The spec decides behaviour; these are the choices where `main` differs from what the spec assumes.

| # | Spec assumes | `main` has | Decision |
|---|---|---|---|
| 1 | Per-area config readers (R22) | `config.ts` imports `modules/mail` at run time; `NODE_ENV` missing is an error; `APP_ORIGIN` path is cut silently | New `src/cli/config.ts` with its own small Zod schema for `DATABASE_URL`, `APP_ORIGIN` (refuses a path, needs `https://` unless `NODE_ENV` is exactly `development`) and `NODE_ENV` (missing or unknown counts as production). It imports nothing from `modules/mail` or from `src/config.ts` |
| 2 | Logger with a destination stream (R19) | No standalone logger | Add `pino` 10.4.0 as a direct dependency of `apps/server`; the command builds `pino(opts, pino.destination(2))` |
| 3 | Narrow entry `modules/auth/cli.ts` (R23) | Rule `toki/module-entry` allows only `index.ts`, and its only option is `modulesDirs` | New option `cliDirs` (absolute folders, set in `eslint.config.js` to `apps/server/src/cli`, schema updated): a file inside one may also import `<module>/cli`, `cli.ts`, `cli.js`. New test file `tools/lint-rules/module-entry.test.mjs`, added to `test:lint-rules`. Update `CLAUDE.md` and `.claude/rules/server.md` |
| 4 | Narrow entries of `members` and `workspace` | Both `index.ts` are mail-free; `Account` has `workspaceId` | Use the existing `index.ts` (`findAccountByEmail`, `getWorkspace`); the import-graph test proves no mail |
| 5 | Handlers know the request's session (R3, R11) | Hook sets only `request.account` | Hook also sets `request.sessionId` |
| 6 | Tests beside the source | Tests in `apps/server/tests/auth/` | Follow the repository |
| 7 | End-to-end against the real server | E2E stubs the API; `webServer` is config-level, so a project cannot start its own servers | A second config `playwright.real-server.config.ts` (`testDir: ./e2e/real-server`, own `webServer`, `globalSetup` that creates and migrates a database, skipped when `TEST_DATABASE_URL` is unset); `testIgnore: "real-server/**"` in the main config; root script `test:e2e:real` |
| 8 | `emergency.rateLimited` with `{minutes}` | i18n picks plural forms only by `count` | Key uses `{count}` with `one` and `other` |

Other choices: R49 adds the route URL to `LIMITED` in `register.ts`; the migration is `0003_emergency_links.sql` from `pnpm db:generate`, with the two cross-module foreign keys written by hand as in `0001`; R48 is a unique partial index (`uniqueIndex(...).on(userId).where(used_at is null and cancelled_at is null)`); `<meta name="referrer" content="no-referrer">` goes into `apps/web/index.html`, so it covers the whole app (`/join` carries a token too).

## AC -> step -> test

| AC (spec) | Task | Test (file :: name) |
|---|---|---|
| R1 to R6 list: fields, live filter, `current`, order, time, codes | 2, 3 | `tests/auth/device-label.test.ts` table; `tests/auth/sessions.list.db.test.ts` |
| R7 to R12 end one: 204, `session_ended` after, 400, 404 identical, `current_session`, idempotent | 3 | `tests/auth/sessions.end-one.db.test.ts` |
| R13 to R15 end all others, listener once with `revoked`, 31-day row untouched | 3 | `tests/auth/sessions.end-all.db.test.ts` |
| R16 guards: 401 without session, `Origin` 403, no `GET` that writes | 3, 5 | `tests/auth/sessions.guards.db.test.ts` |
| R24, R37 constant, schemas, error codes | 1 | `packages/shared/tests/auth/auth.test.ts` |
| R25, R38, R48 table, hash, cancel, unique index, migration names | 4, 5 | `tests/auth/emergency-links.migration.db.test.ts`; `tests/auth/emergency.issue.db.test.ts` |
| R26 to R34 use: 200 + cookie/token, once, 10 minutes, unknown/used/cancelled/expired equal bodies, 43 chars, race, deactivated, rollback, replaced session, `GET` 401, 415, 403 | 5 | `tests/auth/emergency.use.db.test.ts` |
| R35, R36 log lines, no secrets | 5, 6 | `tests/auth/emergency.use.db.test.ts`; `tests/cli/emergency-link.process.db.test.ts` |
| R49 limit per address | 5 | `tests/auth/emergency.limit.db.test.ts` |
| R18 to R23 command: output contract, refusals, exit codes, origin rules, no mail, import graph | 6 | `tests/cli/emergency-link.process.db.test.ts`; `tests/cli/emergency-link.imports.test.ts`; `tests/cli/config.test.ts` |
| R39 `CLAUDE.md` Commands entry | 6 | `tests/cli/emergency-link.imports.test.ts` (checks the entry text exists) |
| R40 to R47 page: route outside guard, fragment removed first, no request on load, one press one request, D-080 question, no token leak, 200/errors/429 states, i18n | 7, 8 | `packages/client-core/src/auth/emergency.test.ts`; `apps/web/tests/routes/emergency.test.tsx`; `packages/i18n` `pnpm i18n:check` |
| End-to-end: print link, open, press, land on Home; no press sends no `POST`; second tab sees invalid | 9 | `e2e/real-server/emergency.spec.ts` |

## Files by task (for the overlap check)

| Task | Files |
|---|---|
| 1 | `packages/shared/src/auth/limits.ts`, `packages/shared/src/auth/devices.ts` (new), `packages/shared/src/auth/emergency.ts` (new), `packages/shared/src/error.ts`, `packages/shared/src/index.ts`, `packages/shared/tests/auth/auth.test.ts` |
| 2 | `apps/server/src/modules/auth/device-label.ts` (new), `apps/server/tests/auth/device-label.test.ts` (new) |
| 3 | `apps/server/src/modules/auth/register.ts`, `routes.ts`, `devices.ts` (new), `apps/server/tests/auth/sessions.*.db.test.ts` (new) |
| 4 | `apps/server/src/modules/auth/schema.ts`, `apps/server/migrations/0003_emergency_links.sql`, `migrations/meta/*`, `apps/server/tests/auth/emergency-links.migration.db.test.ts` |
| 5 | `apps/server/src/modules/auth/emergency.ts` (new), `routes.ts`, `register.ts`, `api.ts`, `apps/server/tests/auth/emergency.*.db.test.ts` |
| 6 | `apps/server/src/cli/config.ts`, `src/cli/emergency-link.ts`, `src/modules/auth/cli.ts` (all new), `apps/server/package.json`, `package.json`, `pnpm-lock.yaml`, `tools/lint-rules/module-entry.js`, `tools/lint-rules/module-entry.test.mjs` (new), `eslint.config.js`, `CLAUDE.md`, `.claude/rules/server.md`, `apps/server/tests/cli/*` |
| 7 | `packages/client-core/src/auth/emergency.ts` (new), `.test.ts`, `src/index.ts`, `packages/i18n/src/messages/{en,vi}/emergency.ts` (new), `{en,vi}/index.ts` |
| 8 | `apps/web/src/routes/emergency.tsx` (new), `router.tsx`, `auth/services.ts`, `apps/web/index.html`, `apps/web/tests/support/auth-harness.tsx`, `apps/web/tests/support/load-app.tsx`, `apps/web/tests/app-providers.test.tsx`, `apps/web/tests/routes/app-layout.test.tsx`, `apps/web/tests/routes/emergency.test.tsx` |
| 9 | `playwright.config.ts`, `playwright.real-server.config.ts` (new), `e2e/real-server/emergency.spec.ts` and a global setup (new), `package.json`, `.github/workflows/ci.yml` (only after the user agrees, Q3) |

Tasks 1 to 3 are the order of dependency for the session routes; 4 then 5 for the link; 6 needs 4 and 5; 7 needs 1; 8 needs 7; 9 needs everything.

---

### Task 1: Shared contracts (R24, R37)

**Files:** see table. **Produces:** `EMERGENCY_LINK_TTL_SECONDS = 600`; `DEVICE_KINDS`, `BROWSERS` (const tuples) and `SessionsResponseSchema`, `SessionItemSchema` in `devices.ts`; `EmergencyBodySchema` (`{ token: string(43, base64url), transport?: "cookie" | "token" }`) and `EmergencyResponseSchema` in `emergency.ts`; `ErrorCodes.currentSession = "current_session"`, `ErrorCodes.emergencyLinkInvalid = "emergency_link_invalid"`.

- [ ] **Step 1: Write failing tests** in `packages/shared/tests/auth/auth.test.ts`: constant equals 600 (a separate assertion; leave the pinned limits array `[6,600,5,5,900,60,20,30]` as it is); the two codes are present, unique and snake_case; `EmergencyBodySchema` accepts a 43-character base64url string, rejects 42, 44 and one containing `+` or `=`; `SessionItemSchema` parses exactly `id, current, deviceKind, browser, lastUsedAt` and `DEVICE_KINDS` is `["desktop","phone","tablet","unknown"]`, `BROWSERS` is `["chrome","edge","safari","firefox","other","unknown"]`.
- [ ] **Step 2: Run** `corepack pnpm exec vitest run packages/shared` — expect FAIL (missing exports).
- [ ] **Step 3: Implement** the exports (token regex `/^[A-Za-z0-9_-]{43}$/`), re-export from `index.ts`.
- [ ] **Step 4: Run** the same command and `corepack pnpm typecheck` — expect PASS.
- [ ] **Step 5: Commit** `feat(shared): add session list and emergency link contracts (TOKI-026)`.

### Task 2: Device label parser (R6, "Device kind and browser")

**Produces:** `deviceLabel(userAgent: string | null | undefined): { deviceKind: DeviceKind; browser: Browser }` in `device-label.ts`, pure, no imports except the shared types.

- [ ] **Step 1: Write the failing table test** `tests/auth/device-label.test.ts` with one invented header each: Chrome and Edge (`Edg/`), Firefox and Safari on a laptop (`desktop`), Safari on iPhone (`phone`, `safari`), Chrome on iOS `CriOS/` (`phone`, `chrome`), Safari on iPad (`tablet`), Chrome on Android with `Mobile` (`phone`) and without (`tablet`), Opera `OPR/` (`other`), an unknown app header (`unknown`, `other`), `undefined`, `null`, `""` (`unknown`, `unknown`); and the rule order (an `Edg/` header that also says `Chrome/` is `edge`).
- [ ] **Step 2: Run** `corepack pnpm exec vitest run apps/server/tests/auth/device-label.test.ts` — FAIL.
- [ ] **Step 3: Implement** the two ordered rule lists of the spec, first match wins.
- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat(auth): turn a user agent into a device kind and browser (TOKI-026)`.

### Task 3: Session list and ending routes (R1 to R16)

**Consumes:** `endSessionsOfUser(client, userId, { reason: "revoked", only })`, `runtime.clock`, `checkSession`. **Produces:** `sessionId?: string` added to the `FastifyRequest` augmentation at `routes.ts:27-30` next to `account`; `listLiveSessions(db, userId, now)`, `endOneSession`, `endOtherSessions` in `devices.ts`; routes `GET /auth/sessions`, `DELETE /auth/sessions/:sessionId`, `DELETE /auth/sessions` registered without the `pub` config.

Notes: `LIMITED` limits only `POST` on `/auth/sessions`, so the new `GET`/`DELETE` on the same URL are not counted. `endSessionsOfUser` ends any row with `ended_at` null, idle or not, and a non-UUID in `only` raises Postgres 22P02, so the handlers validate the id and filter to live rows first. In tests, register the `onSessionsEnded` listener in `beforeAll` and call the function it returns in `afterAll`; build the account for `createSession` as `{ id, workspaceId: h.workspaceId, status: "active" }`.

- [ ] **Step 1: Write failing db tests** (`tests/auth/sessions.list.db.test.ts`, `.end-one.`, `.end-all.`, `.guards.`) using `createHarness`, `h.signIn(email, transport, { headers: { "user-agent": ... } })` and `createSession(h.db, account, "token", { userAgent })`. Cover exactly the cases of the spec's Testing section for R1 to R16: five sessions of one person (cookie, token, one ended, one idle 31 days, one idle exactly 30 days) plus a second person; the list holds three items with only the five fields; `current` true only for the request's session also with a token; order by `lastUsedAt` desc then `id`; `lastUsedAt` of the current item equals `h.clock`; 2,000-character header stored as 512 gives a result; end one: 204, next request with that cookie answers `session_ended`, caller still works, list no longer shows it; not-UUID 400 `validation_failed`, other person's id and unknown id 404 `not_found` with equal bodies and no row changed; own id 400 `current_session`; already ended and idle own session 204 with no new `ended_at` and no listener call; end all: three sessions keep the caller's, others `session_ended`, second request with the caller's cookie passes, none other 204, another person's stay live, the 31-day row keeps `ended_at` null, a fake `onSessionsEnded` listener gets each ended id once with `revoked`; guards: each route 401 without session, `DELETE` with a foreign `Origin` 403 and nothing ended.
- [ ] **Step 2: Run** `corepack pnpm exec vitest run --project server-db apps/server/tests/auth/sessions` (needs `TEST_DATABASE_URL`; the user runs it in the Terminal panel) — FAIL (404 routes).
- [ ] **Step 3: Implement.** In `register.ts` set `request.sessionId = checked.sessionId`. In `devices.ts`: live = `ended_at is null and last_used_at >= now - 30 days`; order `last_used_at desc, id asc`; map rows through `deviceLabel`; end-one validates the UUID with Zod (`400 validation_failed`), loads the person's row by id and user (404 `not_found` otherwise), `400 current_session` when equal to `request.sessionId`, otherwise calls `endSessionsOfUser(db, userId, { reason: "revoked", only: [id] })` only when the row is live (already ended or idle: 204, no call); end-all passes `only` = ids of live sessions other than `request.sessionId`, never `except`.
- [ ] **Step 4: Run** the same command and `corepack pnpm typecheck && corepack pnpm lint` — PASS.
- [ ] **Step 5: Commit** `feat(auth): list sessions and end other sessions (TOKI-026)`.

### Task 4: `emergency_links` table and migration (R25, R38, R48)

**Produces:** `emergencyLinks` in `schema.ts`: `id` uuidv7, `workspace_id`, `user_id`, `token_hash` text with check `emergency_links_token_hash_check` (`~ '^[0-9a-f]{64}$'`) and unique `emergency_links_token_hash_key`, `created_at` (no default), `expires_at` with check `emergency_links_expires_at_check` (`> created_at`), `used_at`, `cancelled_at`, `session_id` (no foreign key), and `uniqueIndex("emergency_links_user_id_open_key").on(userId).where(sql\`used_at is null and cancelled_at is null\`)`.

- [ ] **Step 1: Write failing test** `emergency-links.migration.db.test.ts`: apply on an empty database after the migration of TOKI-019 and find the table, the two checks, the key, the two named foreign keys `emergency_links_user_id_fkey` and `emergency_links_workspace_id_fkey` (`ON DELETE RESTRICT`) and the index by name in `pg_constraint` and `pg_indexes`; no foreign key on `session_id`; an insert with a 63-character hash fails; one with `expires_at = created_at` fails; a second open row for one person fails and succeeds after the first has `used_at` or `cancelled_at` set. Also extend nothing in `account-tables-layout.test.ts` — run it and keep it green (no `now()` default, only allowed imports).
- [ ] **Step 2: Run** the test — FAIL.
- [ ] **Step 3: Implement** the schema, run `corepack pnpm db:generate --name emergency_links` (it writes `0003_emergency_links.sql` and `meta/`), then append by hand, after a `--> statement-breakpoint`, the two `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY ... ON DELETE RESTRICT` lines in the style of `0001_account_tables.sql:87` with a `-- Written by hand` comment.
- [ ] **Step 4: Run** the test, `account-tables-layout.test.ts`, and `corepack pnpm db:generate` again — expect no new file. PASS.
- [ ] **Step 5: Commit** `feat(auth): add the emergency links table (TOKI-026)`.

### Task 5: Issue, use and limit of a link (R19 hash, R24 to R35, R48, R49)

**Consumes:** `sha256`, `newSecret` (`secrets.ts`), `createSession`, `endSessionOfRequest(db, request, "replaced", { only: "cookie" })`, `findAccountByEmail`'s account shape, `sessionCookie`. **Produces:** in `emergency.ts`: `hashLinkToken(token: string): string` (sha256 hex of the 43-character string); `issueEmergencyLink(db: Db, account: { id, workspaceId }, now: Date): Promise<{ token: string; linkId: string; expiresAt: Date } | "concurrent">` typed `Db`, not `DbClient`, so it always opens its own transaction (one transaction: set `cancelled_at = now` on the person's open links, insert the new row). The race is caught around the whole `db.transaction`, because Postgres aborts the transaction after the failed insert: `const e = (err.cause ?? err); e.code === "23505" && e.constraint_name === "emergency_links_user_id_open_key"`, as `first-admin.ts:96-112` does; any other error is rethrown, and the command never prints or logs `err.message` (Drizzle messages carry the statement parameters, including the hash); `useEmergencyLink(db, token, ...)` and the route `POST /auth/emergency-sessions` with `pub`; `LIMITED` gains the route URL. The route is declared in `routes.ts` inside `guarded()` (module-private; a failed query must not log its parameters), reads `request.headers["user-agent"]`, defaults `transport` to `"cookie"` and replies as `routes.ts:108-115` does.

- [ ] **Step 1: Write failing db tests.** `emergency.issue.db.test.ts`: a second link for one member cancels the first (`cancelled_at` set, first answers `emergency_link_invalid`, second signs in); another member's and a used link keep `cancelled_at` null; two `issueEmergencyLink` calls started together give one token and one `"concurrent"`. `emergency.use.db.test.ts`: every case of the spec's "Use (R26 to R34)" bullet — printed link used at once gives 200, a `sessions` row, cookie attributes as in TOKI-022 R21, `GET /auth/session` as the member, transport `token` returns `token` and no cookie; same token again 400 `emergency_link_invalid` and the first session still works; 9 min 59 s accepted and exactly 10 min refused (move `h.clock`); unknown, used, cancelled and expired tokens give equal code and message and change no table; a 43-character string that decodes to the same bytes but differs in the last character gives `emergency_link_invalid`; 42 characters gives `validation_failed` with no statement run (check `h.statements`); two simultaneous requests give one session; deactivated member gives `account_deactivated`, no session, `used_at` set, then `emergency_link_invalid`; `session_id` filled; a failing `createSession` leaves the link unused and the retry works; with a valid cookie the earlier session is `replaced` and a fake listener gets its id once, with only a bearer token it stays live; form-encoded body 415, foreign `Origin` 403, `GET` 401; log has `emergency_link_used` (member id, session id) and `emergency_link_rejected` with reasons `invalid` and `deactivated`, and no token, link, hash or address. `emergency.limit.db.test.ts`: 20 requests from one address are answered by the rule, the 21st gives 429 `rate_limited` with `details.retryAfterSeconds` and `Retry-After`, a valid token in the 21st stays unused and writes no line of R35, after 15 minutes of `h.clock` the token signs in, `POST /auth/codes` does not use this route's count, a second address is not limited.
- [ ] **Step 2: Run** `corepack pnpm exec vitest run --project server-db apps/server/tests/auth/emergency` — FAIL.
- [ ] **Step 3: Implement.** The deactivated check is explicit: after the `UPDATE`, load the account and if `status !== "active"` return a `deactivated` result so the transaction commits with `used_at` set (as `codes.ts:236-275`); do not catch `AccountNotActiveError`, whose throw would roll `used_at` back. The replaced session is ended after the commit with `endSessionOfRequest(db, request, "replaced", { only: "cookie" })`, cookie transport only; with `db` it reports to the listeners itself, so `reportSessionsEnded` is not called. The use is one transaction: `UPDATE emergency_links SET used_at = now WHERE token_hash = $1 AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now RETURNING ...`; no row gives one answer `emergency_link_invalid` and one log reason `invalid` (no second read); load the account, a deactivated one commits `used_at` with no session and answers `account_deactivated`; otherwise `createSession(tx, account, transport, { userAgent })`, write `session_id`, commit; after the commit `endSessionOfRequest(...)` for a cookie session, set the cookie, write the log line. The token is validated with `EmergencyBodySchema` before any database call. Log lines carry ids only. Limit test: pass `remoteAddress` explicitly on every request, because `h.call` otherwise gives each call a new address; reset `h.statements.length = 0` before the 42-character case.
- [ ] **Step 4: Run** the same command plus `corepack pnpm typecheck && corepack pnpm lint` — PASS.
- [ ] **Step 5: Commit** `feat(auth): sign in with an emergency link (TOKI-026)`.

### Task 6: The `emergency:link` command (R18 to R23, R35, R36, R39)

**Consumes:** `issueEmergencyLink`, `findAccountByEmail` (members index), `parseEmail` (shared). **Produces:** `modules/auth/cli.ts` exporting only `issueEmergencyLink`; `src/cli/config.ts` exporting `readCliConfig(env): { databaseUrl, origin, production }` or throwing with variable names only; `src/cli/emergency-link.ts`; script `emergency:link` in `apps/server/package.json` (`tsx --env-file-if-exists=../../.env src/cli/emergency-link.ts`) and in the root `package.json` (`pnpm --filter @toki/server run emergency:link`).

- [ ] **Step 1: Write failing tests.** `tests/cli/config.test.ts`: missing or invalid `DATABASE_URL` or `APP_ORIGIN` throws names only; origin with a path refused; `http://` accepted only with `NODE_ENV=development`; missing, `staging` and misspelt names count as production; an unrelated missing variable (SMTP, first admin) does not matter. `tests/cli/emergency-link.imports.test.ts`: walk the static imports (including `import type`, to be safe) from `src/cli/emergency-link.ts` and find no file under `modules/mail` and no `nodemailer`; `CLAUDE.md` contains `pnpm --silent emergency:link`. `tests/cli/emergency-link.process.db.test.ts` (child process as in `first-admin.process.db.test.ts`, fake env, `createMigratedDb`): Active Member and Admin give exit 0, standard output exactly one line matching `<origin>/emergency#` plus 43 base64url characters, standard error exactly one JSON line `emergency_link_issued` with `operator`, `userId`, `linkId`, `expiresAt` and no address, a row with the 64-character hash and `expires_at` ten minutes later, and no column holds the token; no account, an invited-only address and a Deactivated account give exit 1, empty standard output, no row; no argument, two arguments, malformed and 255-character address give exit 2; missing origin and origin with a path exit 1 naming the variable only; `http://` origin with `production`, `staging`, misspelt and no name exit 1, with `development` exit 0; `https://` with no name exit 0; SMTP unset and a closed SMTP port still prints; a second link cancels the first; two runs for one member started together give one line on standard output in total and the loser's standard error holds one `emergency_link_refused` line with reason `concurrent_issue` and `userId`; no captured output holds a token or an address; the documented form `pnpm --silent emergency:link <email>` gives the same single line.
- [ ] **Step 2: Run** `corepack pnpm exec vitest run apps/server/tests/cli` and `--project server-db` for the process test — FAIL.
- [ ] **Step 3: Implement.** `auth/cli.ts` re-exports `issueEmergencyLink` and `hashLinkToken` only. In `tools/lint-rules/module-entry.js` add the option `cliDirs` (array of strings, in the schema, absolute paths resolved like `modulesDirs`): a file inside one of them may import `<module>/cli`, `cli.ts` or `cli.js` besides the index; set it in `eslint.config.js` to `apps/server/src/cli`. Write `tools/lint-rules/module-entry.test.mjs` in the style of `platform-boundary.test.mjs` (ESLint `lintText` through the real config) with these cases: a file in `src/cli/` importing `auth/cli.ts` passes, importing `auth/sessions` fails, a file in another module importing `auth/cli.ts` fails; append it to `test:lint-rules` in the root `package.json`. The command trims, lower-cases and validates the address with `parseEmail` (exit 2 on failure), reads config, opens the database with `createDb`, finds the account, refuses with `emergency_link_refused` (`no_account` or `deactivated`) and exit 1, otherwise calls `issueEmergencyLink` (`"concurrent"` gives the refusal line `concurrent_issue` and exit 1), prints only the link on standard output, writes the `emergency_link_issued` line to standard error through `pino(opts, pino.destination(2))` with `operator` from `os.userInfo().username`, closes the database. Add `pino` 10.4.0 to `apps/server/package.json` and update the lockfile with `corepack pnpm install`. Update `CLAUDE.md` (Commands block, and the "index.ts only" sentence) and `.claude/rules/server.md`.
- [ ] **Step 4: Run** the same tests, `corepack pnpm test:lint-rules`, `corepack pnpm lint`, `corepack pnpm typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(server): add the emergency link command (TOKI-026)`.

### Task 7: client-core call and i18n keys (R45, R46)

**Produces:** `createEmergencyCalls(api): { signInWithLink(token: string, transport?: "cookie" | "token"): Promise<EmergencyOutcome> }` where `EmergencyOutcome = { kind: "ok"; user } | { kind: "invalid" } | { kind: "deactivated" } | { kind: "rateLimited"; retryAfterSeconds: number } | { kind: "network" } | { kind: "failed" }`; keys `emergency.title`, `description`, `submit`, `switch.question`, `switch.confirm`, `switch.cancel`, `invalid`, `deactivated`, `failed`, `rateLimited` (`one`/`other` with `{count}`), in `en` and `vi` as in the spec's table. `ApiRequest` gains no new method; the call is a `POST` to `/auth/emergency-sessions` with the token only in the body.

- [ ] **Step 1: Write failing tests** `packages/client-core/src/auth/emergency.test.ts` (`vi.fn<ApiRequest>()`): 200 with a valid `user` is `ok`; a 200 that fails the schema is `failed`; `emergency_link_invalid` and `validation_failed` are `invalid`; `account_deactivated` is `deactivated`; `rate_limited` with `details.retryAfterSeconds: 61` is `rateLimited` with 61; network and timeout are `network`; the request path, method and body hold the token only in the body.
- [ ] **Step 2: Run** `corepack pnpm exec vitest run packages/client-core` — FAIL.
- [ ] **Step 3: Implement** the call and the i18n files; register the namespace in `en/index.ts` and `vi/index.ts`; export from `client-core/src/index.ts`.
- [ ] **Step 4: Run** the test, `corepack pnpm i18n:check` and `corepack pnpm typecheck` — PASS.
- [ ] **Step 5: Commit** `feat(client-core): add the emergency link call and its texts (TOKI-026)`.

### Task 8: The `/emergency` page (R40 to R47)

**Consumes:** `createEmergencyCalls`, `markSignedIn`, `useSession`, `SignInCard`, `Button`, `ConfirmDialog` of `@toki/ui-web`. **Produces:** `emergencyRoute` (`path: "/emergency"`, child of `rootRoute`, `staticData: { public: true }`); `AuthServices.emergency` and its fake in `tests/support/auth-harness.tsx`; a token reader `readFragmentToken(win: { location: { hash: string; pathname: string; search: string }; history: { replaceState: ... } })` so tests can drive it.

- [ ] **Step 1: Write failing tests** `apps/web/tests/routes/emergency.test.tsx` (jsdom, `loadApp` with `path: "/emergency"`): reached with a session and with none and never redirected to `/login`, also when the session read answers 401 `account_deactivated` (treated as none, no modal); the fragment is gone from `location.href` and `history` before the first request (assert the replace call happened before the fake was called); no request on load, none for a missing or malformed fragment (shows the invalid state); one request per press and a second press while it runs sends nothing; with a session the question of R43 shows, a refusal sends nothing, a confirmation sends with the cookie transport; the token appears in no request URL, header, storage, console call or captured error report; 200 calls `markSignedIn(user)` and navigates to `/` with `replace`; the states of `invalid`, `deactivated`, network failure (can press again) and `rateLimited` (shows the minutes rounded up from `retryAfterSeconds`, keeps the token, a later press sends one request); the page makes no request to another origin.
- [ ] **Step 2: Run** `corepack pnpm exec vitest run apps/web/tests/routes/emergency.test.tsx` — FAIL.
- [ ] **Step 3: Implement** the route and component following `routes/login.tsx`; remove the fragment with `history.replaceState(history.state, "", pathname + search)` so the router's history state survives; make `emergency` a required field of `AuthServices` and update the three places that build it (`tests/support/load-app.tsx`, `tests/app-providers.test.tsx`, `tests/routes/app-layout.test.tsx`); tests set the hash with `window.history.replaceState(null, "", "/emergency#<token>")` before `mount()`;  (`useTranslation`, `getAuthServices()`), add the route to `router.tsx`, add the fake to `createFakeCalls`, add `<meta name="referrer" content="no-referrer">` to `apps/web/index.html`; the token lives in a `useRef` only and is cleared after a final answer.
- [ ] **Step 4: Run** the web tests, `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm size` — PASS.
- [ ] **Step 5: Commit** `feat(web): add the emergency link page (TOKI-026)`.

### Task 9: End-to-end against the real server

**Produces:** `playwright.real-server.config.ts` (`testDir: "./e2e/real-server"`) with its own `webServer` entries (the server with `DATABASE_URL` set to a throwaway database, `NODE_ENV=development`, `APP_ORIGIN=http://127.0.0.1:<web port>`; vite pointing at that server), a `globalSetup` that creates and migrates the database from `TEST_DATABASE_URL`, and a skip when the variable is unset; `testIgnore: "real-server/**"` in `playwright.config.ts`; root script `test:e2e:real`; spec `e2e/real-server/emergency.spec.ts`. CI: the `e2e` job has no Postgres and no `TEST_DATABASE_URL`; running this spec there needs the service and a step in `ci.yml`, which is changed only after the user agrees (Q3), otherwise the spec is documented as local-only.

- [ ] **Step 1: Write the failing spec:** create a member in the database, print a link with `pnpm --silent emergency:link`, open it, press the button, land on Home as the member; open a link and make no press and assert no `POST` to `/auth/emergency-sessions` was sent and the link still works afterwards; open the page in a second tab after the first used it and see the link as not valid.
- [ ] **Step 2: Run** `corepack pnpm test:e2e:real` (user's Terminal panel; needs `TEST_DATABASE_URL`) — FAIL.
- [ ] **Step 3: Implement** the project in `playwright.config.ts` and its setup helper; keep the existing projects unchanged.
- [ ] **Step 4: Run** `corepack pnpm test:e2e:real` and `corepack pnpm test:e2e` — PASS.
- [ ] **Step 5: Commit** `test(e2e): cover the emergency link against the real server (TOKI-026)`.

---

## Risks and the riskiest step

- **Riskiest: Task 5.** The one-`UPDATE` rule, the Deactivated path that commits `used_at` with no session, and the `replaced` session after the commit must hold at the same time. Mitigation: the use tests list every case, and the race and rollback cases run against the real Postgres.
- **Task 6** edits shared tooling (`module-entry` rule, `CLAUDE.md`, lockfile). Mitigation: a rule test case that shows `src/cli/` may import `cli.ts` and that a module still may not.
- **Task 8:** `location.hash` and `history.replaceState` are not the memory router's, and in the real app `replaceState(null, ...)` would wipe TanStack's history state. Mitigation: the reader takes its window as an argument and passes `history.state` through.
- **Local verification:** `.db.test.ts` and the real-server e2e need `TEST_DATABASE_URL`; the user runs them in the Terminal panel, otherwise CI is the proof.
- **Out of scope:** the screens of TOKI-099, the Admin "last active" column, the production image and runbook (TOKI-084, TOKI-087).
