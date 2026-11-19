# TOKI-022 Sign-in API: plan

Ticket: TOKI-022 (issue 18) · Tier L · Branch `feat/toki-022-sign-in-api`
Spec (source of truth, accepted in PR 156): `docs/specs/2026-11-16-sign-in-api-design.md`. Requirement numbers `R1`..`R57` below are the spec's.

## Design

The approved design is the spec. In short:

- Everything of this ticket lives in `apps/server/src/modules/auth/` (`index.ts`, `routes.ts`, `codes.ts`, `sessions.ts`, `guards.ts`, `secrets.ts`, tests) and `packages/shared/src/auth/` (`limits.ts`, `schemas.ts`), as in the spec's Layout. `auth` owns `login_codes` and `sessions`; it never queries `users` or `workspaces`.
- Three small read functions are added where the spec says (R55, Module boundaries): in `members` "find the account of an email address" and "get an account by id", in `workspace` "get the one workspace (id and name)". Each takes `client` first (database or transaction).
- One hook on every `/api/v1` request runs, in this order: the rate limit of R56 (only on the two public POST routes), the `Origin` rule (R46), the JSON-only rule (R45), then the session check, which reads `config: { public: true }` from the matched route (R24, R44).
- A code is an HMAC-SHA-256 of the `requestId` and the 6 digits keyed with a server secret; the `requestId` and the session secret are 32 random bytes, stored as plain SHA-256 (R23, R40).
- An exchange is decided by one conditional `UPDATE` on `login_codes` (`wrong_tries < 5`); marking the code used and inserting the session are one transaction (R17, R43).
- Every `auth` function that writes takes `client` (database or open transaction), opens its own transaction only when given the database, and reports ended sessions after the commit (R50, R53).
- Times come from the `Clock` of TOKI-008, injected into the app; no database default writes a time.
- The network-address counter of R56 is an in-memory map per route and address, fed by the same `Clock`.
- Cookies are read and written by a small helper in `sessions.ts` (name, attributes of R21, `Max-Age` renewal of R26); no cookie plugin is added.

## Dependencies on other tickets (found while exploring)

| Need | State on `main` | What this plan does |
|---|---|---|
| Tables `users`, `login_codes`, `sessions` | Merged (TOKI-019) | Used as they are; no migration |
| `Clock`, `TestClock` | Merged (`packages/shared/src/clock`) | Injected into `buildApp` |
| Error body and registry | Merged (`apps/server/src/errors.ts`, `packages/shared/src/error.ts`) | Add the codes of R54 |
| `parseEmail` (TOKI-020 R16, `packages/shared/src/email.ts`) | Not built; TOKI-020 is Ready for Dev | Build it exactly as TOKI-020 R16 writes it (spec R7); TOKI-020 then finds it present |
| `app.mail.sendSignInMail` (TOKI-021 R6) | Merged (PR 159): `app.mail`, the `mail` option of `buildApp`, `src/tests/fake-mail.ts` | Call `app.mail.sendSignInMail`; tests pass the fake through the `mail` option. No decorator is declared here |
| New environment values (concern 7) | Not in `config.ts` | Add one area `auth` with the code-hash secret and the app origin, and the rows in `docs/environment-config.md`; names are proposals for TOKI-096 |

## AC to step to test

Test files are in `apps/server/src/modules/auth/` unless the path says otherwise.

