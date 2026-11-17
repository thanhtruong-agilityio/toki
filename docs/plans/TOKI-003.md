# TOKI-003 Local development environment - implementation plan

**Goal:** one command starts Postgres, MinIO and Mailpit for development, and four reset scripts return one store or all three to a clean state without touching `.env`, the test database or production.

**Spec:** `docs/specs/2026-11-12-local-dev-environment-design.md` (R1 to R30). Tier M: design, one grilling round, verifier.

**Run:** unattended, started by Thanh Truong on 2026-11-17 ("questions, commit and PR permission: approve them yourself"). Every choice made without asking is listed under "Choices made in this run" and repeated in the pull request.

## Design

### Files
```
package.json                       six dev:* scripts, each `bash infra/dev/<name>.sh`
infra/
├─ docker-compose.dev.yml          name: toki-dev; postgres, minio, mailpit; one named volume each
├─ minio/Dockerfile                builds MinIO and mc from the upstream source at a pinned release
└─ dev/
   ├─ lib.sh                       shared helpers: repo root, .env reader, compose wrapper, Docker and service checks
   ├─ guard.sh                     the shared guard: environment name (R10) and database names (R24)
   ├─ up.sh  down.sh               dev:up, dev:down
   ├─ reset-db.sh  reset-files.sh  reset-mail.sh     one entry point per store
   ├─ reset.sh                     dev:reset: preflight, then the three entry points
   └─ smoke.test.sh                the R30 smoke test
```
All scripts are Bash and run under the Bash 3.2 that macOS ships.

### Compose file
- `name: toki-dev` (R20). Images: `postgres:17.12`, `axllent/mailpit:v1.33.1`, and `toki-dev-minio:RELEASE.2025-10-15T17-29-55Z` built from `infra/minio/Dockerfile` (R1, R26).
- Every `${...}` is `${VAR:?message}` (R15, R19). Health checks use the escaped `$${...}` form.
- Ports: `127.0.0.1:${VAR}:<container port>` for Postgres 5432, MinIO 9000 and 9001 (console), Mailpit 1025 (SMTP) and 8025 (web) (R25).
- Health checks: `pg_isready -h 127.0.0.1` (TCP, so the init-time server on the socket does not count), `wget` on MinIO's `/minio/health/live`, `/mailpit readyz` (R2).
- Mailpit: `MP_DATABASE=/data/mailpit.db` on its volume; no relay setting (R4, R14).

### Scripts
- `lib.sh`:
  - `cd` to the repository root; `compose()` is `docker compose --env-file .env -f infra/docker-compose.dev.yml "$@"` (R18).
  - `env_file_get FILE NAME` reads one value from an env file without sourcing it (last assignment wins; optional `export`, quotes and inline comments handled).
  - `cfg NAME` returns the shell value when the variable is set, else the `.env` value, the same precedence Compose uses.
  - `require_docker` (R29), `require_service NAME` (R21: the service of project `toki-dev` must be running, else "run `pnpm dev:up` first").
  - `require_bucket_name`: the bucket name must be a valid S3 bucket name; an empty or odd name never reaches `mc`, where `local/` would address every bucket.
  - `in_postgres`, `in_minio`, `in_mailpit`: the only places that call `compose exec`, always with `-T`.
- `guard.sh`:
  - `guard_development FILE`: reads the environment name from the shell and from FILE separately. Passes only when at least one source sets it and every source that sets it says `development`. Otherwise prints a refusal that names the variable and returns non-zero (R10).
  - `guard_database_names`: refuses when the test database name is unset or empty (names the variable), when the development name is empty, equals the test name, or is `postgres`, `template0` or `template1` (R24).
- Each reset script: `guard_development` is the first step, then the name checks (database names, bucket name), `require_docker`, `require_service`, then the change. With `--check` it stops before the change; `reset.sh` uses that for its preflight (R22, R24), so no check is written twice.
  - `reset-db.sh`: `guard_database_names`, then `DROP DATABASE IF EXISTS :"db" WITH (FORCE); CREATE DATABASE :"db";` through `compose exec` on `postgres`, connected to the `postgres` database (R5, R12, R23). No migration step (concern 1).
  - `reset-files.sh`: in the `minio` container, `mc stat` the bucket (missing -> non-zero, "run `pnpm dev:up`", creates nothing), then `mc rm --recursive --force` (R6). The missing bucket is a run-time failure, not a preflight failure, so R9 holds.
  - `reset-mail.sh`: `DELETE /api/v1/messages` sent with `nc` from inside the `mailpit` container; success is an HTTP 200 status line (R7, R21).
