# QA record: TOKI-003
Ticket: TOKI-003
Spec: docs/specs/2026-11-12-local-dev-environment-design.md
Version: e6e2c96
Environment: a temporary worktree of the Version outside the repository, macOS, Docker 29.3.1 with Compose 5.1.1, the real Compose project `toki-dev` on this machine (started, stopped, reset and its volumes removed by the rows: its development data is lost, decided in concern 3 of the QA spec), the MinIO image `toki-dev-minio:RELEASE.2025-10-15T17-29-55Z` already built here (never rebuilt), Python 3 for the marker mail and the checks. The rows that need services use a `.env` that the script writes only inside its temporary worktree from made-up values (user `qauser`, a random password never printed, free ports); it is removed with the worktree. The repository's own `.env` is not read or created by Claude.

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. The static rows run in Claude's shell; the stack rows run in the QA's Terminal panel (`QA_STACK=1`) and Claude reads their output.

Each row runs `V=e6e2c96 bash docs/qa/TOKI-003.checks.sh <ID>` (called `checks` below; the stack rows also with `QA_STACK=1`) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-003.evidence.txt`. `e6e2c96` is the merge commit of PR #78 (2026-11-17), decided in concern 1 of the spec of this record. The layout of the Version differs from the text of the spec of TOKI-003: the compose file is `docker-compose.dev.yml` at the repository root and the scripts are in `scripts/` (the spec says `infra/`); the environment name variable is `NODE_ENV`; the dev scripts are called as `bash scripts/<name>.sh`, which is what the `dev:*` entries of `package.json` run (row T16 reads them). No password, no `.env` value and no log text is kept.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 3 1 1`: `compose config --services` lists three names; they are exactly mailpit, minio and postgres; the Postgres image tag starts with `17` |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 0 3 3`: `dev:up` exits 0; three services report `healthy`; the compose file defines a health check for three services |  | P1 |  |  |  |
| T2N | R2 | command | `checks T2N` | `T2N 1 1`: with the Postgres host port held by another listener, `dev:up` exits non-zero and prints `Not healthy: postgres` |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 0 1 1 1`: a second `dev:up` exits 0; the marker row, the marker file and the marker mail are still there (counts 1, 1, 1) |  | P1 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 0 0 1 1 1`: `dev:down` exits 0; `dev:up` exits 0; the marker row, file and mail are still there (counts 1, 1, 1) |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 0 0 1 1 1`: `dev:reset:db` exits 0; the development database has zero tables; a second database made by hand keeps its marker row; the file and the mail are unchanged |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 0 1 0 1 1`: `dev:reset:files` exits 0; the bucket exists; it holds zero objects; the marker row and the mail are unchanged |  | P1 |  |  |  |
| T6M | R6 | command | `checks T6M` | `T6M 1 1 0 1`: with the bucket removed, `dev:reset:files` exits non-zero and says to run `pnpm dev:up`; the bucket is still missing afterwards; after `dev:up` the bucket is listed again |  | P1 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 0 0 1 1`: `dev:reset:mail` exits 0; the inbox holds zero messages; the marker row and the file are unchanged |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 0 0 0 0 3 0`: `dev:reset` exits 0; zero tables, zero objects, zero messages afterwards; `reset.sh` calls the three entry points; it holds no reset step of its own |  | P1 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 1 1 0 0`: with the bucket removed, `dev:reset` exits non-zero and names the files step; the database and mail steps still ran (zero tables, zero messages) |  | P1 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 24 24 24 1 6`: four scripts in six cases are 24 runs; all 24 exit non-zero and name `NODE_ENV`; the marker data is unchanged; the six accepted runs (only one source says `development`, three scripts, two sources) pass their check |  | P1 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 0 1`: `dev:reset` exits 0 and the checksum of `.env` is the same before and after |  | P1 |  |  |  |
| T12 | R12 | command | `checks T12` | `T12 0 1`: after `dev:reset` the marker row of a second database made by hand is still there |  | P1 |  |  |  |
| T13 | R13 | command | `checks T13` | `T13 1`: one mail sent to the Mailpit SMTP port is in the web inbox (one message) |  | P2 |  |  |  |
| T14 | R14 | command | `checks T14` | `T14 0 1`: no relay or outside SMTP setting in the compose file; a copy with a relay setting added is detected |  | P2 |  |  |  |
| T15 | R15 | command | `checks T15` | `T15 10 10 0 0 1`: ten interpolations, all ten the required `:?` form; zero `:-`; zero credential values written in the file; a copy with a `:-` default is detected |  | P1 |  |  |  |
| T16 | R16 | command | `checks T16` | `T16 6 0`: the root `package.json` holds the six scripts and no `dev:seed` |  | P2 |  |  |  |
| T17 | R17 | command | `checks T17` | `T17 14 14`: each of the 14 names read by the compose file and the scripts is in the inventory (`.env.example`) of TOKI-096 |  | P2 |  |  |  |
| T18 | R18 | command | `checks T18` | `T18 0 1 1 1 0`: `config` with `--env-file .env` exits 0; the same command without it exits non-zero; one `docker compose` call in the scripts; it passes `--env-file .env`; no `docker compose` in the `dev:*` lines of `package.json` |  | P2 |  |  |  |
| T19 | R19 | command | `checks T19` | `T19 0 1 1`: zero interpolations that are not `:?`; with `POSTGRES_PASSWORD` removed from `.env`, `dev:up` exits non-zero and prints that name |  | P1 |  |  |  |
| T20 | R20 | command | `checks T20` | `T20 1`: `compose config` prints `name: toki-dev` |  | P2 |  |  |  |
| T21 | R21 | command | `checks T21` | `T21 4 4 1 0`: with the services down, four reset scripts exit non-zero (4) with the `pnpm dev:up` message (4); after `dev:up` the marker data is there (1); zero reset scripts act on a service other than through `compose ... exec` |  | P1 |  |  |  |
| T22 | R22 | command | `checks T22` | `T22 1 1 1 1`: with only Postgres stopped, `dev:reset` exits non-zero with the `pnpm dev:up` message; the file and the mail are unchanged; after `dev:up` the row is there |  | P1 |  |  |  |
| T23 | R23 | command | `checks T23` | `T23 1 0 0 1`: one session was open on the development database; `dev:reset:db` exits 0; zero tables afterwards; the database exists |  | P1 |  |  |  |
| T24 | R24 | command | `checks T24` | `T24 12 12 4 1 1 1 1`: two scripts in six cases are 12 runs; all 12 exit non-zero; the four runs with the test name unset or empty name `POSTGRES_TEST_DB`; the list of databases is unchanged; the marker row, file and mail are unchanged; with `.env` restored the check passes |  | P1 |  |  |  |
| T25 | R25 | command | `checks T25` | `T25 5 5`: five published ports; all five are bound to `127.0.0.1` |  | P1 |  |  |  |
| T26 | R26 | command | `checks T26` | `T26 1 1 0`: the MinIO tag is an exact release tag; the Mailpit tag is an exact version; zero images use `latest` or no tag |  | P1 |  |  |  |
| T27 | R27 | command | `checks T27` | `T27 0 1 0 1`: on empty volumes `dev:up` exits 0 and the bucket is listed once; a second `dev:up` exits 0 and it is still listed once |  | P1 |  |  |  |
| T28 | R28 | command | `checks T28` | `T28 0 0`: `dev:reset` with standard input closed exits 0; zero prompts to read an answer in the reset scripts |  | P2 |  |  |  |
| T29 | R29 | command | `checks T29` | `T29 6 6`: with a Docker host that does not exist, six scripts exit non-zero (6) and their output names Docker (6) |  | P1 |  |  |  |
| T30 | R30 | command | `checks T30` | `T30 0 1 1`: the smoke test exits 0; the checksum of `.env` is the same; with a guard call removed from `reset-mail.sh` it exits non-zero |  | P1 |  |  |  |

## Not covered
- None: every requirement R1 to R30 of the spec has a row.