| Req | Step | Test |
|---|---|---|
| R38 (constants, schemas, `User` not strict) | S1 | `packages/shared/src/auth/auth.test.ts`: the eight constants exist with the spec's values; each schema parses the shapes of the API table; `User` accepts an added field |
| R54 | S1 | same file: the registry holds the 11 codes (10 added, `unsupported_media_type` reused) |
| R7 (`parseEmail`, 254) | S1 | `packages/shared/src/email.test.ts`: trim, lower case, malformed, 254 and 255 characters |
| R3, R23, R40 helpers | S2 | `secrets.test.ts`: 6 digits with leading zeros kept, length of `requestId` is 43, SHA-256 and HMAC known vectors |
| R45, R46 | S3 | `guards.test.ts` (built with `buildApp` and a test route): form and `text/plain` body 415; no-body request passes; foreign `Origin` on POST, DELETE, PATCH, PUT 403; no `Origin` passes; no `Access-Control-` header |
| R1 to R9, R40 to R42, R47, R48 | S5 | `codes.request.db.test.ts`: statuses and fields for member, deactivated, unknown, no-`users`-row address; one mail only for Active or Deactivated; limit at the 6th and at exactly 15 minutes; 59 and 60 seconds; cancel of the earlier code; failing and never-answering mail layer; `retryAfterSeconds` rounding and `Retry-After`; both limits, `code_request_limit` wins; no digits or `requestId` in any column; same statements for a non-member; invitation row untouched; old rows pruned, at most 100 |
| R56 | S5 | `rate-limit.test.ts`: 20th accepted, 21st 429 with header, counters per route and per address, refused requests not counted, a malformed body counts, reopen at 15 minutes of the test clock, spoofed `X-Forwarded-For` ignored without the proxy, answer first over R4 and R5 |
| R10 to R20, R43 | S6 | `codes.exchange.db.test.ts`: success; other `requestId`; `triesLeft` 4 to 1 then locked; 9:59 accepted and 10:00 refused; second use; unknown id; two exchanges at once give one session; 10 parallel wrong tries leave 5; deactivated 400 and used up; unknown-address id (R19 order); validation errors are not tries; failed session insert leaves the code unused |
| R21 to R23, R25 to R27, R31, R35, R44 | S7 | `sessions.db.test.ts`: cookie name and attributes in development, production and with the value missing, no `Domain`; token transport, no cookie; no secret in any column; 30 days exactly valid, 31 refused, use on day 29 moves the end; cookie set again; ended, deactivated, both; header wins over a stale cookie; secret sent the wrong way refused; user agent cut to 512 |
| R28, R33, R34, R50 to R53 | S7 | `sessions.end.db.test.ts`: sign-out then the same value `session_ended`, no cookie `unauthenticated`, other session of the person works; sign-out without a session 204; replace; `endSessionsOfUser` with `only` and `except`; `endSessionOfRequest` returns id or `null`; rollback leaves the session and reports nothing; `reportSessionsEnded` reaches a listener; already-ended not reported twice |
| R24, R32, R36, R39 | S3, S7, S8 | `routes.db.test.ts`: protected test route 401 and 200; public flag; unknown path 401 without and 404 with a session; `GET /auth/session` body; workspace name has no other field; list of registered routes shows no `GET` that writes; log capture holds no code, `requestId`, secret or address (R37) |
| R49, R51 | S8 | `invitation-codes.db.test.ts`: create, check (`ok`, `incorrect`, `locked`, `expired`), new code cancels the earlier invitation code, a sign-in request leaves it usable; prune deletes only old `invitation` rows, at most `limit`; transaction rollback leaves no live code |
| R55 | S0 | `members` and `workspace` read-function tests with a transaction |

## Steps (test first)

Each new test is run and seen to fail for the right reason before its code. The whole server suite runs at the end of S0, S3 and S6, not only at S9.

0. **S0 Prerequisites.**
   - `parseEmail` (`packages/shared/src/email.ts`) with its test.
   - `buildApp` already takes `mail` (TOKI-021). Add `db` and `clock` (default `systemClock`); `main.ts` creates the database, passes it and closes it in `onClose`. `registerApi` hands `{ db, clock, mail: app.mail, config }` to the auth module.
   - Config area `auth` (next to the `mail` area that main now has; `main.ts` loads `"server", "database", "mail", "auth"`): the code-hash secret (minimum length checked), the app origin (a URL, compared as `new URL(x).origin`) and the trust-proxy address. Rows in `docs/environment-config.md` and in the example env file the config test reads; `main.ts` loads `"auth"`; every `Config` literal in tests gains `auth`.
   - Read functions: `members` (find by email, get by id) and `workspace` (get the one workspace), the latter with a new `modules/workspace/index.ts`; each tested with a transaction.
