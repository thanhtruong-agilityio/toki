# Sign-in API design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/sign-in-api.md (Thanh Truong)
Ticket: TOKI-022

## Goal
A Member or an Admin needs to get into Toki without a password: ask for a 6-digit code by email, exchange it for a session on the device that asked, stay signed in, and sign out. Today the server cannot tell who is asking, so nothing that needs a signed-in person can be built. This work adds the server endpoints for the code, the session and sign-out, and the check that refuses every other request without a valid session.

## Scope
- In:
  - Three operations under `/api/v1/auth`: request a code, exchange a code for a session, sign out; plus one read of the current session.
  - The rules of a code: 6 digits, 10 minutes, once, bound to its request, locked after the 5th wrong try, cancelled by a newer code.
  - The limits on code requests: 5 per address in 15 minutes, 60 seconds between two requests.
  - Two session kinds: a cookie for the web app, a header token for apps.
  - The session check that every other route under `/api/v1` passes through, with the 30-day rule and its renewal.
  - The request and response schemas in `packages/shared`.
  - The functions that other server modules call to start and end sessions.
  - Server integration tests for all of the above.
- Out (not now):
  - The `users`, `login_codes`, `sessions` and `devices` tables and their migrations: TOKI-019. This work reads and writes them; the columns it needs are listed under Data model.
  - The mail layer and the sign-in mail template (code only, no button, English and Vietnamese): TOKI-021. This work calls it with the address, the code and the language.
  - Every screen: the email step, the code step, the 7 error messages, "Your session has ended", and telling the other tabs of a browser about a sign-out without waiting for their next request: TOKI-023. "Sign out" in the account menu: TOKI-099.
  - Invitations: creating one, its mail, its code, "Resend code" on an invitation, accepting it, reactivating a deactivated person: TOKI-024 and TOKI-097. They start the session through the function of R29.
  - Listing a person's sessions, signing out another device or all others, and the emergency sign-in link: TOKI-026. It uses the functions of R29 and R30.
  - Calling R30 when an Admin deactivates someone: TOKI-024.
  - Closing the realtime connection of an ended session: TOKI-038.
  - Removing a device's push registration on sign-out: TOKI-074.
  - Guest sign-in: phase 5.
  - Limits per network address, and a review of headers and cookies: not decided (concern 3); TOKI-091 reviews them.

## Requirements
Request a code
- R1. `POST /api/v1/auth/codes` with a well-formed email address returns status 200 and a body with exactly `requestId`, `expiresInSeconds` (600) and `resendAfterSeconds` (60). The status and the set of body fields are the same for the address of an active account, a deactivated account, an invited person and an address nobody uses (BR-04).
- R2. For the address of an account whose status is Active or Deactivated, an accepted request hands exactly one sign-in mail to the mail layer, with that address, the code and the language saved on the account (D-180). For any other address it hands over no mail (F05).
- R3. A code is 6 decimal digits, leading zeros kept, drawn from a cryptographic random source (D-011).
- R4. When 5 accepted requests for one address are less than 15 minutes old, the next request for that address returns status 429 with the code `code_request_limit` and `details.retryAfterSeconds`; it creates no code and sends no mail. Once the oldest of the 5 is 15 minutes old, a request is accepted again (D-038, FR-02 AC-004).
- R5. A request made less than 60 seconds after the last accepted request for the same address returns status 429 with the code `code_resend_too_soon` and `details.retryAfterSeconds`; it creates no code and sends no mail. At 60 seconds the request is accepted (D-038, D-082, FR-02 AC-005).
- R6. An accepted request cancels every earlier unused code of that address: an exchange with an earlier `requestId` fails with `code_expired`, with the right digits too (D-082, FR-02 AC-006).
- R7. The address is trimmed and put in lower case before any check. A value that is not a well-formed email address returns status 400 with the code `validation_error`, creates no code and does not count toward R4 or R5.
- R8. The response of R1 is sent without waiting for the mail. When the mail layer fails, the response is unchanged and one log line records the failure (concern 2).
- R9. R4 and R5 count requests the same way for every address, whether or not it belongs to an account, so the limits reveal nothing about membership (BR-04).