- `reset.sh`: guard, then `--check` on the three entry points (any failure: exit non-zero, nothing changed); then runs the three entry points, keeps going after a failure, names each failed step and exits non-zero if any failed (R8, R9).
- `up.sh`: Docker check, `.env` present, bucket name valid, `compose up -d --wait --wait-timeout 180`; on failure it names each service that is not `running healthy`, read with `compose ps -a` so a container that never started is listed too (R2); then creates the bucket with `mc mb --ignore-existing` (R27). `down.sh`: `compose down`, which keeps the named volumes (R4).
- No script prompts (R28), writes `.env` (R11) or prints a credential. Credentials never leave the containers: `psql` uses the local socket, `mc` reads the root user and password from the container's own environment.

### Smoke test (R30)
`infra/dev/smoke.test.sh`, run directly with the services up. Part 1 needs no Docker: `env_file_get`, `guard_development` (the six cases of R10 against a temporary file, never `.env`) and `guard_database_names`. Part 2: writes a marker row, file and mail; creates a second database with a marker table as a stand-in for the test database (R12); runs each reset with the environment name exported as `production` and as an unknown value and expects the guard's own refusal message with all markers intact; runs each reset and checks it empties only its own store; runs `reset.sh` last; compares the checksum of `.env` before and after. Every probe stops the test on its own error, so an error is never read as "empty".

## Choices made in this run

1. **TOKI-096 is not built. This departs from a decision of the lead** (concern 4: TOKI-096 goes first). The spec says TOKI-096 goes first and names every variable (concern 4, R17); `main` has no inventory and no `.env.example`. This ticket uses the names below, kept in one place each (the compose file and the top of `lib.sh` / `guard.sh`). `DATABASE_URL` and `TEST_DATABASE_URL` are not read here. R17 stays pending until TOKI-096 lands; TOKI-096 either adopts these names or this ticket's files are renamed. This ticket does not create the inventory or `.env.example`. `NODE_ENV` is the name most likely to change: other tools (Vite, Vitest) set it themselves.

   | Value (TOKI-096 category) | Name used |
   | :-- | :-- |
   | Environment name | `NODE_ENV` |
   | Postgres user, password, development database name | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` |
   | Test database name | `POSTGRES_TEST_DB` |
   | Postgres host port (default 5432) | `POSTGRES_PORT` |
   | MinIO root user and password | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` |
   | Development bucket name | `MINIO_BUCKET` |
   | MinIO host ports (API default 9000, console) | `MINIO_PORT`, `MINIO_CONSOLE_PORT` |
   | Mailpit host ports (SMTP, web) | `MAILPIT_SMTP_PORT`, `MAILPIT_WEB_PORT` |

2. **MinIO publishes no image any more.** `minio/minio` is gone from Docker Hub and quay.io answers 401 (checked 2026-11-17). The source repositories `minio/minio` and `minio/mc` are public and archived. The image is built locally from those sources at `RELEASE.2025-10-15T17-29-55Z` (server) and `RELEASE.2025-08-13T08-35-41Z` (mc), with the commit of each tag checked in the Dockerfile. The first `pnpm dev:up` therefore compiles MinIO (a few minutes, cached afterwards). Each build step removes its Go caches, so the build leaves about 200 MB behind but needs about 3 GB of free Docker disk while it runs. An image from an unknown third party was not used. The archived upstream gets no security fixes. Whether Toki stays on MinIO, now unmaintained upstream, is a question for the lead.
3. **Image tags** (R26): `postgres:17.12`, `axllent/mailpit:v1.33.1`, MinIO as above.
4. **`dev:down` uses `docker compose down`**, not `stop`: containers and the network go, named volumes stay.
5. **Branch:** `feat/toki-003` is the lock; the work and the pull request are on `feat/toki-003-local-dev-environment` (working agreement on branch names).
6. `CLAUDE.md` gets the new commands (its own rule); `README.md` gets the commands where it says "Commands: TBD".

## Advisor