1. **S1 Shared package.** `limits.ts`, `schemas.ts`, the 10 new error codes (the key `unsupportedMediaType` exists and is reused), exports.
2. **S2 Secrets.** `secrets.ts`.
3. **S3 Guards, cookie helper, scope.**
   - `guards.ts` (R45, R46); the cookie helper; the `FastifyContextConfig { public?: boolean }` declaration; an empty `routes.ts` registered through `registerApi`.
   - Hooks that must also cover unknown paths are registered at the root and filtered on the `/api/v1/` prefix (or a not-found handler is set inside the API scope); the test "unknown path, no session, 401" is written here.
4. **S4 Session creation.** `createSession` (R29, R35) in `sessions.ts` with its tests (refuses a non-Active account, rolled-back transaction).
5. **S5 Request a code.** `codes.ts` request path, the limiter, `POST /auth/codes`, flagged public from the start.
6. **S6 Exchange.** `codes.ts` exchange path, `POST /auth/sessions` for both transports, flagged public.
7. **S7 Session check and end.** The check hook, renewal, `DELETE` and `GET` of `/auth/session`, listeners. Existing tests in `apps/server/test/app.test.ts` (`/ok`, `/validate`, `/schema`, `/echo`, `/status/*`, 404 cases) are updated here: their test routes get `config: { public: true }` and the 404 cases move to a signed-in request. Full server suite run.
8. **S8 Workspace route, invitation functions.** `GET /auth/workspace`, R49 and R51, exports in `index.ts`; R36 and R37 are checked here.
9. **S9 Verify.** Whole server and shared test runs, `pnpm typecheck`, `pnpm lint`, a grep for `now()`, `Date.now` and `new Date()` under `modules/auth`, a search of the log capture and the database for secrets, output recorded for the PR.

## Decisions from the review of this plan

Checked by the advisor (Opus); each point is a plan change. Claims about Fastify behaviour were not run yet: the step that depends on one tests it first.