Exchange a code for a session
- R10. `POST /api/v1/auth/sessions` with a `requestId` and the code that was mailed for it, sent up to and including 10 minutes after the code was created, for an Active account, returns status 200 with `user`, and creates one session for that account (D-136, FR-01 AC-001).
- R11. A code is accepted only together with the `requestId` returned by the request that created it. The right digits with any other `requestId` do not create a session (F04: the code belongs to the request).
- R12. A wrong code returns status 400 with the code `code_incorrect` and `details.triesLeft`: 4 after the 1st wrong try, then 3, 2 and 1. No session is created (D-137, F05).
- R13. The 5th wrong try returns status 400 with the code `code_locked`. From then on every exchange for that `requestId`, with the right digits too, returns `code_locked` (D-137, FR-01 AC-003).
- R14. An exchange sent more than 10 minutes after the code was created returns status 400 with the code `code_expired` and does not count as a wrong try (D-136, FR-01 AC-003).
- R15. A code works once: after a successful exchange, a second exchange with the same `requestId` and code returns `code_expired` and creates no session (BR-02).
- R16. An exchange with a `requestId` the server does not know returns `code_expired`.
- R17. When two exchanges with the right code arrive at the same time, exactly one creates a session. Wrong tries sent at the same time never give more than 5 tries in total.
- R18. A correct code for a Deactivated account returns status 403 with the code `account_deactivated`, creates no session and uses up the code (F05).
- R19. For a `requestId` that was given to an address with no Active or Deactivated account, no code is ever right: the exchange answers `code_incorrect` with `triesLeft`, then `code_locked`, then `code_expired`, exactly as R12 to R14.
- R20. A `code` that is not exactly 6 digits, or a missing `requestId`, returns status 400 with the code `validation_error` and does not count as a wrong try (FR-01 AC-002).

Sessions
- R21. With `transport` `"cookie"` (the default) the response of R10 sets the cookie `toki_session` with `HttpOnly`, `SameSite=Lax`, `Path=/` and `Max-Age=2592000` (30 days, D-011), and with `Secure` in every environment except development. The body holds no token.
- R22. With `transport` `"token"` the response of R10 holds `token` in the body and sets no cookie. A later request is signed in by the header `Authorization: Bearer <token>`.
- R23. The session secret is 32 random bytes. The database stores only its SHA-256 hash; neither the cookie value nor the token can be read back from the database.
- R24. Every route under `/api/v1` except `POST /api/v1/auth/codes`, `POST /api/v1/auth/sessions` and sign-out (R33) requires a valid session. Without a cookie or token the response is status 401 with the code `unauthenticated` and holds no workspace data (BR-01, FR-03 AC-007).
- R25. A session is valid up to and including 30 days after its last use. Each request that passes the check sets the last use to now. A request made more than 30 days after the last use returns status 401 with the code `session_ended` (D-011, D-138, FR-03 AC-009).
- R26. Each response to a request that passed the check with a cookie sets the cookie again with `Max-Age=2592000`, so the cookie lives as long as the session.
- R27. A request with a session that was ended (R28, R30) returns status 401 with the code `session_ended`. A request with a session whose account is Deactivated returns status 401 with the code `account_deactivated` (F07).
- R28. `DELETE /api/v1/auth/session` ends the session of the request, clears the cookie and returns status 204. After it, any request with that cookie or token returns 401 `session_ended`, from every tab of that browser, because the tabs share the one cookie (D-093, FR-46 AC-130, AC-131). The other sessions of the same person keep working (FR-46 AC-132).
- R29. The `auth` module exports a function that creates a session for a given account and transport and returns the cookie value or the token. R10 uses it; TOKI-097 and TOKI-026 call it. It refuses an account that is not Active.
- R30. The `auth` module exports a function that ends every session of a given account, with an option to keep one. After it, a request with any ended session is refused as in R27 (BR-29, D-158).
- R31. Each exchange creates its own session. A session created on one client is not accepted for a request that does not carry its cookie or token, and ending one session ends no other (FR-03 AC-008).
- R32. `GET /api/v1/auth/session` with a valid session returns status 200 with `user`: `id`, `email`, `displayName`, `role` (`member` or `admin`) and `language` (`en` or `vi`).
- R33. `DELETE /api/v1/auth/session` without a valid session also returns status 204 and clears the cookie.
- R34. When the exchange of R10 uses the cookie transport and the request already carries a valid session cookie, that earlier session is ended and the cookie is replaced.
- R35. A new session stores its kind (`cookie` or `token`) and the `User-Agent` header of the request, for the device list of TOKI-026.

