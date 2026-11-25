# QA record: TOKI-004
Ticket: TOKI-004
Spec: docs/specs/2026-11-12-server-skeleton-design.md
Version: 5320ebc
Environment: a temporary worktree of the Version under Node 22 (`~/.nvm`), pnpm through corepack, macOS; the real entry point started with Node on free ports with throwaway values on the command line; the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows.

Each row runs `V=5320ebc bash docs/qa/TOKI-004.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-004.evidence.txt`. `5320ebc` is the merge commit of PR #106, decided in concern 1 of the spec of this record. Rows T8, T9, T10, T12 and T16 use a small in-process harness that the script writes into the temporary worktree; it builds the app with `buildApp` as `apps/server/src/test/app.test.ts` does. No `.env` is read or created, and the script prints no value of a variable.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 1 1`: exactly one log line gives the listen address, and it is the explicit bind host and port |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 1 config.ts`: one file outside the tests reads `process.env`, and it is `config.ts` |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 3 3 1`: three cases (nothing set, whitespace-only, empty) exit 1 and name the failing variable; one run with two failing variables names both |  | P1 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 1 2 0`: an invalid value makes the process exit 1, both invalid variable names are on standard error, and no submitted value appears in anything printed |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 200 1`: `GET /healthz` returns 200 and the body `{"status":"ok"}` with Postgres unreachable |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 L L`, L at least 1: every line the logger writes to standard output parses as one JSON object (process started directly with Node) |  | P1 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 1 5 0 1`: one line holds the request id of a request; it has the five fields (method, path without the query string, status, duration, request id); `/healthz` writes no completion line at `info` and one at `debug` |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 5 5`: the five error classes return a body that passes `ErrorResponseSchema` with the expected status |  | P1 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 1 1 1 1`: the unexpected error returns 500 `internal_error` with a fixed message, no stack and no internal message in the body, `details` holds only `requestId`, and the log holds the error and its stack |  | P1 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 200 404 1`: a route registered through the API module answers under `/api/v1/`, returns 404 without the prefix, and a route outside the prefix is refused at registration |  | P1 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 0 N`, N at least 1: the `test` script of `apps/server` exits 0 with no database variable, and N tests pass |  | P1 |  |  |  |
| T12 | R12 | command | `checks T12` | `T12 2 2`: the same failing request with `Accept-Language: vi` and `en` gives the same code and message, for two error classes |  | P2 |  |  |  |
| T13 | R13 | command | `checks T13` | `T13 5 5`: the five variable names the configuration module reads are all in `.env.example` |  | P2 |  |  |  |
| T14 | R14 | command | `checks T14` | `T14 1 1 0`: the `dev` script of `apps/server` uses `--env-file=../../.env`, the root `dev` script is unchanged, nothing in `src` loads a `.env` file |  | P2 |  |  |  |
| T15 | R15 | command | `checks T15` | `T15 0 0`: SIGTERM and SIGINT each end the started process with exit code 0 |  | P1 |  |  |  |
| T16 | R16 | command | `checks T16` | `T16 1 1 1`: `buildApp({ config })` works; `logStream` captures the log; `registerRoutes` runs inside the `/api/v1` scope before the app is ready |  | P2 |  |  |  |
| T17 | R17 | command | `checks T17` | `T17 1 0`: `apps/server/src/modules/` exists and holds no module |  | P3 |  |  |  |
| T18 | R18 | command | `checks T18` | `T18 127.0.0.1 3000 *`: with only the two required variables the server listens on `127.0.0.1:3000`, and with `SERVER_HOST=0.0.0.0` it listens on every address |  | P2 |  |  |  |
| T19 | R19 | command | `checks T19` | `T19 1 0`: the database area reads `DATABASE_URL` only, and no other database connection variable is read |  | P2 |  |  |  |
| T20 | R20 | command | `checks T20` | `T20 200 1`: with Postgres unreachable at start (an unresolvable host) the server starts and `/healthz` answers |  | P1 |  |  |  |

## Not covered
- None: every requirement R1 to R20 of the spec has a row. The second half of R20 (a database call made later fails with `500 internal_error`) cannot be tested at this commit, which has no database call; row T20 covers the first half and the result notes say so.
