# TOKI-114 QA of the local development environment - implementation plan

**Goal:** TOKI-003 gets a QA record at the merge commit of the pull request that delivered it (`e6e2c96`, PR #78), with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-local-dev-environment-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-114-local-dev-qa`. Documents and one bash script; no existing file changes except `docs/traceability.md` (regenerated). Concerns 1 to 3 are decided: judged at `e6e2c96`; temporary worktree and local resources allowed; the real Compose project `toki-dev` is started and reset, and its development data on this machine is lost.

## What the delivery looks like at `e6e2c96` (read from the commit, not assumed)
The spec of TOKI-003 names `infra/docker-compose.dev.yml` and `infra/dev/`; at the Version the files are `docker-compose.dev.yml` and `scripts/` (`up.sh`, `down.sh`, `reset*.sh`, `guard.sh`, `lib.sh`, `smoke.test.sh`) with `Dockerfile.minio`; there is no `.env.example` at that commit. The environment name variable is `NODE_ENV`; the other names read are `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_TEST_DB`, `POSTGRES_PORT`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `MINIO_PORT`, `MINIO_CONSOLE_PORT`, `MINIO_BUCKET`, `MAILPIT_SMTP_PORT`, `MAILPIT_WEB_PORT`. Rows use the paths and names of the Version; the result notes say where they differ from the text of the spec (R17 reads the inventory of TOKI-096 as it stood at the Version; if it is not there, the row is Blocked and says so). The MinIO image is built from upstream source (`Dockerfile.minio`) and already exists locally as `toki-dev-minio:RELEASE.2025-10-15T17-29-55Z`; a row never rebuilds it.

## The `.env` problem and how it is solved
The dev scripts and Compose read a root `.env`; Claude may not create or read one. Decided by the Dev on 2026-11-25: the rows that need services run in the Dev's own Terminal panel. The script, run there with `run_in_terminal`, creates a `.env` only inside its temporary worktree, with fixed made-up values (user `qa`, a random password made with `openssl rand` and never printed, free high ports, bucket `qa-files`, `NODE_ENV=development`), and removes it with the worktree. Claude does not read it and the evidence prints no value. The rows that need no services (static rows, `docker compose config`, R29 with a Docker host that does not exist) run in Claude's own shell with the values exported in a clean environment and no `.env` anywhere. The repository's own `.env` is not touched.

## Design
Same shape as the earlier QA tickets, with their lessons built in from the start: each part of a sentence of a requirement is a printed number; a row names one requirement; a mutation is paired with a run that passes; a row prints `Blocked` and never a Pass when it cannot be shown; every claim of the notes has a line of evidence; a changed `Expected` is approved again; one `BASE` folder holds every temporary file (exported as `TMPDIR`); the last line shows that no worktree, process, container of the script, port or folder is left, and that the repository is unchanged.

- **Isolation of the stack.** The script uses `COMPOSE_PROJECT_NAME`-independent calls exactly as the scripts do (`-p toki-dev`). Running the rows replaces the containers of the project `toki-dev` that are up now (they are another worktree's) and the reset rows wipe its volumes: that is concern 3, decided. The script records, before it starts, only the names and states of the containers and volumes of the project (no data), prints them, and at the end leaves the stack stopped (`dev:down`) with its volumes in place; it does not restore the wiped data.
- **Marker data** (fake): one table row in the development database, one small text file in the bucket, one mail to a made-up address sent to the Mailpit SMTP port; read back through `compose exec` (psql, `mc`) and the Mailpit HTTP API, never through a password on a command line.
- **Rows that change `.env`** (R10, R24) do it on the temporary `.env` and restore it; each is run six (R10) or five (R24) times with each outcome counted, paired with the unchanged run that proves the guard lets a run through.
- **Docker not running** (R29): `DOCKER_HOST=unix:///nonexistent` for each of the six scripts (decided in concern 3), not a stopped Docker.
- **Smoke test** (R30): run directly in the temporary worktree; then the guard call is removed from one reset script of the worktree and the test must exit non-zero; restored with `git checkout`.
- The script takes row ids, so the rows run in groups: `static` (Claude's shell) and `stack` (Terminal panel). The evidence file keeps each group and its last `CLEAN` line.
- Output is counts, exit codes, ids and words. No password, no `.env` value and no tool output beyond the first error line of a refusal.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug on a mutated copy first and say if I run a real row to debug it.

### Rows (one per requirement behavior; ids follow the requirement numbers)
| ID | TOKI-003 | Group | What it compares (printed numbers) |
| :-- | :-- | :-- | :-- |
| T1 | R1 | static | `compose config --services` count 3 and names; the Postgres tag starts with `17` |
| T2 | R2 | stack | `dev:up` exits 0; the three services `healthy`; each has a healthcheck |
| T2N | R2 | stack | with a host port already taken by a listener, `dev:up` exits non-zero and names the service that is not healthy |
| T3 | R3 | stack | a second `dev:up` exits 0; the row, the file and the mail are still there |
| T4 | R4 | stack | after `dev:down` then `dev:up` the row, the file and the mail are still there |
| T5 | R5 | stack | `dev:reset:db` exits 0; no table in the development database; the test database, the file and the mail are unchanged |
| T6 | R6 | stack | `dev:reset:files` exits 0; the bucket exists with zero objects; the row and the mail are unchanged |
| T6M | R6 | stack | with the bucket removed it exits non-zero, says to run `pnpm dev:up`, creates nothing; `dev:up` lists the bucket again |
| T7 | R7 | stack | `dev:reset:mail` exits 0; zero messages; the row and the file are unchanged |
| T8 | R8 | stack | `dev:reset` exits 0; the checks of R5, R6, R7 pass; the script calls the three entry points and holds no step of its own |
| T9 | R9 | stack | with the bucket removed `dev:reset` exits non-zero, names the files step, and the other two resets took effect |
| T10 | R10 | stack | four scripts x six cases: 24 runs, each refusal exits non-zero, names `NODE_ENV`, changes nothing; the two accepted combinations of the spec run |
| T11 | R11 | stack | the checksum of the temporary `.env` is the same before and after `dev:reset` |
| T12 | R12 | stack | a second database made by hand keeps its marker row after `dev:reset` |
| T13 | R13 | stack | a mail sent to the SMTP port is in the Mailpit inbox |
| T14 | R14 | static | no relay or outside SMTP setting in the compose file |
| T15 | R15 | static | every `${` is a `:?` form; `grep ':-'` finds nothing; zero credential values |
| T16 | R16 | static | the six scripts are in `package.json`; no `dev:seed` |
| T17 | R17 | static | every `${...}` name and every name the scripts read is in the inventory at the Version (Blocked if there is none) |
| T18 | R18 | static | `config` with `--env-file` from the root exits 0 and without it exits non-zero; every `docker compose` call of the scripts passes `--env-file .env` |
| T19 | R19 | static + stack | only `:?` forms; removing one variable makes `dev:up` exit non-zero and print its name |
| T20 | R20 | static | `config` prints `name: toki-dev` |
| T21 | R21 | stack | after `dev:down` each of the four resets exits non-zero with the `dev:up` message; the marker data is back after `dev:up`; every action on a service is `compose ... exec` |
| T22 | R22 | stack | with only Postgres stopped `dev:reset` exits non-zero with the message and changes nothing |
| T23 | R23 | stack | with a `psql` session open `dev:reset:db` exits 0 and the check of R5 passes |
| T24 | R24 | stack | five cases (equal names, `postgres`, `template0`, `template1`, test name unset, test name empty) x two scripts: each exits non-zero, nothing is dropped; the last two name `POSTGRES_TEST_DB` |
| T25 | R25 | stack | `compose ps` shows `127.0.0.1:` before every published port |
| T26 | R26 | static | MinIO and Mailpit tags are exact; none is `latest` |
| T27 | R27 | stack | on empty volumes `dev:up` creates the bucket; a second run lists it once |
| T28 | R28 | stack | `dev:reset < /dev/null` exits 0 without waiting |
| T29 | R29 | static | with a Docker host that does not exist each of the six scripts exits non-zero and names Docker |
| T30 | R30 | stack | the smoke test exits 0, the checksum of `.env` is the same; with a guard call removed it exits non-zero |

## AC -> step -> test
| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-003.checks.sh` (static group first) | run on a mutated copy of the compose file and scripts (`latest` tag, a `:-` default, an `0.0.0.0` port, the guard call removed): the matching rows fail; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-003.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; the static group runs in my shell and the stack group in the Terminal panel | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `e6e2c96`), `trace.sh` | the TOKI-003 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no worktree, process, port or folder left; the repository `.env` untouched |

## What can break (riskiest first)
1. A row that passes without measuring: every case that must fail is paired with a case that must pass and the numbers are printed.
2. Ports 5432, 9000, 9001, 1025 and 8025 are held by the current `toki-dev` stack of another worktree: the script uses its own free ports in the temporary `.env`, and the containers of the project are replaced (concern 3).
3. Time and disk: the stack group takes many minutes; the MinIO image already exists and is never rebuilt; if it is missing the rows are Blocked, not built.
4. The Terminal runner: output is read with `read_terminal`; the script writes its output to the evidence candidate file in `BASE` too, and the CLEAN line proves the cleanup.
5. A reset row wiping something outside the temporary stack: all commands go through `-p toki-dev` and the temporary `.env`; the repository `.env` is never read.
6. The spec text and the Version differ (paths, `NODE_ENV`, no `.env.example`): each row follows the Version and the notes say so.