1. **The app had no database.** Fixed in S0: `db`, `mail` and `clock` are options of `buildApp`; modules receive them from the app.
2. **Hooks and unknown paths.** A hook inside the prefix scope may not run when no route matches (the 404 handler is at the root), which would break R44. S3 registers at the root with a prefix filter, or sets a not-found handler in the scope, whichever its test shows works.
3. **Existing tests.** The session check answers 401 to every unflagged route, so S7 updates `app.test.ts`.
4. **Step order.** The public flag type and the route registration move to S3, `createSession` to S4, and every route is flagged when it is added.
5. **Riskiest step is S7** (a hook on every request, the 404 scoping, the R27 order, existing tests), with S6 the second (concurrency).
6. **R55 and the module boundary.** The spec says the account is read in the same statement as the session, and also that `auth` never queries `users`. Choice: `auth` loads the session by its hash, then reads the account through the `members` function in the same transaction, and applies R27 in that order. This departs from "the same statement" and is the one point of this plan that departs from the spec; it is named in the PR. Approving this plan approves that choice.
7. **Lock on the address (R4, R5).** The request transaction takes `pg_advisory_xact_lock` on a hash of the address; a test sends parallel requests for one address and expects exactly one accepted.
8. **Request body detection (R45).** A body exists when `content-length` is above 0 or `transfer-encoding` is present. Tests: `text/plain` POST to a public route is 415 and not parsed; `DELETE /auth/session` with a JSON type and no body is 204 (R33).
9. **Limiter (R56).** Keyed by method and `request.routeOptions.url`, not the raw URL; one instance per `buildApp`; entries older than 15 minutes are pruned. The R56 tests set `remoteAddress` explicitly, for the spoof case and for the per-address counters.
10. **Time.** No SQL `now()` and no `defaultNow` for auth columns; every comparison takes the time from the `Clock` as a parameter. One test runs with the test clock years away from real time.
11. **R40.** The test asserts `code_hash` equals the HMAC under the configured key and differs under another; a missing secret stops the config load.
12. **Races (R17).** The deciding `UPDATE` carries `used_at is null and cancelled_at is null and expires_at > $now and wrong_tries < 5` and its `RETURNING` is checked. The race tests use separate connections, a pool of at least 10, and two explicit transactions for the forced interleaving.
13. **R43.** The failing session insert is produced by a duplicate `secret_hash` from a stubbed random source; no test-only code in the production path.
14. **Mail after the answer (R8).** Sent fire-and-forget with a `.catch`, never awaited, so a mail that never answers does not hold `app.close()`. The test asserts no unhandled rejection and no auth log line.
15. **R41.** A statement recorder (a postgres-js `debug` hook in the test) compares the statement lists, without parameters, for a member and a non-member.
16. **R26.** The cookie is set again only when the session came from the cookie, also on an error response after the check passed; renewal is one `UPDATE ... RETURNING` after the ended and idle checks, so an ended session is never renewed. A token session gets no `Set-Cookie`.
17. **Cookie helper.** Parses only the one expected name, takes the first duplicate, tolerates malformed pairs, clears with the same name, `Path=/`, `Secure` and `Max-Age=0`, and appends `Set-Cookie` (R34 with R28). Each case has a unit test.
18. **R21 "value missing".** The helper takes `env: string | undefined` and treats anything except `"development"` as production; it is tested directly, because `NODE_ENV` is required and a missing value never reaches the app.
19. **Trust proxy.** S0 chooses the value, proposed to TOKI-096 with the other new names.
20. **Tests added to the table:** R29 refuses a non-Active account; R53 rollback for `createSession` and `endSessionOfRequest`; R38 a route rejects a body that fails the shared schema; R55 the account on the request carries `workspaceId`; R50 the listener gets the reason for sign-out, replace and R30. R47 rows in S5 are inserted by SQL through `db/test-rows.ts`, because `createInvitationCode` comes in S8.

## What can break, and the riskiest step

- **Riskiest: S7 (a hook on every request), then S6 under concurrency (R17, R43).** For S6: Two exchanges, ten parallel wrong tries and a failing session insert only prove anything against the real database with separate connections. Mitigation: the tests open real connections, not one shared transaction, and run the race 20 times.
- **Hook order.** Fastify parses the body after `onRequest`; R56 and R46 must run before the body is read, and R45 must not refuse a no-body request. Mitigation: each rule has a test that sends the case that would pass if the order were wrong.
- **`parseEmail` written twice.** TOKI-020 may be built in parallel. Mitigation: the file follows TOKI-020 R16 word for word, so a later merge is a no-op or a trivial conflict.
- **In-memory rate limit and trust proxy.** A wrong trust setting lets a client pick its address. Mitigation: the spoofing test of R56 runs with and without a proxy address.
- **Account read after the session (R55).** Two reads in one transaction instead of one statement (decision 6). Mitigation: a test that deactivates the account between two requests and expects `account_deactivated`.

## Update after main moved (2026-11-19)

Main moved while the plan was approved: TOKI-021 (mail layer) is merged, tests of the server moved from `src/test` to `src/tests`, and a `mail` config area exists. The spec did not change (`dev-state drift`: no drift). The plan changes are the TOKI-021 row of the dependency table, S0 (`buildApp` already has `mail`) and the removal of the "TOKI-021 not merged" risk. Module tests stay beside their module; shared helpers come from `src/tests` (`fake-mail.ts`). The plan needs a new approval.
