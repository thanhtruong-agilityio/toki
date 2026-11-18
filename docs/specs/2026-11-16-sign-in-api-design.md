# Sign-in API design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/sign-in-api.md (Thanh Truong)
Ticket: TOKI-022

## Goal
A Member or an Admin needs to get into Toki without a password: ask for a 6-digit code by email, exchange it for a session on the device that asked, stay signed in, and sign out. Today the server cannot tell who is asking, so nothing that needs a signed-in person can be built. This work adds the server endpoints for the code, the session and sign-out, and the check that refuses every other request without a valid session.

## Scope
- In:
  - Three operations under `/api/v1/auth`: request a code, exchange a code for a session, sign out; plus one read of the current session and one public read of the workspace name for the sign-in card.
  - The rules of a code: 6 digits, 10 minutes, once, bound to its request, locked after the 5th wrong try, cancelled by a newer code.
  - The limits on code requests: 5 per address in 15 minutes, 60 seconds between two requests.
  - Two session kinds: a cookie for the web app, a header token for apps.
  - The session check that every other route under `/api/v1` passes through, with the 30-day rule and its renewal.
  - The request and response schemas in `packages/shared`.
  - The functions that other server modules call to start and end sessions, to end the session of a request, to hear that sessions ended, to create, check and prune an invitation's code, and to read an account (R29, R30, R49 to R55).
  - The per-route flag that says a route needs no session (R24), which every later ticket sets for its own public routes.
  - Server integration tests for all of the above.
- Out (not now):
  - The `users`, `login_codes`, `sessions` and `devices` tables and their migrations: TOKI-019. This work reads and writes them; the columns it needs are listed under Data model.
  - The mail layer and the sign-in mail template (code only, no button, English and Vietnamese): TOKI-021. This work calls `sendSignInMail({ to, code, language })` through the application's `app.mail` (TOKI-021 R6 and its decorator) and writes no log line for a failed send (R8).
  - Every screen: the email step, the code step, the 7 error messages, "Your session has ended": TOKI-023. "Sign out" in the account menu: TOKI-099.
  - Other tabs of the same browser on sign-out (D-093). This work owns the server side only: the tabs share one session, so once it is ended every later request from any tab is answered as not signed in (R28). The signal that makes the other tabs react at once, without waiting for their next request, belongs to TOKI-099. The session state in the web app that reacts to an ended session belongs to TOKI-023.
  - Invitations: creating one, its mail, its link, its endpoints, "Resend code" on an invitation, accepting it, reactivating a deactivated person: TOKI-024 and TOKI-097. They do not write the code rules again: they create, check and prune the invitation's code through the functions of R49 and R51, start the session through the function of R29 and replace the browser's session through R52. They set the flag of R24 on their own public routes.
  - Listing a person's sessions, signing out another device or all others, and the emergency sign-in link: TOKI-026. It uses the functions of R29, R30 and R52 and sets the flag of R24 on `POST /api/v1/auth/emergency-sessions`. The link is the one sign-in without a code (D-159); how it starts a session is designed there (concern 9). The device kind and the browser read from the stored `user_agent`, the shape of the session list (`{ sessions: [...] }`, read by TOKI-099) and the value lists of both, which live in `packages/shared/src/auth/devices.ts`: TOKI-026 (its R1, R6 and R37); this work stores the header (R35) and nothing more.
  - The last use per person for the Admin page, `getLastUsedAtByUser(userIds)`: TOKI-024 adds it to the `auth` module (its R25), because `auth` owns `sessions`; this work does not build it.
  - The list of accounts by id with an optional lock, `getAccountsByIds(client, ids, { lock? })`: TOKI-029 builds it in `members` (its R19). This work does not build or copy it; the two account reads of R55 are for one account and carry the email address, which `getAccountsByIds` does not.
  - Calling R30 with the reason `deactivated` when an Admin deactivates someone: TOKI-024.
  - Closing the realtime connection of an ended session: TOKI-038. It hears about ended sessions through R50.
  - Removing a device's push registration on sign-out: TOKI-074. It registers a listener through `onSessionsEnded` (R50), and TOKI-099 runs its before-sign-out task in the web app.
  - Guest sign-in: phase 5.
  - A limit per network address or for the whole server, and a cap on wrong tries across codes: not decided (concern 3). This work builds none.

## Requirements
Request a code
- R1. `POST /api/v1/auth/codes` with a well-formed email address returns status 200 and a body with exactly `requestId`, `expiresInSeconds` (600) and `resendAfterSeconds` (60). Every accepted request returns a new `requestId`. The status and the set of body fields are the same for the address of an active account, a deactivated account, an address that has only an invitation (assumption, concern 1) and an address nobody uses (BR-04).
- R2. For the address of an account whose status is Active or Deactivated, an accepted request hands exactly one sign-in mail to the mail layer, with that address, the code and the language saved on the account (D-180). For an address with no account it hands over no mail (F05). For an address that has only an invitation it also hands over no mail: an invited person has no `users` row (TOKI-019 R10, concern 2 there), so the account read of R55 finds no account. That the invitation changes nothing here is an assumption, not a decision (concern 1).
- R3. A code is 6 decimal digits, leading zeros kept, drawn from a cryptographic random source (D-011).
- R4. When 5 accepted requests for one address are less than 15 minutes old, the next request for that address returns status 429 with the code `code_request_limit` and `details.retryAfterSeconds`; it creates no code and sends no mail. Once the oldest of the 5 is 15 minutes old, a request is accepted again (D-038, FR-02 AC-004).
- R5. A request made less than 60 seconds after the last accepted request for the same address returns status 429 with the code `code_resend_too_soon` and `details.retryAfterSeconds`; it creates no code and sends no mail. At 60 seconds the request is accepted (D-038, D-082, FR-02 AC-005).
- R6. An accepted request cancels every earlier unused sign-in code of that address: an exchange with an earlier `requestId` fails with `code_expired`, with the right digits too (D-082, FR-02 AC-006).
- R7. The address is checked and normalised by `parseEmail` of TOKI-020 R16 (`packages/shared/src/email.ts`: trimmed, lower case, well-formed, at most 254 characters). Decided in this spec: this work uses that one function, so sign-in accepts the addresses that the `users` table accepts; whichever of TOKI-020 and this work is built first creates the file as TOKI-020 R16 writes it. This work therefore needs TOKI-020 for `parseEmail`, a plan change to the Needs line of this ticket (TOKI-019 and TOKI-021 only); TOKI-020 does not need this work. A value that `parseEmail` refuses, a value of more than 254 characters included, returns status 400 with the code `validation_failed`, creates no code, writes no row and does not count toward R4 or R5. Reason for the 254: `login_codes.email` refuses a longer value with `login_codes_email_length_check` (TOKI-019 R7), which would otherwise reach the person as an internal error.
- R8. The response of R1 is sent without waiting for the mail. When the mail layer fails or never answers, the response is unchanged (concern 2). The one log line of a failed send is the layer's own (TOKI-021 R14); this module writes none for it.
- R9. R4 and R5 count requests the same way for every address, whether or not it belongs to an account, so the limits reveal nothing about membership (BR-04).

