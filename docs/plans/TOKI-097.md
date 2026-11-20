# TOKI-097 Accept an invitation: plan

Ticket: TOKI-097 (issue 76) · Tier L · Branch `feat/toki-097-accept-invitation`
Spec (source of truth, accepted in PR 181): `docs/specs/2026-11-17-accept-invitation-design.md`. Requirement numbers `R1`..`R54` below are the spec's.

## Design

The spec fixes behaviour. This section says how it fits the code as it is on `main` (f300394), after TOKI-022, 023, 024, 026, 021 and 028 (all done). TOKI-032 is not on `main`.

### Where the code goes

```
packages/shared/src/members/join-schemas.ts       request and response schemas of the three routes (R24); exported from the package index
packages/shared/tests/members/join-schemas.test.ts
apps/server/src/modules/members/invitation-join.ts        lookupInvitation, resendInvitationCode, acceptInvitationWithCode (R1..R21, R44, R50, R51)
apps/server/src/modules/members/invitation-join.routes.ts registerInvitationJoinRoutes(scope, deps): the three POST routes, each `config: { public: true }` (R22, R23)
apps/server/src/modules/members/index.ts                  exports registerInvitationJoinRoutes
apps/server/src/modules/members/routes.ts                 calls registerInvitationJoinRoutes from registerMembersRoutes (the deps are the same: db, mail, clock)
apps/server/src/modules/auth/codes.ts                     checkCodeRequestLimits(client, { email, now }); requestCode uses it (R50..R53)
apps/server/src/modules/auth/api.ts                       exports checkCodeRequestLimits
apps/server/tests/members/join-*.db.test.ts               lookup, resend, accept, hardening
apps/server/tests/auth/code-limits.db.test.ts             the shared count; the TOKI-022 tests that said an invitation code never counts are changed (R47)
packages/client-core/src/auth/invitation.ts               lookupInvitation, resendInvitationCode, acceptInvitation calls (+ test)
packages/client-core/src/index.ts                         exports them
packages/ui-web/src/join/{InvitationRefusal,SignedInQuestion}.tsx (+ tests); exported from the package index
packages/i18n/src/messages/{en,vi}/join.ts                `join.*` texts; registered in each index.ts
apps/web/src/join/join-token.ts                           reads the fragment once, removes it, holds the token in memory (R26)
apps/web/src/routes/join.tsx                              the /join route, flag `public` (R25)
apps/web/src/router.tsx                                   one route (`/join`, flag `public`)
apps/web/src/main.tsx                                     imports `./join/join-token` first of all (R26)
apps/web/src/auth/services.ts                             the three calls (and `resetConversations`) are added to `AuthServices` and `build()`
packages/shared/src/index.ts, packages/ui-web/src/index.ts, packages/i18n/src/messages/{en,vi}/index.ts   the new exports
apps/web/tests/routes/join.test.tsx, apps/web/tests/join/join-token.test.ts
e2e/join.spec.ts                                          Playwright against the real server and Mailpit (next to e2e/sign-in.spec.ts)
```

### How it differs from the spec's text

- **No second `members` to `auth` import problem.** `members` already imports `auth/index.js` (`accept.ts`, `accounts.ts`, `routes.ts`), and `auth` imports `members/index.js`. The new files follow the spec's layout and add imports only to those two public indexes.
- **Where the routes are registered.** `registerMembersRoutes` already receives `db`, `mail` and `clock` inside the `registerApi` scope, so the three routes are added there by one call. The per-IP limiter of `registerAuthHooks` lists only three auth routes (`LIMITED`); the spec adds the new routes to no list, so none is added (see the grilling).
- **`conversations.reset()` (R33)** is on `main` now (TOKI-032, merged into this branch). `apps/web/src/client.ts` exports the one store, `conversations`. `AuthServices` gets `resetConversations: () => conversations.reset()`, so the Join page calls it through the services and a test passes a fake. No second store is made.
- **`/c/<id>` is not a route yet (R32).** The route tree has no `/c/$id`, so a typed `navigate({ to: "/c/$id" })` does not compile. The page lands with `router.history.replace(`/c/${id}`)`, which replaces the Join entry as R32 asks; the PR says it until TOKI-033.
- **The three client calls** are written like the sign-in calls (`createSignInCalls(request)` with `toApiRequest(api)` of `apps/web/src/auth/request-adapter.ts`, the shared client of TOKI-032), in `client-core/src/auth/invitation.ts`, and are added to `AuthServices` and `build()`.

