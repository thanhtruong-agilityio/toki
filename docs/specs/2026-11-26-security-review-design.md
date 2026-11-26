# Security review design

Date: 2026-11-26 · Status: draft for review
Intent: docs/intents/security-review.md (Thanh Truong)
Ticket: TOKI-091

## Goal
Toki goes onto the public internet for about 200 people. This work reads the security choices of the finished specs together, against the code on `main`, for four things: headers, cookies, rate limits and dependencies. It records what it finds in one file, builds what the findings call for (a Content-Security-Policy, limits for the routes that have none, a body size limit, an advisory check, pinned workflow actions) and adds tests so that routes and packages added later stay inside the same rules. Two findings need a product decision and are carried as concerns.

## Scope
- In:
  - The review: a checklist of items, each with its source, and the record of findings, `docs/security/review.md` (R1, R2).
  - Headers: the Content-Security-Policy, `Permissions-Policy` and `Cross-Origin-Opener-Policy` of the app host in `infra/Caddyfile`; the default `Cache-Control` of the API (R3, R4, R7); the proof of the policy in a real browser (R5).
  - Cookies and cross-site requests: the browser proof of the cookie (R6), the cross-site cases for every route that is not a `GET` (R16), and the proof that no `GET` route changes anything (R17).
  - Rate limits: one limiter for every limit, the address key, the three Join routes, failed sign-in checks, signed-in people by route class, the body size (R8 to R15), and the address that the proxy forwards (R18).
  - Dependencies: exact versions, the advisory check, install scripts, pinned workflow actions (R19 to R22).
- Out (not now):
  - Authorization: who may read or change what, and the same answer for every outsider. That is TOKI-088 (its registry, its fixture and its refusals). This work asks how often and how much, and which headers and cookies; it never asks who is allowed. Where it reuses the registry of TOKI-088 it uses its requests and its route table and adds no authorization case (concern 5).
  - The content of the screens for a refused request: the text of `rate_limited` on sign-in and Join is open (concern 2); the screens belong to TOKI-023 and TOKI-097.
  - A virus scan (D-186), a quota on storage (NFR-15), a web application firewall, intrusion detection, a penetration test by a third party, and a vulnerability-disclosure page. Not asked by the log; each would be a new decision.
  - A scan of the operating-system packages inside the images and a licence review (concern 7).
  - The headers of TOKI-084 R20 and the Caddyfile outside the header block of this work; backup (D-092).
  - A limit shared by several processes or machines: the limits count in the memory of the one server process (concern 6).

## Requirements
### The review and its record
- R1. The record. `docs/security/review.md` holds one table with one row for each item of Table C (below), with the columns `id`, `area`, `checked`, `source`, `result` and `evidence`. `result` is one of `pass`, `fixed`, `accepted` and `open`. A `fixed` row names the requirement of this spec and the test that proves it; an `accepted` row names the decision that accepts the risk (a D-number, an NFR, or a concern of a merged spec); an `open` row names a concern of this spec or an issue of the repository. The file also holds the known findings F1 to F9 of Table D with the result and the reference written in that table, and one line at the top with the commit of `main` that the review read. The review is made against the built code, not only the specs: a row says what was read (a file and a line range, or a request that was sent). Check: R2.
- R2. The check of the record. `tools/security/findings.test.mjs` (Node test runner, run by `pnpm test`) reads `docs/security/review.md` and `Table C` of this spec and fails on: an item of Table C with no row; a row with a `result` that is not one of the four; a `fixed` row whose named test file does not exist; an `open` or `accepted` row with no reference; a `source` that names a path of the repository that does not exist; a known finding F1 to F9 with no row. Check: a fixture file with each of the six faults, each failing with its own message, and the real file passing.

### Headers
- R3. The Content-Security-Policy. The Caddyfile sets `Content-Security-Policy` on every answer of the app host that is not under `/api/*` or `/ws` (the classes (2) to (6) of TOKI-084 R16 and the 404s of them), in the one header block that TOKI-084 R20 reserved. The value is the policy of the table "Content-Security-Policy" below, with `{$APP_DOMAIN}` and `{$STORAGE_DOMAIN}` taken from the environment of Caddy. It holds no `unsafe-inline`, no `unsafe-eval`, no `*` and no `http:`; `default-src` is `'none'`. The answers of the API are not given the header, so the `sandbox` policy that the thumbnail route sets for itself (TOKI-060 R8) is never replaced. Check: `tools/security/csp.test.mjs` reads the value from the Caddyfile, parses it into directives (a name and a list of sources) and fails when a directive of the table is missing or differs, when a forbidden source is present, or when a directive not in the table is present; a negative control feeds it a value with `'unsafe-inline'` in `script-src` and expects the failure. The browser proof is R5.
- R4. Two more headers on the app host, on the same answers as R3: `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()` (the browser features Toki never uses) and `Cross-Origin-Opener-Policy: same-origin`. The storage host gets neither. Check: the same Caddyfile parse as R3; R5 reads both headers on `/`.
- R5. The policy in a real browser. `tools/stack/browser/security.mjs` (Playwright library, Chromium, run by `tools/stack/check.sh` of TOKI-084 after its own checks, one added line there) opens the production stack of TOKI-084 and signs in with the one-time link that TOKI-084 R25 prints. It then visits the screens of the web app (the first screen, the open conversation, Preferences, the Admin page, the people list, the search palette), sends a message, picks a small PNG and sends it (the XHR to the storage host, the thumbnail from `/api/v1/files/<id>/thumbnail`, the download link) and keeps the WebSocket open. During the whole run a listener records each `securitypolicyviolation` event and each console message that names the policy. Pass means none, and that the headers of R3 and R4 are on `/` as served, not as written. Negative control: the same run with the `Content-Security-Policy` of the document answer rewritten by `page.route` to drop the storage host from `connect-src` must record a violation on the upload, so the listener is shown to see one. The by-hand run in Firefox and Safari (concern 4) is recorded in the pull request.
- R7. The default `Cache-Control` of the API. An `onSend` hook of the `/api/v1` scope sets `Cache-Control: no-store` on every answer that has no `Cache-Control` of its own, errors and `404` included. Routes that set their own keep it: `private, no-store` of the download redirect (TOKI-058 R12), the validators of the thumbnail (TOKI-060 R8), `no-store` of `/bootstrap`. Reason: today only `/bootstrap` sets one (`apps/server/src/bootstrap/routes.ts`), so the answer of any other route is left to the browser's own rules. Check: a `GET`, a `POST`, a 401 and a 404 under `/api/v1` carry `no-store`; the three routes named keep their own value.