Exchange a code for a session
- R10. `POST /api/v1/auth/sessions` with a `requestId` and the code that was mailed for it, sent less than 10 minutes after the code was created, for an Active account, returns status 200 with `user`, and creates one session for that account (D-136, FR-01 AC-001).
- R11. A code is accepted only together with the `requestId` returned by the request that created it. The right digits with any other `requestId` do not create a session (F04: the code belongs to the request).
- R12. A wrong code returns status 400 with the code `code_incorrect` and `details.triesLeft`: 4 after the 1st wrong try, then 3, 2 and 1. No session is created (D-137, F05).
- R13. The 5th wrong try returns status 400 with the code `code_locked`. From then on every exchange for that `requestId`, with the right digits too, returns `code_locked`, until the code is cancelled by a newer one (R6) or its row is removed (R48); after that the answer is `code_expired` (D-137, FR-01 AC-003).
- R14. An exchange sent 10 minutes or more after the code was created returns status 400 with the code `code_expired` and does not count as a wrong try (D-136, FR-01 AC-003).
- R15. A code works once: after a successful exchange, a second exchange with the same `requestId` and code returns `code_expired` and creates no session (BR-02).
- R16. An exchange with a `requestId` the server does not know returns `code_expired`.
- R17. When two exchanges with the right code arrive at the same time, exactly one creates a session. Wrong tries sent at the same time never give more than 5 tries in total: the update that adds a try carries the condition `wrong_tries < 5`, because the table refuses a sixth try only with a check (TOKI-019 R15) and an error is not an answer.
- R18. A correct code for a Deactivated account returns status 400 with the code `account_deactivated`, creates no session and uses up the code (F05).
- R19. For a `requestId` that was given to an address with no Active or Deactivated account, no code is ever right: a 6-digit code answers `code_incorrect` with `triesLeft`, the 5th one and every later one `code_locked`, and a code that reached 10 minutes without being locked `code_expired`, in the same order as for an account.
- R20. A `code` that is not exactly 6 digits, or a missing `requestId`, returns status 400 with the code `validation_failed` and does not count as a wrong try (FR-01 AC-002).

