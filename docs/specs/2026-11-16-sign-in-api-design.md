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
  - The functions that other server modules call to start and end sessions, to hear that sessions ended, and to create and check an invitation's code.
  - Server integration tests for all of the above.
- Out (not now):
  - The `users`, `login_codes`, `sessions` and `devices` tables and their migrations: TOKI-019. This work reads and writes them; the columns it needs are listed under Data model.
  - The mail layer and the sign-in mail template (code only, no button, English and Vietnamese): TOKI-021. This work calls it with the address, the code and the language.
  - Every screen: the email step, the code step, the 7 error messages, "Your session has ended": TOKI-023. "Sign out" in the account menu: TOKI-099.
  - Other tabs of the same browser on sign-out (D-093). This work owns the server side only: the tabs share one session, so once it is ended every later request from any tab is answered as not signed in (R28). The signal that makes the other tabs react at once, without waiting for their next request, belongs to TOKI-099. The session state in the web app that reacts to an ended session belongs to TOKI-023.
  - Invitations: creating one, its mail, its link, its endpoint, "Resend code" on an invitation, accepting it, reactivating a deactivated person: TOKI-024 and TOKI-097. They do not write the code rules again: they create and check the invitation's code through the functions of R49 and start the session through the function of R29.
  - Listing a person's sessions, signing out another device or all others, and the emergency sign-in link: TOKI-026. It uses the functions of R29 and R30. The link is the one sign-in without a code (D-159); how it starts a session is designed there (concern 9).
  - Calling R30 when an Admin deactivates someone: TOKI-024.
  - Closing the realtime connection of an ended session: TOKI-038. It hears about ended sessions through R50.
  - Removing a device's push registration on sign-out: TOKI-074.
  - Guest sign-in: phase 5.
  - A limit per network address or for the whole server, and a cap on wrong tries across codes: not decided (concern 3). This work builds none.

## Requirements
Request a code
- R1. `POST /api/v1/auth/codes` with a well-formed email address returns status 200 and a body with exactly `requestId`, `expiresInSeconds` (600) and `resendAfterSeconds` (60). Every accepted request returns a new `requestId`. The status and the set of body fields are the same for the address of an active account, a deactivated account, an invited person (assumption, concern 1) and an address nobody uses (BR-04).
- R2. For the address of an account whose status is Active or Deactivated, an accepted request hands exactly one sign-in mail to the mail layer, with that address, the code and the language saved on the account (D-180). For an address with no account it hands over no mail (F05). For the address of an Invited person it also hands over no mail; this is an assumption, not a decision (concern 1).
- R3. A code is 6 decimal digits, leading zeros kept, drawn from a cryptographic random source (D-011).
- R4. When 5 accepted requests for one address are less than 15 minutes old, the next request for that address returns status 429 with the code `code_request_limit` and `details.retryAfterSeconds`; it creates no code and sends no mail. Once the oldest of the 5 is 15 minutes old, a request is accepted again (D-038, FR-02 AC-004).
- R5. A request made less than 60 seconds after the last accepted request for the same address returns status 429 with the code `code_resend_too_soon` and `details.retryAfterSeconds`; it creates no code and sends no mail. At 60 seconds the request is accepted (D-038, D-082, FR-02 AC-005).
- R6. An accepted request cancels every earlier unused sign-in code of that address: an exchange with an earlier `requestId` fails with `code_expired`, with the right digits too (D-082, FR-02 AC-006).
- R7. The address is trimmed and put in lower case before any check. A value that is not a well-formed email address returns status 400 with the code `validation_error`, creates no code and does not count toward R4 or R5.
- R8. The response of R1 is sent without waiting for the mail. When the mail layer fails or never answers, the response is unchanged and one log line records the failure (concern 2).
- R9. R4 and R5 count requests the same way for every address, whether or not it belongs to an account, so the limits reveal nothing about membership (BR-04).