### Cookies and cross-site requests
- R6. The cookie in a real browser. In the same run as R5, after the sign-in, `context.cookies()` holds exactly one cookie of the app host, named `__Host-toki_session`, with `httpOnly`, `secure`, `sameSite` `Lax`, path `/`, no `domain` attribute (a host-only cookie) and an expiry about 30 days ahead (TOKI-022 R21); `document.cookie` does not show it; the request that uploads to the storage host carries no `Cookie` header (`request.allHeaders()`); after sign-out the cookie is gone and the next `GET /api/v1/auth/session` answers 401. Check: the run; a negative control that adds a cookie with `domain` set through `context.addCookies` and expects the check to name it.
- R16. Cross-site requests, for every route. `apps/server/tests/security/csrf.db.test.ts` (the database project, TOKI-008) takes the route table of TOKI-088 R2 and, for every route whose method is not `GET`, `HEAD` or `OPTIONS` (the public routes included), sends the valid request of its entry in the registry of TOKI-088 R1 (`request(world, target)`) with the header `Origin: https://other.test`: the answer is 403 `origin_not_allowed` and the watch set of TOKI-088 R15 is unchanged; then with a valid `Origin` and `Content-Type: text/plain` on a route that has a body: 415 `unsupported_media_type` and the watch set unchanged. No answer of any route carries an `Access-Control-` header. Check: the test itself, with a control per case (the same request with the app's own origin and JSON succeeds or is refused for its own reason); a route that is not in the registry fails TOKI-088 R3 first.
- R17. No `GET` changes anything. `apps/server/tests/security/get-safe.db.test.ts` sends the valid request of each `GET` entry of the registry (and `GET /ws` without an upgrade) as its control person and compares the watch set of TOKI-088 R15, plus the columns of `users` and `sessions` other than `last_used_at` (the only write a request makes by design, TOKI-022 R25), before and after. All equal. Check: the test, and a negative control that registers a `GET` route which inserts a row and expects the test to fail on it.

### Rate limits and sizes
- R8. One limiter. `apps/server/src/modules/auth/limiter.ts` exports `createLimiter(clock, { max, windowSeconds, maxKeys })`, the one function that every limit of this spec and of TOKI-022 R56 and TOKI-026 R49 uses; `createAddressLimiter` becomes a call of it with `CODE_IP_REQUESTS_MAX`, `CODE_REQUESTS_WINDOW_SECONDS` and `LIMITER_MAX_KEYS`, and every existing test of R56 and R49 passes unchanged. `hit(key)` has the behaviour of R56: a request that reaches it is counted, a request it refuses leaves no entry, and the answer is `null` or the whole seconds to wait, at least 1. The map holds at most `maxKeys` keys (`LIMITER_MAX_KEYS`, 50,000): when a new key would pass it, expired keys are removed first and, if the map is still full, the key with the oldest last hit is removed, so a client that changes address cannot grow the memory of the server. Check: tests with the controllable clock of TOKI-008, no real timer: the Nth and the N+1th hit; the wait; a refused hit leaves no entry; the window slides; 50,001 distinct keys leave 50,000 and the one removed is the oldest.
- R9. The address that is counted. The key of every limit by network address is the address of `request.ip` reduced by `limitAddress(ip)`, which is in `packages/shared`: an IPv4 address is kept; an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) becomes the IPv4 address; any other IPv6 address becomes its first 64 bits written as four groups of lower-case hexadecimal, so all addresses of one `/64` count as one. Reason: one subscriber is given a whole `/64`, so a limit by full address is passed by changing the last 64 bits. TOKI-022 R56 and TOKI-026 R49 use this key; nothing else of them changes. Check: a table test (IPv4; mapped; two IPv6 addresses of one `/64` equal; two of different `/64` different; compressed and expanded forms of one address equal; upper case) and a limiter test where the 21st request from a second address of the same `/64` is refused.
- R10. The Join routes. `POST /api/v1/invitations/lookup`, `POST /api/v1/invitations/codes` and `POST /api/v1/invitations/sessions` (TOKI-097 R1, R6, R10) join the set of routes that the address limit counts, each with a counter of its own, checked first and counted as TOKI-022 R56 says. `codes` and `sessions` accept 20 requests in 15 minutes from one address (`CODE_IP_REQUESTS_MAX`); `lookup`, which sends no mail and writes nothing, accepts 60 (`JOIN_LOOKUP_IP_REQUESTS_MAX`, a starting value, concern 3) because several people invited on the same day may open their links from one office. The set is a table `LIMITED_ROUTES` of `route -> { max, windowSeconds }` in `modules/auth/`, replacing the `Set` of `register.ts`. Check: for each route the Nth request is answered by the route's own rule and the N+1th is 429 `rate_limited` with `details.retryAfterSeconds` and `Retry-After`, a valid token in the refused request is not used, the counters of the three routes are separate from each other and from the sign-in routes, and after 15 minutes of the test clock the same address is accepted.
- R11. Failed sign-in checks, by address. A request to a route that needs a session whose session check fails (401 `unauthenticated`, `session_ended` or `account_deactivated`), and a handshake of `GET /ws` whose check fails (the upgrade completes and the connection is closed with 4401, TOKI-038 R3), is counted for its address. When an address has `FAILED_AUTH_MAX` (60, concern 3) failures in the last `FAILED_AUTH_WINDOW_SECONDS` (60), the next such request is refused with 429 `rate_limited` before the session is read from the database (a handshake is refused with the HTTP status 429 before the upgrade), and the refused request is not counted. Reason: today each request with an unknown cookie costs one database read at no price to the sender. A request that passes the check is never counted. Check: 60 requests with an unknown cookie from one address are answered 401, the 61st is 429 and the fake database records no session read for it; a second address is not limited; a valid session from the limited address is also refused for that minute (accepted: an address that sends 60 failures a minute is not a person using Toki, concern 3); after 60 seconds of the test clock the address is accepted; a handshake closed with 4401 counts in the same counter, and the 61st handshake is answered 429 with no upgrade.
- R12. Signed-in people, by class. After the session check, every request to a route that needs a session is counted for the account (`request.account.id`, not the address, because many people share an office address) in the class of its route, and when the class is full the request is refused with 429 `rate_limited`. The classes and their starting values (concern 3) are in the table "Limits by class" below and in `packages/shared/src/limits/classes.ts`. The class of a route is `write` for a method other than `GET` and `HEAD`, `read` for those two, and the route may name another in its definition with `config: { limitClass: "heavy" }`; no route may switch its limit off, and `/healthz` and `GET /ws` are outside the classes (the first needs no session; the second has the limits of TOKI-038 R19, R24, R25 and `MAX_CONNECTIONS_PER_PERSON`). Check: with the test clock, the Nth request of each class passes and the N+1th is 429; a request of another person is not affected; a `write` does not use up the `read` counter; after the window the same person is accepted; a refused request is not counted.
- R13. Every route has a class, and the overrides are a visible list. `apps/server/tests/security/limit-classes.test.ts` takes the route table of TOKI-088 R2, resolves the class of each route as R12 does, and fails when a route resolves to nothing, when a route names a class that does not exist, or when the set of routes that name a class themselves differs from the list written in the test (`heavy`: `GET /api/v1/bootstrap`, `GET /api/v1/search`, `GET /api/v1/conversations/:id/search`, `GET /api/v1/shared-items`; the list is closed, so a ticket that adds a `heavy` route edits it in its own change). Check: the test, with a fixture route that names an unknown class and one that adds an override, each failing.
- R14. The size of a body. `buildApp` passes `bodyLimit: BODY_LIMIT_BYTES` (262,144) to Fastify. A request body above it is refused with 413 `payload_too_large` before the route runs, and writes nothing. Reason: the largest legitimate body is a message of 10,000 code points (TOKI-037 R4), which is 120,000 bytes at most even when every code point is written as a pair of `\u` escapes (12 bytes each); the other bodies are smaller (an invitation batch is 50 addresses of at most 254 characters, D-134). Fastify's own default is 1 MiB and was never set. Check: a message of 10,000 code points that are all written as `😀` (120,000 bytes) is accepted; a body of 262,145 bytes is 413 `payload_too_large`, in the error format of TOKI-004, with no row written and no log line holding the body.
- R15. The answer of a limit. Every limit of this spec answers as TOKI-022 R42 and R56 do: status 429, code `rate_limited`, `details.retryAfterSeconds` (whole seconds, at least 1) and the header `Retry-After` with the same number, and the body of TOKI-004. A refusal writes one log line at `warn` with the fields `limit` (the class or route key), `route` (the matched url, not the path) and nothing else: no address, no account id, no query string. Check: the answer and the captured log of one refusal for each of R10, R11 and R12 searched for the address, the account id and a marker in the query string.
- R18. The address behind the proxy. `tools/stack/security-check.sh` (called from `tools/stack/check.sh` next to R5) sends 21 requests to `POST /api/v1/auth/codes` through Caddy with the header `X-Forwarded-For: 203.0.113.9` and a different forged value on each, then reads that the 21st is 429: the forged header changed nothing, because Caddy gives the server the real address and the server trusts only Caddy (`TRUSTED_PROXY`, TOKI-084 R12). It then sends the same 21 requests with a second source address if the host has one, or states in its output that it could not. Negative control: the check runs the same requests against the server container started with `TRUSTED_PROXY` unset in a throwaway override and expects a failure of the first part (every request seems to come from Caddy, so the count of one person is shared by everyone: the check must see that). Reason: a wrong value makes every person share one counter and locks everybody out after 20 requests; no test has so far proved the value Compose sets.