Consulted once on this design (Opus, 2026-11-17). Adopted: bucket name validation, SQL through standard input, `-T` on every `compose exec`, `--check` stops before the bucket lookup, refusal judged by message and not only by exit status, probes that fail on their own error, the second-database marker in the smoke test, `compose ps -a` for R2, set-but-empty counts as set, the Go and Alpine images pinned to a release. Not adopted: also refusing a development database name that ends in `_test` or that matches `TEST_DATABASE_URL`; the spec defines the rule by `POSTGRES_TEST_DB` only (R24), so this goes to the pull request as a suggestion.

## AC -> step -> test

"smoke" is `bash infra/dev/smoke.test.sh`; "hand" is the check command of the requirement, run once, output in the pull request.

| AC | Step | Test |
| :-- | :-- | :-- |
| R1, R20, R26 | 1 | hand: `compose config --services`, `--images`, `config \| grep name:` |
| R14, R15, R19 (form) | 1 | hand: the two `grep` commands of R15 and R19; no relay setting |
| R18 | 1, 2 | hand: `compose config` with and without `--env-file .env` |
| R25 | 1 | hand: `compose ps` shows `127.0.0.1:` on every port |
| R2, R3, R27 | 3 | hand: `pnpm dev:up` twice, `compose ps`; port taken -> non-zero and the service named |
| R19 (missing value) | 3 | hand: remove one variable, `pnpm dev:up` -> non-zero, names it |
| R4, R13 | 3 | hand: markers survive `dev:down` + `dev:up`; mail to an outside address is caught |
| R10 | 2, 4 | smoke part 1 (six cases, function level) and part 2 (exported `production` and unknown value, four scripts); hand: the six `.env` cases on one script |
| R24 | 2, 4 | smoke part 1; hand: the `.env` cases of R24 |
| R5, R6, R7 | 4 | smoke part 2 |
| R8, R9, R22 | 5 | smoke (final `reset.sh`); hand: bucket removed (R9), Postgres stopped (R22) |
| R11, R30 | 6 | smoke compares the `.env` checksum; hand: remove a guard call -> smoke fails |
| R12, R23 | 4 | smoke (second database, R12); hand: open `psql` session during the reset (R23) |
| R21 | 4 | hand: `dev:down`, then each reset -> refusal |
| R28, R29 | 4, 5 | hand: `pnpm dev:reset < /dev/null`; Docker check by a `PATH` without `docker` |
| R16 | 7 | hand: `pnpm run` lists the six, no `dev:seed` |
| R17 | - | pending: TOKI-096 is not built (choice 1) |

## Steps

1. Compose file and `infra/minio/Dockerfile`. Build the MinIO image once to prove it.
2. `smoke.test.sh` part 1 first (fails: no `lib.sh`, no `guard.sh`), then `lib.sh` and `guard.sh`.
3. `up.sh`, `down.sh`; hand checks of R2 to R4.
4. `smoke.test.sh` part 2 first (fails: no reset scripts), then the three reset scripts.
5. `reset.sh`; the final section of the smoke test.
6. Hand check of R30 (remove a guard call).
7. Root `package.json` scripts, `CLAUDE.md` and `README.md` commands.

Each test is run before its step and must fail for the right reason, then after it and must pass.

## What can break

- **Riskiest step: the MinIO build.** It depends on github.com and the Go module proxy at build time; a failure there blocks `dev:up`. Proven once in step 1; the commit check makes a moved tag fail loudly.
- **A reset that wipes the wrong thing.** Mitigations: the guard fails closed and runs first; every action is a `compose exec` in project `toki-dev`; the database name is passed as a quoted psql identifier; system and test database names are refused.
- **Guard parsing differs from Compose parsing of `.env`.** A value Compose reads as `development` but the guard does not only causes a refusal (fail closed). The reverse needs an exotic line (for example a multi-line quoted value); out of scope, noted in the pull request.
- **`.env` changed after the containers were created.** The reset uses the current `.env` names; a database name that no longer matches the container only recreates an empty database of that name, and the user name mismatch makes `psql` fail with non-zero.
- **Bash 3.2 on macOS:** no associative arrays, no `mapfile`, no `${var,,}`.
- **`package.json` is also edited by TOKI-002** (lint scripts): a merge conflict in `scripts` is possible, resolved by keeping both.