Exchange a code for a session
- R10. `POST /api/v1/auth/sessions` with a `requestId` and the code that was mailed for it, sent less than 10 minutes after the code was created, for an Active account, returns status 200 with `user`, and creates one session for that account (D-136, FR-01 AC-001).
- R11. A code is accepted only together with the `requestId` returned by the request that created it. The right digits with any other `requestId` do not create a session (F04: the code belongs to the request).
- R12. A wrong code returns status 400 with the code `code_incorrect` and `details.triesLeft`: 4 after the 1st wrong try, then 3, 2 and 1. No session is created (D-137, F05).
- R13. The 5th wrong try returns status 400 with the code `code_locked`. From then on every exchange for that `requestId`, with the right digits too, returns `code_locked`, until the code is cancelled by a newer one (R6) or its row is removed (R48); after that the answer is `code_expired` (D-137, FR-01 AC-003).
- R14. An exchange sent 10 minutes or more after the code was created returns status 400 with the code `code_expired` and does not count as a wrong try (D-136, FR-01 AC-003).
- R15. A code works once: after a successful exchange, a second exchange with the same `requestId` and code returns `code_expired` and creates no session (BR-02).
- R16. An exchange with a `requestId` the server does not know returns `code_expired`.
- R17. When two exchanges with the right code arrive at the same time, exactly one creates a session. Wrong tries sent at the same time never give more than 5 tries in total.
- R18. A correct code for a Deactivated account returns status 400 with the code `account_deactivated`, creates no session and uses up the code (F05).
- R19. For a `requestId` that was given to an address with no Active or Deactivated account, no code is ever right: a 6-digit code answers `code_incorrect` with `triesLeft`, the 5th one and every later one `code_locked`, and a code that reached 10 minutes without being locked `code_expired`, in the same order as for an account.
- R20. A `code` that is not exactly 6 digits, or a missing `requestId`, returns status 400 with the code `validation_error` and does not count as a wrong try (FR-01 AC-002).