Sessions
- R21. With `transport` `"cookie"` (the default) the response of R10 sets the session cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` (30 days, D-011) and no `Domain` attribute, under the name `__Host-toki_session`. Only when the environment is explicitly set to development is `Secure` left out and the name `toki_session`; a missing or unknown value counts as production. The body holds no token.
- R22. With `transport` `"token"` the response of R10 holds `token` in the body and sets no cookie. A later request is signed in by the header `Authorization: Bearer <token>`.
- R23. The session secret is 32 random bytes. The database stores only its SHA-256 hash; neither the cookie value nor the token can be read back from the database.
- R24. Every route under `/api/v1` requires a valid session unless the route sets the flag `config: { public: true }` in its own definition. This work sets it on four routes only: `POST /api/v1/auth/codes`, `POST /api/v1/auth/sessions`, `GET /api/v1/auth/workspace` (R39) and sign-out (R33). Decided in this spec: the flag is on the route, and the session check reads it from the route that matched, so no ticket edits a list in `auth`; a request that matches no route has no flag and needs a session (R44). Tickets that add a public route set the flag on it: TOKI-026 on `POST /api/v1/auth/emergency-sessions` and TOKI-097 on its three Join routes. Without a cookie or token a route without the flag answers status 401 with the code `unauthenticated` and holds no workspace data (BR-01, FR-03 AC-007). The rules of R45 and R46 apply to every route, flagged or not.
- R25. A session is valid up to and including 30 days after its last use. Each request that passes the check sets the last use to now. A request made more than 30 days after the last use returns status 401 with the code `session_ended` (D-011, D-138, FR-03 AC-009).
- R26. Each response to a request that passed the check with a cookie sets the cookie again with `Max-Age=2592000`, so the cookie lives as long as the session.
- R27. The check looks at the account before the session. A request with a session whose account is Deactivated returns status 401 with the code `account_deactivated`, also when that session was ended (F07, F41). Otherwise a request with a session that was ended (R28, R30, R34) returns status 401 with the code `session_ended`.
- R28. `DELETE /api/v1/auth/session` ends the session of the request (through R52, reason `signed_out`), clears the cookie and returns status 204. After it, a request that still carries that cookie value or token returns 401 `session_ended`. The other tabs of that browser share the one cookie, which is now cleared, so their next request carries none and returns 401 `unauthenticated` (D-093, FR-46 AC-130; server side of AC-131). The other sessions of the same person keep working (FR-46 AC-132).
- R29. The `auth` module exports `createSession(client, account, transport, { userAgent? })` (R53 for `client`), which creates a session for the account and returns `{ id, secret }`: the id of the new row and the cookie value or the token. R10 uses it; TOKI-097 and TOKI-026 call it, TOKI-026 inside its own transaction so that the link, the session and its `session_id` are committed together (TOKI-026 R32). It refuses an account that is not Active.
- R30. The `auth` module exports `endSessionsOfUser(client, userId, { reason, only?, except? })`. It ends the live sessions of the account, that is the rows whose `ended_at` is empty: those named by `only`, or all but the one named by `except`, or all. `reason` is required and is one of `revoked` and `deactivated` (R28 uses `signed_out` and R34 `replaced` through R52). The function sets `ended_at` and `ended_reason` and returns the ids it really ended, an empty list when there was none. After it, a request with any ended session is refused as in R27 (BR-29, D-158). TOKI-024 calls it with `deactivated`, TOKI-026 with `revoked`.
- R31. Each exchange creates its own session. A session created on one client is not accepted for a request that does not carry its cookie or token, and ending one session ends no other (FR-03 AC-008).
- R32. `GET /api/v1/auth/session` with a valid session returns status 200 with `user`: `id`, `email`, `displayName`, `role` (`member` or `admin`) and `language` (`en` or `vi`).
- R33. `DELETE /api/v1/auth/session` without a valid session also returns status 204 and clears the cookie.
- R34. When the exchange of R10 uses the cookie transport and the request already carries a valid session cookie, that earlier session is ended with the reason `replaced` through R52, and the cookie is replaced.
- R35. A new session stores its kind (`cookie` or `token`) and the first 512 characters of the `User-Agent` header of the request, for the device list of TOKI-026.

Safety
- R36. Among the routes of this work, no `GET` route creates or ends a session, and none creates a session without a code. A sign-in mail therefore cannot sign anyone in by a link (D-157).
- R37. No log line and no error body holds a code, a `requestId`, a session secret or a cookie value. The `auth` module writes no email address to the log.
- R38. The request and response bodies of the five routes are Zod schemas in `packages/shared`, and the routes validate with those same schemas. The numbers 6, 10 minutes, 5 tries, 5 requests, 20 requests per network address, 15 minutes, 60 seconds and 30 days are constants in one file, `packages/shared/src/auth/limits.ts`, used by the server and available to the screens and to TOKI-021 for the text of the mail: `CODE_LENGTH` (6), `CODE_TTL_SECONDS` (600), `CODE_MAX_WRONG_TRIES` (5), `CODE_REQUESTS_MAX` (5), `CODE_REQUESTS_WINDOW_SECONDS` (900), `CODE_RESEND_SECONDS` (60), `CODE_IP_REQUESTS_MAX` (20, used with `CODE_REQUESTS_WINDOW_SECONDS` for R56) and `SESSION_IDLE_DAYS` (30). The 10 minutes of the emergency link is one more constant of the same file, `EMERGENCY_LINK_TTL_SECONDS` (600), which TOKI-026 adds and uses (its R24 and R37); this work does not use it. The `User` schema of the shapes below is exported from the same package (`packages/shared/src/auth/schemas.ts`); TOKI-031 builds its own strict version of it for the bootstrap answer, so this schema is not strict and a field added to it later breaks no client.

Contract details and hardening
- R39. `GET /api/v1/auth/workspace` needs no session and returns status 200 with exactly `name`, the name of the workspace, and no other field (F01, F04, D-081).
- R40. After an accepted code request, the row in `login_codes` holds neither the 6 digits nor the `requestId` in a readable form: only the hashes of "Hashing" below.
- R41. Every accepted code request does the same work whatever the address: the same database statements run, and a code is drawn and hashed and its hash stored, also when no mail will be sent.
- R42. `details.retryAfterSeconds` is the number of whole seconds, rounded up, until a request for that address would be accepted, and is at least 1. The response also carries the header `Retry-After` with the same number. When R4 and R5 both apply, the answer is `code_request_limit`. For `rate_limited` (R56) it is the seconds until the oldest counted request of that route and network address is 15 minutes old; as refused requests are not counted, a client that waits that long is accepted.
- R43. In an exchange, marking the code used and creating the session are committed together or not at all. When creating the session fails, the code is still unused and the same exchange can be sent again.
- R44. The session check reads the `Authorization: Bearer` header when the request has one, and otherwise the cookie. A secret is accepted only in the way its session was created: a `cookie` session only from the cookie, a `token` session only from the header. A secret the server does not know, or one sent the other way, returns 401 `unauthenticated`. A request without a valid session for a path that does not exist returns 401, not 404.
- R45. A request with a body is accepted only with `Content-Type: application/json`. Any other type returns status 415 with the code `unsupported_media_type` and changes nothing. A request with no body is not refused by this rule, whatever its type, so a route with no body (TOKI-029 join and leave) is not affected; the schema of the route then decides.
- R46. A request of any method except `GET`, `HEAD` and `OPTIONS` (so `POST`, `DELETE`, `PATCH` and `PUT`, and any method added later) that carries an `Origin` header different from the app's own origin returns status 403 with the code `origin_not_allowed` and changes nothing. A request without an `Origin` header is not refused by this rule. The server sends no cross-origin (CORS) headers. Decided in this spec: the rule is a list of the methods that are exempt, not of the methods that are refused, so a route that uses a verb nobody thought of is covered (TOKI-024 concern 13, TOKI-029 concern 12).
- R47. R4, R5 and R6 count and cancel only rows whose purpose is `sign_in`. A request for a sign-in code never counts, cancels or deletes an invitation's code.
- R48. Each accepted code request also deletes up to 100 `sign_in` rows, of any address, that are 15 minutes old or more.
- R49. The `auth` module exports the code rules for TOKI-024 and TOKI-097: `createInvitationCode(client, { email, secret })`, which creates a code of purpose `invitation` for an address, bound to a secret the caller supplies, and returns the 6 digits; and `checkInvitationCode(client, { secret, code })`, which checks 6 digits against that secret and returns one of `ok`, `incorrect` with `triesLeft`, `locked` and `expired`, as separate results (the answers of R12 to R16, R18 not included: this function knows no account status). `client` is the database or an open transaction (R53): TOKI-024 calls `createInvitationCode` inside the transaction that inserts the invitation, so that a rolled-back invitation leaves no live code (TOKI-024 R6). The caller supplies a new secret for every code, a resend included, because `request_hash` is unique (TOKI-019 R14). They apply the same hashing (R40), 10 minutes (R14), single use (R15) and wrong tries and lock (R12, R13, R17) as a sign-in code, and a new invitation code cancels the earlier unused invitation codes of that address (D-082, D-136, D-137). They send no mail and apply no request limit (concern 4).
- R50. Every way of ending sessions (R28, R30, R34, R52) returns the ids of the sessions it ended and reports them, with the reason, to listeners that other modules register through `onSessionsEnded(listener)`, which the `auth` module exports. When the function opens its own transaction (R53), it reports after the commit. When the caller passed an open transaction, the function reports nothing, because the transaction may still be rolled back; the caller calls `reportSessionsEnded(ids, reason)`, also exported, after its own commit. A session that was already ended is not reported again. Callers that end sessions inside their own transaction and report after the commit: TOKI-024 for a deactivation (R30 with `deactivated`, then `reportSessionsEnded(ids, "deactivated")`), and TOKI-097 for an accepted invitation that brings back a deactivated account, which passes to `reportSessionsEnded(endedSessionIds, "deactivated")` the `endedSessionIds` that `acceptInvitation` of TOKI-024 returns after it ended them through R30 in the caller's transaction. TOKI-026 passes the database, so its functions report by themselves.
- R51. The `auth` module exports `pruneInvitationCodes(client, olderThan, limit)`, which deletes up to `limit` rows of purpose `invitation` of `login_codes` created before `olderThan` and returns the number deleted. TOKI-024 calls it with 8 days ago and 100 on every batch and every resend (its R33), because R48 removes only `sign_in` rows and an invitation's code cannot work 7 days and 10 minutes after its creation. This replaces the removal per invitation that TOKI-019 handed over. It never deletes a `sign_in` row.
- R52. The `auth` module exports `endSessionOfRequest(client, request, reason, { only? })`, which ends the one live session that the request carries, read as the check reads it (R44), or only the cookie one with `only: "cookie"`, and returns its id, or `null` when the request carries none, an unknown one, an ended one, or one of a Deactivated account. `reason` is `signed_out` or `replaced`. R28 and R33 use it with `signed_out`, R34 with `replaced` and `only: "cookie"`; TOKI-097 (its R21) and TOKI-026 (its R33) call it with `replaced`, so the three tickets use one function. It reports as in R50.
- R53. Every function of the `auth` module that writes (R29, R30, R49, R51, R52) takes as its first argument `client`, either the database or an open transaction. Given the database, it opens its own transaction; given a transaction, it joins it and commits nothing. Decided in this spec: this is the convention of `createAccount` (TOKI-020), so TOKI-024, TOKI-026 and TOKI-097 keep their writes and the session in one transaction and no ticket needs two edits of `auth`.
- R54. The codes `code_request_limit`, `code_resend_too_soon`, `code_incorrect`, `code_locked`, `code_expired`, `account_deactivated`, `unauthenticated`, `session_ended`, `origin_not_allowed`, `unsupported_media_type` and `rate_limited` are added to the registry of error codes of TOKI-004 in `packages/shared`, with the statuses of the tables under Design. `validation_failed` is the code of TOKI-004 and is not added. Whichever ticket is built first adds a code that others use; none adds it twice.
- R55. The session check puts the account on the request with `id`, `workspaceId`, `email`, `displayName`, `role`, `status` and `language`, read in the same statement as the session. The two read functions of `members` that `auth` calls, "find the account of an email address" and "get an account by id", take `client` as their first argument (a transaction is allowed) and return the same fields; `status` is `active` or `deactivated` and an address with no `users` row returns no account. TOKI-031 calls the second one inside its transaction to build `user`.
- R56. `POST /api/v1/auth/codes` and `POST /api/v1/auth/sessions` each accept at most 20 requests in 15 minutes from one network address. The counters are separate: one per route and per address, so requests to one route do not use up the other. Only requests that pass this limit are counted; a refused request is not counted and leaves no entry. The 21st returns status 429 with the code `rate_limited`, `details.retryAfterSeconds` and the header `Retry-After`, creates no code and sends no mail. The limit is the same for every body, so it reveals nothing about membership (BR-04). The network address is the one the proxy reports: the server reads the first value of `X-Forwarded-For` only when the connection comes from the proxy (Caddy in production, the dev proxy of TOKI-006), through the trust-proxy setting of the server, and uses the address of the connection otherwise, so a client cannot choose its own address by sending the header. The counter lives in the memory of the server process; it is lost on a restart, which is accepted for M2 (one process), because the limits per address of R4 and R5 and the tries of R12 and R13 are in the database and are not lost. The numbers are constants of R38 (concern 3).
- R57. This work counts and cancels only `sign_in` rows (R47). The decision of concern 4 is that one counter per address is shared by sign-in and invitation requests; TOKI-097 owns that change and must change R4, R5 and R47 of this spec so that rows of both purposes count for the limit of 5 in 15 minutes and for the 60 seconds, and must test that 5 invitation resends make the next sign-in request for that address return `code_request_limit` and the reverse. Cancelling (R6) stays per purpose.

## Design
### Data model
The tables come from TOKI-019, whose spec lists these columns for this work one for one. This work adds no table. If TOKI-019 is built without one of them, this work adds it in its own migration (concern 6).

`login_codes`, one row per accepted request:
- `id`, `workspace_id`, `created_at`.
- `purpose`: `sign_in` or `invitation`. This work creates `sign_in` rows through its route and `invitation` rows only through R49.
- `email`: the normalised address the request was made for, at most 254 characters (R7). Required. R4 and R5 count `sign_in` rows by this column.
- `user_id`: the account, or empty when the address has no Active or Deactivated account (R19).
- `request_hash`: SHA-256 of the `requestId` (for an invitation: of the secret the caller supplies). Unique.
- `code_hash`: see "Hashing" below. Always filled (R41).
- `expires_at`: `created_at` plus 10 minutes. The code is valid while the time is before `expires_at`.
- `wrong_tries`: starts at 0. The code is locked when it reaches 5.
- `used_at`, `cancelled_at`: empty until the code is used or cancelled.

`sessions`, one row per sign-in:
- `id`, `workspace_id`, `user_id`, `created_at`.
- `secret_hash`: SHA-256 of the session secret. Unique.
- `kind`: `cookie` or `token`.
- `user_agent`: the first 512 characters of the header.
- `last_used_at`: set at creation and on every request that passes the check.
- `ended_at`, `ended_reason` (`signed_out`, `replaced`, `revoked`, `deactivated`): empty while the session lives. A session is ended, not deleted.

Rules:
- All times are written by the server from the clock interface of TOKI-008, never by a database default, so tests can move the clock.
- A `sign_in` row is deleted by the first accepted code request, for any address, that comes after the row is 15 minutes old (R48): by then it counts for no limit and its code has expired. Each request removes at most 100 rows and adds 1, so the table cannot grow beyond the requests of the last 15 minutes plus a remainder that shrinks with every request. On a server where nobody asks for a code, the last rows stay until the next request; a timed clean-up can be added with the background jobs (TOKI-064, M4).
- There is no limit on the number of sessions per person; the log sets none.

### API
| Method | Path | Session | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/codes` | none | Request a code for an email address |
| POST | `/api/v1/auth/sessions` | none | Exchange a `requestId` and a code for a session |
| GET | `/api/v1/auth/session` | required | Return the signed-in person |
| DELETE | `/api/v1/auth/session` | optional | Sign out: end the session of this request |
| GET | `/api/v1/auth/workspace` | none | Return the workspace name for the sign-in card |

