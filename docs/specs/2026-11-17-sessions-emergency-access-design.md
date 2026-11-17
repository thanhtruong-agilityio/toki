# Sessions and emergency access (server) design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/sessions-emergency-access.md (Thanh Truong)
Ticket: TOKI-026

## Goal
A signed-in Member or Admin needs to see where they are signed in and end a session on a device they no longer hold. An operator with shell access needs a way to let a member in when mail is down, because every other sign-in needs a mailed code. This work adds the server side of both: the list of a person's own sessions with the end of one other session or of all other sessions, and a command that prints a one-time sign-in link together with the endpoint that turns that link into a session.

## Scope
- In:
  - `GET /api/v1/auth/sessions`: the signed-in person's own live sessions, with device kind, browser, last use and the mark of the one in use.
  - `DELETE /api/v1/auth/sessions/:sessionId` (end one other session) and `DELETE /api/v1/auth/sessions` (end all other sessions).
  - The turning of the stored `User-Agent` into a device kind and a browser.
  - The command `emergency:link`, the table that stores its links (hashed), and `POST /api/v1/auth/emergency-sessions`, which exchanges a link for a session.
  - The log lines of the command and of the use of a link.
  - The function that returns the last use of each person, for the Admin page (a hand-off of TOKI-019).
  - The request and response schemas in `packages/shared`, and server integration tests.
- Out (not now):
  - Signing out the current device: `DELETE /api/v1/auth/session`, owned by TOKI-022 (R28, R33). This work does not duplicate it and refuses to end the current session through its own route (R11). Whether "Sign out" asks for confirmation (D-178, Open in the log) is a question for TOKI-099; the route is the same either way.
  - The screens: the account menu, the "Signed-in devices" section of Preferences, the confirmation for signing out other devices and the words of a row: TOKI-099. The data they need is under "API".
  - What other tabs of the same browser do when a session ends (D-093). This work owns the server side only: the tabs of one browser share one session, so they are not "other devices" and these routes never end them; once a session is ended, every later request that carries it is answered `session_ended` (TOKI-022 R27, R28). The signal that makes a tab react before its next request is TOKI-099, on the session state of TOKI-023.
  - Closing the realtime connection and removing the push registration of an ended session: TOKI-038 and TOKI-074. They hear about it through the listeners of TOKI-022 (R50), which this work feeds (R13).
  - Ending every session of a person when an Admin deactivates them: TOKI-024 through TOKI-022 R30.
  - The web page that the emergency link opens: no ticket in the plan owns it (concern 3).
  - How the command is run inside the production image: TOKI-084 (concern 12).
  - A network limit on sign-in routes: TOKI-022 concern 3.
  - Guest sessions: phase 5.

## Requirements
The list of sessions
- R1. `GET /api/v1/auth/sessions` with a valid session returns status 200 and a body with exactly one field, `sessions`, a list. Each item has exactly `id`, `current`, `deviceKind`, `browser` and `lastUsedAt`, and nothing else (no secret hash, no raw `User-Agent`).
- R2. The list holds exactly the sessions of the signed-in person that are live: not ended, and with a last use at most 30 days ago (up to and including exactly 30 days, as TOKI-022 R25). It holds no session of another person, no ended session and no session that ran out of time. Cookie sessions and token sessions are both listed (FR-47 AC-133).
- R3. `current` is `true` for the one session that carries the request and `false` for every other item. The list always has exactly one item with `current` true (D-158, F06 "This device").
- R4. The list is ordered by `lastUsedAt`, latest first; items with the same time are ordered by `id`, smallest first (concern 5).
- R5. `lastUsedAt` is the stored `last_used_at` as an ISO 8601 string in UTC. The request that reads the list counts as a use (TOKI-022 R25), so the item with `current` true has the time of the clock at that request.
- R6. `deviceKind` is one of `desktop`, `phone`, `tablet`, `unknown`; `browser` is one of `chrome`, `edge`, `safari`, `firefox`, `other`, `unknown`. Both are a pure function of the stored `user_agent`, by the rules of "Device kind and browser" below (concern 5). A session with no stored `user_agent` or an empty one gives `unknown` and `unknown`.

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
- R15. R7 and R13 end sessions only through the one function of `sessions.ts` that TOKI-022 names (Module boundaries), so the listeners of TOKI-022 R50 receive the ids and the reason `revoked` once for each session that was live, and nothing for a session that was already ended.
- R16. The three routes need a valid session (TOKI-022 R24). Both `DELETE` routes obey the `Origin` rule (TOKI-022 R46). `GET /api/v1/auth/sessions` changes nothing except the last use that every checked request sets (TOKI-022 R36).
- R17. The `auth` module exports `getLastUsedAtByUser(userIds)`, which returns for each given person id the latest `last_used_at` over all of that person's sessions, ended or not, or `null` for a person with no session. The Admin page's "last active" reads it (TOKI-019, Hand-offs).