Safety
- R36. No `GET` route creates or ends a session, and no route creates a session without a code. A sign-in mail therefore cannot sign anyone in by a link (D-157).
- R37. No log line and no error body holds a code, a `requestId`, a session secret or a cookie value. The `auth` module writes no email address to the log.
- R38. The request and response bodies of the four routes are Zod schemas in `packages/shared`, and the routes validate with those same schemas. The numbers 6, 10 minutes, 5 tries, 5 requests, 15 minutes, 60 seconds and 30 days are constants in one file of `packages/shared`, used by the server and available to the screens.

## Design
### Data model
The tables come from TOKI-019. This work adds no table. It needs these columns; if TOKI-019 lands without one, this work adds it in its own migration (concern 6).

`login_codes`, one row per accepted request:
- `id`, `workspace_id`, `created_at`.
- `email`: the normalised address the request was made for. Required. R4 and R5 count rows by this column.
- `user_id`: the account, or empty when the address has no Active or Deactivated account (R19).
- `request_hash`: SHA-256 of the `requestId`. Unique.
- `code_hash`: see "Hashing" below. Empty when `user_id` is empty, so nothing can match.
- `expires_at`: `created_at` plus 10 minutes.
- `wrong_tries`: starts at 0. The code is locked when it reaches 5.
- `used_at`, `cancelled_at`: empty until the code is used or cancelled.

`sessions`, one row per sign-in:
- `id`, `workspace_id`, `user_id`, `created_at`.
- `secret_hash`: SHA-256 of the session secret. Unique.
- `kind`: `cookie` or `token`.
- `user_agent`: the header as sent.
- `last_used_at`: set at creation and on every request that passes the check.
- `ended_at`, `ended_reason` (`signed_out`, `replaced`, `revoked`, `deactivated`): empty while the session lives. A session is ended, not deleted.

`users`: this work reads `id`, `email` (compared in lower case), `display_name`, `role`, `status` (Invited, Active, Deactivated) and `language`.

Rules:
- All times are written by the server from the clock interface of TOKI-008, never by a database default, so tests can move the clock.
- A row of `login_codes` is deleted when a later request for the same address is accepted and the row is more than 15 minutes old: by then it counts for no limit and its code has expired. General pruning of old rows belongs to the background jobs (TOKI-064).
- There is no limit on the number of sessions per person; the log sets none.