Shapes (JSON):
- `POST /auth/codes` request: `{ "email": string }`. Response 200: `{ "requestId": string, "expiresInSeconds": 600, "resendAfterSeconds": 60 }`.
- `POST /auth/sessions` request: `{ "requestId": string, "code": string of 6 digits, "transport"?: "cookie" | "token" }`. Response 200 with a cookie: `{ "user": User }`. Response 200 with a token: `{ "user": User, "token": string }`.
- `GET /auth/session` response 200: `{ "user": User }`.
- `DELETE /auth/session` response 204, no body.
- `GET /auth/workspace` response 200: `{ "name": string }`.
- `User`: `{ "id": string, "email": string, "displayName": string, "role": "member" | "admin", "language": "en" | "vi" }`.
- Every error: `{ "error": { "code": string, "message": string, "details"?: object } }` (TOKI-004).

The `requestId` is an opaque string of 43 characters (32 random bytes, base64url). A client sends it back unchanged with the code. It is a secret for the 10 minutes of its code: a client keeps it only where the code step lives, never in an address, and never logs it.

### Outcomes and what a client does with them
A client decides by `error.code`, not by the status alone: `account_deactivated` comes with 400 on the exchange and with 401 on the session check. The texts a person reads belong to TOKI-023; the journey is named where it gives one.

`POST /api/v1/auth/codes`, body `{ email }`:

| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 200 | none | none | Accepted; says nothing about membership. Body: `requestId`, `expiresInSeconds`, `resendAfterSeconds` | Show the code step; keep the `requestId` in place of any earlier one; allow "Resend code" after `resendAfterSeconds`; treat the code as expired after `expiresInSeconds` |
| 400 | `validation_failed` | as TOKI-004 | The address is missing or malformed; nothing was created | Keep the email step and show the field error |
| 429 | `code_request_limit` | `retryAfterSeconds` | 5 requests for this address in the last 15 minutes; no code, no mail | Show the wait of F05 ("Try again in N minutes") from `retryAfterSeconds`; any earlier `requestId` stays as it was |
| 429 | `code_resend_too_soon` | `retryAfterSeconds` | Less than 60 seconds since the last accepted request for this address; no code, no mail | Keep the earlier `requestId` if it has one and allow a new request after `retryAfterSeconds`. What the person reads is not decided (concern 10) |
| 429 | `rate_limited` | `retryAfterSeconds` | More than 20 requests in 15 minutes from this network address on `POST /auth/codes` or `POST /auth/sessions` (R56); no code, no mail | Show the same wait text as `code_request_limit` from `retryAfterSeconds` |

`POST /api/v1/auth/sessions`, body `{ requestId, code, transport? }`:

| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 200 | none | none | Signed in. Body: `user`, and `token` for the token transport; the cookie is set for the cookie transport | Drop the `requestId` and open the app as `user` |
| 400 | `validation_failed` | as TOKI-004 | `code` is not 6 digits or `requestId` is missing; not a wrong try | Not reachable from a correct screen; show nothing new |
| 400 | `code_incorrect` | `triesLeft` (4 to 1) | Wrong digits; the code still lives | Show the wrong-code message of F05 with `triesLeft`; let the person type again |
| 400 | `code_locked` | none | The 5th wrong try, or any try after it; this code will never work | Show the locked message of F05; the only way on is a new code request |
| 400 | `code_expired` | none | The code is 10 minutes old or more, was used, was cancelled by a newer one, or the `requestId` is not known | Show the expired message of F05 and offer a new code |
| 400 | `account_deactivated` | none | The digits were right; the account is Deactivated; no session; the code is used up | Show the deactivated message of F05 on the code step; a new code will not help |

`GET /api/v1/auth/session`, and every other route that requires a session:

| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 200 | none | none | (`GET /auth/session`) Body: `user` | Open the app as `user` |
| 401 | `unauthenticated` | none | No cookie or token, or one the server does not know | With no session in hand: show the sign-in page. While it believed itself signed in (the cookie ran out, or another tab signed out): treat as `session_ended` or go to the sign-in page (F06, F07) |
| 401 | `session_ended` | none | The session was signed out, replaced, revoked, or unused for more than 30 days | Show "Your session has ended" with the way to sign in again (F07) |
| 401 | `account_deactivated` | none | The account of the session is Deactivated | Show the deactivated form of F07, with no way to sign in |

`DELETE /api/v1/auth/session`:

| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 204 | none | none | The session of the request is ended, or there was none; the cookie is cleared | Show the sign-in page; a token client forgets its token |

`GET /api/v1/auth/workspace`:

| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 200 | none | none | Body: `name` | Show the name on the sign-in card |

Any route:

| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 403 | `origin_not_allowed` | none | A request that is not a `GET`, `HEAD` or `OPTIONS` came from a page of another origin | Not reachable from the app itself |
| 415 | `unsupported_media_type` | none | A body that is not JSON | Not reachable from the app itself |
| 404, 500 | as TOKI-004 | as TOKI-004 | Unknown path with a valid session; server failure | As for every feature (D-131) |

A failure of the mail layer is not an outcome a client sees (R8).

### How the parts run
How a request for a code runs:
1. Validate and normalise the address (R7).
2. In one transaction, with a lock on the address so two requests cannot both pass: check the 5 in 15 minutes (R4), then the 60 seconds (R5), against the `sign_in` rows of that address; cancel its unused `sign_in` codes (R6); delete up to 100 `sign_in` rows of any address that are 15 minutes old or more (R48); draw a code, hash it and insert the new row (R41).
3. Answer 200 with a new `requestId`.
4. After the answer, if the address has an Active or Deactivated account, hand the mail to the mail layer of TOKI-021 with the code and the account's language.

The same database work is done for every address, and the mail is sent after the answer, so neither the answer nor its timing depends on membership.

How an exchange runs: one `UPDATE` on the row found by `request_hash`, with the condition `wrong_tries < 5` on the update that adds a try, decides the result, so two requests cannot both win (R17). Order of the checks: unknown, used or cancelled row -> `code_expired`; `wrong_tries` already 5 -> `code_locked`; at or past `expires_at` -> `code_expired`; code does not match, or the row has no account -> add one wrong try, then `code_incorrect` or, at 5, `code_locked`; code matches -> mark used, then check the account status (R18) and create the session (R29). Marking the code used and inserting the session are in one transaction (R43); for a Deactivated account the code is marked used and nothing else is written.

How the session check runs: a hook on every `/api/v1` request. It reads the flag of R24 from the route that matched and lets a flagged route through without a session; a request that matches no route has no flag, so a path that does not exist answers 401 to a caller without a session and the list of routes is not shown to the outside (R44). Order:
1. Take the secret from the `Authorization: Bearer` header if there is one, otherwise from the cookie. None -> `unauthenticated`.
2. Hash it and load the session. No row, or a row of the other kind -> `unauthenticated`.
3. Load the account. Deactivated -> `account_deactivated`, whatever the state of the session (R27).
4. Session ended -> `session_ended`.
5. Last use more than 30 days ago -> `session_ended` (R25).
6. Set `last_used_at`, put the account on the request for the route to use (R55), and set the cookie again on the response (R26).

### Module boundaries
- The `auth` module owns `login_codes` and `sessions`: no other module reads or writes them. Others use the exported functions: the session check, create a session (R29), end the sessions of an account (R30), end the session of a request (R52), register a listener for ended sessions and report ended ones (R50), create, check and prune an invitation's code (R49, R51). TOKI-024 adds `getLastUsedAtByUser(userIds)` to this list (its R25), the one read of `sessions` that leaves the module.
- `users` belongs to the `members` module and `workspaces` to the `workspace` module (technical design, list of server modules). `auth` does not query them. It calls two read functions of `members` (R55), each taking `client` and returning `id`, `workspaceId`, `email`, `displayName`, `role`, `status` and `language`; and one read function of `workspace` that returns the id and the name of the one workspace (D-004). `status` is `active` or `deactivated`: "Invited" is not read from `users`, because an invitation is a row of the `invitations` table of TOKI-024, not a `users` row (TOKI-019 concern 2, TOKI-024 concern 2). The id of the workspace is the `workspace_id` of the rows this work writes, also for a request with no session; the name is the answer of R39. When this work is built before those modules exist, it adds these three read functions to them and nothing else (concern 6). `getAccountsByIds(client, ids, { lock? })` of TOKI-029 R19 is a different function (many accounts, `id`, `workspaceId`, `role`, `status`, no email); this work neither builds nor copies it, and TOKI-031 takes `workspaceId` from that function, with one more statement in its transaction, although the account read of R55 returns it too; this work does not change for that.
- Ended sessions: sign-out, replacement, R30 and R52 all go through one function in `sessions.ts`. It returns the ids it ended and, by R50, calls the registered listeners in the same process with the ids and the reason. TOKI-038 and TOKI-074 register one each. A session that only ran out of time is not reported; TOKI-038 finds that through the session check.
- The mail layer is `app.mail` (TOKI-021 R6, the decorator of `buildApp`); `auth` calls `sendSignInMail` on it and nothing else of the layer.

### Decided in this spec
These are technical choices the Blueprint leaves to the builder.
- The request binding is a `requestId` returned in the body and sent back with the code. Reason: it works the same for the cookie and the token client, and a code typed on another device has no `requestId` there (F04). Where the web app keeps it is for TOKI-023.
- Hashing: the session secret and the `requestId` have 256 bits of randomness, so a plain SHA-256 is enough. A 6-digit code has only a million values, so `code_hash` is an HMAC-SHA-256 of the `requestId` and the code, keyed with a server secret. The key is kept because the `requestId` is not a secret from the person who asked: anyone can ask for a code for a member's address and holds that `requestId`. Without the key, that person plus read access to the table (a leaked backup made in those 10 minutes, a read-only query hole) could try the million values offline and sign in as the member. With the key, the database alone is not enough. A missing key stops the server at start (TOKI-004 validates the environment); changing the key makes the codes of the last 10 minutes fail, and the person asks again. The secret is one new environment variable (concern 7).
- A used, a cancelled and an unknown code all answer `code_expired`. Reason: journey F05 has no separate message for them, and the right next step is the same: ask for a new code.
- Code errors use status 400, not 401 or 403, the deactivated account included (R18). Reason: D-131 maps 400 to a message under the field, which is where F05 puts all of them; it maps 403 to the shared no-access page, and the app treats 401 as "the session has ended" (F07).
- Boundaries, each stated here once:
  - Code, 10 minutes: valid while less than 10 minutes old; refused at exactly 10 minutes and after. AC-003 says a code "stops working 10 minutes after it was sent"; TS-005 tests just under and just over and does not fix the exact instant, so the instant is a choice of this spec. It also matches `expiresInSeconds`: a countdown that reaches 0 and the server agree.
  - Resend, 60 seconds: refused while the last accepted request is less than 60 seconds old; accepted at exactly 60 seconds (TS-009).
  - 5 in 15 minutes: a request counts while it is less than 15 minutes old; at exactly 15 minutes it no longer counts (TS-008).
  - Session, 30 days: valid up to and including exactly 30 days after the last use; refused after (AC-009, TS-014).