The emergency command
- R18. The root `package.json` and `apps/server/package.json` each have a script `emergency:link`. From the repository root, `pnpm emergency:link <email>` runs the command with exactly one argument, the member's email address, which is trimmed and put in lower case, as TOKI-022 R7 does.
- R19. For an address whose account is Active, a Member or an Admin, the command writes exactly one line to standard output: the link `<origin>/emergency#<token>`, where `<origin>` is the app's own origin of the configuration and `<token>` is 43 characters, the base64url form of 32 bytes from a cryptographic random source. It writes nothing else to standard output, may write explanations to standard error, and exits with code 0 (D-159, FR-49 AC-139).
- R20. For an address with no account (this includes a person who has only been invited) or whose account is Deactivated, the command prints no link, writes a one-line reason to standard error, exits with code 1 and stores nothing (D-159, FR-49 AC-141).
- R21. With no argument, more than one argument, or an address that is not well-formed or longer than 254 characters, the command exits with code 2, prints no link and stores nothing.
- R22. The command reads only the configuration it needs: the database connection, the app's own origin and the environment name. With one of them missing or invalid it exits with code 1, writes the variable name and never its value, prints no link and stores nothing. The origin must be an absolute `https://` address, or an `http://` address when the environment name is not `production`, with no path. An unrelated missing variable (SMTP, first admin) does not stop it.
- R23. The command needs no mail: it does not import the mail module, and it prints a link with the SMTP host unreachable and with the SMTP variables unset (D-159, journey F43).
- R24. A link is valid for 10 minutes: usable while the clock is before `expires_at`, which is `created_at` plus 10 minutes, and refused at exactly 10 minutes and after (concern 5, TOKI-022 uses the same instant for a code). The 10 minutes is a constant in the shared limits file of TOKI-022 R38 (D-159, FR-49 AC-140).
- R25. The database stores only the SHA-256 hash of the token, in a table `emergency_links` (Data model). No column holds the token or the link, and the token cannot be read back from the database.

Using a link
- R26. `POST /api/v1/auth/emergency-sessions` with `{ "token": string, "transport"?: "cookie" | "token" }`, with a token whose link was printed less than 10 minutes ago and not used, for an Active account, returns status 200 with `user` (the `User` of TOKI-022) and creates one session through the function of TOKI-022 R29. The cookie, or for `transport` `"token"` the `token` in the body, is exactly as in TOKI-022 R21 and R22, and the stored `user_agent` and kind are as in R35 of that spec. No code is asked for (D-159, FR-49 AC-139).
- R27. A link works once. After a successful use, a second request with the same token returns status 400 with the code `emergency_link_invalid` and creates no session; the first session stays (D-159, FR-49 AC-140, TS-223).
- R28. A token that is unknown, already used, or older than 10 minutes returns status 400 with the code `emergency_link_invalid`, with the same message and no `details` for all three, creates no session and writes nothing (FR-49 AC-140, TS-222).
- R29. A `token` that is not 43 base64url characters returns status 400 with the code `validation_failed` and does not read the database.
- R30. When two requests with the right token arrive at the same time, exactly one creates a session; the other answers `emergency_link_invalid`.
- R31. When the account of a link is Deactivated at the time of use, the request returns status 400 with the code `account_deactivated`, creates no session and uses up the link (as TOKI-022 R18 does for a code).
- R32. Marking the link used and creating the session are committed together or not at all. When creating the session fails, the link is still unused and the same request can be sent again (as TOKI-022 R43).
- R33. With the cookie transport, when the request already carries a valid session cookie, that session is ended with reason `replaced` and the cookie is replaced (as TOKI-022 R34). Asking the person first (D-080) is the page's job.
- R34. The route is added to the routes the session check lets through without a session (TOKI-022 R24), and the JSON-only rule and the `Origin` rule of TOKI-022 (R45, R46) apply to it. It is `POST` only: no `GET` route of this work creates a session, so opening a link in a browser, or a program that fetches it, signs nobody in (TOKI-022 R36, concern 9 of that spec).