Sessions
- R21. With `transport` `"cookie"` (the default) the response of R10 sets the session cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age=2592000` (30 days, D-011) and no `Domain` attribute, under the name `__Host-toki_session`. Only when the environment is explicitly set to development is `Secure` left out and the name `toki_session`; a missing or unknown value counts as production. The body holds no token.
- R22. With `transport` `"token"` the response of R10 holds `token` in the body and sets no cookie. A later request is signed in by the header `Authorization: Bearer <token>`.
- R23. The session secret is 32 random bytes. The database stores only its SHA-256 hash; neither the cookie value nor the token can be read back from the database.
- R24. Every route under `/api/v1` requires a valid session, except `POST /api/v1/auth/codes`, `POST /api/v1/auth/sessions`, `GET /api/v1/auth/workspace` (R39) and sign-out (R33). Without a cookie or token the response is status 401 with the code `unauthenticated` and holds no workspace data (BR-01, FR-03 AC-007).
- R25. A session is valid up to and including 30 days after its last use. Each request that passes the check sets the last use to now. A request made more than 30 days after the last use returns status 401 with the code `session_ended` (D-011, D-138, FR-03 AC-009).
- R26. Each response to a request that passed the check with a cookie sets the cookie again with `Max-Age=2592000`, so the cookie lives as long as the session.
- R27. The check looks at the account before the session. A request with a session whose account is Deactivated returns status 401 with the code `account_deactivated`, also when that session was ended (F07, F41). Otherwise a request with a session that was ended (R28, R30, R34) returns status 401 with the code `session_ended`.
- R28. `DELETE /api/v1/auth/session` ends the session of the request, clears the cookie and returns status 204. After it, a request that still carries that cookie value or token returns 401 `session_ended`. The other tabs of that browser share the one cookie, which is now cleared, so their next request carries none and returns 401 `unauthenticated` (D-093, FR-46 AC-130; server side of AC-131). The other sessions of the same person keep working (FR-46 AC-132).
- R29. The `auth` module exports a function that creates a session for a given account and transport and returns the cookie value or the token. R10 uses it; TOKI-097 and TOKI-026 call it. It refuses an account that is not Active.
- R30. The `auth` module exports a function that ends every session of a given account, with an option to keep one. After it, a request with any ended session is refused as in R27 (BR-29, D-158).
- R31. Each exchange creates its own session. A session created on one client is not accepted for a request that does not carry its cookie or token, and ending one session ends no other (FR-03 AC-008).
- R32. `GET /api/v1/auth/session` with a valid session returns status 200 with `user`: `id`, `email`, `displayName`, `role` (`member` or `admin`) and `language` (`en` or `vi`).
- R33. `DELETE /api/v1/auth/session` without a valid session also returns status 204 and clears the cookie.
- R34. When the exchange of R10 uses the cookie transport and the request already carries a valid session cookie, that earlier session is ended and the cookie is replaced.
- R35. A new session stores its kind (`cookie` or `token`) and the first 512 characters of the `User-Agent` header of the request, for the device list of TOKI-026.

Safety
- R36. Among the routes of this work, no `GET` route creates or ends a session, and none creates a session without a code. A sign-in mail therefore cannot sign anyone in by a link (D-157).
- R37. No log line and no error body holds a code, a `requestId`, a session secret or a cookie value. The `auth` module writes no email address to the log.
- R38. The request and response bodies of the five routes are Zod schemas in `packages/shared`, and the routes validate with those same schemas. The numbers 6, 10 minutes, 5 tries, 5 requests, 15 minutes, 60 seconds and 30 days are constants in one file of `packages/shared`, used by the server and available to the screens.

Contract details and hardening
- R39. `GET /api/v1/auth/workspace` needs no session and returns status 200 with exactly `name`, the name of the workspace, and no other field (F01, F04, D-081).
- R40. After an accepted code request, the row in `login_codes` holds neither the 6 digits nor the `requestId` in a readable form: only the hashes of "Hashing" below.
- R41. Every accepted code request does the same work whatever the address: the same database statements run, and a code is drawn and hashed and its hash stored, also when no mail will be sent.
- R42. `details.retryAfterSeconds` is the number of whole seconds, rounded up, until a request for that address would be accepted, and is at least 1. The response also carries the header `Retry-After` with the same number. When R4 and R5 both apply, the answer is `code_request_limit`.
- R43. In an exchange, marking the code used and creating the session are committed together or not at all. When creating the session fails, the code is still unused and the same exchange can be sent again.
- R44. The session check reads the `Authorization: Bearer` header when the request has one, and otherwise the cookie. A secret is accepted only in the way its session was created: a `cookie` session only from the cookie, a `token` session only from the header. A secret the server does not know, or one sent the other way, returns 401 `unauthenticated`. A request without a valid session for a path that does not exist returns 401, not 404.
- R45. A request with a body is accepted only with `Content-Type: application/json`. Any other type returns status 415 with the code `unsupported_media_type` and changes nothing.
- R46. A `POST` or `DELETE` request that carries an `Origin` header different from the app's own origin returns status 403 with the code `origin_not_allowed` and changes nothing. A request without an `Origin` header is not refused by this rule. The server sends no cross-origin (CORS) headers.
- R47. R4, R5 and R6 count and cancel only rows whose purpose is `sign_in`. A request for a sign-in code never counts, cancels or deletes an invitation's code.
- R48. Each accepted code request also deletes up to 100 `sign_in` rows, of any address, that are 15 minutes old or more.
- R49. The `auth` module exports the code rules for TOKI-097: one function that creates a code of purpose `invitation` for an address, bound to a secret the caller supplies, and returns the 6 digits; and one that checks 6 digits against that secret. They apply the same hashing (R40), 10 minutes (R14), single use (R15) and wrong tries and lock (R12, R13) as a sign-in code, and a new invitation code cancels the earlier unused invitation codes of that address (D-082, D-136, D-137). They send no mail and apply no request limit (concern 4).
- R50. Every way of ending sessions (R28, R30, R34) returns the ids of the sessions it ended and reports them, with the reason, to listeners that other modules register through a function the `auth` module exports.

## Design
### Data model
The tables come from TOKI-019. This work adds no table. It needs these columns; if TOKI-019 lands without one, this work adds it in its own migration (concern 6).

`login_codes`, one row per accepted request:
- `id`, `workspace_id`, `created_at`.
- `purpose`: `sign_in` or `invitation`. This work creates `sign_in` rows through its route and `invitation` rows only through R49.
- `email`: the normalised address the request was made for. Required. R4 and R5 count `sign_in` rows by this column.
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
| 400 | `validation_error` | as TOKI-004 | The address is missing or malformed; nothing was created | Keep the email step and show the field error |
| 429 | `code_request_limit` | `retryAfterSeconds` | 5 requests for this address in the last 15 minutes; no code, no mail | Show the wait of F05 ("Try again in N minutes") from `retryAfterSeconds`; any earlier `requestId` stays as it was |
| 429 | `code_resend_too_soon` | `retryAfterSeconds` | Less than 60 seconds since the last accepted request for this address; no code, no mail | Keep the earlier `requestId` if it has one and allow a new request after `retryAfterSeconds`. What the person reads is not decided (concern 10) |

`POST /api/v1/auth/sessions`, body `{ requestId, code, transport? }`:

| Status | `error.code` | `details` | Meaning | The client is expected to |
|---|---|---|---|---|
| 200 | none | none | Signed in. Body: `user`, and `token` for the token transport; the cookie is set for the cookie transport | Drop the `requestId` and open the app as `user` |
| 400 | `validation_error` | as TOKI-004 | `code` is not 6 digits or `requestId` is missing; not a wrong try | Not reachable from a correct screen; show nothing new |
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
| 403 | `origin_not_allowed` | none | A `POST` or `DELETE` came from a page of another origin | Not reachable from the app itself |
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

How an exchange runs: one `UPDATE` on the row found by `request_hash` decides the result, so two requests cannot both win (R17). Order of the checks: unknown, used or cancelled row -> `code_expired`; `wrong_tries` already 5 -> `code_locked`; at or past `expires_at` -> `code_expired`; code does not match, or the row has no account -> add one wrong try, then `code_incorrect` or, at 5, `code_locked`; code matches -> mark used, then check the account status (R18) and create the session (R29). Marking the code used and inserting the session are in one transaction (R43); for a Deactivated account the code is marked used and nothing else is written.

How the session check runs: a hook on every `/api/v1` request except the four that need no session. It runs before the route is looked up, so a path that does not exist answers 401 to a caller without a session and the list of routes is not shown to the outside (R44). Order:
1. Take the secret from the `Authorization: Bearer` header if there is one, otherwise from the cookie. None -> `unauthenticated`.
2. Hash it and load the session. No row, or a row of the other kind -> `unauthenticated`.
3. Load the account. Deactivated -> `account_deactivated`, whatever the state of the session (R27).
4. Session ended -> `session_ended`.
5. Last use more than 30 days ago -> `session_ended` (R25).
6. Set `last_used_at`, put the account on the request for the route to use, and set the cookie again on the response (R26).

### Module boundaries
- The `auth` module owns `login_codes` and `sessions`: no other module reads or writes them. Others use the exported functions: the session check, create a session (R29), end the sessions of an account (R30), register a listener for ended sessions (R50), create and check an invitation's code (R49).
- `users` belongs to the `members` module and `workspaces` to the `workspace` module (technical design, list of server modules). `auth` does not query them. It calls two read functions of `members`, "find the account of an email address" and "get an account by id", each returning `id`, `email`, `displayName`, `role`, `status` (Invited, Active, Deactivated) and `language`; and one read function of `workspace` that returns the id and the name of the one workspace (D-004). The id is the `workspace_id` of the rows this work writes, also for a request with no session; the name is the answer of R39. When this work is built before those modules exist, it adds these three read functions to them and nothing else (concern 6).
- Ended sessions: sign-out, replacement and R30 all go through one function in `sessions.ts`. It returns the ids it ended and calls the registered listeners in the same process with the ids and the reason. TOKI-038 registers one to close connections. A session that only ran out of time is not reported; TOKI-038 finds that through the session check.

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
- Cross-site requests. The cookie is `SameSite=Lax`, but that protects per site, not per origin: a page on another host of the same company domain is the same site. So the protection does not rest on it alone: a body must be JSON (R45), which a plain form on another page cannot send; a `POST` or `DELETE` from another origin is refused by its `Origin` header (R46), which also covers the public exchange route, so a page elsewhere cannot sign a browser in as someone else (R34); the server allows no cross-origin reads (R46); the cookie has no `Domain` attribute and the `__Host-` name, so another host of the domain cannot set or overwrite it (R21); and none of this work's `GET` routes changes anything (R36). There is no separate anti-forgery token. TOKI-091 reviews this (concern 9).
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

### Layout
```
apps/server/src/modules/auth/
├─ index.ts        public entry: the session check, createSession (R29), endSessionsOfUser (R30),
│                  onSessionsEnded (R50), createInvitationCode and checkInvitationCode (R49)
├─ routes.ts       the five routes
├─ codes.ts        request and exchange rules, pruning
├─ sessions.ts     create, check, renew, end
├─ guards.ts       JSON-only bodies (R45) and the Origin rule (R46)
├─ secrets.ts      random values, SHA-256, HMAC
└─ *.test.ts       integration tests
packages/shared/src/auth/
├─ schemas.ts      request, response and User schemas (R38)
└─ limits.ts       the constants of R38
```

## Testing
- Written test-first, as server integration tests with Vitest against the real Postgres of TOKI-008, the test clock of TOKI-008 and a fake mail layer that records what it was asked to send. No real address, name or mail server is used; addresses are of the form `sam@example.com`.
- Request: one mail with a 6-digit code for an Active account and for a Deactivated one (R2, R3); no mail and the same status and fields for an unknown address and for an Invited one, each with a new `requestId` (R1, R9); the 6th request refused and accepted again at exactly 15 minutes (R4, TS-007, TS-008); refused at 59 seconds and accepted at 60 (R5, TS-009); the earlier code refused after a new one (R6, TS-010); a malformed address (R7); a mail layer that fails and one that never answers: the response arrives all the same (R8).
- Exchange: success (R10, TS-001); right code with another `requestId` (R11); `triesLeft` 4 to 1, then locked, then the right code refused, and `code_expired` once a newer code is requested (R12, R13, TS-002, TS-006); accepted at 9 minutes 59 seconds, refused at exactly 10 minutes and after (R10, R14, TS-005); second use (R15); unknown `requestId` (R16); two exchanges at once give one session, and 10 wrong tries at once leave the count at 5 (R17); Deactivated account answers 400 and the code is used up (R18); `requestId` of an unknown address: wrong, locked, and expired without a lock (R19); 5 digits, 7 digits, letters (R20, TS-003, TS-004).
- Sessions: the cookie name and attributes in development, in production mode and with the environment value missing, and no `Domain` (R21); the token transport (R22); the database holds no cookie value or token (R23); a protected test route answers 401 without a session and 200 with one (R24, TS-012); still valid at exactly 30 days, refused at 31, and a use on day 29 moves the end (R25, TS-014); the cookie set again (R26); an ended session answers `session_ended`, a session of a Deactivated account `account_deactivated`, and a session that is both ended and of a Deactivated account `account_deactivated` (R27); sign-out, then the same cookie value refused with `session_ended`, a request with no cookie refused with `unauthenticated`, while a second session of the same person still works (R28, R31, TS-013, TS-211); the two exported functions (R29, R30); the current session (R32); sign-out without a session (R33); replacing a session (R34); kind stored and a 2,000-character user agent cut to 512 (R35).
- Safety: a list of the registered routes of this work shows no `GET` that writes (R36); the log captured during the tests is searched for the code, the `requestId`, the session secret and the email address (R37); the routes reject a body that fails the shared schema (R38).
- Contract details and hardening: the workspace name without a session, and the body has no other field (R39); after a request, every column of the `login_codes` row is searched for the 6 digits and for the `requestId` (R40); a request for an unknown address stores a row with a `code_hash` and runs the same statements as one for a member (R41); `retryAfterSeconds` at 59.2 seconds left is 60, equals the `Retry-After` header, and a request that breaks both limits answers `code_request_limit` with the longer wait (R42); a session insert made to fail leaves the code unused, and the same exchange then succeeds (R43); a stale cookie with a valid token passes, a cookie secret sent as a token and a token sent as a cookie are refused, an unknown secret answers `unauthenticated`, an unknown path answers 401 without a session and 404 with one (R44); a form-encoded and a `text/plain` body answer 415 and create nothing (R45); a `POST` and a `DELETE` with a foreign `Origin` answer 403 and change nothing, the same without `Origin` pass, and no response carries an `Access-Control-` header (R46); a sign-in request for an address that has an invitation code leaves that code usable and does not count it (R47); rows of other addresses older than 15 minutes are gone after a request, at most 100 at a time (R48); an invitation code through the exported functions: right, wrong with tries left, locked, expired at 10 minutes, used once, cancelled by a newer one (R49); a listener receives the ids and the reason for sign-out, replacement and R30 (R50).
- TS-210 (the other tab shows the sign-in page without a reload) is not a test of this work: the server side is covered by the R28 test above, and the rest by TOKI-099 and TOKI-023.
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
| Needs: TOKI-019 and TOKI-021 | Data model lists the columns used; R2 and R8 call the mail layer. Concern 6. |
| Needed by: TOKI-023, TOKI-024 and TOKI-026 | "Outcomes and what a client does with them" for the screens; R29, R30, R49 and R50 for the other server modules. |
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
| Nothing is readable without a session; sign-in is the only public page | R24, R44. Four routes answer without a session: the two sign-in routes, sign-out, and the workspace name for the sign-in card (R39). None returns workspace content. |
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
1. An address with an unused invitation asks for a code on the normal sign-in page. The decision log does not say what happens. This spec treats it as an address with no account: same answer, no mail (R1, R2), because the account state "Invited" joins through the invitation's own code (TOKI-097) and only "Active" can sign in. The request leaves the invitation's code untouched (R47). Assumption, to be confirmed. Owner: Thanh Truong.
2. When the mail server fails, the person who asked for a code is not told (R8): telling them would show that the address is a member (BR-04). They see "Check your email" and no mail arrives; "Resend code" after 60 seconds is their only step, and the emergency link (D-159) is the way out when mail stays down. D-099 decides mail failure for invitations only. Not decided for sign-in. A known limit of M2 adds to this: the mail is handed over inside the web process after the answer, with no retry, so a crash or restart between the answer and the send loses the mail and nobody is told. The technical design puts mail in the background jobs; when TOKI-064 lands (M4) the send moves to the queue and gets its retries. Owner: Thanh Truong.
3. The only decided limits are per email address (D-038) and per code (D-137). Not decided: a limit per network address, a limit for the whole server, or a cap on wrong tries across the codes of one address. This spec adds none and proposes no number as a requirement. A decision is needed before this work is built, not at the security review (TOKI-091, M6), because without one the decided numbers leave three openings to anyone who can reach the server (NFR-07) and knows addresses, with no access to any mailbox. (a) Guessing codes online. The `requestId` is returned to whoever asks, so it does not stop this. Per address: 5 codes in 15 minutes with 5 tries each is 25 guesses per 15 minutes, 2,400 per day, each with 1 chance in 1,000,000: about 0.24% per day and about 7% in 30 days for one address. Against all 200 addresses of a workspace (NFR-04): 480,000 guesses per day, about a 38% chance per day that one account is opened. (b) Locking a member out. Any accepted request cancels the code the member is about to type (R6) and blocks the member's own request for 60 seconds (R5); five requests use up the 15 minutes (R4). One request a minute for 5 minutes, repeated every 15, keeps a known address out for as long as the sender likes; the member's valid code answers `code_expired`. The only way out is the emergency link (D-159), which needs server access. D-082 decided the cancel for "Resend code" pressed by the same person and did not consider a second requester. (c) Mail and rows. Each accepted request mails the member, up to 480 mails a day per address, and one sender can ask for codes for many addresses, each storing a row (R48 bounds how long, not how many in 15 minutes). Proposals, not decisions, to choose from: a limit on code requests and on exchanges per network address; a cap on wrong tries per address across codes (for example a pause on that address after a number of wrong tries in a period), which stops (a) but makes (b) easier unless combined with the first; a ceiling on code requests for the whole server. Each needs numbers from the product owner. Owner: Thanh Truong.
4. "Resend code" on an invitation (TOKI-097) also creates codes for an address. Not decided: whether those count toward the same 5 in 15 minutes and the same 60 seconds as sign-in requests. Proposal, not a decision: one counter per address, since D-038 says "per email". Until it is decided, the two kinds are kept apart by the `purpose` column: this spec counts and cancels only `sign_in` rows (R47), and the functions of R49 apply no request limit. Owner: Thanh Truong.
5. The sign-in page shows the workspace name (F01, F04) to a person with no session, while BR-01 lets nothing be read without one. Answered: the name is part of the sign-in page, the one public page, and this work supplies it by a public read of the name only (R39); TOKI-023 shows it. Evidence: F01 and F04, accepted as the baseline by D-091; D-081. It means the workspace name can be read by anyone who can reach the server. Owner: Thanh Truong.
6. TOKI-019 has no spec yet, so the columns under Data model are what this work needs, not what exists. In particular `login_codes` must allow a row with no account (R19), hold the address (R4) and carry a `purpose` (R47). The read functions of the `members` and `workspace` modules (Module boundaries) do not exist yet either; TOKI-020, TOKI-024 and TOKI-027 touch the same modules. If TOKI-019 or those tickets differ, the difference is settled in their specs or by a migration here. Owner: Thanh Truong.
7. This work needs three values that TOKI-096 must add to its inventory and `.env.example`, since it owns the variable names: the server secret for the code hash (the name `AUTH_CODE_SECRET` is a proposal); the app's own origin, compared with the `Origin` header (R46); and the value that says "development" (R21), which no spec has named yet. Owner: Thanh Truong.
8. Renewing "on every use" (D-138) is one database write per request (R25) and one `Set-Cookie` per response (R26). For 200 people this is expected to be cheap, but it is not measured. If TOKI-089 shows a cost, the write can be limited to once per period; that period would be a new number and needs a decision. Owner: Thanh Truong.
9. The Blueprint's technical design does not say how the web app is protected against forged cross-site requests. This spec uses JSON-only bodies, the `Origin` rule, no cross-origin headers, a host-only cookie and no writing `GET` route among its own (R21, R36, R45, R46). It has not been reviewed; TOKI-091 does that. Two hand-offs follow from it. Every later ticket must keep "no `GET` changes anything", which this work cannot enforce for routes it does not own. And the emergency link of D-159 (F43: "Opening the link in a browser goes straight to Home") is by decision a sign-in without a code; TOKI-026 has to design it so that opening the link shows a page that then posts, not a `GET` that creates the session. Owner: Thanh Truong.
10. `code_resend_too_soon` can reach a person who never pressed "Resend code": "Use a different email" and back, a second tab, or another person asking for the same address inside the 60 seconds. The server side is decided (R5; D-038, D-082). What the person reads is not: F05 has no text for it. Proposal in the TOKI-023 spec, not a decision: show the code step without a new mail and let "Resend code" wait for `retryAfterSeconds`; that only works while the client still holds the earlier `requestId`. The wording and the behaviour are for TOKI-023 to settle with the product owner. Owner: Thanh Truong.
