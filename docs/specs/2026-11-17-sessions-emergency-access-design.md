# Sessions and emergency access (server) design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/sessions-emergency-access.md (Thanh Truong)
Ticket: TOKI-026

## Goal
A signed-in Member or Admin needs to see where they are signed in and end a session on a device they no longer hold. An operator with shell access needs a way to let a member in when mail is down, because every other sign-in needs a mailed code. This work adds the server side of both: the list of a person's own sessions with the end of one other session or of all other sessions, and a command that prints a one-time sign-in link, together with the endpoint and the web page that turn that link into a session.

## Scope
- In:
  - `GET /api/v1/auth/sessions`: the signed-in person's own live sessions, with device kind, browser, last use and the mark of the one in use.
  - `DELETE /api/v1/auth/sessions/:sessionId` (end one other session) and `DELETE /api/v1/auth/sessions` (end all other sessions).
  - The turning of the stored `User-Agent` into a device kind and a browser.
  - The command `emergency:link`, the table that stores its links (hashed), and `POST /api/v1/auth/emergency-sessions`, which exchanges a link for a session.
  - The log lines of the command and of the use of a link.
  - The web page `/emergency` that carries the link's token and turns it into a session: a web part of this server ticket, with its files under Layout and its tests under Testing (R40 to R46, concern 3).
  - The request and response schemas in `packages/shared`, and server integration tests.
- Out (not now):
  - Signing out the current device: `DELETE /api/v1/auth/session`, owned by TOKI-022 (R28, R33). This work does not duplicate it and refuses to end the current session through its own route (R11). Whether "Sign out" asks for confirmation (D-178, Open in the log) is a question for TOKI-099; the route is the same either way.
  - The screens: the account menu, the "Signed-in devices" section of Preferences, the confirmation for signing out other devices and the words of a row: TOKI-099. The data they need is under "API".
  - What other tabs of the same browser do when a session ends (D-093). This work owns the server side only: the tabs of one browser share one session, so they are not "other devices" and these routes never end them; once a session is ended, every later request that carries it is answered `session_ended` (TOKI-022 R27, R28). The signal that makes a tab react before its next request is TOKI-099, on the session state of TOKI-023.
  - Closing the realtime connection and removing the push registration of an ended session: TOKI-038 and TOKI-074. They hear about it through the listeners of TOKI-022 (R50), which this work feeds (R13).
  - Ending every session of a person when an Admin deactivates them: TOKI-024 through TOKI-022 R30.
  - The last use of each person for the Admin page: `getLastUsedAtByUser` is added by TOKI-024 (its R25), so R17 is withdrawn.
  - Building the production image that holds the compiled command, and the installation guide that tells the operator how to run it: TOKI-084 and TOKI-087 (concern 12).
  - A network limit on sign-in routes: TOKI-022 concern 3.
  - Guest sessions: phase 5.

## Requirements
The list of sessions
- R1. `GET /api/v1/auth/sessions` with a valid session returns status 200 and a body with exactly one field, `sessions`, a list. Each item has exactly `id`, `current`, `deviceKind`, `browser` and `lastUsedAt`, and nothing else (no secret hash, no raw `User-Agent`).
- R2. The list holds exactly the sessions of the signed-in person that are live: not ended, and with a last use at most 30 days ago (up to and including exactly 30 days, as TOKI-022 R25). It holds no session of another person, no ended session and no session that ran out of time. Cookie sessions and token sessions are both listed (FR-47 AC-133).
- R3. `current` is `true` for the one session that carries the request and `false` for every other item. The list always has exactly one item with `current` true (D-158, F06 "This device").
- R4. The list is ordered by `lastUsedAt`, latest first; items with the same time are ordered by `id`, smallest first (concern 5).
- R5. `lastUsedAt` is the stored `last_used_at` as an ISO 8601 string in UTC. The request that reads the list counts as a use (TOKI-022 R25), so the item with `current` true has the time of the clock at that request.
- R6. `deviceKind` is one of `desktop`, `phone`, `tablet`, `unknown`; `browser` is one of `chrome`, `edge`, `safari`, `firefox`, `other`, `unknown`. Both are a pure function of the stored `user_agent`, by the rules of "Device kind and browser" below (concern 5). A client that meets a value outside these lists reads it as `unknown` (TOKI-099 R13), so adding a value later is additive. A session with no stored `user_agent` or an empty one gives `unknown` and `unknown`.

Ending one other session
- R7. `DELETE /api/v1/auth/sessions/:sessionId` with the id of a live session of the signed-in person other than the one of the request returns status 204 and no body. That session gets `ended_at` of now and `ended_reason` `revoked`. Every other session of the person, and the one of the request, stay as they were (D-158, FR-47 AC-134).
- R8. After R7, a request that carries the ended session's cookie or token returns status 401 with the code `session_ended` (TOKI-022 R27), and `GET /api/v1/auth/sessions` no longer lists it (D-158, F07, FR-47 AC-134).
- R9. A `:sessionId` that is not a UUID returns status 400 with the code `validation_failed` (TOKI-004) and changes nothing.
- R10. A `:sessionId` that belongs to another person, or to no session, returns status 404 with the code `not_found` and changes nothing. The answer is the same for the two cases, so the route shows nothing about other people's sessions.
- R11. A `:sessionId` equal to the id of the session of the request returns status 400 with the code `current_session`, and ends nothing. Signing out the device in use is `DELETE /api/v1/auth/session` of TOKI-022.
- R12. A `:sessionId` of the person's own session that is already ended, or ran out of time, returns status 204 and changes nothing: no new `ended_at`, no call to the listeners. Ending twice is not an error, so a second tab that presses the same button gets the same result.