- Only accepted requests count toward R4 and R5; a refused request leaves no row.
- When both limits apply the answer is `code_request_limit` (R42). Reason: F05 has a text for that case, and its wait is the longer one.
- A session is renewed by one write per request, with no batching (concern 8).
- Cross-site requests. The cookie is `SameSite=Lax`, but that protects per site, not per origin: a page on another host of the same company domain is the same site. So the protection does not rest on it alone: a body must be JSON (R45), which a plain form on another page cannot send; a request of any method except `GET`, `HEAD` and `OPTIONS` from another origin is refused by its `Origin` header (R46), which also covers the public exchange route, so a page elsewhere cannot sign a browser in as someone else (R34); the server allows no cross-origin reads (R46); the cookie has no `Domain` attribute and the `__Host-` name, so another host of the domain cannot set or overwrite it (R21); and none of this work's `GET` routes changes anything (R36). There is no separate anti-forgery token. TOKI-091 reviews this (concern 9).
- `Secure` and the `__Host-` name are the default; they are dropped only for an explicit development value (R21). Reason: a wrong or missing value must fail on the safe side.
- Three codes on the session check (`unauthenticated`, `session_ended`, `account_deactivated`) let the app choose between the sign-in page and the two texts of F07. The account is checked before the session (R27). Reason: deactivation ends the sessions too (BR-29), and F07 and F41 want "This account has been deactivated" with no way to sign in, not "Your session has ended".
- A secret the server does not know answers `unauthenticated`, not `session_ended`. Reason: sessions are ended, not deleted, so an unknown secret was never a session.
- The header wins over the cookie, and a secret works only in the way it was issued (R44). Reason: a header is sent on purpose and a cookie by itself, so a stale cookie must not block a valid token; and the `Origin` rule protects cookie sessions, so a cookie secret must not be usable where that rule does not look.
- A path that does not exist answers 401 to a caller without a session (R44); the 404 of TOKI-004 is for signed-in callers.
- Signing out twice is not an error (R33), so a second tab that signs out after the first gets the same result.
- A new sign-in in a browser that is already signed in replaces that browser's session (R34). Asking the person first (D-080) is done by the screens before they call the API.
- The workspace name is read from `GET /api/v1/auth/workspace` (R39). Reason: journeys F01 and F04 put the name on the sign-in card, D-091 accepts the journeys as the baseline, and D-081 takes the name away only from the page for an unrecognised link. The route is part of the sign-in page, the one public page of BR-01, and returns the name only. It sits in the `auth` routes because it exists for that page.
- `user_agent` is cut to 512 characters (R35). Reason: the device list needs the browser and system names, and a header is otherwise as long as the sender likes.
- Pruning is done inside the code request, 100 rows at a time (R48). Reason: the background jobs arrive in M4, and until then nothing else would remove the rows of addresses that asked once.
- The code rules live in `auth` and are exported for invitations (R49), with a `purpose` column to keep the two kinds apart (R47). Reason: D-136 and D-137 apply to both codes, and one implementation of the expiry, the lock and the hashing is safer than two.
- Module interfaces for `users` and `workspaces` (Module boundaries). Reason: the technical design forbids reading another module's tables.
- A route says itself that it needs no session (R24). Reason: four tickets after this one add public routes (TOKI-026, TOKI-097 three, and this one's own four); a list in `auth` would be edited by each, and a forgotten entry would make a route public or private without a test noticing, where a flag sits beside the route it opens.
- Every write function of `auth` takes the database or a transaction (R53), and reports ended sessions after the commit of the transaction that made them (R50). Reason: TOKI-024, TOKI-026 and TOKI-097 each need the code, the session or the end of a session inside their own transaction; one rule in this spec is cheaper than a separate request from each.
- `Invited` is not a status of `users` (Module boundaries). Reason: the table has two values and TOKI-024 holds the invitation; reading Invited from `users` would make the function return a value that nothing can store.
- `endSessionOfRequest` (R52) is one function for three tickets. Reason: replacing the browser's session on sign-in, on accepting an invitation and on the emergency link is the same step, and TOKI-097 and TOKI-026 each asked for it.
- The origin rule lists the exempt methods, not the refused ones (R46). Reason: two later specs ask for `PATCH`; a list of refused verbs would be asked to grow again.

### Layout
```
apps/server/src/modules/auth/
├─ index.ts        public entry: the session check, createSession (R29), endSessionsOfUser (R30),
│                  endSessionOfRequest (R52), onSessionsEnded and reportSessionsEnded (R50),
│                  createInvitationCode, checkInvitationCode (R49), pruneInvitationCodes (R51)
├─ routes.ts       the five routes
├─ codes.ts        request and exchange rules, pruning
├─ sessions.ts     create, check, renew, end
├─ guards.ts       JSON-only bodies (R45) and the Origin rule (R46)
├─ secrets.ts      random values, SHA-256, HMAC
└─ *.test.ts       integration tests
packages/shared/src/auth/
├─ schemas.ts      request, response and User schemas (R38)
└─ limits.ts       the constants of R38 (CODE_*, SESSION_IDLE_DAYS)
```

## Testing
- Written test-first, as server integration tests with Vitest against the real Postgres of TOKI-008, the test clock of TOKI-008 and a fake mail layer that records what it was asked to send. No real address, name or mail server is used; addresses are of the form `sam@example.com`.
- Request: one mail with a 6-digit code for an Active account and for a Deactivated one (R2, R3); no mail and the same status and fields for an unknown address and for an address that has only an invitation, each with a new `requestId` (R1, R9); the 6th request refused and accepted again at exactly 15 minutes (R4, TS-007, TS-008); refused at 59 seconds and accepted at 60 (R5, TS-009); the earlier code refused after a new one (R6, TS-010); a malformed address (R7); a mail layer that fails and one that never answers: the response arrives all the same (R8).
- Exchange: success (R10, TS-001); right code with another `requestId` (R11); `triesLeft` 4 to 1, then locked, then the right code refused, and `code_expired` once a newer code is requested (R12, R13, TS-002, TS-006); accepted at 9 minutes 59 seconds, refused at exactly 10 minutes and after (R10, R14, TS-005); second use (R15); unknown `requestId` (R16); two exchanges at once give one session, and 10 wrong tries at once leave the count at 5 (R17); Deactivated account answers 400 and the code is used up (R18); `requestId` of an unknown address: wrong, locked, and expired without a lock (R19); 5 digits, 7 digits, letters (R20, TS-003, TS-004).
- Sessions: the cookie name and attributes in development, in production mode and with the environment value missing, and no `Domain` (R21); the token transport (R22); the database holds no cookie value or token (R23); a protected test route answers 401 without a session and 200 with one (R24, TS-012); still valid at exactly 30 days, refused at 31, and a use on day 29 moves the end (R25, TS-014); the cookie set again (R26); an ended session answers `session_ended`, a session of a Deactivated account `account_deactivated`, and a session that is both ended and of a Deactivated account `account_deactivated` (R27); sign-out, then the same cookie value refused with `session_ended`, a request with no cookie refused with `unauthenticated`, while a second session of the same person still works (R28, R31, TS-013, TS-211); the two exported functions (R29, R30); the current session (R32); sign-out without a session (R33); replacing a session (R34); kind stored and a 2,000-character user agent cut to 512 (R35).
- Contract with the other tickets: a route registered with `config: { public: true }` answers without a session and a route without the flag answers 401 (R24); `PATCH` and `PUT` with a foreign `Origin` answer 403 (R46); a request with no body and a form type passes R45 (R45); `endSessionsOfUser` with a reason returns the ids it ended, only the live ones, and with `only` and `except` (R30); `endSessionOfRequest` returns the id, and `null` for no cookie, an unknown, an ended and a deactivated one (R52); a function called with an open transaction that is rolled back leaves the session, the code or the end undone and reports nothing, and `reportSessionsEnded` after a commit reaches the listener (R50, R53); `pruneInvitationCodes` deletes only `invitation` rows older than the time, at most `limit` (R51); an address of 255 characters answers 400 `validation_failed`, writes no row and sends no mail (R7); the registry holds the codes of R54; the account on the request and the two account reads carry `workspaceId` and accept a transaction (R55); the constants of R38 exist under those names, and the `User` schema exported from `packages/shared` parses the `user` of R10 and R32 and does not reject an added field.
- Safety: a list of the registered routes of this work shows no `GET` that writes (R36); the log captured during the tests is searched for the code, the `requestId`, the session secret and the email address (R37); the routes reject a body that fails the shared schema (R38).
- Contract details and hardening: the workspace name without a session, and the body has no other field (R39); after a request, every column of the `login_codes` row is searched for the 6 digits and for the `requestId` (R40); a request for an unknown address stores a row with a `code_hash` and runs the same statements as one for a member (R41); `retryAfterSeconds` at 59.2 seconds left is 60, equals the `Retry-After` header, and a request that breaks both limits answers `code_request_limit` with the longer wait (R42); a session insert made to fail leaves the code unused, and the same exchange then succeeds (R43); a stale cookie with a valid token passes, a cookie secret sent as a token and a token sent as a cookie are refused, an unknown secret answers `unauthenticated`, an unknown path answers 401 without a session and 404 with one (R44); a form-encoded and a `text/plain` body answer 415 and create nothing (R45); a `POST`, a `DELETE` and a `PATCH` with a foreign `Origin` answer 403 and change nothing, the same without `Origin` pass, and no response carries an `Access-Control-` header (R46); a sign-in request for an address that has an invitation code leaves that code usable and does not count it (R47); rows of other addresses older than 15 minutes are gone after a request, at most 100 at a time (R48); an invitation code through the exported functions: right, wrong with tries left, locked, expired at 10 minutes, used once, cancelled by a newer one (R49); a listener receives the ids and the reason for sign-out, replacement and R30 (R50).
- TS-210 (the other tab shows the sign-in page without a reload) is not a test of this work: the server side is covered by the R28 test above, and the rest by TOKI-099 and TOKI-023.
- Network address limit (R56): the 21st request from one address to each of the two routes returns 429 `rate_limited` with `retryAfterSeconds` and `Retry-After`, creates no code and sends no mail; the 20th is accepted; a request from another address is accepted; 20 requests to one route do not refuse the other route; a client that keeps sending after the 21st is refused with an unchanged count, and one that waits the `retryAfterSeconds` it was given is accepted; after 15 minutes of the test clock the address is accepted again; the same answer for a member and a non-member address; a spoofed `X-Forwarded-For` from a connection that is not the proxy changes nothing.
- The limits are tested by moving the test clock, never by waiting.

## Data safety
- Codes, `requestId`s and session secrets are stored only as hashes and never logged (R23, R37, R40).
- The server secret for the code hash lives in `.env`, never in git.
- The answer to a code request and its timing do not show whether an address is a member (R1, R9, R41).
- An email address is personal data. `login_codes` holds it, also for people who are not members, until the first accepted code request that comes 15 minutes or more after the row was made (R48); it is not written to the log by this module.
- The workspace name is readable by anyone who can reach the server (R39). Nothing else is.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I03, alongside TOKI-019, 020, 021, 023, 026 and 099 | Planning fact; Scope "Out" draws the line with each of them. |
| Milestone: M2 | Planning fact; no design impact. |
| Size: L | Scope: five routes, the session check and their tests; no screen, no table, no mail template. |
| Needs: TOKI-019 and TOKI-021 (plan change: also TOKI-020) | Data model lists the columns used; R2 and R8 call the mail layer; R7 calls `parseEmail` of TOKI-020, so TOKI-020 is a dependency too. TOKI-020 does not need this work. Concern 6. |
| Needed by: TOKI-023, TOKI-024 and TOKI-026 | "Outcomes and what a client does with them" for the screens; R24, R29, R30, R49 to R55 for the other server modules (TOKI-097, TOKI-031 and TOKI-038 also use them). |
| Agreed scope: request a code, exchange it for a session, sign out; cookie and token | R1, R10, R28; R21 and R22. |
| 6-digit emailed code; no password | R2, R3, R20. No route takes a password. |
| A code is valid for 10 minutes | R10, R14; the exact instant under "Decided in this spec". |
| A code works once | R15, R17, R43. |
| A code works only for the request that asked for it | R11. |
| Locked after the 5th wrong try; a wrong try says how many are left | R12, R13. The decided limits still allow guessing across codes: concern 3. |
| At most 5 code requests per address in 15 minutes | R4, R9, R42. |
| A code can be sent again only after 60 seconds | R5, R42. |
| A new code cancels the earlier one | R6, R47. |
| Same answer whether or not the address is a member; no mail to an address not in the workspace | R1, R2, R8, R9, R19, R41. |
| A deactivated account is refused after a correct code | R18. |
| A session lasts 30 days and renews on every use | R25, R26. |
| A session on one device does not sign in another device | R31, R44. |
| Nothing is readable without a session; sign-in is the only public page | R24, R44. Four routes of this work carry the public flag: the two sign-in routes, sign-out, and the workspace name for the sign-in card (R39). None returns workspace content. A route of a later ticket is public only if it sets the flag itself. |
| The sign-in card shows the workspace name to a person with no session | R39. |
| The mail carries the code only; nothing in the mail signs anyone in without the code | R36. The template itself is TOKI-021. |
| The sign-in mail is in the language the member chose | R2 passes the account's language to the mail layer. |
| Sign-out ends the session on that device; other tabs at once; other devices stay signed in | Server side only: R28, R31, R33. Every later request from any tab of that browser is refused. Making the other tabs react before their next request is TOKI-099, on the session state of TOKI-023 (Scope). |
| Two session kinds: cookie for web, header token for apps | R21, R22, R44. |
| The API lives under `/api/v1`; fields are only added | API table; R38 keeps the shapes in one shared place. |
| Codes are stored hashed | R40; R23 for session secrets. |
| Two roles, Member and Admin; no Owner | R32: `role` is `member` or `admin`. |
| English is the default interface language | Error `message` is English and not translated by the server (TOKI-004); a mail is in the account's language, which is English unless the member chose Vietnamese (D-018, D-180). |

## Open questions from the intent
- Is a code sent to an address with an unused invitation (state "Invited")? Not answered. Carried forward as concern 1.
- Is the person told when the sign-in mail cannot be sent? Not answered. Carried forward as concern 2.
- Is there a limit per network address or for the whole server, besides the limit per email address? Not answered. Carried forward as concern 3, with the guessing rate the decided limits allow.
- Do "Resend code" requests on an invitation count toward the same 5 in 15 minutes? Not answered. Carried forward as concern 4.
- Which ticket supplies the workspace name to the sign-in page? Answered: this work, by a public read of the name only (R39). Evidence: journeys F01 and F04 show the name on the sign-in card and are accepted as the baseline by D-091; D-081 removes the name only from the page for an unrecognised link; FR-03 TS-011 forbids channel names, messages and member names on a signed-out page, not the workspace name. See concern 5.
- Clarify gap: does the server enforce the 60 seconds, or only the button? Answered: the server enforces it (R5). Evidence: ticket TOKI-022 says "a resend only after 60 seconds" in the API scope (D-038, D-082).
- Clarify gap: is a code mailed to a Deactivated account? Answered: yes; the refusal comes after the correct code (R2, R18). Evidence: journey F05, accepted as the baseline by D-091.
- Clarify gap: does the 30 days count from sign-in or from the last use? Answered: from the last use (R25). Evidence: D-138. FR-03 still lists D-138 and D-093 as open, but the decision log has D-138 as an accepted assumption and D-093 as confirmed; this spec follows the log.
- Clarify gap: does "Sign out" ask for confirmation (D-178, Open)? Not a question for the API: the route is the same with or without a confirmation. It stays with TOKI-099.
- Clarify gap: how long does a session from the emergency link last (D-179, Open)? Not a question for this work: TOKI-026 creates that session through R29, which makes a normal session; a different length would be a change there.

## Areas of concern
1. An address with an unused invitation asks for a code on the normal sign-in page. The decision log does not say what happens. This spec treats it as an address with no account: same answer, no mail (R1, R2), because an invited person has no `users` row (TOKI-019, TOKI-024) and the account read of R55 finds none; the invitation joins through its own code (TOKI-097) and only an Active account can sign in. The request leaves the invitation's code untouched (R47). Assumption, not a decision; it needs the product owner. Owner: Thanh Truong. Decided by Thanh Truong (2026-11-18): the assumption stands. An Invited address gets the same answer and no mail.
2. When the mail server fails, the person who asked for a code is not told (R8): telling them would show that the address is a member (BR-04). They see "Check your email" and no mail arrives; "Resend code" after 60 seconds is their only step, and the emergency link (D-159) is the way out when mail stays down. D-099 decides mail failure for invitations only. Not decided for sign-in. A known limit of M2 adds to this: the mail is handed over inside the web process after the answer, with no retry, so a crash or restart between the answer and the send loses the mail and nobody is told. The technical design puts mail in the background jobs; when TOKI-064 lands (M4) the send moves to the queue and gets its retries. Owner: Thanh Truong. Decided by Thanh Truong (2026-11-18): accepted for M2. The person is not told and sees "Check your email"; the retry follows with TOKI-064 (M4).
3. The limits per email address (D-038) and per code (D-137) leave three openings to anyone who can reach the server (NFR-07) and knows addresses, with no access to any mailbox. R56 closes the part that a limit per network address can close: 20 requests in 15 minutes to each of the two public routes. No cap on wrong tries across the codes of one address and no ceiling for the whole server is added now; TOKI-091 (M6) reviews them. The openings: (a) Guessing codes online. The `requestId` is returned to whoever asks, so it does not stop this. Per address: 5 codes in 15 minutes with 5 tries each is 25 guesses per 15 minutes, 2,400 per day, each with 1 chance in 1,000,000: about 0.24% per day and about 7% in 30 days for one address. Against all 200 addresses of a workspace (NFR-04): 480,000 guesses per day, about a 38% chance per day that one account is opened. (b) Locking a member out. Any accepted request cancels the code the member is about to type (R6) and blocks the member's own request for 60 seconds (R5); five requests use up the 15 minutes (R4). One request a minute for 5 minutes, repeated every 15, keeps a known address out for as long as the sender likes; the member's valid code answers `code_expired`. The only way out is the emergency link (D-159), which needs server access. D-082 decided the cancel for "Resend code" pressed by the same person and did not consider a second requester. (c) Mail and rows. Each accepted request mails the member, up to 480 mails a day per address, and one sender can ask for codes for many addresses, each storing a row (R48 bounds how long, not how many in 15 minutes). The options considered were a limit per network address (taken, R56), a cap on wrong tries per address across codes (not taken now: it stops (a) but makes (b) easier unless combined with the first) and a ceiling on code requests for the whole server (not taken now). Owner: Thanh Truong. Decided by Thanh Truong (2026-11-18): a limit per network address, R56, of 20 requests in 15 minutes on each of `POST /auth/codes` and `POST /auth/sessions`, one counter per route and address, refused requests not counted. No cap on wrong tries across codes and no ceiling for the whole server now; TOKI-091 reviews them. The figure 20 was confirmed by Thanh Truong in chat on 2026-11-18; it is a constant in `packages/shared` (R38).
4. "Resend code" on an invitation (TOKI-097) also creates codes for an address. The question was whether those count toward the same 5 in 15 minutes and the same 60 seconds as sign-in requests. Until TOKI-097 lands, the two kinds are kept apart by the `purpose` column: this spec counts and cancels only `sign_in` rows (R47), and the functions of R49 apply no request limit. Owner: Thanh Truong. Accepted by Thanh Truong (2026-11-18): one counter per address, shared by sign-in and invitation requests, as D-038 says "per email". This work keeps counting `sign_in` rows only (R47); R57 hands the change to TOKI-097 with its test.
5. The sign-in page shows the workspace name (F01, F04) to a person with no session, while BR-01 lets nothing be read without one. Answered: the name is part of the sign-in page, the one public page, and this work supplies it by a public read of the name only (R39); TOKI-023 shows it. Evidence: F01 and F04, accepted as the baseline by D-091; D-081. It means the workspace name can be read by anyone who can reach the server. Owner: Thanh Truong.
6. The columns and the read functions this work relies on. Decided in this spec: the tables are TOKI-019's, whose spec lists the columns under Data model for this work one for one (including `login_codes.email` of at most 254 characters, `purpose` and a nullable `user_id`), so this work needs no migration unless that spec changes; the three read functions of the `members` and `workspace` modules (Module boundaries, R55) are added by whichever of this work, TOKI-020, TOKI-024 and TOKI-027 is built first, taking `client` as their first argument, and the others import them. `parseEmail` (R7) is the same case: this work needs TOKI-020, and TOKI-020 needs nothing of this work. `getAccountsByIds` is TOKI-029's and is not copied (Scope). If a later change of TOKI-019 or those tickets differs, the difference is settled in their specs or by a migration here. Owner: Thanh Truong.
7. This work needs two new environment values and one existing one, and TOKI-096 owns the variable names and the inventory: the server secret for the code hash (the name `AUTH_CODE_SECRET` is a proposal); the app's own origin, compared with the `Origin` header (R46), which TOKI-026 also reads to build the emergency link and TOKI-024 for the Join address, so there is one value and no second (the name is a proposal for TOKI-096); and the environment name of TOKI-004, whose allowed values are `development` and `production` (TOKI-096 R12), which R21 reads, so no third variable is added. TOKI-096 takes the two names. Owner: Thanh Truong. Decided by Thanh Truong (2026-11-18): the names `AUTH_CODE_SECRET` and the app origin value are accepted as proposals for TOKI-096, which may rename them.
8. Renewing "on every use" (D-138) is one database write per request (R25) and one `Set-Cookie` per response (R26). Decided in this spec: one write per request and no batching, because for 200 people it is expected to be cheap and a period would be a new number that the log does not give. It is not measured; if TOKI-089 shows a cost, limiting the write to once per period needs a decision and a number then. Owner: Thanh Truong.
9. The Blueprint's technical design does not say how the web app is protected against forged cross-site requests. Decided in this spec: JSON-only bodies, the `Origin` rule for every method except `GET`, `HEAD` and `OPTIONS`, no cross-origin headers, a host-only cookie and no writing `GET` route among its own (R21, R36, R45, R46). TOKI-091 reviews the choice later. Two hand-offs follow. Every later ticket must keep "no `GET` changes anything", which this work cannot enforce for routes it does not own. And the emergency link of D-159 (F43) is by decision a sign-in without a code; TOKI-026 designs it as a page that posts (its R34, `POST` only, with the `Origin` rule), not a `GET` that creates the session. Owner: Thanh Truong.
10. `code_resend_too_soon` can reach a person who never pressed "Resend code": "Use a different email" and back, a second tab, or another person asking for the same address inside the 60 seconds. The server side is decided (R5; D-038, D-082). What the person reads is not: F05 has no text for it. Proposal in the TOKI-023 spec, not a decision: show the code step without a new mail and let "Resend code" wait for `retryAfterSeconds`; that only works while the client still holds the earlier `requestId`. The wording and the behaviour are for TOKI-023 to settle with the product owner. Owner: Thanh Truong. Accepted by Thanh Truong (2026-11-18): the server side stays as R5. The wording and the behaviour on screen are settled in the TOKI-023 spec.