Logging
- R35. Each use of the command writes one line to the command's log, with the time: for a printed link, `emergency_link_issued` at level `info` with `userId`, `linkId` and `expiresAt`; for a refusal, `emergency_link_refused` at level `warn` with `reason` `no_account` or `deactivated`, and `userId` for the second (D-159, FR-49 AC-141, TS-225). Each use of a link by the server writes one line to the server's log: `emergency_link_used` at `info` with `userId`, `linkId` and `sessionId`, or `emergency_link_rejected` at `warn` with `reason` `unknown`, `used`, `expired` or `deactivated`. Where the command's line ends up is concern 7.
- R36. No log line, no error body and no standard-error line of this work holds a token, a link, a token hash or an email address (TOKI-022 R37).

Contracts
- R37. The request and response bodies of the four routes of this work are Zod schemas in `packages/shared/src/auth/`, and the routes validate with those same schemas. The value lists of R6 are constants there. The 10 minutes of R24 is a constant in the file of TOKI-022 R38.
- R38. The migration of this work creates `emergency_links` and nothing else, after the migration of TOKI-019, with the names and rules of "Data model".

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
- Every error: `{ "error": { "code": string, "message": string, "details"?: object } }` (TOKI-004). The codes `current_session`, `emergency_link_invalid` are added to the registry of TOKI-004.

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

What the page shows, and which ticket builds it, are not decided (concern 3).

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
- `workspace_id`: uuid, required, points to `workspaces.id`.
- `user_id`: uuid, required, points to `users.id` (a foreign key across modules, written as SQL in the migration, named `emergency_links_user_id_fkey`; `emergency_links_workspace_id_fkey` for the other).
- `token_hash`: text, required, 64 lower-case hexadecimal characters of the SHA-256 of the token (`emergency_links_token_hash_check`), unique (`emergency_links_token_hash_key`).
- `created_at`: timestamptz, required, written from the clock; no database default.
- `expires_at`: timestamptz, required, later than `created_at` (`emergency_links_expires_at_check`).
- `used_at`: timestamptz, empty until the link is used.
- All foreign keys are `ON DELETE RESTRICT`. A link row is never deleted in phase 1: it is the durable record that a link was printed for a person (concern 7), and it holds no address.

Rules:
- A link is used by one `UPDATE ... WHERE used_at IS NULL AND expires_at > now RETURNING` on the row found by `token_hash`, so two requests cannot both win (R30). Which of the cases `unknown`, `used`, `expired` applies is read afterwards for the log only; the client sees one code (R28).
- The 32 bytes of the token are never stored or logged. Hashing with plain SHA-256 is enough because the token has 256 bits of randomness (as TOKI-022 does for a session secret).
- No index beyond the key: the route finds a link by `token_hash`, and nothing reads links by person.