### Server: one request each

**Lookup (R1..R5).** Validate the body with the shared schema (a missing or non-string `token` is 400 `validation_failed`). A token that fails `INVITATION_TOKEN_PATTERN` is `unknown` with no query. Otherwise `findInvitationByToken(db, token, now)`; `null` is `unknown`. For every other state read the workspace name through the `workspace` module's read function, compute `codeExpiresInSeconds` and `resendAfterSeconds` from `codeIssuedAt` (R4), and return only the fields of R1 per state. Nothing is written.

**Resend (R6..R9, R50, R51).** Validate; `findInvitationByToken`; a state other than `pending` answers its refusal first (R8, R50 last sentence). Then, in **one** transaction on **one** connection: `checkCodeRequestLimits(tx, { email, now })`, which takes `pg_advisory_xact_lock(hashtext(email))` (the lock `requestCode` takes) and counts the rows of both purposes; then `issueInvitationCode(tx, { token, now, minIntervalSeconds: INVITATION_RESEND_SECONDS })`; commit. `issueInvitationCode` is typed to take `Db` and opens `db.transaction`; given a transaction, Drizzle opens a savepoint on the same connection, and `createInvitationCode` already joins a caller's transaction (`withTransaction`). The call passes `tx as unknown as Db` (the one cast, with a comment), and a DB test proves one connection is used (see "Resend and the pool" below). If that proves false, the fallback is to compose `lockInvitationByToken`, `closedError` and `makeCode`, which the `members` module holds, inside the route's transaction. map the results (429 `code_request_limit` or `code_resend_too_soon` with `Retry-After`; 409/404); answer; after the answer (on `reply.raw.once("close")` with a `.catch` that ignores the failure, as `/auth/codes` does), `sendInvitationCode({ to: email, code })`; the failure is only what the mail layer logs (R9). When both limits apply, `code_request_limit` carries the longer wait (R51).

**Accept (R10..R21, R44).** The order of "How an accept runs" is kept: validate, find, refuse a state other than `pending`, `checkInvitationCode(db, { secret: codeSecret(token, codeSerial), code })`; then one transaction around `acceptInvitation(tx, { token, now })` (commit on `ok` and on `account_active`, roll back on any other refusal); after the commit `reportSessionsEnded(endedSessionIds, "deactivated")` when the list is not empty; end the replaced session with `endSessionOfRequest(db, request, "replaced", { only: "cookie" })`; read the account by id (`getAccountById`) for the `user`; `createSession(db, account, "cookie")`; set the cookie as `/auth/sessions` does; answer `{ user, generalConversationId }`. `account_active` answers 409 `invitation_used` with no session (R44). A failure of the transaction is 500 with the code used up; a failure of the session after the commit is 500 with the invitation used (R19).

**The shared count (R50..R53).** `checkCodeRequestLimits(client, { email, now })` returns `ok`, or `request_limit` or `resend_too_soon` with `retryAfterSeconds`. It replaces the counting block of `requestCode` (which now counts `purpose in ('sign_in','invitation')`); cancelling and pruning stay per purpose (R52). The function is the one place that takes the address lock and it stays read-only (no `for update`, no cancel, no prune of invitation rows), so a row lock of the outer transaction can never be waited on by inner work. `requestCode` opens its transaction and calls it; the resend route calls it in its own transaction, and a lock order of address lock first, invitation row second holds on both paths (`acceptInvitation` and the Admin routes never take the address lock). Admin operations of TOKI-024 are never refused (R53): they do not call it.

### Resend and the pool

The pool is `postgres(connection)` with its default of 10 connections and no wait timeout, and `/auth/codes` is public. A resend that held the address lock on one connection and needed a second for `issueInvitationCode` could wait for ever while sign-in requests for the same address hold the rest, blocked on that lock. A cap on resends would not prevent it, so the design uses one connection (above) and adds no cap. Test: with a pool reduced to 2 connections, 6 resends and 6 sign-in requests for one address at the same time all finish.

### Web: the Join page