Ending all other sessions
- R13. `DELETE /api/v1/auth/sessions` returns status 204 and ends every live session of the signed-in person except the one of the request, each with `ended_reason` `revoked`. It keeps the session of the request, so a second request with the same cookie or token, as another tab of that browser would send, still passes (D-093, FR-47 AC-135). With no other live session it returns 204 and changes nothing. Sessions of other people are never touched.
- R14. After R13, a request that carries any of the ended sessions returns 401 `session_ended`, and the list holds only the item with `current` true (FR-47 AC-135, TS-216).
- R15. R7 and R13 end sessions only through the one ending function of the `auth` module, `endSessionsOfUser(client, userId, { reason, only?, except? })` of TOKI-022 R30, which TOKI-024 also calls (with `deactivated`): it ends only the person's rows whose `ended_at` is empty, those named by `only` or all but the one named by `except`, with the given reason, and returns the ids it really ended. The handlers call it with the database as `client`, so the function opens its own transaction and reports the ended ids after the commit (TOKI-022 R50, R53); the listeners receive those ids and the reason `revoked` once for each session that was ended, and nothing for a session that was already ended (R12). Both handlers pass `only`, set to the ids of the live sessions of R2 that are not the one of the request, and never `except`: a row that ran out of time but has no `ended_at` is not touched (R12), and a request that ends no live session changes no row (R13). Decided in this spec: this is one reading of the function, so the two routes and the list agree on what "live" means.
- R16. The three routes need a valid session (TOKI-022 R24). Both `DELETE` routes obey the `Origin` rule (TOKI-022 R46). `GET /api/v1/auth/sessions` changes nothing except the last use that every checked request sets (TOKI-022 R36).
- R17. Withdrawn. The last use of each person is read through `getLastUsedAtByUser(userIds)`, which TOKI-024 adds to the `auth` module (its R25, a change request to TOKI-022's module); this work adds no such function and so there is one function and one owner. The number is kept so that the other numbers stay stable.

The emergency command
- R18. The root `package.json` and `apps/server/package.json` each have a script `emergency:link`, and the root script forwards its argument to the one of `apps/server`. The documented form is `pnpm --silent emergency:link <email>`, run from the repository root: it runs the command with exactly one argument, the member's email address, which is trimmed, put in lower case and checked by the one shared address function of TOKI-020 (R16 of that spec), as sign-in does (TOKI-022 R7). Without `--silent`, `pnpm` writes its own header lines to standard output, which R19 does not cover; so the form with `--silent` is the one that is documented (R39) and the one that is tested.
- R19. The output contract of the command is one line on standard output and everything else on standard error. For an address whose account is Active, a Member or an Admin, the command writes exactly one line to standard output: the link `<origin>/emergency#<token>`, where `<origin>` is the app's own origin of the configuration and `<token>` is 43 characters, the base64url form of 32 bytes from a cryptographic random source. It writes nothing else to standard output: every explanation and the log line of R35 go to standard error. It exits with code 0 (D-159, FR-49 AC-139). R19 holds for the process of the command started with Node or `tsx` directly and for the documented form of R18; the logger of TOKI-004 R6 writes to standard output only for the server, and the command gives its logger standard error as its destination (concern 11).
- R20. For an address with no account (this includes a person who has only been invited) or whose account is Deactivated, the command prints no link, writes a one-line reason to standard error, exits with code 1 and stores nothing (D-159, FR-49 AC-141).
- R21. With no argument, more than one argument, or an address that is not well-formed or longer than 254 characters, the command exits with code 2, prints no link and stores nothing.
- R22. The command reads only the configuration it needs, each value through the reader of its own area in the configuration module (concern 11): the database connection, the app's own origin and the environment name. With the database connection or the origin missing or invalid it exits with code 1, writes the variable name and never its value, prints no link and stores nothing. The origin must be an absolute address with no path, and it must be `https://`, except that an `http://` origin is accepted only when the environment name is exactly the development value. This is the test of TOKI-022 R21, which treats only an explicit development value as development and a missing or unknown value (`staging`, a typo) as production; so a missing or unknown environment name is not an error for the command, it counts as production and requires `https://`. An unrelated missing variable (SMTP, first admin) does not stop the command.
- R23. The command needs no mail. The import graph of the command's entry file (every file reached by static imports from `apps/server/src/cli/emergency-link.ts`, and every package they import) holds no file of the `mail` module and no mail package; and the command prints a link with the SMTP variables unset and with the SMTP host unreachable (D-159, journey F43). The index of the `auth` module reaches the mail layer (TOKI-022 R2, R8), so the command does not import it: it imports one narrow entry of each module it needs, `modules/auth/cli.ts` (which exports `issueEmergencyLink` and nothing else), one read-only entry of the `members` module that finds an account by address, and one of the `workspace` module that returns the workspace id (concern 11).
- R24. A link is valid for 10 minutes: usable while the clock is before `expires_at`, which is `created_at` plus 10 minutes, and refused at exactly 10 minutes and after (concern 5, TOKI-022 uses the same instant for a code). The 10 minutes is the constant `EMERGENCY_LINK_TTL_SECONDS` (600) in the shared limits file of TOKI-022 R38, which this work uses (D-159, FR-49 AC-140). TOKI-022 R38 names the constant and leaves its use to this ticket; the file is `packages/shared/src/auth/limits.ts` (R37).
- R25. The database stores only the SHA-256 hash of the token, in a table `emergency_links` (Data model). The hash is taken over the 43-character string exactly as printed, not over the 32 decoded bytes, by one function that the command and the route both call, so a link is found only by the string that was printed. No column holds the token or the link, and the token cannot be read back from the database.

Using a link
- R26. `POST /api/v1/auth/emergency-sessions` with `{ "token": string, "transport"?: "cookie" | "token" }`, with a token whose link was printed less than 10 minutes ago and not used, for an Active account, returns status 200 with `user` (the `User` of TOKI-022) and creates one session through `createSession(client, account, transport, { userAgent? })` of TOKI-022 R29, with the open transaction of R32 as `client`, which returns `{ id, secret }`. The session is of the kind that function creates, whatever its length is at build time: the 30 days of TOKI-022 R21 is the proposal of D-179, which is Open (concern 1), so this work fixes no length. The cookie holds the `secret` and is as in TOKI-022 R21 in name, `HttpOnly`, `Secure`, `SameSite`, `Path` and no `Domain`, or for `transport` `"token"` the `token` in the body is the `secret`, as in R22; the stored `user_agent` and kind are as in R35 of that spec. No code is asked for (D-159, FR-49 AC-139).
- R27. A link works once. After a successful use, a second request with the same token returns status 400 with the code `emergency_link_invalid` and creates no session; the first session stays (D-159, FR-49 AC-140, TS-223).
- R28. A token that is unknown, already used, or older than 10 minutes returns status 400 with the code `emergency_link_invalid`, with the same message and no `details` for all three, creates no session and changes no table; it writes only the log line of R35 (FR-49 AC-140, TS-222).
- R29. A `token` that is not 43 base64url characters returns status 400 with the code `validation_failed` (the registered code of TOKI-004) and does not read the database. Of the 16 strings of 43 characters that decode to the same 32 bytes, only the one that was printed is stored (R25); the others answer `emergency_link_invalid`.
- R30. When two requests with the right token arrive at the same time, exactly one creates a session; the other answers `emergency_link_invalid`.
- R31. When the account of a link is Deactivated at the time of use, the request returns status 400 with the code `account_deactivated`, creates no session and uses up the link as TOKI-022 does for a code (R18 of that spec): the transaction commits with `used_at` set and no session, so a second request answers `emergency_link_invalid`.
- R32. Marking the link used, creating the session and writing its id in `session_id` are committed together or not at all; the one exception is R31, where `used_at` is committed with no session. When creating the session fails, the transaction is rolled back, the link is still unused and the same request can be sent again (as TOKI-022 R43). This is met by `createSession` of TOKI-022 R29 and R53: it takes the open transaction, joins it, commits nothing and returns the id of the session. It also refuses an account that is not Active, which R31 has already answered before the call.
- R33. With the cookie transport, when the request already carries a valid session cookie, that session is ended with reason `replaced` after the commit, through `endSessionOfRequest(db, request, "replaced", { only: "cookie" })` of TOKI-022 R52, and the cookie is replaced (as TOKI-022 R34). The function ends only the session of the cookie, never one carried by a bearer token, returns its id or `null` (no cookie, an unknown or ended one, or one of a Deactivated account, in which case nothing is ended), and reports the ended id itself because it is given the database (TOKI-022 R50, R53). If the process stops between the commit and that ending, the earlier session stays live until its own end, which is the person's own earlier session. Asking the person first (D-080) is the page's job (R43).
- R34. The route is defined with `config: { public: true }`, the flag of TOKI-022 R24, so the session check lets it through without a session and no list in `auth` is edited, and the JSON-only rule and the `Origin` rule of TOKI-022 (R45, R46) apply to it. It is `POST` only: no `GET` route of this work creates a session, so opening a link in a browser, or a program that fetches it, signs nobody in (TOKI-022 R36, concern 9 of that spec).

Logging
- R35. Each use of the command writes one JSON line to standard error (R19), with the time and `operator`, the name of the operating-system user that ran it: for a printed link, `emergency_link_issued` at level `info` with `userId`, `linkId` and `expiresAt`; for a refusal, `emergency_link_refused` at level `warn` with `reason` `no_account` or `deactivated`, and `userId` for the second (D-159, FR-49 AC-141, TS-225). Each use of a link by the server writes one line to the server's log: `emergency_link_used` at `info` with `userId`, `linkId` and `sessionId`, or `emergency_link_rejected` at `warn` with `reason` `invalid` (unknown, used or expired: the three are one reason, so no second read of the database is made) or `deactivated`. R19 and R35 are tested on the same run: one line on standard output and one JSON line on standard error. Where the command's line ends up is concern 7.
- R36. No log line, no error body and no standard-error line of this work holds a token, a link, a token hash or an email address (TOKI-022 R37).

Contracts
- R37. The request and response bodies of the four routes of this work are Zod schemas in `packages/shared/src/auth/`, and the routes validate with those same schemas. The value lists of R6 are constants there, and TOKI-099 reads them (its R13). The 10 minutes of R24 is `EMERGENCY_LINK_TTL_SECONDS` in `limits.ts` of TOKI-022 R38. The codes `current_session` and `emergency_link_invalid` are added by this work to the registry of error codes in `packages/shared`, as TOKI-022 R54 adds its own; the other codes of this work are registered already (TOKI-004, TOKI-022 R54).
- R38. The migration of this work creates `emergency_links` and nothing else, after the migration of TOKI-019, with the names and rules of "Data model".
- R39. The Commands section of `CLAUDE.md` gets one entry for `pnpm --silent emergency:link <email>`: what it prints on standard output, what goes to standard error and the exit codes of R19 to R22.
The page that opens the link
- R40. The web app has a route `/emergency`, outside the app layout and outside the sign-in guard of TOKI-023: a person with a session and a person with none both reach it, and neither state sends it to `/login`, because that redirect would drop the fragment. The route carries the flag `public` of TOKI-023 R40, set on the route itself, so no root file is edited; with the flag, a 401 answer to the session read, whatever its code, is treated as no session and shows no modal, so a browser that holds the cookie of a Deactivated account can still use the link. While the session is read, the page shows the page background only.
- R41. Before it makes any request, the page reads the token from `location.hash` (the characters after `#`), keeps it in memory only, and removes the fragment from the address bar and from the history entry with `history.replaceState`, so that `location.href` holds the path alone. When there is no fragment, or it is not 43 base64url characters, the page shows the link as not valid and sends no request.
- R42. The page sends no request when it loads. The `POST` of R26 is sent only after the person presses the button of the page, and one press sends one request. Reason: a mail or chat program that renders a link with scripts would otherwise use the link up before the person does.
- R43. When the browser already has a session, the page asks first (D-080: "You are signed in as A. Sign out to continue as B?"): a confirmation sends the request with the cookie transport, and a refusal keeps the session and leaves the link unused. The wording is the one of D-080, in English and Vietnamese through i18n (concern 14).
- R44. The token is only in the request body: never in a path, a query string or a header, in browser storage, in the console, in a log, or in a report of an error. The page makes no request to another origin and loads nothing from another origin, and it carries `<meta name="referrer" content="no-referrer">`.
- R45. After 200 the page calls `markSignedIn(user)` of `client-core` (TOKI-023 R39), with the `user` of the answer, so the session state is `signedIn` for any earlier state, and the app goes to `/` with the history entry replaced, so Back does not return to the page. `emergency_link_invalid` and `validation_failed` show the link as not valid, with no workspace content (FR-49 AC-140); `account_deactivated` shows the deactivated form of F07; a failed or unanswered request (5xx, no network) shows the general failure and lets the person press again, since the link is not used up (R32). The token leaves memory after a final answer.
- R46. Every text of the page is read from the `i18n` package in English and Vietnamese, under keys `emergency.*`. The page is one centred card on the page background at every width from 360 x 560 up, with every control at least 40 px tall (D-068). What the card says is concern 14.
- R47. R40 to R44 are the rules of any page of Toki that carries a one-time token in its address; they are stated once, here. The page `/join` of TOKI-097 reads its token from `location.hash` after `/join#` (TOKI-024 R11) and follows R40, R41 and R44 (its R25, R26, R43). It does not follow R42 and R43 because it has a different protection: the only request that opening it makes is a lookup that changes nothing (TOKI-097 R5), and the code that signs a person in needs the 6 digits of the mail. R42 stays a rule for a page whose single request signs a person in with the token alone, as this one does.

## Design
### API
| Method | Path | Session | Purpose |
|---|---|---|---|
| GET | `/api/v1/auth/sessions` | required | The signed-in person's own live sessions |
| DELETE | `/api/v1/auth/sessions/:sessionId` | required | End one other session of the person |
| DELETE | `/api/v1/auth/sessions` | required | End every other session of the person |
| POST | `/api/v1/auth/emergency-sessions` | none | Exchange an emergency link's token for a session |

Shapes (JSON):
- `GET /auth/sessions` response 200: `{ "sessions": [ { "id": string (uuid), "current": boolean, "deviceKind": "desktop" | "phone" | "tablet" | "unknown", "browser": "chrome" | "edge" | "safari" | "firefox" | "other" | "unknown", "lastUsedAt": string (ISO 8601, UTC) } ] }`.
- `DELETE /auth/sessions/:sessionId` and `DELETE /auth/sessions`: no body; response 204, no body.
- `POST /auth/emergency-sessions` request: `{ "token": string of 43 characters, "transport"?: "cookie" | "token" }`. Response 200 with a cookie: `{ "user": User }`; with a token: `{ "user": User, "token": string }`. `User` is the shape of TOKI-022.
- Every error: `{ "error": { "code": string, "message": string, "details"?: object } }` (TOKI-004). The codes `current_session`, `emergency_link_invalid` are added to the registry of error codes by this work (R37).

What the screens of TOKI-099 get from it:
- A row of "Signed-in devices" is one item of the list. The screen words the row from `deviceKind` and `browser` (through i18n; what it says for `unknown` and `other` is concern 4) and the time from `lastUsedAt` (TOKI-094 rules). It marks the item with `current` true as "This device" (F06). The confirmation that "names the phone" (FR-47 TS-214) uses the same two values of the row it was opened from.
- After a confirmed "Sign out", the screen calls R7 or R13 and reads the list again: the row is gone (AC-134, AC-135).
- A 404 `not_found` or a 204 on R7 both mean the row is gone; the screen reads the list again.

### Outcomes
`GET /api/v1/auth/sessions`:

| Status | `error.code` | Meaning | The client is expected to |
|---|---|---|---|
| 200 | none | Body: `sessions` | Show the rows |
| 401 | `unauthenticated`, `session_ended`, `account_deactivated` | As TOKI-022 | As TOKI-022 |

`DELETE /api/v1/auth/sessions/:sessionId`:

| Status | `error.code` | Meaning | The client is expected to |
|---|---|---|---|
| 204 | none | The session is ended, or it already was | Read the list again |
| 400 | `validation_failed` | The id is not a UUID | Not reachable from a correct screen |
| 400 | `current_session` | The id is the session in use | Not reachable from a correct screen (the current row has no button); sign-out of this device is TOKI-022's route |
| 404 | `not_found` | Not a session of this person | Read the list again; show the shared "not found" page of D-131 only if it was not a stale row |
| 401 | as TOKI-022 | | As TOKI-022 |

`DELETE /api/v1/auth/sessions`: 204 always for a signed-in person; 401 as TOKI-022.

`POST /api/v1/auth/emergency-sessions`:

| Status | `error.code` | Meaning | The page is expected to |
|---|---|---|---|
| 200 | none | Signed in as `user`; cookie set, or `token` in the body | Go to Home (F43) |
| 400 | `validation_failed` | The token is not 43 base64url characters | Show the link as not valid |
| 400 | `emergency_link_invalid` | Unknown, used, or older than 10 minutes | Show the link as not valid, with no workspace content (FR-49 AC-140) |
| 400 | `account_deactivated` | The account is Deactivated | Show the deactivated form of F07 |
| 403 | `origin_not_allowed`, 415 `unsupported_media_type` | TOKI-022 R45, R46 | Not reachable from the app itself |

The page is built by this ticket (concern 3); what it says is concern 14.

### Device kind and browser
A small function of the `auth` module, `device-label.ts`, with no dependency. It reads the stored `user_agent` and applies these rules in order; the first that matches wins.

Browser:
1. No value or an empty one -> `unknown`.
2. Contains `Edg/`, `EdgA/` or `EdgiOS/` -> `edge`.
3. Contains `OPR/` or `Opera` -> `other`.
4. Contains `Firefox/` or `FxiOS/` -> `firefox`.
5. Contains `Chrome/` or `CriOS/` -> `chrome`.
6. Contains `Safari/` and `Version/` -> `safari`.
7. Anything else -> `other`.

Device kind:
1. No value or an empty one -> `unknown`.
2. Contains `iPad` -> `tablet`.
3. Contains `iPhone` -> `phone`.
4. Contains `Android`: `phone` when it also contains `Mobile`, otherwise `tablet`.
5. Contains `Windows`, `Macintosh`, `CrOS`, `X11` or `Linux` -> `desktop`.
6. Anything else -> `unknown`.

The browsers are the four that D-108 supports; any other is `other`. A laptop and a desktop machine cannot be told apart by a header, so both are `desktop`. A tablet that asks for the desktop site (iPadOS Safari sends a Macintosh header by default) is `desktop`: a known limit of the header, accepted by the rules above, not a decision of the log.

### Data model
This work adds one table, `emergency_links`, in `modules/auth/schema.ts`, by one migration `pnpm db:generate --name emergency_links`, following the conventions of TOKI-019. It changes no existing table.
- `id`: uuid, UUIDv7 by the default of the column.
- `workspace_id`: uuid, required, points to `workspaces.id`; the command reads it through the read function of the `workspace` module (TOKI-022, Module boundaries), because the `members` read function returns no workspace id.
- `user_id`: uuid, required, points to `users.id` (a foreign key across modules, written as SQL in the migration, named `emergency_links_user_id_fkey`; `emergency_links_workspace_id_fkey` for the other).
- `token_hash`: text, required, 64 lower-case hexadecimal characters of the SHA-256 of the token (`emergency_links_token_hash_check`), unique (`emergency_links_token_hash_key`).
- `created_at`: timestamptz, required, written from the clock; no database default.
- `expires_at`: timestamptz, required, later than `created_at` (`emergency_links_expires_at_check`).
- `used_at`: timestamptz, empty until the link is used (also set when the use is refused because the account is Deactivated, R31).
- `session_id`: uuid, empty until a session is created from the link; no foreign key, because a session row may be removed by the rules of TOKI-019 and the link row must outlive it. With the log line of R35 this is the durable record of which session a link made.
- Both foreign keys are `ON DELETE RESTRICT`. A link row is never deleted in phase 1: it is the durable record that a link was printed for a person (concern 7), and it holds no address.

Rules:
- A link is used by one `UPDATE ... WHERE used_at IS NULL AND expires_at > now RETURNING` on the row found by `token_hash`, so two requests cannot both win (R30). A statement that returns no row is one answer, `emergency_link_invalid`, and one log reason, `invalid` (R35); nothing is read afterwards to tell the cases apart.
- The hash is the SHA-256 of the 43-character string (R25). The 32 bytes of the token are never stored or logged. Hashing with plain SHA-256 is enough because the token has 256 bits of randomness (as TOKI-022 does for a session secret).
- No index beyond the key: the route finds a link by `token_hash`, and nothing reads links by person.

### How the parts run
The command: `apps/server/src/cli/emergency-link.ts`, run with `tsx` and the root `.env` like the `dev` script of TOKI-004 (the entry lives outside `modules/`, like `main.ts`). It imports the three narrow entries of R23 and not the `index.ts` of `auth`, which reaches the mail layer. The configuration module (TOKI-004 R2) keeps one schema per area; it exports each area's reader as a function, and the command calls only the readers of the database area, the app origin and the server area (its values all have defaults; the command uses the environment name), never the loader of all areas.
1. Read the arguments (R21) and the configuration it needs (R22); open the database; leave on any failure with the exit codes above. The logger is the one of TOKI-004 with standard error as its destination.
2. Find the account of the address through the read function of the `members` module that TOKI-022 uses (R2 of that spec, "find the account of an email address"), and the workspace id through the `workspace` read function. No account -> refuse (R20). Deactivated -> refuse.
3. Draw 32 random bytes, insert the `emergency_links` row with the hash and the times from the clock, then print the link on standard output (R19). The row is written before anything is printed, so a printed link always exists in the table.
4. Write the log line (R35) to standard error and close the database.

The production form is the compiled entry of the same file run with Node directly, `node <build folder>/cli/emergency-link.js <email>`, next to the compiled `main` (concern 12); `tsx` and `pnpm` are development tools.

The use: `POST /api/v1/auth/emergency-sessions`: validate the body with the shared schema; in one transaction run the `UPDATE` of "Rules", load the account, and for a Deactivated one commit the used mark with no session and answer `account_deactivated` (R31); otherwise create the session through `createSession` (R26), write its id in `session_id` and commit (R32); after the commit end the replaced session if the cookie carries one (R33), write the log line and set the cookie. The route sits in the `auth` routes next to the others and carries the flag of R34, so the JSON-only and `Origin` rules apply.

The link and the page: the link is `<origin>/emergency#<token>`. The token is in the fragment on purpose: a browser never sends a fragment to the server, so the token is not in an access log, a proxy log or a `Referer` header. That holds only while the page keeps it there, so the page follows the rules R40 to R44 (the rules of any page that carries a token, R47): outside the sign-in guard, because a redirect to `/login` loses the fragment; the fragment removed from the address bar and the history before any request; a `POST` only after a press, so a program that opens the link and runs its scripts uses nothing up; the token in the request body only. The server never serves a page that signs in and never signs in on a `GET` (R34).

Ending sessions:
- `devices.ts` holds the list and the two `DELETE` handlers. The handlers load the person's live sessions, pick those to end and call `endSessionsOfUser(db, userId, ...)` (R15) with the reason `revoked` and `only`: the one id for R7, the ids of all live sessions but the one of the request for R13.

### Decided in this spec
Technical choices the Blueprint leaves to the builder.
- Where links are stored: an own table, `emergency_links`, not a new `purpose` of `login_codes`. Reason: a `login_codes` row requires an address and a code hash and is counted, cancelled and pruned by the sign-in rules (TOKI-022 R4 to R6, R48). A link has none of them, and mixing the two would let a bug in one rule touch the other. TOKI-019 left this storage to this ticket (its concern 1).
- The link carries its token in the fragment (Design, "The link and the page"), and a page posts it. Reason: TOKI-022 concern 9 asks that opening a link never creates a session by a `GET`, and F43 wants the person to land on Home with no code.
- One error code, `emergency_link_invalid`, for an unknown, used or old token (R28). Reason: the three need the same step from the person (ask the operator for a new link), and three codes would tell a holder of a stolen token about the link's state.
- A deactivated person's link answers `account_deactivated` and is used up (R31). Reason: the holder has the secret, so telling them is not a leak, and F07 has a text for it; used up as TOKI-022 does for a code.
- The sessions ended by R7 and R13 get the reason `revoked` (the list of reasons is in TOKI-019 R17), not `signed_out`, which stays for the device ending its own session. Reason: the log (D-158) does not name a reason; a session ended from another device is revoked from the person's point of view, and listeners may treat the two differently.
- Ending a session that is already ended is 204 (R12); a session of another person is 404, like an unknown id (R10). Reason: the list can be stale, and the route must not tell a person which ids exist.
- The current session cannot be ended by these routes (R11). Reason: its own route exists (TOKI-022 R28), and one route that sometimes ends the session of the request would break the screen's idea of "other".
- The list holds live sessions only: not ended and not older than 30 days since last use (R2). Reason: FR-47 AC-134 says the row is gone after sign-out, and a session that ran out of time is no longer signed in.
- The list order is latest use first (R4). Reason: the current item has the latest time, since the request that reads the list sets it, so it comes first without a special rule; the screen may place it differently.
- The device kinds and browsers are codes, not words (R6, "Device kind and browser"). Reason: the words are i18n keys of TOKI-099; the server holds no text for a screen. Adding a value later is additive.
- The link lifetime is "valid while the time is before `expires_at`", refused at exactly 10 minutes (R24). Reason: D-159 says "valid 10 minutes" and TS-222 tests 11 minutes; the exact instant is a choice, the same as the code's in TOKI-022.
- The command's output: the link alone on standard output, everything else, the log line included, on standard error (R19, R35), and the documented form is `pnpm --silent emergency:link` (R18). Reason: the operator can pipe or copy the link, TS-221 expects exactly one link, the server's logger writes to standard output (TOKI-004 R6) and `pnpm` writes its own header lines there.
- No limit of its own against guessing a token, on the route or the command. Reason: the token has 256 bits, so guessing one is not possible; the list and the two `DELETE` routes need a session of the person; the command needs shell access. The cost of an unauthenticated route is kept small: a wrong token costs one `UPDATE` and one log line, with no second read (R35). Whether the public routes get a limit per network address is concern 17.
- The command and the route live in the `auth` module and a `cli/` entry, with no new module. Reason: sessions and links are `auth`'s data; no other module may read them.
- The page is built by this ticket (concern 3) and its rules are R40 to R44, stated once for every page that carries a token (R47). Reason: TOKI-023 leaves the emergency link to this ticket (its Scope), TOKI-099 does not list it, and the page is a small route outside the guard that needs the session state of TOKI-023.
- The command's refusal and the server's rejection of a link carry the operating-system user and the reasons of R35 and no address (R36). Reason: the operator is who ran it, and the address is personal data.

### Layout
```
apps/server/
├─ migrations/<n>_emergency_links.sql   (with meta/)
└─ src/
   ├─ config.ts (path of TOKI-004)       one reader per area (concern 11)
   ├─ cli/emergency-link.ts             the command (R18 to R23, R35)
   └─ modules/auth/
      ├─ index.ts        gains the use of a link; reaches the mail layer
      ├─ cli.ts          narrow entry of the command: issueEmergencyLink only (R23)
      ├─ routes.ts       gains the four routes
      ├─ devices.ts      list, end one, end all others
      ├─ device-label.ts user agent -> device kind and browser
      ├─ emergency.ts    issue and use of a link
      ├─ schema.ts       gains emergency_links
      └─ *.test.ts       integration tests
packages/shared/src/auth/
├─ devices.ts            schemas and value lists of R1, R6
├─ emergency.ts          schemas of R26
└─ limits.ts             gains EMERGENCY_LINK_TTL_SECONDS of R24 (named in TOKI-022 R38)
package.json (root)      script emergency:link
CLAUDE.md                the Commands entry of R39
apps/web/src/routes/
└─ emergency.tsx         the /emergency route with the flag `public`, and its card (R40 to R46)
packages/client-core/src/auth/emergency.ts   the one call of R26, no DOM
packages/i18n/           keys emergency.* in en and vi
```

## Testing
Written test-first, as server integration tests with Vitest against the real Postgres and the test clock of TOKI-008. Fake addresses (`sam@example.com`) and invented `User-Agent` strings only.
- List (R1 to R6): a person with five sessions, a cookie session, a token session, one ended, one idle for 31 days and one idle for exactly 30 days, and a second person with one session: the list holds three items, the cookie session, the token session and the one at exactly 30 days, with exactly the fields of R1 and the rest absent; `current` true only for the request's session, also when the request comes with the token; the order for different and equal times; `lastUsedAt` of the current item equals the test clock; a 2,000-character header stored as 512 gives a result. A table test of the rules of "Device kind and browser" with one invented header each for: Chrome and Edge, Firefox and Safari on a laptop (`desktop`), Safari on an iPhone (`phone`), Chrome on iOS (`phone`, `chrome`), Safari on an iPad (`tablet`), Chrome on Android with and without `Mobile`, an unknown app header (`unknown`, `other`), and no value and an empty one (`unknown`, `unknown`).
- End one (R7 to R12): end the phone's session from the laptop's: 204; the next request with the phone's cookie answers `session_ended`; the laptop still works; the list no longer shows it (TS-214). A not-UUID id, an id of another person's session and an id that does not exist answer 400, 404 and 404 with the same body and change no row; the current session's id answers `current_session` and the session still works; an already ended and an idle own session answer 204 with no new `ended_at` and no listener call.
- End all others (R13 to R15): with three sessions, the call keeps the caller's, the other two answer `session_ended`, and a second request with the caller's cookie still passes (TS-216); with no other session 204; another person's sessions stay live. A session idle for 31 days with no `ended_at` stays as it was after R13. A fake listener registered through TOKI-022 R50 receives each ended id once with the reason `revoked`, and nothing for an already ended one.
- Guards (R16): each route without a session answers 401, and the emergency route, which carries the flag, answers without one; a `DELETE` with a foreign `Origin` answers 403 and ends nothing; the route list of this work holds no `GET` that writes.
- Command (R18 to R25, R35, R36): run as a child process with a fake environment, once as the node process (R19) and once in the documented form `pnpm --silent emergency:link <email>` (R18), whose standard output must be the same single line. An Active Member and an Active Admin: exit 0, standard output is exactly one line that matches `<origin>/emergency#` plus 43 base64url characters, standard error holds exactly one JSON line `emergency_link_issued` with `operator`, `userId`, `linkId` and `expiresAt` and no address (R35), a row exists with the 64-character hash of the printed string and `expires_at` 10 minutes later, and a search of every column of the row finds neither the token nor the link. No account, an address that is only invited (an invitation row, no `users` row) and a Deactivated account: exit 1, empty standard output, no row. No argument, two arguments, a malformed and a 255-character address: exit 2, no row. A missing origin and an origin with a path: exit 1 with the variable name and not its value, no row. An `http://` origin with the environment name `production`, with `staging`, with a misspelt name and with no name: exit 1, no row; the same origin with the name `development`: exit 0; an `https://` origin with no environment name: exit 0. With no SMTP variable set and a closed port as the SMTP host: the link is printed (R23); a test walks the static imports from `src/cli/emergency-link.ts` and finds no file of the `mail` module and no mail package. The captured output of every run holds no token and no address, and the log lines have the fields of R35.
- Use (R26 to R34): the link printed by the command, used at once: 200, a session exists, the cookie has the attributes of TOKI-022 R21, a request with that cookie reaches `GET /api/v1/auth/session` as the member, and the token transport returns `token` and no cookie; the same token again: 400 `emergency_link_invalid`, no second session, the first still works (TS-223); at 9 minutes 59 seconds accepted and at exactly 10 minutes and after refused (TS-222); an unknown token, a used one and an expired one give bodies equal in code and message and change no table (R28); a 43-character string that decodes to the same bytes as a printed token but differs in its last character answers `emergency_link_invalid` (R29); a token of 42 characters: `validation_failed`, and no database statement runs; two requests at once: one session; the member deactivated after the link was printed: `account_deactivated`, no session, `used_at` set, and the link then answers `emergency_link_invalid` (R31); the row of a used link holds the id of the session in `session_id`; a session insert made to fail leaves the link unused and the same request then succeeds; with a valid session cookie on the request the earlier session is `replaced` and a fake listener receives its id once; with only a bearer token of an earlier session, that session stays live; a form-encoded body answers 415 and a foreign `Origin` 403, and a `GET` on the path answers 401 without a session; the route works with no session. The log captured during the tests holds `emergency_link_used` with the member's id and the session id, and `emergency_link_rejected` with the reasons `invalid` and `deactivated`, and no token, link, hash or address.
- Page (R40 to R47): component tests of Vitest with a faked API: the route is reached with a session and with none and is not sent to `/login`, also when the session read answers 401 `account_deactivated` (treated as none, no modal); the fragment is gone from `location.href` and `history` before the first request (the replacing call is made before the request); no request is made on load, and none for a missing or malformed fragment; one request per press, and a second press while it runs sends nothing; with a session, the D-080 question shows and a refusal sends nothing; the token appears in no request URL, header, storage, console call or captured error report; 200 calls `markSignedIn` with the user and replaces the history entry; each error answer of R45 shows its state. End-to-end (Playwright) against the real server: print a link with the command, open it, press the button and land on Home as the member; open the link, make no press and check that no `POST` was sent and that the link still works afterwards; open the page in a second tab after the first used it and see the link as not valid.
- Migration (R38): apply on an empty database after TOKI-019's migration; find the table, the two checks, the key and the two foreign keys by name in `pg_constraint`, and no foreign key on `session_id`; an insert with a 63-character hash and one with an `expires_at` equal to `created_at` fail; `pnpm db:generate` run again makes no new file.
- The 10 minutes and the 30 days are tested by moving the test clock, never by waiting.

## Data safety
- Only the hash of a link's token is stored; the token and the link are never logged and never in an error body (R25, R36). The link is printed once, on the operator's screen, and exists nowhere else.
- The link is not sent by mail, and nothing in a sign-in mail can carry one (D-157).
- The token is in a URL fragment, so it is not sent to the server by the browser, and not written to access logs or `Referer` headers; the page removes it from the address bar and the history before any request and posts it in a body only after a press (R41 to R44).
- What the list cannot tell: two sessions of the same browser on the same kind of machine look the same (a row has only kind, browser and last use), a stolen session that copies the header looks like the member's, and Samsung Internet, Brave, Vivaldi and the old Edge (`Edge/`) read as `chrome`. The remedy for a session a person does not recognise is "sign out all others" (R13). Whether a row also shows the time of its first sign-in is for TOKI-099 to decide; it would be an additive field.
- The list returns no secret and no raw `User-Agent`; a person sees only their own sessions (R2, R10).
- The command's address argument is personal data: it stays in the operator's shell history, which this work cannot control, and it is not written to any log of this work (R36).
- A printed link signs in as a member without a code: its protection is the shell access needed to print it, its 10 minutes, its single use and its 256-bit token.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I03, alongside TOKI-019, 020, 021, 022, 023 and 099 | Planning fact; Scope "Out" draws the line with each of them. |
| Milestone: M2 | Planning fact; no design impact. |
| Size: S | Scope: four routes, one command, one table, one parser and one small page. The scope is larger than the plan's size; concern 16. |
| Needs: TOKI-022 | R7, R13, R15, R26, R33, R34 use its session functions (R29, R30, R52, R53), its public-route flag (R24) and its constant (R38); concern 11 lists what this work adds itself. The page also needs TOKI-023 (concern 13). |
| Agreed scope: list own sessions with device kind, browser and last use; sign out one device or all others; refused on the next request; a command prints a one-time link valid 10 minutes, refuses a non-member or deactivated address, logs every use | R1 to R8, R13, R14; R18 to R24; R35, R39. |
| Each row shows device kind, browser and last use; the device in use is marked; confirmation is asked | R1, R3, R6. The confirmation is the screen's job (Scope "Out"); the data the screen needs is under "API". |
| After sign-out of another device it can read or write nothing, and its row is gone | R7, R8, R13, R14 (`session_ended` on the next request; row gone from the list). |
| Signing out leaves the person's other devices signed in; tabs of the same browser share the session | R7 and R13 end only other sessions; R13 keeps the request's session, so every tab of that browser stays in. Cross-tab signal: TOKI-099 (Scope). |
| The emergency link is valid 10 minutes, works once, for one member, and is the only sign-in without a code | R24, R27, R19; R26 makes it the only route that starts a session without a code, besides TOKI-022's exchange. The page that uses it: R40 to R47. |
| No link for a non-member or a deactivated person; every use is logged | R20, R31, R35 (standard error, with the operator), R25 and `session_id`. Where the command's line lands: concern 7. |
| The link is never mailed | R23, R36; the route list of R34. |
| A session started from the link is of the same kind as any other | R26 (the same function of TOKI-022 R29). The length of that session is not decided: concern 1. |
| Nothing is readable without a session; one sees and ends only one's own sessions | R2, R10, R16. |
| `/api/v1`, fields only added, one error format | API table; R37. |
| Two roles, Member and Admin; no Owner | R19 and R2 treat Member and Admin alike. No route here reads the role. |
| English is the default; server messages are English | The `message` of the new errors is English text for developers, not translated (TOKI-004 R12); the screens' words are TOKI-099's. |

## Open questions from the intent
- Does a session started from the emergency link last 30 days like any other? Not answered. D-179 is Open in the log. Carried forward as concern 1.
- Does printing a new link cancel an earlier unused one? Not answered. D-179 is Open in the log. Carried forward as concern 2.
- Which ticket builds the web page that opens the link? Answered in this spec: this ticket (concern 3, R40 to R47). What the page says is concern 14.
- What does the list show for a device whose user agent says nothing useful? Not answered. Carried forward as concern 4.
- Is "server log" met by a line in the output of the command, or must it reach the log of the running server? Not answered. Carried forward as concern 7.

## Areas of concern
1. How long a session from the emergency link lasts. D-179 is Open in the decision log; its proposal is a normal 30-day session. This spec fixes no length: R26 creates the session through the one function of TOKI-022 and takes whatever length that function gives at build time, so a different length would be a change to that function and a new requirement here. The tests do not check the `Max-Age` of this session. Not decided. Owner: Thanh Truong.
2. Whether printing a new link for a member cancels an earlier unused one. D-179 is Open; its proposal is that it does, as a new code does (D-082). This spec writes no requirement and builds no cancel step, and the table has no `cancelled_at`; with no rule, two printed links for one member are both usable until each is used or reaches 10 minutes, and an operator who printed a link by mistake cannot cancel it before it expires. A yes would add a column, a requirement and a test, and the table is new, so the decision is needed before the build. Not decided. Owner: Thanh Truong.
3. Who builds the web page that opens the link. Decided in this spec: this ticket builds it (R40 to R46), as a web part of a server ticket, with its files under Layout and its tests under Testing. Reasons: TOKI-023 lists the emergency link as TOKI-026's in its Scope and builds no page for it; TOKI-099 does not list it; the page is a small route outside the sign-in guard that reads the fragment, asks the question of D-080 and sends one `POST`. It needs the session state and the guard of TOKI-023, so the plan gets one more edge, TOKI-026 needs TOKI-023 (concern 13). The rules for a page that carries a token are R40 to R44 and are stated once for every such page (R47). Owner: Thanh Truong.
4. What a row of the devices list says when the header gives no device kind or browser (`unknown`, `other`): an app with a token session, an empty header, an unlisted browser. The log fixes the three items of a row and gives no word for an unknown one (TOKI-019 concern 12 is the same question). The words are not decided; whether the codes `unknown` and `other` show one label or two, and the label, belong to TOKI-099 and the product owner. Proposal, not a decision: a generic label for each, in the words the TOKI-099 spec chooses (D-139). Not decided. Owner: Thanh Truong.
5. The list's contents and rules not in the log: the closed lists of device kinds and browsers, the parsing rules, the order, the filter of live sessions and the exact instant of 10 minutes. Decided in this spec (see "Decided in this spec" for each reason); the log fixes only the three items of a row, "This device", and the 10 minutes. Adding a value to a list later is additive. The limits of the label are in Data safety. Owner: Thanh Truong.
6. Where the emergency links are stored. Decided in this spec: own table `emergency_links` in the `auth` module (TOKI-019 concern 1 left it to this ticket), with the id of the session a link made; the migration, its names and rules are under "Data model". Owner: Thanh Truong.
7. Where "every use is written to the server log" lands. The use of a link is written by the server process, so it is in the server's log. The command is a separate process: its line goes to standard error (R19, R35), and in a container that is the output of the `exec`, not the log of the running server. Decided in this spec: the row of R25 with `session_id` is the durable record of each printed and each used link, and the command's line carries the operating-system user that ran it. A refused unknown address leaves only the line on standard error, with no address (R36), and the line is lost if the output is not kept. Not decided: whether that meets FR-49 AC-141 and TS-225 ("the log contains an entry for this run"), or whether the line must reach the server's log. Proposal, not a decision: the operator's production runbook (TOKI-087) tells the operator to run the command so that its standard error is kept, and the row is accepted as the record. Owner: Thanh Truong.
8. How sessions are ended from another device. Decided in this spec: reason `revoked`; 204 for an already ended own session; 404 for another person's id; 400 `current_session` for the session in use; no confirmation on the server (R7 to R15). Owner: Thanh Truong.
9. The address in the link. Decided in this spec: the link is `<origin>/emergency#<token>`, with the origin from the one configuration value that TOKI-022 R46 reads for the `Origin` rule; this work adds no second value and builds the link from nothing else. Which name that variable has, and the row in the TOKI-096 inventory, is concern 15. Owner: Thanh Truong.
10. Guessing a token. Decided in this spec: no limit of its own on the route or the command (reason under "Decided in this spec"). A limit per network address on the public routes is concern 17. Owner: Thanh Truong.
11. Changes this work needs from files of other tickets. Decided in this spec: this ticket edits no other spec. (a) TOKI-022 now provides what this work asked for: the per-route flag `config: { public: true }` (its R24, set here on `POST /api/v1/auth/emergency-sessions`), `createSession(client, account, transport, { userAgent? })` that joins an open transaction and returns `{ id, secret }` (R29, R53), `endSessionsOfUser(client, userId, { reason, only?, except? })` that ends only live rows and returns the ids (R30), `endSessionOfRequest(client, request, reason, { only? })` (R52), the reporting of ended sessions (R50) and the constant `EMERGENCY_LINK_TTL_SECONDS` (R38). TOKI-022 R38 refers to this constant as "its R38"; the requirement here is R24 and R37. This work adds the two error codes `current_session` and `emergency_link_invalid` to the registry itself (R37). (b) TOKI-004: the configuration module exports one reader per area, and the logger takes a destination stream (as `buildApp` takes `logStream`), so the command can write to standard error; no spec has taken this yet, and the part of the command that needs it waits for it. (c) `members` and `workspace`: one narrow read entry each, with no import of the mail layer (R23); TOKI-002 allows the three narrow entries of R23 among the module boundaries. (d) TOKI-023: it provides the flag `public` on a route (its R40) and `markSignedIn(user)` (its R39) for this page, and names this ticket as the one that sets the flag on `/emergency`; no root file is edited. (e) The validation code: TOKI-004 registers `validation_failed`, and TOKI-022 now uses it too (its R20); this spec uses it. Owner: Thanh Truong.
12. Running the command in production. Decided in this spec: the entry is `apps/server/src/cli/emergency-link.ts`; in development it is run by the `emergency:link` script with `tsx` and the root `.env`, and in production by Node on its compiled file next to the compiled `main`, because `tsx` and `pnpm` are development tools. TOKI-084 builds every entry under `src/cli/` into the image, and TOKI-087 documents `node <build folder>/cli/emergency-link.js <email>` with its standard error kept (concern 7). Owner: Thanh Truong.
13. Plan changes this spec needs, requests to the plan and not edits. Decided in this spec: TOKI-026 needs TOKI-023 (the page needs its session state and guard); TOKI-099 needs TOKI-026 (its screens call these routes); TOKI-087 needs TOKI-026 (it documents the command); TOKI-084 builds every entry under `src/cli/`, or else needs TOKI-026. The last use per person is TOKI-024's (its R25, R17 here is withdrawn), so the Admin page needs no edge to this ticket for it, and TOKI-025 stays as the plan has it (TOKI-024, TOKI-093); TOKI-024 needs TOKI-022 already. Owner: Thanh Truong.
14. What the page at `/emergency` says, and whether a press is accepted. Decided in this spec: no request is sent before a press (R42), because a link scanner that renders scripts would use the link up. Not decided: the words of the page (the button, the not-valid state, the deactivated state and the failure state are in no prototype screen, so any wording is a proposal, D-139), and whether one press is accepted against FR-49 AC-139 and journey F43, which say that opening the link goes straight to Home. The question of D-080 for a browser that already has a session is Confirmed, and its wording is used (R43). Proposal, not a decision: one button, with the words the product owner chooses, then Home. Owner: Thanh Truong.
15. The name of the variable that holds the app's own origin. TOKI-022 concern 7, TOKI-024 R11 and this spec each leave it to TOKI-096, and the merged inventory has no such row (its server rows are the port, the bind host, the environment name and the log level). The environment name, with the values `development` and `production`, has its row. Proposal, not a decision: one row `APP_ORIGIN` (a required, non-secret value, read by the server) added to the inventory and to `.env.example` by one change request to TOKI-096 that the three specs share. Not decided. Owner: Thanh Truong.
16. The size of this ticket. The plan gives TOKI-026 the size S; the scope is four routes, a command, a table with a migration, a parser and one small page, with the last-use function now left to TOKI-024. Proposal, not a decision: M. Not decided. Owner: Thanh Truong.
17. Whether the public routes get a limit per network address. This is TOKI-022 concern 3, which is open; whatever it decides covers `POST /api/v1/auth/emergency-sessions`. This spec limits the cost of a wrong token to one `UPDATE` and one log line (R35). Not decided. Owner: Thanh Truong.