### Dependencies
- R19. Exact versions. `tools/security/pinned.test.mjs` reads every `package.json` of the workspace (root, `apps/*`, `packages/*`) and fails on a version in `dependencies`, `devDependencies`, `optionalDependencies` or `pnpm.overrides` that is a range (`^`, `~`, `>`, `<`, `*`, `x`, `latest`, a tag) or a git or URL source; an `npm:` alias is read at its own version; `workspace:*` is allowed. Check: a fixture with each of the faults; the real files pass today.
- R20. The advisory check. A new workflow `.github/workflows/audit.yml` runs `pnpm audit --audit-level high` (without `--prod`: the web app's packages are developer dependencies of `apps/web` and are bundled into what the browser runs, TOKI-084 R1) on every pull request that changes `pnpm-lock.yaml` or a `package.json`, on every push to `main`, by hand, and every Monday at 06:00 UTC. It fails on a finding of `high` or `critical`; `low` and `moderate` are printed and do not fail. `permissions: contents: read`, no secret. An advisory that is accepted (no fix, or not reachable) is listed in the one place pnpm reads ignored advisories, and `tools/security/audit-ignore.test.mjs` fails when an ignored advisory id has no row `accepted` in `docs/security/review.md` that names it. Reason: the lock file changes only by a ticket, but advisories appear without one, so a weekly run is the only way a quiet month is seen. Check: `tools/security/audit-workflow.test.mjs` parses the workflow and fails when the triggers, the command, the missing `--prod`, the permissions or the weekly schedule differ; the ignore test with a fixture id; the first real run is recorded in the pull request and its findings are in the record (R1). A failed scheduled run is the signal: it is read in the Actions tab, and nothing else sends a message (one operator).
- R21. Install scripts. `allowBuilds` in `pnpm-workspace.yaml` is the list of packages allowed to run an install script. The review lists, for each package of the lock file that declares a lifecycle script, whether it is allowed (the row D3 of the record). `tools/security/builds.test.mjs` fails when `allowBuilds` holds a package set to `true` that has no row in the record naming it, so a package cannot gain the right to run code at install without a line saying why. Check: a fixture; the real file passes (today the only entry is `esbuild: false`).
- R22. Workflow actions are pinned to a commit. Every `uses:` of a file under `.github/workflows/` that names a repository action (not a local path) ends in `@` and a 40-character commit hash followed by a comment with the version tag (`actions/checkout@<hash> # v4`). `.github/scripts/actions-pinned.sh` prints a line for each that is not and exits 1; its test `.github/scripts/actions-pinned.test.sh` has a pinned and an unpinned fixture; the script runs in the `lint` job of `ci.yml`. The existing `ci.yml`, `pr-review.yml` and `spec-ticket.yml` are changed to pass it, with the hashes read from the tags at build time (`gh api repos/<owner>/<repo>/git/ref/tags/<tag>`, an annotated tag resolved to its commit). Reason: today `@v4` and `@v1` follow a tag that its owner can move, and `pr-review.yml` passes `CLAUDE_CODE_OAUTH_TOKEN` to an action. Check: the script test; the lint job.

## Design
### The checklist (Table C)
Each item is read at the code on `main` when the review runs, and the row says what was read. The sources are the specs and files that give the rule; the review checks the code against them.

| Id | Area | Item | Source |
| :-- | :-- | :-- | :-- |
| H1 | Headers | The headers of the app host on each class of answer: HSTS, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, no `Server` | TOKI-084 R16, R20; `infra/Caddyfile` |
| H2 | Headers | The Content-Security-Policy against the code of the web app (R3, R5) | `apps/web/index.html`, `apps/web/src`, `packages/platform/src/web` |
| H3 | Headers | `Permissions-Policy` and `Cross-Origin-Opener-Policy` (R4) | R4 |
| H4 | Headers | The storage host: `nosniff`, `sandbox`, `attachment`, no cookie, CORS for the app's origin only | TOKI-084 R19; TOKI-058 R13 |
| H5 | Headers | `Cache-Control` of API answers (R7) | `apps/server/src/bootstrap/routes.ts`; TOKI-058 R12; TOKI-060 R8 |
| H6 | Headers | Referrer: the `<meta name="referrer" content="no-referrer">` of `apps/web/index.html` and the header of TOKI-084 R20; record which one a browser applies to the page and to a link opened in a new tab | `apps/web/index.html`; TOKI-084 R20 |
| H7 | Headers | HSTS without `includeSubDomains` and `preload` | TOKI-084 R20 and concern 7 |
| H8 | Headers | An error answer holds no stack, path, query or SQL | TOKI-004 R8, R9; `apps/server/src/errors.ts` |
| H9 | Headers | No header names the software or its version | TOKI-084 R20 |
| H10 | Headers | Slow requests: the header, read and idle timeouts that Caddy and Node really apply, read from `caddy adapt` and the server options and written down | TOKI-084 R15; `apps/server/src/app.ts` |
| H11 | Headers | Cross-origin access: the server sends no CORS header; MinIO answers the app's origin only | TOKI-022 R46; TOKI-084 R19 |
| C1 | Cookies | Attributes of the session cookie (R6) | TOKI-022 R21; `modules/auth/cookies.ts` |
| C2 | Cookies | A missing or unknown `NODE_ENV` counts as production | TOKI-022 R21; `cookies.ts` `isDevelopment` |
| C3 | Cookies | 32 random bytes, only the SHA-256 hash stored | TOKI-022 R23 |
| C4 | Cookies | Lifetime and every way a session ends: idle 30 days, sign-out, replaced, deactivated | TOKI-022 R25 to R28, R34 |
| C5 | Cookies | Cross-site requests: JSON only, the `Origin` rule, no CORS, no `GET` that writes (R16, R17) | TOKI-022 R36, R45, R46 and concern 9 |
| C6 | Cookies | The cookie never reaches the storage host (R6) | TOKI-084 R19 |
| C7 | Cookies | No session secret in a URL, a query string, a log or web storage: the keys of `localStorage` and `sessionStorage` are listed and none is a secret; the WebSocket accepts no token in the query string | `packages/platform/src/web/storage.ts`; TOKI-038 R2 and its handshake tests; TOKI-022 R37 |
| C8 | Cookies | The emergency link: the token in the fragment, removed from the address before the first request, `POST` only | TOKI-026 R34, R42; TOKI-022 concern 9 |
| C9 | Cookies | A secret is accepted only the way its session was made (cookie or bearer) | TOKI-022 R44 |
| C10 | Cookies | The address behind the proxy (R18) | TOKI-022 R56; TOKI-084 R12 |
| L1 | Limits | The inventory of limits in Table B, each number compared with its constant in the code | Table B |
| L2 | Limits | Public routes: `auth/codes`, `auth/sessions`, `auth/workspace`, `auth/emergency-sessions`, the three Join routes; which is limited and why the others need no limit | TOKI-022 R24, R56; TOKI-026 R49; TOKI-097 R23; R10 |
| L3 | Limits | Requests from a signed-in person (R12) | R12 |
| L4 | Limits | The address key and IPv6 (R9) | R9 |
| L5 | Limits | The guessing budget of the sign-in code (concern 1) | TOKI-022 concern 3 |
| L6 | Limits | Mail sent for one request: one mail per accepted code request, at most 5 per address in 15 minutes and 20 requests per source address; an invitation batch of 50 | TOKI-022 R2, R4, R56; D-134 |
| L7 | Limits | Link-preview fetches by one sender and to one host; jobs added by one message | TOKI-061 R10; TOKI-064 R11 |
| L8 | Limits | Push sends caused by one person's messages are bounded by R12 and by one job per person and message | TOKI-074 R12, R13; R12 |
| L9 | Limits | The WebSocket: connections per person, buffer, frame size and rate, heartbeat | TOKI-038 R19, R24, R25; `MAX_CONNECTIONS_PER_PERSON` |
| L10 | Limits | Files: size, unsent files per person, files per message, upload ticket lifetime; what one member can fill (F9) | TOKI-058 R3, R7, R9; NFR-15 |
| L11 | Limits | The size of a body (R14) | R14 |
| L12 | Limits | The cost of one search request: query length and page size | TOKI-070 |
| S1 | Outbound | The guard of link previews: scheme, user name, port, name list, IP ranges, resolve once and connect to what was checked, every redirect checked, size and time caps, no cookie or `Authorization`. The test table of TOKI-061 (Table A) is run against the built code and each row is read; a case the table lacks is added to it by this ticket | TOKI-061 R4 to R9 |
| S2 | Outbound | The push endpoint list: `https`, port 443, host equal to or under the four push services, no `%` or `@`, checked at registration and before each send | TOKI-074 R7 |
| S3 | Outbound | The private VAPID key is read only by the worker and appears in no log, answer, image layer or `docker inspect` of the server container | TOKI-074 R1, R11; TOKI-084 R11 |
| S4 | Files | The upload ticket fixes size, key, type and disposition as a rule of storage | TOKI-058 R7 |
| S5 | Files | A file never runs in the browser: stored type and disposition, signed address, `nosniff`, `sandbox`, another origin, no `src` of an original; the thumbnail has a fixed type | TOKI-058 R13; TOKI-062 R15; TOKI-060 R8; TOKI-084 R19 |
| S6 | Files | Message text is never rendered as raw HTML: no `dangerouslySetInnerHTML` outside the icon base, which deletes it; links open only as `http` or `https` | `packages/ui-web/src/icons/icon-base.tsx`; TOKI-049; technical design |
| S7 | Files | The storage account is MinIO's root account | TOKI-084 concern 5 |
| D1 | Dependencies | Exact versions in every `package.json` (R19) | R19 |
| D2 | Dependencies | Known advisories, all packages (R20) | R20 |
| D3 | Dependencies | Install scripts (R21) | R21; `pnpm-workspace.yaml` |
| D4 | Dependencies | The production image holds the production dependencies of `apps/server` only and no developer tool | TOKI-084 R6 |
| D5 | Dependencies | The direct dependencies of `apps/server` and `apps/web`, each with its purpose and the ticket that added it; one that no code imports is removed | `package.json` files |
| D6 | Dependencies | Workflow actions (R22), their `permissions`, and the secrets each workflow reads | `.github/workflows/*.yml`; `CLAUDE.md` ("Review on request") |
| D7 | Dependencies | The base images: their tags and release dates are written down; they follow a tag and are rebuilt with each deploy (concern 7) | TOKI-084 concern 3 |
| D8 | Dependencies | `pnpm install --frozen-lockfile` in CI and in the image | TOKI-084 R1; `ci.yml` |
| A1 | Records | Each administrative action writes one record of who, what, to whom and when (read; the tests belong to the owner) | NFR-16; TOKI-024 R31 |

### Known findings (Table D)
Found while writing this spec, by reading the code on `main` and the specs. The disposition is what this spec decides; the review confirms or changes it when it reads the built code.

| Id | Finding | Evidence | Result |
| :-- | :-- | :-- | :-- |
| F1 | The three Join routes are public and have no limit by address | `LIMITED` of `modules/auth/register.ts` holds `auth/codes`, `auth/sessions` and `auth/emergency-sessions` only | `fixed` by R10 |
| F2 | No limit on any route that needs a session: a signed-in person can send requests without a ceiling | no hook reads the account for a count | `fixed` by R12, R13 |
| F3 | The guessing budget of the sign-in code is 25 guesses per address per 15 minutes: about 0.24% a day for one address, about 38% a day for all 200 addresses if the sender has about 250 network addresses | TOKI-022 concern 3 (arithmetic there; the 250 is 480,000 guesses a day divided by the 1,920 requests a day that one address may make) | `open`, concern 1 |
| F4 | Workflow actions follow tags (`@v4`, `@v1`) | `.github/workflows/ci.yml`, `pr-review.yml` | `fixed` by R22 |
| F5 | The address limit counts a full IPv6 address, so a client with a `/64` passes it | `createAddressLimiter` keys on `request.ip` | `fixed` by R9 |
| F6 | Only `/bootstrap` sets `Cache-Control`; every other API answer is left to the browser's own rules | `bootstrap/routes.ts` is the only `cache-control` in `apps/server/src` | `fixed` by R7 |
| F7 | No spec gives the screens of sign-in and Join a text for `rate_limited` (only the emergency page has one) | `sign-in-screens` and `accept-invitation` specs name `code_request_limit` and `code_resend_too_soon` only | `open`, concern 2 |
| F8 | The body limit was never set: Fastify's default of 1 MiB applies | `buildApp` passes no `bodyLimit` | `fixed` by R14 |
| F9 | A member can fill the disk with sent files: there is no quota, and the uploads stop only at 95% | NFR-15; D-186 | `accepted` by NFR-15 (the disk warning at 80% and the refusal at 95% are the control, TOKI-103) |

### Content-Security-Policy
Each directive is there because of something the code does; a source that nothing needs is not listed.

| Directive | Value | Reason (what in the code needs it) |
| :-- | :-- | :-- |
| `default-src` | `'none'` | Nothing is allowed that is not named below. |
| `script-src` | `'self'` | One module script, `/src/main.tsx` built to `/assets/*.js`; no inline script (the built `index.html` is checked, R5 and `dist-csp.test.mjs`). |
| `style-src` | `'self'` | The CSS is built into files. React sets `style` through the CSSOM (`Avatar.tsx`, `ToastRegion.tsx`, `BrowseRow.tsx`), which a policy without `'unsafe-inline'` allows; R5 proves it. |
| `img-src` | `'self' data:` | The thumbnail is read from `/api/v1/files/<id>/thumbnail` on the app host (TOKI-060 R8); `data:` is the `<link rel="icon" href="data:,">` of `index.html`. No original is ever a `src` (TOKI-062 R15). |
| `font-src` | `'self'` | `/assets/fonts/*.woff2` (TOKI-010). |
| `connect-src` | `'self' https://{$STORAGE_DOMAIN} wss://{$APP_DOMAIN}` | The API; the upload to the storage host by `XMLHttpRequest` (TOKI-059 R3); the WebSocket, named so that it does not depend on how a browser reads `'self'` for `wss:`. |
| `worker-src` | `'self'` | `/push-sw.js` (TOKI-074 R19). |
| `manifest-src` | `'self'` | `/manifest.webmanifest` (TOKI-077 R1). |
| `form-action` | `'self'` | No form posts anywhere else. |
| `frame-src` | `'none'` | The app embeds nothing. |
| `frame-ancestors` | `'none'` | Nothing may embed the app (the modern form of `X-Frame-Options: DENY`). |
| `object-src` | `'none'` | No plug-in. |
| `base-uri` | `'none'` | No `<base>` is used. |

The value is one line in the Caddyfile. There is no `report-uri` or `report-to`: a route that takes reports from anyone would be a new public route to limit and store (concern 4); the violations are seen in the browser's console and by R5. The link previews (TOKI-061) load no image, so no remote `img-src` is needed.

### Limits by class (R12)
Starting values; the key is the account.

| Class | Routes | Starting value | Reason |
| :-- | :-- | :-- | :-- |
| `write` | every method except `GET` and `HEAD` | 300 per 60 seconds | A person who types sends a draft save a second after the last change (TOKI-051 concern 5, about 60 a minute) and a message every few seconds; 300 is about 4 a second. |
| `read` | `GET` and `HEAD` | 600 per 60 seconds | Opening a conversation, paging and a refresh after a reconnect are a few requests each. |
| `heavy` | the four routes of R13 | 60 per 60 seconds | The widest queries; the palette debounces and drops stale answers (TOKI-071 R13). |
| public, by address | `auth/codes`, `auth/sessions`, `auth/emergency-sessions`, Join `codes` and `sessions` | 20 per 15 minutes | Decided (TOKI-022 R56, concern 3). |
| public, by address | Join `lookup` | 60 per 15 minutes | R10. |
| failed checks, by address | every route that needs a session, and `GET /ws` | 60 per 60 seconds | R11. |

### Limits that already exist (Table B)
Read by L1 against the constants in the code; this table is what the review confirms.

| Limit | Value | Source |
| :-- | :-- | :-- |
| Code requests per address | 5 in 15 minutes, 60 s between two | D-038, D-082; TOKI-022 R4, R5 |
| Wrong tries per code | 5 | D-137; TOKI-022 R12, R13 |
| Public routes, by network address | 20 in 15 minutes (three routes) | TOKI-022 R56; TOKI-026 R49 |
| Link previews | 5 fetches per sender and 10 per host per minute; 3 redirects; 8 s; 524,288 bytes | TOKI-061 R8, R10 |
| WebSocket | 20 connections per person; 1 MiB buffered; 4,096-byte frames; 50 frames in 10 s | TOKI-038 R19, R25 |
| Files | 100 MB; 20 unsent per person; 10 per message; ticket 15 minutes | TOKI-058 R3, R9; D-014, D-042 |
| Invitation batch | 50 addresses | D-134 |
| Typing and presence frames | one in 3 s per conversation; one in 30 s | TOKI-044 R8; TOKI-055 R7 |

### Layout
```
docs/security/review.md                     R1
tools/security/                             R2, R3, R19, R20, R21 (the *.test.mjs files; dist-csp.test.mjs reads apps/web/dist)
tools/stack/browser/security.mjs            R5, R6
tools/stack/security-check.sh               R18   (both called by one added line of tools/stack/check.sh)
infra/Caddyfile                             R3, R4 (the header block of TOKI-084 R20)
apps/server/src/app.ts                      R7, R14
apps/server/src/modules/auth/limiter.ts     R8
apps/server/src/modules/auth/request-limits.ts   R11, R12, R15 (called by the hook of register.ts, after the session check)
apps/server/src/modules/auth/register.ts    LIMITED_ROUTES (R10), the order of the hook
apps/server/tests/security/                 R13, R16, R17
packages/shared/src/limits/                 limitAddress (R9), classes (R12), constants
.github/workflows/audit.yml                 R20
.github/scripts/actions-pinned.sh           R22
pnpm-workspace.yaml                         allowBuilds (R21)
```
The order of the one `onRequest` hook (TOKI-022 R44, R56) becomes: the address limit of `LIMITED_ROUTES`; the failed-check count of R11; the `Origin` rule; the JSON rule; the session check; the class limit of R12. A failed session check adds one to the counter of R11. The limits are in memory, so a restart empties them, as for TOKI-022 R56 (concern 6).

### Where the findings go (concern 9)
`docs/security/review.md` in the repository. A finding that this work fixes is `fixed` and points to the requirement and the test; a finding that needs a decision is `open` and points to a concern of this spec; a finding for work that this ticket does not own is `open` with the number of a repository issue that the builder opens (labelled as the tracker's pipeline labels allow) and the name of the owning ticket. No finding is kept only in a pull request comment or a chat.

### Errors
- A limit is full -> 429 `rate_limited` with `Retry-After` (R15). The client treats any failed request by the rule of its own screen; the text for sign-in and Join is concern 2.
- A body above 256 KiB -> 413 `payload_too_large` (R14).
- A policy violation in the browser -> the console of the browser; there is no report route.

## Testing
- Tests first, fake data only, the controllable clock of TOKI-008 for every window and no real timer.
- Unit and server tests (`pnpm test`): R8, R9, R10, R11, R12, R13, R14, R15, R7 in the unit and database projects; R16 and R17 in the database project, reusing the route table, the registry, the world and the watch set of TOKI-088 (if the pull request of that work is not merged first, the builder of whichever comes second adds the files it names and says so in the pull request; nothing is duplicated).
- Tool tests (`node --test`, in `pnpm test`): R2, R3, R4, R19, R20 (workflow shape and ignore list), R21, and a test that reads the built `apps/web/dist/index.html` and the built CSS and fails on an inline `<script>` with no `src`, an inline event attribute, a `style` attribute, or a remote address in `url()` or `@import`, which is what makes `script-src 'self'` and `style-src 'self'` true (R3). Negative controls are in each.
- `bash .github/scripts/actions-pinned.test.sh` (R22).
- The stack run of TOKI-084 (`pnpm stack:check`, one job in CI) gains R5, R6 and R18: they need Docker, a browser and the real Caddy. The negative controls of R5, R6 and R18 are part of the run.
- By hand, once, recorded in the pull request: the policy in Firefox and Safari (R5), the effective timeouts of H10, and the effect of the Referrer rows (H6).
- The load run of TOKI-089 (200 people) must show no answer 429 other than the ones it provokes; this is a hand-off, not a test of this ticket (Plan changes).
- Not proved here: a real attacker (the limits are proved with the test clock), the browsers other than Chromium in CI, certificates from a real authority (TOKI-084).

## Data safety
- The record of findings names routes, files and requirements; it holds no secret, no address of a person and no real advisory token. A finding that depends on a secret says "the private VAPID key" and never its value.
- The log lines of a refusal hold no address, no account id and no query string (R15). Reason: an address and an id identify a person; the route and the class say what happened.
- No report endpoint is added, so no new unauthenticated route stores a browser's text.
- The workflow that audits has no secret and read-only permission (R20).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Milestone M6, size M; needs TOKI-084 | Planning fact. It extends the Caddyfile and the stack check of TOKI-084 (R3, R4, R5, R6, R18). Plan changes. |
| The scope is headers, cookies, rate limits and dependencies | R3 to R7 (headers), R6, R16, R17 (cookies), R8 to R15, R18 (limits), R19 to R22 (dependencies); the checklist covers the outbound and file items the hand-offs name (S1 to S7). |
| Public internet, one VPS, about 200 people; no new service | No new service or port. The limiter is in memory and bounded (R8); the starting values leave room for 200 people (Limits by class, R12). |
| Files never run in the browser; no scan; no quota | S4, S5 are reviewed; R3 keeps the thumbnail's own policy; F9 is accepted by NFR-15; no scan (Out). |
| Link previews refuse internal addresses; text never raw HTML; code limits; no membership leak | S1, S6 reviewed (S1 with the test table of TOKI-061); the code limits are in Table B and L5, L6; the limits of R10 and R11 give the same answer for every address (TOKI-022 R9 is unchanged). |
| The decided limits stay | R8 keeps them through the same constants; every existing test of R56 and R49 passes unchanged. |
| CSP, limits, cookies, dependency review belong here | R3 to R22. |
| Authorization is TOKI-088 | Scope (Out), concern 5; R16 and R17 reuse its files and add no authorization case. |
| Exact versions at least two weeks old | R19 (exact); the age rule is checked by hand at the review (D5) and kept by each ticket that adds a package (TOKI-064 R1). |
| Every text through i18n | This work adds no screen and no text (concern 2 is open for the one that is missing). |
| No backup in phase 1 | Out. |

## Open questions from the intent
- What is the Content-Security-Policy, given what the web app does? Answered: the table "Content-Security-Policy", enforced, with no report route (R3, R5; concern 4).
- Which routes need a rate limit, and at what numbers? Answered: the three Join routes, failed checks by address, and signed-in people by class (R10 to R12), at starting values that are technical choices (concern 3); the numbers of the sign-in routes stay as decided.
- Does the guessing budget of the 6-digit code need a further limit? Not answered. Carried forward as concern 1.
- Is the cookie and cross-site choice of TOKI-022 enough, and how is "no `GET` changes anything" kept true? Answered: it is kept; `SameSite=Lax` stays (concern 8), and two tests run for every route, present and future (R16, R17).
- Where are findings recorded, and what is the line with the access-control tests? Answered: `docs/security/review.md` (concern 9); authorization is TOKI-088, abuse, headers, cookies and dependencies are this work (concern 5).
- What does a person see when a limit refuses them? Not answered. Carried forward as concern 2.

## Areas of concern
1. The guessing budget of the sign-in code. The log decides a 6-digit code, 5 wrong tries per code, 5 code requests per address in 15 minutes and 20 requests per network address on each sign-in route (D-011, D-038, D-137; TOKI-022 R56). Together they allow 25 guesses per address in 15 minutes, 2,400 a day, which is about 0.24% a day for one address and about 38% a day for all 200 addresses of a workspace, if the sender has about 250 network addresses and knows the addresses of the members (TOKI-022 concern 3). TOKI-022 left "a cap on wrong tries across the codes of one address" and "a ceiling for the whole server" to this review. Not decided. The options, with their effect (a proposal, not a decision): (a) keep as it is; (b) count wrong tries per address across all its codes and, from `ADDRESS_WRONG_TRIES_MAX` in 15 minutes, answer `code_locked` for that address until the oldest counted try is 15 minutes old; with 10 the budget is 960 guesses a day (about 0.096% a day for one address, about 17% a day for 200), with 5 it is 480 (about 9%); the cost is that a sender who knows an address can block that member's sign-in for as long as they keep guessing, which they can already do by requesting codes (TOKI-022 concern 3 (b)); a member's own typing mistakes also count; (c) a ceiling on wrong tries for the whole server per hour that writes a log line at `error` for the operator to read, and refuses nothing; (d) (b) and (c) together. The arithmetic is TOKI-022's; a number for (b) and (c) is for the owner. Owner: Thanh Truong.
2. What a person sees when a limit refuses them. Sign-in and Join can now answer 429 `rate_limited` (TOKI-022 R56 already could, TOKI-097 now too through R10), and a signed-in person can meet it (R12). The sign-in and Join screens give a text for `code_request_limit` and `code_resend_too_soon` only; the emergency page has one (`emergency.rateLimited`, TOKI-026), and the other screens treat a failed request by their own rules. D-139 says a wording that the prototype does not contain is a proposal. Not decided. Proposal, not a decision: the sign-in and Join pages reuse the wording of `emergency.rateLimited` ("Too many attempts from this network. Try again in {minutes} minutes."), made by the screens' owners (TOKI-023, TOKI-097) with `details.retryAfterSeconds`; a signed-in request refused by R12 shows the failure state its screen already has, with no new text. This work adds no screen and no text. Owner: Thanh Truong.
3. The starting numbers of the limits by class and the failed-check count. Decided in this spec: the mechanism (R10 to R12) and the starting values of the table "Limits by class" (300, 600 and 60 a minute per person; 60 a minute of failed checks and 60 per 15 minutes for the Join `lookup` per address). No decision of the log gives them; each is one constant in `packages/shared/src/limits/`, with its reason in the table, chosen above what the client does at its busiest (a draft save a second, a few requests per opened conversation) and below what would let one account load the server. TOKI-089's measure with 200 people sets the final numbers by reading its count of 429 answers; a number changes in one line and no test changes except the constant it reads. Reason for deciding here: a limit that waits for a product figure would leave the routes with none. The cost named: behind one office address, 60 failed checks a minute is not reached by normal use (a failed check is a session that has ended, which sends the person to sign in once). Owner: Thanh Truong.
4. The Content-Security-Policy is enforced, not reported. Decided in this spec: the policy of the table is sent as `Content-Security-Policy` from the first release, with no `report-uri`, after the run of R5 in Chromium and the by-hand run in Firefox and Safari. Reason: a report-only phase needs a place that receives reports, which is a public route that stores text from anyone, and the policy comes from what the code does (each directive has its reason), not from a guess; a mistake is seen at once in the console and by R5. `wss://{$APP_DOMAIN}` is named in `connect-src` even though `'self'` covers it in current browsers, so a browser that reads `'self'` for `wss:` the old way can open the WebSocket too. Owner: Thanh Truong.
5. The line with TOKI-088. Decided in this spec: TOKI-088 owns authorization: who may do an action, the refusals (401, 403, 404 with the same body for every outsider) and the canaries. This ticket owns abuse and exposure: how often (limits), how much (body size), which headers, which cookie, which outbound requests, and which packages. The two meet in two places, both stated here: R16 and R17 run over every route using the registry and the route table of TOKI-088, and add no authorization case; a route that is public is justified in TOKI-088 (its `reason`) and limited here (R10, table L2). A finding in one's area that belongs to the other goes into `docs/security/review.md` as `open` with the owner named. Owner: Thanh Truong.
6. The limits count in the memory of one process. Decided in this spec: the counters live in the server process and are emptied by a restart, as TOKI-022 R56 already accepts, because the server is one copy (NFR-04, TOKI-084 concern 12), the worker has no HTTP routes, and a table or Redis for counters would add a write to every request. The known cost: a deploy or a crash gives every address a fresh count, so an attacker who can make the server restart gains nothing the attacker does not already have by waiting. If a second copy of the server ever runs, the limiter is the one place to change (R8). Owner: Thanh Truong.
7. Images and base-image packages. Decided in this spec: no scan of the operating-system packages of the images and no licence review in this phase; the review records the base image tags and their release dates (D7) and the images follow the tag and are rebuilt with each deploy. Reason: the log asks for no scan, one operator would receive a second advisory source with no one on call, and the advisory check of R20 covers the packages that Toki itself chooses. A scan that fails a build is a later change to the stack job and to TOKI-085. Owner: Thanh Truong.
8. The cookie choice stays. Decided in this spec, as the result of the review of TOKI-022 concern 9: `SameSite=Lax`, `HttpOnly`, `Secure`, the `__Host-` name and a 30-day sliding life stay as built. `SameSite=Strict` would also work for the pages (the first request of a page needs no cookie, and later requests come from the page), but the `Origin` rule, the JSON-only rule and the absence of CORS already stop a cross-site request, a change would alter a merged decision for no extra protection against a request the server already refuses, and R16 proves the refusal for every route. The change that would matter is a `GET` route that writes, which R17 forbids and tests. Owner: Thanh Truong.
9. Where findings are recorded. Decided in this spec: in `docs/security/review.md`, in git, reviewed in the pull request of this ticket (R1, R2), with an issue only for work outside this ticket. Reason: a record outside the repository goes stale and cannot be checked by a test; one file shows the next reviewer what was read and when. The review is a point in time (the commit named at its top); the tests of R13, R16, R17, R19 and R20 keep the parts that can be kept true for later changes. Owner: Thanh Truong.
10. Permissions-Policy and Cross-Origin-Opener-Policy. Decided in this spec: both are set on the app host (R4), with the features Toki never uses switched off and `same-origin` for the opener. Reason: no sign-in goes through another site (TOKI-022) and a link only opens a new tab (TOKI-049); the review row H3 confirms that no code reads `window.opener`, and no screen uses the camera, microphone, location, payment or USB. The storage host gets neither because it serves downloads, not pages. If a later feature needs one of the switched-off features, it edits the one line. Owner: Thanh Truong.

## Plan changes
- Plan: `TOKI-091 needs: TOKI-084` becomes `needs: TOKI-084, TOKI-088`, because R16 and R17 use the route table, the registry, the world and the watch set of TOKI-088. The pipeline order already has 088 in the same milestone.
- TOKI-084: the header block of the Caddyfile (R20 there) gets the lines of R3 and R4 in this ticket's change; `tools/stack/check.sh` gets one line that runs `tools/stack/browser/security.mjs` and `tools/stack/security-check.sh` after its own checks; nothing else of that ticket changes.
- TOKI-022 and TOKI-026: the limiter becomes `createLimiter` and the key becomes `limitAddress(request.ip)` (R8, R9); the numbers, the counters and every answer stay; their tests pass unchanged.
- TOKI-097: its three public routes get the limits of R10; its screens need the wording of concern 2 once the owner gives it.
- TOKI-089: its run of 200 people reports the number of answers 429 (expected: none other than the ones it provokes), so the starting values of concern 3 are confirmed or changed.
- TOKI-088: nothing changes there. This ticket reads `route-table.ts`, `accessRegistry`, `world.ts` and the watch set, and adds no authorization case.
- `docs/definition-of-done.md`: no edit. A new route is held to a limit class by R13, to the cross-site rules by R16 and to R17 by a test that fails, so no line is needed.