### How the parts run
The command: `apps/server/src/cli/emergency-link.ts`, run with `tsx` and the root `.env` like the `dev` script of TOKI-004 (the entry lives outside `modules/`, like `main.ts`, and imports only the `auth` module's `index.ts`).
1. Read the arguments (R21) and the configuration it needs (R22); open the database; leave on any failure with the exit codes above.
2. Find the account of the address through the `members` read function that TOKI-022 uses (R2 of that spec, "find the account of an email address"). No account -> refuse (R20). Deactivated -> refuse.
3. Draw 32 random bytes, insert the `emergency_links` row with the hash and the times from the clock, then print the link on standard output (R19). The row is written before anything is printed, so a printed link always exists in the table.
4. Write the log line (R35) and close the database.

The use: `POST /api/v1/auth/emergency-sessions`: validate the body with the shared schema; in one transaction run the `UPDATE` of "Rules", load the account, refuse a Deactivated one (R31), create the session through the same internal function that TOKI-022 R10 uses, end the replaced session if the cookie carries one (R33); commit; write the log line; set the cookie. The route sits in the `auth` routes next to the others, so the JSON-only and `Origin` rules apply.

The link and the page: the link is `<origin>/emergency#<token>`. The token is in the fragment on purpose: a browser never sends a fragment to the server, so the token is not in an access log, a proxy log or a `Referer` header. The page at `/emergency` reads the fragment and sends one `POST` to the route above. The server never serves a page for the link and never signs in on a `GET` (R34).

Ending sessions:
- `devices.ts` holds the list and the two `DELETE` handlers. The handlers load the person's live sessions, pick those to end and call the one ending function of `sessions.ts` with the reason `revoked`. "All other" uses the option of TOKI-022 R30 that keeps one session (the one of the request).
- `getLastUsedAtByUser` is one `GROUP BY` query on `sessions`.

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
- The command's output: the link alone on standard output, everything else on standard error (R19). Reason: the operator can pipe or copy it, and TS-221 expects exactly one link.
- No rate limit on the new routes and none on the command. Reason: the token has 256 bits, so guessing one is not possible; the list and the two `DELETE` routes need a session of the person; the command needs shell access. A limit per network address on the public routes is TOKI-022 concern 3 and would cover this route too.
- The command and the route live in the `auth` module and a `cli/` entry, with no new module. Reason: sessions and links are `auth`'s data; no other module may read them.

### Layout
```
apps/server/
├─ migrations/<n>_emergency_links.sql   (with meta/)
└─ src/
   ├─ cli/emergency-link.ts             the command (R18 to R23, R35)
   └─ modules/auth/
      ├─ index.ts        gains issueEmergencyLink and getLastUsedAtByUser
      ├─ routes.ts       gains the four routes
      ├─ devices.ts      list, end one, end all others, last use per person
      ├─ device-label.ts user agent -> device kind and browser
      ├─ emergency.ts    issue and use of a link
      ├─ schema.ts       gains emergency_links
      └─ *.test.ts       integration tests
packages/shared/src/auth/
├─ devices.ts            schemas and value lists of R1, R6
├─ emergency.ts          schemas of R26
└─ limits.ts             gains the 10 minutes of R24
package.json (root)      script emergency:link
```

## Testing
Written test-first, as server integration tests with Vitest against the real Postgres and the test clock of TOKI-008. Fake addresses (`sam@example.com`) and invented `User-Agent` strings only.
- List (R1 to R6): a person with a cookie session and a token session, one ended session, one idle for 31 days, one idle for exactly 30 days, and a second person with one session: the list holds the first three and the one at 30 days, with exactly the fields of R1 and the rest absent; `current` true only for the request's session, also when the request comes with the token; the order for different and equal times; `lastUsedAt` of the current item equals the test clock; a 2,000-character header stored as 512 gives a result. A table test of the rules of "Device kind and browser" with one invented header each for: Chrome and Edge, Firefox and Safari on a laptop (`desktop`), Safari on an iPhone (`phone`), Chrome on iOS (`phone`, `chrome`), Safari on an iPad (`tablet`), Chrome on Android with and without `Mobile`, an unknown app header (`unknown`, `other`), and no value and an empty one (`unknown`, `unknown`).
- End one (R7 to R12): end the phone's session from the laptop's: 204; the next request with the phone's cookie answers `session_ended`; the laptop still works; the list no longer shows it (TS-214). A not-UUID id, an id of another person's session and an id that does not exist answer 400, 404 and 404 with the same body and change no row; the current session's id answers `current_session` and the session still works; an already ended and an idle own session answer 204 with no new `ended_at` and no listener call.
- End all others (R13 to R15): with three sessions, the call keeps the caller's, the other two answer `session_ended`, and a second request with the caller's cookie still passes (TS-216); with no other session 204; another person's sessions stay live. A fake listener registered through TOKI-022 R50 receives each ended id once with the reason `revoked`, and nothing for an already ended one.
- Guards (R16): each route without a session answers 401; a `DELETE` with a foreign `Origin` answers 403 and ends nothing; the route list of this work holds no `GET` that writes.
- Last use (R17): two persons with several sessions, one of them ended, and one with none: the function returns the latest time per person and `null`.
- Command (R18 to R25, R35, R36): run as a child process with a fake environment. An Active Member and an Active Admin: exit 0, standard output is exactly one line that matches `<origin>/emergency#` plus 43 base64url characters, a row exists with the 64-character hash and `expires_at` 10 minutes later, and a search of every column of the row finds neither the token nor the link. No account, an address that is only invited (an invitation row, no `users` row) and a Deactivated account: exit 1, empty standard output, no row. No argument, two arguments, a malformed and a 255-character address: exit 2, no row. A missing origin, an origin with a path, an `http://` origin with the environment name `production`: exit 1 with the variable name and not its value, no row. With no SMTP variable set and a closed port as the SMTP host: the link is printed (R23); a search of the command's files finds no import of the mail module. The captured output of every run holds no token and no address, and the log lines have the fields of R35.
- Use (R26 to R34): the link printed by the command, used at once: 200, a session exists, the cookie has the attributes of TOKI-022 R21, a request with that cookie reaches `GET /api/v1/auth/session` as the member, and the token transport returns `token` and no cookie; the same token again: 400 `emergency_link_invalid`, no second session, the first still works (TS-223); at 9 minutes 59 seconds accepted and at exactly 10 minutes and after refused (TS-222); an unknown token and a used one give bodies equal in code and message; a token of 42 characters: `validation_failed`, and no database statement runs; two requests at once: one session; the member deactivated after the link was printed: `account_deactivated`, no session, the link then answers `emergency_link_invalid`; a session insert made to fail leaves the link unused and the same request then succeeds; with a valid session cookie on the request the earlier session is `replaced`; a form-encoded body answers 415 and a foreign `Origin` 403, and a `GET` on the path answers 401 without a session; the route works with no session. The log captured during the tests holds `emergency_link_used` with the member's id and the session id, and `emergency_link_rejected` with each reason, and no token, link, hash or address.
- Migration (R38): apply on an empty database after TOKI-019's migration; find the table, the two checks, the key and the two foreign keys by name in `pg_constraint`; an insert with a 63-character hash and one with an `expires_at` equal to `created_at` fail; `pnpm db:generate` run again makes no new file.
- The 10 minutes and the 30 days are tested by moving the test clock, never by waiting.

## Data safety
- Only the hash of a link's token is stored; the token and the link are never logged and never in an error body (R25, R36). The link is printed once, on the operator's screen, and exists nowhere else.
- The link is not sent by mail, and nothing in a sign-in mail can carry one (D-157).
- The token is in a URL fragment, so it is not sent to the server by the browser, and not written to access logs or `Referer` headers.
- The list returns no secret and no raw `User-Agent`; a person sees only their own sessions (R2, R10).
- The command's address argument is personal data: it stays in the operator's shell history, which this work cannot control, and it is not written to any log of this work (R36).
- A printed link signs in as a member without a code: its protection is the shell access needed to print it, its 10 minutes, its single use and its 256-bit token.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I03, alongside TOKI-019, 020, 021, 022, 023 and 099 | Planning fact; Scope "Out" draws the line with each of them. |
| Milestone: M2 | Planning fact; no design impact. |
| Size: S | Scope: four routes, one command, one table, one parser; no screen. |
| Needs: TOKI-022 | R7, R13, R15, R26, R33 use its session functions and check; "Decided in this spec" and concern 11 list what is added to its files. |
| Agreed scope: list own sessions with device kind, browser and last use; sign out one device or all others; refused on the next request; a command prints a one-time link valid 10 minutes, refuses a non-member or deactivated address, logs every use | R1 to R8, R13, R14; R18 to R24; R35. |
| Each row shows device kind, browser and last use; the device in use is marked; confirmation is asked | R1, R3, R6. The confirmation is the screen's job (Scope "Out"); the data the screen needs is under "API". |
| After sign-out of another device it can read or write nothing, and its row is gone | R7, R8, R13, R14 (`session_ended` on the next request; row gone from the list). |
| Signing out leaves the person's other devices signed in; tabs of the same browser share the session | R7 and R13 end only other sessions; R13 keeps the request's session, so every tab of that browser stays in. Cross-tab signal: TOKI-099 (Scope). |
| The emergency link is valid 10 minutes, works once, for one member, and is the only sign-in without a code | R24, R27, R19; R26 makes it the only route that starts a session without a code, besides TOKI-022's exchange. |
| No link for a non-member or a deactivated person; every use is logged | R20, R31, R35. Where the command's line lands: concern 7. |
| The link is never mailed | R23, R36; the route list of R34. |
| A session started from the link is of the same kind as any other | R26 (the same function of TOKI-022 R29). The length of that session is not decided: concern 1. |
| Nothing is readable without a session; one sees and ends only one's own sessions | R2, R10, R16. |
| `/api/v1`, fields only added, one error format | API table; R37. |
| Two roles, Member and Admin; no Owner | R19 and R2 treat Member and Admin alike. No route here reads the role. |
| English is the default; server messages are English | The `message` of the new errors is English text for developers, not translated (TOKI-004 R12); the screens' words are TOKI-099's. |

## Open questions from the intent
- Does a session started from the emergency link last 30 days like any other? Not answered. D-179 is Open in the log. Carried forward as concern 1.
- Does printing a new link cancel an earlier unused one? Not answered. D-179 is Open in the log. Carried forward as concern 2.
- Which ticket builds the web page that opens the link? Not answered. Carried forward as concern 3.
- What does the list show for a device whose user agent says nothing useful? Not answered. Carried forward as concern 4.
- Is "server log" met by a line in the output of the command, or must it reach the log of the running server? Not answered. Carried forward as concern 7.

## Areas of concern
1. How long a session from the emergency link lasts. D-179 is Open in the decision log; its proposal is a normal 30-day session. This spec writes no requirement about the length: it creates the session through the one function of TOKI-022 (R26), which makes the only kind of session there is, so a different length would be a change to that function and a new requirement here. Not decided. Owner: Thanh Truong.
2. Whether printing a new link for a member cancels an earlier unused one. D-179 is Open; its proposal is that it does, as a new code does (D-082). This spec writes no requirement and builds no cancel step, and the table has no `cancelled_at`; with no rule, two printed links for one member are both usable until each is used or reaches 10 minutes. A yes would add a column, a requirement and a test. Not decided. Owner: Thanh Truong.
3. The web page that opens the link. F43 says opening the link goes straight to Home, and TOKI-022 concern 9 forbids a `GET` that creates a session, so a page must read the fragment and send the `POST` of R26. TOKI-023 leaves the emergency link to this ticket, this ticket is server only, and TOKI-099 does not list it, so no ticket builds the page. It also needs the question of D-080 when a session already exists in that browser. Proposal, not a decision: TOKI-023, which owns the session state in `client-core` and the pages around sign-in, adds a route `/emergency`; it is small (read the fragment, one `POST`, go Home, or show the link as not valid). Not decided. Owner: Thanh Truong.
4. What a row of the devices list says when the header gives no device kind or browser (`unknown`, `other`): an app with a token session, an empty header, an unlisted browser. The log fixes the three items of a row and gives no word for an unknown one (TOKI-019 concern 12 is the same question). The words are not decided; whether the codes `unknown` and `other` show one label or two, and the label, belong to TOKI-099 and the product owner. Proposal, not a decision: a generic label for each, in the words the TOKI-099 spec chooses (D-139). Not decided. Owner: Thanh Truong.
5. The list's contents and rules not in the log: the closed lists of device kinds and browsers, the parsing rules, the order, the filter of live sessions and the exact instant of 10 minutes. Decided in this spec (see "Decided in this spec" for each reason); the log fixes only the three items of a row, "This device", and the 10 minutes. Adding a value to a list later is additive. Owner: Thanh Truong.
6. Where the emergency links are stored. Decided in this spec: own table `emergency_links` in the `auth` module (TOKI-019 concern 1 left it to this ticket); the migration, its names and rules are under "Data model". Owner: Thanh Truong.
7. Where "every use is written to the server log" lands. The use of a link is written by the server process, so it is in the server's log. The command is a separate process: its line goes to the command's own output, and in a container that is the output of the `exec`, not the log of the running server. Decided in this spec: the row of R25 is the durable record of each printed link (who, when), and the command writes its line through the same JSON logger as the server. Not decided: whether that meets FR-49 AC-141 and TS-225 ("the log contains an entry for this run"), or whether the line must reach the server's log. Proposal, not a decision: the operator's production runbook (TOKI-087) tells the operator to run the command so that its output is captured, and the row is accepted as the record. Owner: Thanh Truong.
8. How sessions are ended from another device. Decided in this spec: reason `revoked`; 204 for an already ended own session; 404 for another person's id; 400 `current_session` for the session in use; no confirmation on the server (R7 to R15). Owner: Thanh Truong.
9. The address in the link. Decided in this spec: the link is `<origin>/emergency#<token>`, with the origin from the one configuration value that TOKI-022 concern 7 asks TOKI-096 to add for the app's own origin; this work adds no second value and builds the link from nothing else. If that value is not in the inventory when this is built, the build adds it there under the name chosen in TOKI-022's work. Owner: Thanh Truong.
10. Rate limits. Decided in this spec: none on the four routes and the command (reason under "Decided in this spec"); a limit per network address on the public routes is TOKI-022 concern 3 and, if made, covers `POST /auth/emergency-sessions`. Owner: Thanh Truong.
11. Changes this work makes to files of TOKI-022, which edits no spec here: it adds `POST /api/v1/auth/emergency-sessions` to the routes the check lets through (TOKI-022 R24 lists four); it adds one constant to `limits.ts` (R38); it calls the ending function of `sessions.ts` with the reason `revoked` and uses the "keep one" option of R30 (R30 does not say that the reason is an argument; if it is not, this work adds it); it adds its codes to the registry. TOKI-022 writes the validation code `validation_error`, while TOKI-004 names it `validation_failed`; this spec uses the name of TOKI-004. Decided in this spec: each is made in this ticket's own build; the difference of the validation code is for TOKI-022's spec to settle. Owner: Thanh Truong.
12. Running the command in production. Decided in this spec: the entry is `apps/server/src/cli/emergency-link.ts`, run by the `emergency:link` script with `tsx` and the root `.env`, as the `dev` script is (TOKI-004). How the production image makes it runnable, and how an operator reaches it on the VPS, is TOKI-084 (the image) and TOKI-087 (the installation guide). Owner: Thanh Truong.
13. The last use per person (R17) is a hand-off from TOKI-019 (Hand-offs and its concern 13) for the Admin page (TOKI-025). Decided in this spec: this ticket builds it. The plan lists TOKI-025 as needing TOKI-024 and TOKI-093 only; it must also need this ticket, which is a change to the plan, not to this spec. Owner: Thanh Truong.
