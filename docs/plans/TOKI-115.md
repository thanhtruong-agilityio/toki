# TOKI-115 QA of the server skeleton - implementation plan

**Goal:** TOKI-004 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-server-skeleton-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-115-server-qa`. Documents and one bash script (with one small TypeScript harness it writes into the temporary worktree); no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `5320ebc` (PR #106), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-001.*` and `TOKI-002.*`, with their lessons built in: a row that loops prints what it checked, a case list is fixed so zero cases cannot pass, each row compares the whole requirement and not a part, a wrong check is corrected and rerun with both runs kept, a changed `Expected` is approved again, a row names one requirement.

- `docs/qa/TOKI-004.checks.sh` reads files of `V` with `git show`. Rows that run the server or the tests use one temporary worktree of `V` (installed once, removed by an `EXIT` trap, every process the script starts is killed by the trap). Node 22 and `corepack pnpm` as before.
- **Live rows** start the real entry point directly with Node (`node --import tsx src/main.ts` in `apps/server`, as R6 asks: not through pnpm) on a free port, with throwaway values on the command line: `NODE_ENV=development`, a free `SERVER_PORT`, `SERVER_HOST=127.0.0.1`, `LOG_LEVEL`, and `DATABASE_URL` pointing at a made-up address where nothing listens. No `.env` is read or created. Requests use `curl`; standard output and standard error are captured to a temporary file and kept only as counts and field names.
- **In-process rows** (error classes, the 500, the prefix, `Accept-Language`, `buildApp`'s options) use a small harness `zz-harness.ts` that the script writes into the temporary worktree. It builds the app with `buildApp` like `apps/server/src/test/app.test.ts` does, registers its own test routes through `registerRoutes`, sends requests with `app.inject`, and prints one JSON line of results. It is not committed to the repository.
- **Row for R11** runs the existing `test` script of `apps/server` with no database and no network variable set.
- The case lists are fixed and printed; a wrong environment variable makes a live row print `needs a free port` or the first error line and be `Blocked`, not Pass.
- Output is counts, exit codes and words. No value of a variable, no secret.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug the script on a mutated copy first; if I run a real row to debug it, I say so.

### Rows (one per requirement)

| ID | TOKI-004 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 1 1`: lines in the server's log that give the listen address (exactly one), and that the address is the explicit bind host and port |
| T2 | R2 | `T2 1 config.ts`: files outside tests that read `process.env`, and which |
| T3 | R3 | `T3 3 3 1`: three cases (nothing set; whitespace-only; empty) exit 1 and name the failing variable; one run with two failing variables names both |
| T4 | R4 | `T4 1 2 0`: an invalid value makes the process exit 1, both invalid variable names are on standard error, and no submitted value appears in anything printed |
| T5 | R5 | `T5 200 1`: `GET /healthz` returns 200 and the body `{ "status": "ok" }`, also with Postgres unreachable |
| T6 | R6 | `T6 L L`, L at least 1: every line the logger writes to standard output parses as one JSON object, on the process started directly with Node |
| T7 | R7 | `T7 1 5 0 1`: one completion line for a request (and no other line with its id), the five fields (method, path without the query string, status, time in ms, request id), none for `/healthz` at `info`, one at `debug` |
| T8 | R8 | `T8 5 5`: the five error classes (unknown path, validation failure, known error, error raised by a plugin or Fastify, unexpected) return a body that passes the `ErrorResponseSchema` of `packages/shared` |
| T9 | R9 | `T9 1 1 1 1`: the unexpected error returns 500 `internal_error` with the fixed English message, no stack and no internal message in the body, `details` holds only `requestId`, and the log holds the error and its stack |
| T10 | R10 | `T10 200 404 1`: a route registered through the API module answers under `/api/v1/`, returns 404 without the prefix, and a route outside the prefix is refused at registration (except `/healthz`) |
| T11 | R11 | `T11 0 N`, N at least 1: the `test` script of `apps/server` exits 0 with no database and no network variable, and N tests pass |
| T12 | R12 | `T12 2 2`: the same failing request with `Accept-Language: vi` and `en` gives the same code and message, for two error classes |
| T13 | R13 | `T13 5 5`: the five variable names the configuration module reads are all in `.env.example` |
| T14 | R14 | `T14 1 1 0`: the `dev` script of `apps/server` loads the root `.env` with `--env-file=../../.env`, the root `dev` script is unchanged, nothing in `src` loads a `.env` file |
| T15 | R15 | `T15 0 0`: SIGTERM and SIGINT each end the started process with exit code 0 |
| T16 | R16 | `T16 1 1 1`: `buildApp({ config })` works; `logStream` captures the log; `registerRoutes` runs inside the `/api/v1` scope before the app is ready |
| T17 | R17 | `T17 1 0`: `apps/server/src/modules/` exists and holds no module |
| T18 | R18 | `T18 127.0.0.1 3000 0.0.0.0`: with only the two required variables the server listens on `127.0.0.1:3000` (row runs only when 3000 is free, `Blocked` otherwise); `SERVER_HOST=0.0.0.0` is accepted |
| T19 | R19 | `T19 1 0`: the database area reads `DATABASE_URL` only, and no other database connection variable is read |
| T20 | R20 | `T20 200 1`: with Postgres unreachable at start the server starts and `/healthz` answers; the later `500 internal_error` on a database call cannot be tested at this commit (it has no database call) and is said in the notes |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-004.checks.sh` and the harness | run on a mutated copy (a missing hook, a wrong status, a logged value): the matching rows fail; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-004.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; I run T1 to T20 | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `5320ebc`), `trace.sh` | the TOKI-004 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no process or worktree left |

## What can break (riskiest first)

1. A live row that passes because it parsed nothing: counts are printed and `Expected` needs at least one.
2. A value leaking into evidence: the invalid values are throwaway words, and the script checks they are absent from everything the process printed and prints only the count.
3. Processes and ports left behind: the `EXIT` trap kills every process the script started and the final line shows nothing remains.
4. Port 3000 busy: only T18 needs it and it is `Blocked` instead of guessed.
5. The harness differs from the real server: it uses `buildApp` exactly as the existing tests do, and the live rows check the same behaviors through the real process where they can.