`join/join-token.ts` is the first import of `main.tsx`, before `./app-providers`, `./router` and every other import (ES imports run in source order), because `createRouter` reads `location` when `./router` loads. On load, only when `location.pathname` is `/join` (so `/emergency#<token>` is untouched), it takes `location.hash`, keeps the token in a module variable if it matches the pattern, and calls `history.replaceState` to remove the fragment. The route also does what `emergency.tsx` does after mount: if the router's own location still has a hash, `router.history.replace` removes it, so neither `location`, the history entry nor the router state holds the token (R43). The same file holds `getJoinToken()` and the pure parts, with the unit tests of R26. `routes/join.tsx` (`staticData: { public: true }`, as `emergency.tsx` does) reads the session state with `useSession`, does the lookup once, and picks a view with one pure function `chooseJoinView(lookup, session)` (unit-tested for R25, R34..R38, R44, R46): code step, the question, a refusal page, or a `navigate` to `/login` with `state.email`. The code step is the existing `CodeStep` of `ui-web` with the props of TOKI-023 R41; `send` and `resend` map the answers as R49 lists. On a 200: `resetConversations()` only when the state was `signedIn`, then `markSignedIn(user)`, then `navigate({ to: "/c/$id", replace: true })`. The refusal pages and the question are two new components in `ui-web/src/join/` that use `SignInCard` and `Button` only (R42). The `<meta name="referrer" content="no-referrer">` of R43 is already in `apps/web/index.html`, so nothing is added; a test asserts it.

### Seams for tests

The server routes take `clock` and `mail` from the deps (as the members routes do); `createMemberHarness` already builds invitations, tokens and a fake mail. The page takes its calls, clock and timers from `getAuthServices()`; the three new calls are added to that object so a test passes fakes through `setAuthServices`.

### Errors, logging, safety

Errors go through `AppError` and the registry (all codes already exist); a 429 `AppError` with `retryAfterSeconds` already gets `Retry-After` from the shared handler. Every handler is wrapped in a `guarded()` like `auth/routes.ts` and `members/routes.ts` use: a failed Drizzle query carries its parameters in the message and the shared handler logs it, so any error that is not an `AppError` or `ZodError` becomes an error that names only its kind, with no `cause`. This covers the two 500 cases of R19. No log line holds the token, the code, a secret or the address (R24); a test makes a query fail and greps the captured log. The token is in request bodies only (R26, R43).

### Tests