### API
| Method | Path | Session | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/codes` | none | Request a code for an email address |
| POST | `/api/v1/auth/sessions` | none | Exchange a `requestId` and a code for a session |
| GET | `/api/v1/auth/session` | required | Return the signed-in person |
| DELETE | `/api/v1/auth/session` | optional | Sign out: end the session of this request |

Shapes (JSON):
- `POST /auth/codes` request: `{ "email": string }`. Response 200: `{ "requestId": string, "expiresInSeconds": 600, "resendAfterSeconds": 60 }`.
- `POST /auth/sessions` request: `{ "requestId": string, "code": string of 6 digits, "transport"?: "cookie" | "token" }`. Response 200 with a cookie: `{ "user": User }`. Response 200 with a token: `{ "user": User, "token": string }`.
- `GET /auth/session` response 200: `{ "user": User }`.
- `DELETE /auth/session` response 204, no body.
- `User`: `{ "id": string, "email": string, "displayName": string, "role": "member" | "admin", "language": "en" | "vi" }`.

How a request for a code runs:
1. Validate and normalise the address (R7).
2. In one transaction, with a lock on the address so two requests cannot both pass: check the 60 seconds (R5) and the 5 in 15 minutes (R4) against the rows of that address; cancel its unused codes (R6); delete its rows older than 15 minutes; insert the new row.
3. Answer 200 with a new `requestId` (32 random bytes, base64url).
4. After the answer, if the address has an Active or Deactivated account, hand the mail to the mail layer of TOKI-021 with the code and the account's language.

The same database work is done for every address, and the mail is sent after the answer, so neither the answer nor its timing depends on membership.

How an exchange runs: one `UPDATE` on the row found by `request_hash` decides the result, so two requests cannot both win (R17). Order of the checks: unknown, used or cancelled row -> `code_expired`; `wrong_tries` already 5 -> `code_locked`; past `expires_at` -> `code_expired`; code does not match -> add one wrong try, then `code_incorrect` or, at 5, `code_locked`; code matches -> mark used, then check the account status (R18) and create the session (R29).

How the session check runs: a hook on every `/api/v1` route except the two public ones and sign-out reads the cookie, or the `Authorization` header when there is no cookie, hashes the secret, loads the session with its account, applies R25 and R27, sets `last_used_at`, and puts the account on the request for the route to use.

### Decided in this spec
These are technical choices the Blueprint leaves to the builder.
- The request binding is a `requestId` returned in the body and sent back with the code. Reason: it works the same for the cookie and the token client, and a code typed on another device has no `requestId` there (F04). Where the web app keeps it is for TOKI-023.
- Hashing: the session secret and the `requestId` have 256 bits of randomness, so a plain SHA-256 is enough. A 6-digit code has only a million values, so `code_hash` is an HMAC-SHA-256 of the `requestId` and the code, keyed with a server secret; a copy of the database alone cannot be used to find a code. The secret is one new environment variable (concern 7).
- A used, a cancelled and an unknown code all answer `code_expired`. Reason: journey F05 has no separate message for them, and the right next step is the same: ask for a new code.
- Code errors use status 400, not 401. Reason: D-131 maps 400 to a message under the field, and the app treats 401 as "the session has ended" (F07).
- Boundaries are inclusive where the tests of the Blueprint say so: a code is accepted at exactly 10 minutes (TS-005), a request at exactly 60 seconds (TS-009), a session at exactly 30 days (TS-014); a request counts toward R4 until it is exactly 15 minutes old (TS-008).
- Only accepted requests count toward R4 and R5; a refused request leaves no row.
- A session is renewed by one write per request, with no batching (concern 8).
- The cookie is `SameSite=Lax` and no `GET` route changes anything; there is no separate anti-forgery token. Reason: the web app and the API share one origin (Caddy in production, the dev proxy of TOKI-006). TOKI-091 reviews this.
- Three 401 codes (`unauthenticated`, `session_ended`, `account_deactivated`) let the app choose between the sign-in page and the two texts of F07.
- Signing out twice is not an error (R33), so a second tab that signs out after the first gets the same result.
- A new sign-in in a browser that is already signed in replaces that browser's session (R34). Asking the person first (D-080) is done by the screens before they call the API.

### Errors
Every error uses the one format of TOKI-004: `{ "error": { "code", "message", "details"? } }`. The `message` is English for developers; the app shows its own text from `code`.
- Malformed email, code or body -> 400 `validation_error`.
- 6th request in 15 minutes -> 429 `code_request_limit`, `details.retryAfterSeconds`, header `Retry-After`.
- Request within 60 seconds of the last -> 429 `code_resend_too_soon`, `details.retryAfterSeconds`, header `Retry-After`.
- Wrong code, tries left -> 400 `code_incorrect`, `details.triesLeft` (4 to 1).
- 5th wrong try and after -> 400 `code_locked`.
- Code older than 10 minutes, used, cancelled or unknown -> 400 `code_expired`.
- Correct code, Deactivated account -> 403 `account_deactivated`.
- No cookie or token on a protected route -> 401 `unauthenticated`.
- Session unused for more than 30 days, signed out or revoked -> 401 `session_ended`.
- Session of a Deactivated account -> 401 `account_deactivated`.
- Mail layer fails -> no error to the client; one log line (R8).

### Layout
```
apps/server/src/modules/auth/
├─ index.ts        public entry: the session check, createSession (R29), endSessionsOfUser (R30)
├─ routes.ts       the four routes
├─ codes.ts        request and exchange rules
├─ sessions.ts     create, check, renew, end
├─ secrets.ts      random values, SHA-256, HMAC
└─ *.test.ts       integration tests
packages/shared/src/auth/
├─ schemas.ts      request, response and User schemas (R38)
└─ limits.ts       the constants of R38
```

## Testing
- Written test-first, as server integration tests with Vitest against the real Postgres of TOKI-008, the test clock of TOKI-008 and a fake mail layer that records what it was asked to send. No real address, name or mail server is used; addresses are of the form `sam@example.com`.
- Request: one mail with a 6-digit code for an Active account (R2, R3); no mail and the same status and fields for an unknown address and for an Invited one (R1, R9); the 6th request refused and accepted again after 15 minutes (R4, TS-007, TS-008); refused at 59 seconds and accepted at 60 (R5, TS-009); the earlier code refused after a new one (R6, TS-010); a malformed address (R7); a failing mail layer (R8).
- Exchange: success (R10, TS-001); right code with another `requestId` (R11); `triesLeft` 4 to 1, then locked, then the right code refused (R12, R13, TS-002, TS-006); accepted at 10 minutes and refused after (R14, TS-005); second use (R15); unknown `requestId` (R16); two exchanges at once (R17); Deactivated account (R18); `requestId` of an unknown address (R19); 5 digits, 7 digits, letters (R20, TS-003, TS-004).
- Sessions: the cookie attributes in development and in production mode (R21); the token transport (R22); the database holds no cookie value or token (R23); a protected test route answers 401 without a session and 200 with one (R24, TS-012); still valid at 30 days, refused at 31, and a use on day 29 moves the end (R25, TS-014); the cookie set again (R26); ended and deactivated sessions (R27); sign-out, then the same cookie refused, while a second session of the same person still works (R28, R31, TS-013, TS-210, TS-211); the two exported functions (R29, R30); the current session (R32); sign-out without a session (R33); replacing a session (R34); kind and user agent stored (R35).
- Safety: a list of the registered routes shows no `GET` that writes (R36); the log captured during the tests is searched for the code, the `requestId` and the session secret (R37); the routes reject a body that fails the shared schema (R38).
- The limits are tested by moving the test clock, never by waiting.

## Data safety
- Codes, `requestId`s and session secrets are stored only as hashes and never logged (R23, R37).
- The server secret for the code hash lives in `.env`, never in git.
- The answer to a code request and its timing do not show whether an address is a member (R1, R9).
- An email address is personal data: it is stored in `login_codes` only as long as the row lives and is not written to the log by this module.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I03, alongside TOKI-019, 020, 021, 023, 026 and 099 | Planning fact; Scope "Out" draws the line with each of them. |
| Milestone: M2 | Planning fact; no design impact. |
| Size: L | Scope: four routes, the session check and their tests; no screen, no table, no mail template. |
| Needs: TOKI-019 and TOKI-021 | Data model lists the columns used; R2 and R8 call the mail layer. Concern 6. |
| Needed by: TOKI-023, TOKI-024 and TOKI-026 | The API and error codes for the screens; R29 and R30 for the other server modules. |
| Agreed scope: request a code, exchange it for a session, sign out; cookie and token | R1, R10, R28; R21 and R22. |
| 6-digit emailed code; no password | R2, R3, R20. No route takes a password. |
| A code is valid for 10 minutes | R10, R14. |
| A code works once | R15, R17. |
| A code works only for the request that asked for it | R11. |
| Locked after the 5th wrong try; a wrong try says how many are left | R12, R13. |
| At most 5 code requests per address in 15 minutes | R4, R9. |
| A code can be sent again only after 60 seconds | R5. |
| A new code cancels the earlier one | R6. |
| Same answer whether or not the address is a member; no mail to an address not in the workspace | R1, R2, R8, R9, R19. |
| A deactivated account is refused after a correct code | R18. |
| A session lasts 30 days and renews on every use | R25, R26. |
| A session on one device does not sign in another device | R31. |
| Nothing is readable without a session; sign-in is the only public page | R24. Only the two sign-in routes are public. The workspace name on the sign-in page is concern 5. |
| The mail carries the code only; nothing in the mail signs anyone in without the code | R36. The template itself is TOKI-021. |
| The sign-in mail is in the language the member chose | R2 passes the account's language to the mail layer. |
| Sign-out ends the session on that device; other tabs at once; other devices stay signed in | R28, R31, R33. Showing it in an open tab before its next request is TOKI-023. |
| Two session kinds: cookie for web, header token for apps | R21, R22. |
| The API lives under `/api/v1`; fields are only added | API table; R38 keeps the shapes in one shared place. |
| Codes are stored hashed | Data model, "Hashing"; R23 for session secrets. |
| Two roles, Member and Admin; no Owner | R32: `role` is `member` or `admin`. |
| English is the default interface language | Error `message` is English and not translated by the server (TOKI-004); a mail is in the account's language, which is English unless the member chose Vietnamese (D-018, D-180). |

## Open questions from the intent
- Is a code sent to an address with an unused invitation (state "Invited")? Not answered. Carried forward as concern 1.
- Is the person told when the sign-in mail cannot be sent? Not answered. Carried forward as concern 2.
- Is there a limit per network address or for the whole server, besides the limit per email address? Not answered. Carried forward as concern 3.
- Do "Resend code" requests on an invitation count toward the same 5 in 15 minutes? Not answered. Carried forward as concern 4.
- Which ticket supplies the workspace name to the sign-in page? Not answered. Carried forward as concern 5.
- Clarify gap: does the server enforce the 60 seconds, or only the button? Answered: the server enforces it (R5). Evidence: ticket TOKI-022 says "a resend only after 60 seconds" in the API scope (D-038, D-082).
- Clarify gap: is a code mailed to a Deactivated account? Answered: yes; the refusal comes after the correct code (R2, R18). Evidence: journey F05, accepted as the baseline by D-091.
- Clarify gap: does the 30 days count from sign-in or from the last use? Answered: from the last use (R25). Evidence: D-138. FR-03 still lists D-138 and D-093 as open, but the decision log has D-138 as an accepted assumption and D-093 as confirmed; this spec follows the log.
- Clarify gap: does "Sign out" ask for confirmation (D-178, Open)? Not a question for the API: the route is the same with or without a confirmation. It stays with TOKI-099.
- Clarify gap: how long does a session from the emergency link last (D-179, Open)? Not a question for this work: TOKI-026 creates that session through R29, which makes a normal session; a different length would be a change there.

## Areas of concern
1. An address with an unused invitation asks for a code on the normal sign-in page. The decision log does not say what happens. This spec treats it as an address with no account: same answer, no mail (R2), because the account state "Invited" joins through the invitation's own code (TOKI-097) and only "Active" can sign in. Assumption, to be confirmed. Owner: Thanh Truong.
2. When the mail server fails, the person who asked for a code is not told (R8): telling them would show that the address is a member (BR-04). They see "Check your email" and no mail arrives; "Resend code" after 60 seconds is their only step, and the emergency link (D-159) is the way out when mail stays down. D-099 decides mail failure for invitations only. Not decided for sign-in. Owner: Thanh Truong.
3. The only decided limit is per email address (D-038). Not decided: a limit per network address or for the whole server. Without one, a person who knows a member's address can use up that member's 5 requests every 15 minutes and keep them from signing in, and one sender can ask for codes for many addresses. No number is proposed in the log; this spec adds none. TOKI-091 (security review) covers rate limits. Owner: Thanh Truong.
4. "Resend code" on an invitation (TOKI-097) also creates codes for an address. Not decided: whether those count toward the same 5 in 15 minutes and the same 60 seconds as sign-in requests. Proposal, not a decision: one counter per address, since D-038 says "per email". This spec counts only the rows it creates itself. Owner: Thanh Truong.
5. The sign-in page shows the workspace name (F01, F04) to a person with no session, while BR-01 lets nothing be read without one. No ticket scope names a public route for the name, and this work adds none (R24). TOKI-023 needs an answer before it can show the name. Owner: Thanh Truong.
6. TOKI-019 has no spec yet, so the columns under Data model are what this work needs, not what exists. In particular `login_codes` must allow a row with no account (R19) and hold the address (R4). If TOKI-019 differs, the difference is settled in its spec or by a migration here. Owner: Thanh Truong.
7. The code hash needs one new server secret. Its name must be added to the inventory and `.env.example` of TOKI-096, which owns the variable names; the name `AUTH_CODE_SECRET` is a proposal. The "development" check for the `Secure` cookie flag (R21) also reads an environment value that TOKI-096 must name. Owner: Thanh Truong.
8. Renewing "on every use" (D-138) is one database write per request (R25) and one `Set-Cookie` per response (R26). For 200 people this is expected to be cheap, but it is not measured. If TOKI-089 shows a cost, the write can be limited to once per period; that period would be a new number and needs a decision. Owner: Thanh Truong.
9. The Blueprint's technical design does not say how the web app is protected against forged cross-site requests. This spec relies on `SameSite=Lax`, one origin and no writing `GET` route (Decided in this spec). It has not been reviewed; TOKI-091 does that. Owner: Thanh Truong.