Server integration tests are written first against the real Postgres, with the test clock and the fake mail (the spec's "Testing" lists the cases per requirement). Unit tests for the token reader and `chooseJoinView`; component tests per row of "Outcomes and what the person sees"; Playwright for the end-to-end cases that do not need time to pass; layout and accessibility checks at the five widths. `TEST_DATABASE_URL` is not available locally (`.env` is off limits), so DB tests run in CI.

### Points the advisor raised and how they are met

- Pool starvation of Resend: one connection, no cap (above).
- The fragment reader must not touch `/emergency`, and must run before the router loads: path check and import order (above).
- `getAccountById` is required in accept, because the result of `acceptInvitation` has no `workspaceId`, which `createSession` needs. `account_active` is returned as a value out of the transaction callback so that it commits (Drizzle rolls back only on a throw).
- A request with an `Authorization` header counts as `via: "header"`, so `{ only: "cookie" }` ends nothing; the web app sends none. No code for it.
- No per-IP limit is added to the three routes: the brakes are 5 tries per code and 5 codes per 15 minutes per address, and the token has 256 bits. Raised in the grilling.

## Decisions taken with the Dev

1. TOKI-032 merged on 2026-11-20: the store and `reset()` are real; no seam is built.
2. `issueInvitationCode` is typed to take `Db`. The design passes the route's transaction with one documented cast, so Resend uses one connection and TOKI-024's file is not edited (the Dev said "continue" after seeing the two options; the cast is the recommended one and is taken). The one-word widening to `DbClient` stays an option for TOKI-024's owner and goes in the PR text.

## Steps (test first, each step ends with its tests green)

1. **Schemas** (`packages/shared`): `members/join-schemas.ts` (the three requests, the lookup union, the codes and sessions answers) and the index export. Unit tests first (R1, R2, R13, R24).
2. **The shared count** (`auth`): `checkCodeRequestLimits` in `codes.ts`, `requestCode` uses it, export in `api.ts`. Tests first, against `requestCode` and `checkCodeRequestLimits` only: both purposes count for the 5 and for the 60 seconds, the longer wait wins, cancelling and pruning stay per purpose, Admin operations are never refused (R50, R51, R52 first half, R53). The test `codes.request.db.test.ts` "leaves an invitation's row untouched and does not count it (R47)" (line 182) is split in two: "cancels nothing" is kept, "counts it" is new (it asks three times with no wait, which now answers `code_resend_too_soon`). No other existing test of the auth module asks for an invitation row to be ignored (checked: the others advance 61 seconds or never call `requestCode`). Stale text goes in the same step: `docs/specs/2026-11-16-sign-in-api-design.md` R4, R5, R47, R57, the R47 sentence of its Testing, its constraint row and concern 4; and the comments in `auth/codes.ts` (`requestCode` header and the counting block).
3. **Lookup and the route file** (`members/invitation-join.ts`, `.routes.ts`, one call in `registerMembersRoutes`): `guarded()` on every handler, `public: true`, 415 and 403 from the hooks. Tests first for R1..R5, R22..R24 (the five states, the shape, no write, 401 on a session route afterwards, no `GET`, log search).
4. **Resend** (`resendInvitationCode`): one transaction on one connection, `checkCodeRequestLimits` then `issueInvitationCode(tx as Db)`, mapping, mail after the answer. Tests first for R6..R9, R50, R51 and the reverse half of R52 (5 sign-in requests, then "Resend code" answers `code_request_limit`; 5 resends, then a sign-in request does), and the race of a resend with a sign-in request at the same moment with 4 rows. R7 is proved by its positive twin: `issueInvitationCode` called directly, with no address lock, answers `resend_too_soon` at 59 seconds and a code at 60, and a route test with a mutation (no `minIntervalSeconds`) fails only when the address lock is not already refusing; the "longer wait" mapping of R51 is tested on the count side, since the invitation side cannot disagree through the route (the new row of `issueInvitationCode` is itself a counted row). One-connection proof: the test reads `pg_backend_pid()` inside the lock scope and inside `issueInvitationCode`'s scope (a test seam on the transaction) and expects the same pid; the stress test (6 resends and 6 sign-in requests for one address at the same time) runs with a pool of 2 built by a harness option `maxConnections` added to `createHarness`.
5. **Accept** (`acceptInvitationWithCode`): the order of "How an accept runs", `reportSessionsEnded`, `endSessionOfRequest(..., { only: "cookie" })`, `getAccountById`, `createSession`, cookie. Tests first for R10..R21, R44, R45 (server half), with the listener and the failing-session cases.
6. **Client calls** (`client-core/src/auth/invitation.ts`, `AuthServices`): the answers of R49 for each status. Unit tests first.
7. **Texts and views** (`i18n` `join.*` in en and vi; `ui-web/src/join/InvitationRefusal.tsx`, `SignedInQuestion.tsx`): missing-translation check, no literal text, focus on the heading without a tab stop (R35, R36, R39, R41, R42).
8. **The page** (`join/join-token.ts` and import order, `join/choose-view.ts`, `routes/join.tsx`, `router.tsx`): unit tests of the token reader and `chooseJoinView`; component tests per row of "Outcomes and what the person sees", including R28, R33 (the session status is read at the moment of the send and kept, so the reset still happens after `markSignedIn`'s predecessor state is known; reset, then `markSignedIn`, then the address), R45..R48, R54. `CodeStep` needs `codeLength` (`CODE_LENGTH`) and the tests wrap it in `SignInTimeProvider` with the controllable clock. A session read that never answers leaves the state `unknown` and the page shows the background only (the same open question as TOKI-023's read); a test documents it and the PR lists it under "Not decided by the spec".
9. **End to end and layout** (`e2e/join.spec.ts`; five widths, Calm and Focus, en and vi; keyboard run; accessibility check): R15 with an old cookie, R26, R28, R34, R36, R43 and the layout rows.
10. Whole-repository `pnpm test`, lint, typecheck, format; the PR text lists what was not done (below).

## AC to step to test

| Req | Step | Test |
|---|---|---|
| R1, R2, R3 the five states, the fields, the pattern, order of states | 1, 3 | `join-schemas.test.ts`; `tests/members/join-lookup.db.test.ts` |
| R4 seconds left, at 9:59 / 10:00 and 59 / 60 | 3 | `join-lookup.db.test.ts` |
| R5 a lookup changes nothing and signs nobody in | 3 | `join-lookup.db.test.ts` |
| R6, R7, R9 a new code, 60 seconds, two at once, mail failure | 4 | `join-resend.db.test.ts` |
| R8 refusals of an unusable invitation, no code, no mail | 4 | `join-resend.db.test.ts` |
| R50..R54 (server) one count for both purposes | 2, 4 | `tests/auth/code-limits.db.test.ts`; `join-resend.db.test.ts` |
| R10, R11, R12, R13, R20 accept, order, tries, shape, secret | 1, 5 | `join-accept.db.test.ts` |
| R14, R15, R17 new account, brought-back account, #general once | 5 | `join-accept.db.test.ts` |
| R16, R18, R19, R44 races, partial failures, active account | 5 | `join-accept.db.test.ts` |
| R21 replaced session | 5 | `join-accept.db.test.ts` |
| R22, R23, R24 hardening, public flag, no leak | 3, 5 | `tests/members/join-hardening.db.test.ts` |
| R25, R28, R43 public route, only lookup on opening, no token left | 8, 9 | `join.test.tsx`; `join-token.test.ts`; `e2e/join.spec.ts` |
| R26, R48 fragment read once and removed, reload loses it | 8 | `join-token.test.ts`; `join.test.tsx`; e2e |
| R27, R29, R30, R31, R49 code step and its outcomes | 6, 8 | `invitation.test.ts`; `join.test.tsx` |
| R32, R33 landing and the reset order | 8 | `join.test.tsx` |
| R34, R35, R36, R37, R38, R46, R47 other states and the question | 7, 8 | `choose-view.test.ts`; `join.test.tsx`; `InvitationRefusal.test.tsx`; e2e |
| R39 texts in both languages | 7 | i18n missing-translation check; literal search of `ui-web/src/join` |
| R40, R41, R42 layout, keyboard, tokens | 7, 9 | layout and accessibility checks in `e2e/join.spec.ts` |
| R45 after a 500 | 5, 8 | `join-accept.db.test.ts`; `join.test.tsx` |

## What can break, and the riskiest step

- **Step 4, Resend on one connection.** If Drizzle does not open a savepoint on the same connection for `tx.transaction`, the pool can starve (advisor finding 1). The pid check is deterministic and is written first; the pool-of-2 stress test is the second proof. The cast departs from the spec's words "call `issueInvitationCode(db, ...)`" and the PR names it. The fallback is to compose `lockInvitationByToken`, `closedError` and `makeCode` in the route's transaction.
- **Step 2, the shared count** changes a route that is in use. The existing sign-in tests are run before and after, and the changed ones are named in the PR. `checkCodeRequestLimits` stays read-only apart from the address lock.
- **Step 5, `account_active` must commit.** Drizzle rolls back only on a throw, so the callback returns the refusal as a value; the test checks the invitation is closed afterwards (R44).
- **Step 5, the order after the commit** (report, replaced session, `getAccountById`, `createSession`): the test with a failing `createSession` shows the report was made and the invitation is used (R19).
- **Step 8, the token reader.** It must not take the fragment of `/emergency`, and it must run before `./router` loads. A test opens `/emergency#<token>` and checks the emergency page still gets its token; another checks `router.state.location` holds no hash after `/join#<token>`.
- **Step 8, landing at `/c/<id>`** is not a route yet, so it uses `router.history.replace`; the test checks the replaced entry and that Back does not return to Join.
- **DB tests run only in CI** (`TEST_DATABASE_URL` is in `.env`, which this session cannot read); the unit, component and type checks run locally. The PR says so.
- A negative check always sits next to its positive twin in the same test (for example "no mail" next to a case where one mail is sent).

## Files outside the spec's layout, with the reason (goes in the PR)

- `members/routes.ts`, `members/index.ts`: the one place where routes of the module are registered with `db`, `mail`, `clock`; no file of TOKI-024's logic changes.
- `auth/api.ts`: the public index of `auth`, which the spec's "its `index.ts`" names; `checkCodeRequestLimits` is exported there.
- `web/src/auth/services.ts`: where the sign-in calls are built; the three calls and `resetConversations` join them.
- The barrel files of `shared`, `client-core`, `ui-web` and `i18n`: one export line each.
- `createHarness` option `maxConnections` (test code only).

## Files added during the build

Not named above, or named differently, and what the build found. (Notes only: the steps and the design above are as they were approved.)

- **Names.** `apps/web/src/join/join-token.ts` holds the reader (`captureJoinToken`, `getJoinToken`); `join/capture-on-load.ts` is the one-line file with the side effect that `main.tsx` imports; `join/choose-view.ts` is the pure choice of view. `main.tsx` imports `capture-on-load` as its first import that is not a style sheet (`packages/ui-web/tests/styles/order.test.ts`, R29 of TOKI-015, wants the style sheets first); the router is loaded after it.
- **Server.** `JoinHooks` (`afterCodeCheck`, `inTransaction`, `afterCommit`) are test seams of the accept; `buildApp` takes `joinHooks`, `registerMembersRoutes` takes `development` (the cookie) and `joinHooks`. `sessionCookie` is exported from `auth/api.ts`. The harness has the options `joinHooks` and `maxConnections`. The tests that make a second harness (`join-resend-mail`, `join-resend-pool`) are in files of their own because the auth module holds one clock per process.
- **Existing tests changed.** `tests/auth/codes.request.db.test.ts` (R47 split in two, as planned); `tests/members/access.db.test.ts` (the list of the routes under `/invitations` now holds the three public routes, compared as a set); `apps/web/tests/routes/root.test.tsx` and `tests/support/load-app.tsx` (the stub of the flag `public` is at `/public-probe`, because `/join` is a real route now); `apps/web/tests/app-providers.test.tsx` and `tests/routes/app-layout.test.tsx` (the services have `invitation` and `resetConversations`); `packages/ui-web/tests/components/exports.test.ts` (the join pieces are a known entry). `docs/specs/2026-11-16-sign-in-api-design.md` R4, R5, R47, R57, its testing sentence, constraint row and concern 4 say that both purposes count.
- **e2e.** `e2e/support/layout.ts` holds `expectFits` and `expectNoVerticalScroll`, moved out of `e2e/sign-in.spec.ts` with no change (a `noControls` option is added for the refusal pages). `e2e/support/smtp-sink.ts` is a small mail server of the test that keeps the mails, so the real-server spec reads the link and the code the server made; `playwright.real-server.config.ts` points the server's `SMTP_PORT` at it (2526), which the emergency spec does not mind.
- **Checks run.** Typecheck, lint, prettier, i18n check, build, the unit and component tests, `e2e/join.spec.ts` (80 layout cases and the keyboard cases), `e2e/sign-in.spec.ts` and the real-server specs (the three of TOKI-026 and the six of this ticket) all pass locally. The database tests ran on a Postgres 14 started for the purpose (CI has 17): 20 tests of other tickets fail there on `main` as well (`account-tables`, `conversation-tables`, `channels.edit`, `members/list`: code points and Vietnamese search), and `main.test` and `emergency-link.process` time out when the machine is busy; none is in this ticket's files.
- **Mutation checks.** One connection of Resend (the statement test fails when `issueInvitationCode` gets `db`); the report of ended sessions (two tests fail without it); `account_active` commits (a test fails when it rolls back); the order of the reset before `markSignedIn` (a test fails when swapped). The pool-of-2 stress test did not fail on the two-connection version: it is not deterministic, as the advisor said, and the pid test is the proof.

## Not decided by the spec, and left for the PR

- **A second Join link in the same tab.** Going from `/join` (the fragment already removed) to `/join#<another token>` changes only the fragment, so the browser does not load the document again and the token read at load (R26) is the first one. The page keeps showing the first link. Nothing is added here: R26 says the token is read once when the document loads. A `hashchange` reader would fix it; it is the spec owner's call.
- **A session read that never answers** leaves the state `unknown` and the page shows the background only (the same open point as TOKI-023's read).
- **`/c/<id>` is not a route yet** (TOKI-033): the page lands there with `router.history.replace`.
- **No per-IP limit** is added to the three routes (`LIMITED` of `auth/register.ts` is not edited); the brakes are the 5 tries of a code and the 5 codes in 15 minutes of an address.
- **The cast** `tx as unknown as Db` in `resendInvitationCode` (the spec's words are "call `issueInvitationCode(db, ...)`"); widening that parameter to `DbClient` is a one-word edit of TOKI-024's file.
- **An expired invitation** is covered by the integration and component tests only: the e2e harness cannot move the clock of the server (TOKI-008 R19).
