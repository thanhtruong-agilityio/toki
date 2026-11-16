# Local development environment design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/local-dev-environment.md (Thanh Truong)
Ticket: TOKI-003

## Goal
The builder needs the three backing services of Toki (database, file storage, mail catcher) on the development machine, started with one command.
The builder also needs a safe way back to a clean state, for one kind of data or for all of it.
Later foundation work, starting with TOKI-005, relies on these services being available locally.

## Scope
- In: `infra/docker-compose.dev.yml` with Postgres, MinIO and Mailpit; the six root scripts `dev:up`, `dev:down`, `dev:reset:db`, `dev:reset:files`, `dev:reset:mail`, `dev:reset`; the guards that keep a reset away from `.env`, the test database and production; one script-level smoke test for the guard and the resets.
- Out (not now):
  - Monorepo, packages and shared TypeScript config: TOKI-001.
  - Lint, format and boundary rules: TOKI-002.
  - Server skeleton, reading and validating environment variables: TOKI-004.
  - Postgres connection, the migration workflow and the first table: TOKI-005.
  - Web skeleton and dev proxy: TOKI-006. CI: TOKI-007.
  - Test harness and the test database itself: TOKI-008.
  - The inventory of environment variables and `.env.example`: TOKI-096.
  - Sending mail over SMTP from the server: TOKI-021.
  - Sample data and the `dev:seed` script: TOKI-081.
  - Production image and Compose: TOKI-084.
  - The root `pnpm dev` script: TOKI-001 creates it (decision of 2026-11-12). The intent does not ask for it here. It does not start the services; the builder runs `pnpm dev:up` first (concern 6).
- Plan change: TOKI-003 now also needs TOKI-096 (decision of 2026-11-12); the Blueprint plan must be updated.

## Requirements
In the checks below, `compose` stands for `docker compose --env-file .env -f infra/docker-compose.dev.yml`, run from the repository root (R18).
- R1. `infra/docker-compose.dev.yml` exists and defines three services: Postgres 17, MinIO and Mailpit. Check: `compose config --services` lists exactly three names, and `compose config --images` shows a Postgres image whose tag starts with `17`.
- R2. `pnpm dev:up` starts the three services and exits 0 only when all three are healthy. The compose file defines a health check for each service. Check: after `pnpm dev:up`, `compose ps` shows `healthy` for all three. Negative check: with one service made to fail (for example its host port is already taken), `pnpm dev:up` exits non-zero and names the service that is not healthy.
- R3. `pnpm dev:up` run a second time exits 0 and leaves existing data unchanged. Check: with the marker data of R4 in place, run `pnpm dev:up` again; `echo $?` prints 0 and the row, the file and the mail are still there.
- R4. `pnpm dev:down` stops the three services and keeps their data. Check: write one table row, one stored file and one caught mail; run `dev:down` then `dev:up`; all three are still there.
- R5. `pnpm dev:reset:db` leaves the development database with no table and no row from before. It wipes only the development database: it never drops the Postgres server, the volume or the test database. Stored files and caught mail are unchanged. In this ticket the script is a wipe only; TOKI-005 adds the "re-run migrations" step (concern 1). Check: with the marker data of R4 in place, run `pnpm dev:reset:db`; `psql` with `\dt` on the development database (through `compose exec` on the Postgres service) lists no table; the file is still in the MinIO console and the mail is still in the Mailpit web inbox.
- R6. `pnpm dev:reset:files` leaves the development bucket present and holding zero objects. When the bucket is missing, it exits non-zero, says to run `pnpm dev:up` and creates nothing. The database and caught mail are unchanged. Check: with the marker data of R4 in place, run `pnpm dev:reset:files`; the MinIO console still lists the bucket and shows zero objects in it; the marker row (`psql` through `compose exec`) and the mail (Mailpit web inbox) are still there. Remove the bucket by hand and run it again; `echo $?` prints non-zero and the bucket is still missing.
- R7. `pnpm dev:reset:mail` leaves the Mailpit inbox with zero messages. The database and stored files are unchanged. Check: with the marker data of R4 in place, run `pnpm dev:reset:mail`; the Mailpit web inbox shows zero messages; the marker row (`psql` through `compose exec`) and the file (MinIO console) are still there.
- R8. `pnpm dev:reset` runs the three resets in one command. It runs the same entry point as `pnpm dev:reset:db`, `pnpm dev:reset:files` and `pnpm dev:reset:mail`. Check: afterwards the checks of R5, R6 and R7 all pass; reading the `dev:reset` script shows it calls those three entry points and holds no reset step of its own.
- R9. `pnpm dev:reset` exits non-zero and names the failed step when any of the three resets fails. The remaining steps still run. Check: with all three services up, make one step fail (remove the development bucket by hand, so the files step fails, R6); run `pnpm dev:reset`; `echo $?` prints non-zero, the output names the failed step, and the checks of the other two resets pass.
- R10. Each of the four reset scripts runs only when the environment name variable (the row named in the TOKI-096 inventory, allowed values `development` and `production`) is set to `development`. The scripts load the root `.env` themselves, because pnpm does not. They read the variable from both the shell and the root `.env`: every source that sets it must say `development`, so a script refuses when the two disagree. With the variable set to `production`, set to any other value, or not set at all, the script exits non-zero, prints a refusal message that names the variable and changes no data. Check: run each of the four scripts five times: with the variable in `.env` set to `production`, set to an unknown value, and removed (and not exported in the shell); then with `development` in `.env` and `production` exported in the shell, and the other way round; each run exits non-zero and the marker data of R4 (one table row, one stored file, one caught mail) is still there.
- R11. No reset changes `.env`. Check: the checksum of `.env` is the same before and after `pnpm dev:reset`.
- R12. No reset touches the test database. The test database is a second database, under another name, on the same development Postgres server; TOKI-008 creates it (concern 3). Check: in this ticket, create a second database by hand for this check only and write a marker row to it; run `pnpm dev:reset`; the marker row is still there (`psql` through `compose exec`). Drop the second database after the check.
- R13. Mail sent to the Mailpit SMTP port is caught and readable on the development machine. Check: send one mail to an outside address; it appears in the Mailpit web inbox.
- R14. The compose file sets no mail relay. Check: `infra/docker-compose.dev.yml` holds no relay or outside SMTP setting.
- R15. The compose file holds no credential value; it reads them from `.env`. Check: every credential in `docker-compose.dev.yml` is a `${VAR:?message}` reference (R19). A form with a default, such as `${VAR:-default}`, does not pass: `grep -n ':-' infra/docker-compose.dev.yml` prints nothing. Compose's escaped form `$${...}` is not an interpolation (it is common in health check commands) and is not counted.
- R16. The root `package.json` holds the six scripts named in Scope and no `dev:seed` script. Check: `pnpm run` lists the six and does not list `dev:seed`.
- R17. The compose file and the dev scripts read only environment variables named in the TOKI-096 inventory; this ticket invents no variable name. Check: every `${...}` name in `infra/docker-compose.dev.yml` and every variable the scripts in `infra/dev/` read appears in the TOKI-096 inventory.
- R18. Every script and every check command runs Compose from the repository root with `--env-file .env`, so the values come from the root `.env` and not from `infra/`. Check: in a shell that does not export the values, with the root `.env` present and no `infra/.env`, `docker compose --env-file .env -f infra/docker-compose.dev.yml config` exits 0 and the same command without `--env-file .env` exits non-zero; reading the scripts in `infra/dev/` and the `dev:*` lines of the root `package.json` shows every `docker compose` call passes `--env-file .env`.
- R19. Every `${...}` in the compose file uses the required form `${VAR:?message}`. A value missing from `.env` makes `pnpm dev:up` exit non-zero and print the name of the missing variable. Check: `grep -n '\${' infra/docker-compose.dev.yml` shows only `:?` forms. Compose's escaped form `$${...}` is not an interpolation (it is common in health check commands) and is not counted. Remove one variable from `.env` and run `pnpm dev:up`; it exits non-zero and prints that variable's name.
- R20. The compose file sets `name: toki-dev`. Check: `compose config` prints `name: toki-dev`.
- R21. Each reset acts only through the containers of the dev Compose project `toki-dev` (`docker compose ... exec`). It never connects to a host or address read from `.env`. When that project is not the one running, or the service the reset needs is stopped, the script exits non-zero, says to run `pnpm dev:up` first and changes nothing. Check: run `pnpm dev:down`, then each of the four reset scripts; each exits non-zero with that message; after `pnpm dev:up` the marker data of R4 is still there. Reading the scripts in `infra/dev/` shows every action on a service is a `docker compose ... exec` call.
- R22. `pnpm dev:reset` checks that all three services are up before it changes anything. When one is not, it exits non-zero, says to run `pnpm dev:up` first and changes nothing. Check: with the marker data of R4 in place, run `compose stop` on the Postgres service only, then `pnpm dev:reset`; it exits non-zero with that message; the file and the mail are still there; after `pnpm dev:up` the row is still there.
- R23. `pnpm dev:reset:db` works while sessions are connected to the development database. It uses `DROP DATABASE ... WITH (FORCE)`, which closes them. Check: keep one `psql` session open on the development database, run `pnpm dev:reset:db`; it exits 0 and the check of R5 passes.
- R24. `pnpm dev:reset:db` and `pnpm dev:reset` exit non-zero and change nothing when the development database name equals the test database name, or is a system database (`postgres`, `template0`, `template1`), or when the test database name variable is not set or is empty; the refusal message names that variable. Check: set the development database name in `.env` to the test database name, then to `postgres`, `template0` and `template1`, then restore it and remove the test database name variable; each time run `pnpm dev:reset:db` and `pnpm dev:reset`; each run exits non-zero, `psql` with `\l` shows every database still there, and the file and the mail are unchanged.
- R25. Every published port is bound to `127.0.0.1`. The host port numbers come from variables in the TOKI-096 inventory (R17). Check: `compose ps` shows `127.0.0.1:` in front of every published port.
- R26. The MinIO and Mailpit images are pinned to an exact tag: never `latest`, no floating tag. The exact tag is chosen when the ticket is built. Check: `compose config --images` shows a full release tag on the MinIO image and on the Mailpit image, and no `latest`.
- R27. `pnpm dev:up` creates the development bucket when it is missing. Check: on empty volumes, run `pnpm dev:up`; the MinIO console lists the development bucket. Run `pnpm dev:up` again; it exits 0 and the bucket is listed once.
- R28. No reset asks for confirmation before it deletes data. Check: `pnpm dev:reset < /dev/null` finishes without waiting for input and exits 0.
- R29. When Docker is not running or not installed, each of the six scripts exits non-zero and says so. Check: quit Docker, run each of the six scripts; each exits non-zero and its message names Docker.
- R30. This ticket adds one script-level smoke test in `infra/dev/`. It checks that the guard refuses (R10) and that each reset empties only its own store (R5, R6, R7). It runs without the TOKI-008 harness. It wipes the development data, like `dev:reset`. Check: with the services up, run the smoke test file directly; it exits 0. Remove the guard call from one reset script by hand and run it again; it exits non-zero.

## Design
### Errors
- Docker is not running or not installed -> the script exits non-zero and says so (R29).
- A value the compose file needs is missing from `.env` -> `dev:up` exits non-zero and prints the name of the missing variable (R19).
- A service does not become healthy -> `dev:up` exits non-zero and names the service (R2).
- A reset is run while the dev Compose project is not running, or while the service it needs is stopped -> the script exits non-zero, says to run `pnpm dev:up` first and changes nothing (R21).
- A reset is run while the environment name is not `development` (production, any other value, or unset) -> refusal, as in R10. The same holds when the shell and the root `.env` disagree on the value. The guard runs before any other step and fails closed.
- The development database name equals the test database name or is a system database, or the test database name is not set -> `dev:reset:db` and `dev:reset` exit non-zero and change nothing (R24).
- `dev:reset:files` is run while the development bucket is missing -> it exits non-zero and says to run `pnpm dev:up` (R6).
- `dev:reset:db` is run while sessions are connected to the development database -> the sessions are closed and the reset goes on (R23).
- `dev:reset` is run while one of the three services is not up -> it exits non-zero before it changes anything and says to run `pnpm dev:up` first (R22).
- One step of `dev:reset` fails after that preflight -> the remaining steps still run, then the script exits non-zero (R9). Run all, report at the end.

### Layout
```
toki/
├─ package.json                 the six dev:* scripts
└─ infra/
   ├─ docker-compose.dev.yml    Postgres 17, MinIO, Mailpit, one named volume each
   └─ dev/                      the reset scripts, the shared production guard, the smoke test
```
- The compose file sets `name: toki-dev` (R20), so no other compose file in a folder called `infra` shares its project.
- The scripts load the root `.env` themselves and pass `--env-file .env` to every Compose call (R10, R18).
- Each service has a health check; `dev:up` waits for all three (R2).
- Every published port is bound to `127.0.0.1` (R25). The MinIO and Mailpit images carry an exact tag (R26).
- Data lives in named Docker volumes, so `dev:down` (stop without removing volumes) keeps it. Mailpit stores its database on its named volume through `MP_DATABASE`; without it Mailpit keeps mail in a temporary file that is lost when it stops. `MP_DATABASE` is Mailpit's own setting, written in the compose file; it is not a variable read from `.env`.
- Each reset reaches its service only through the containers of the `toki-dev` project (R21). No reset asks for confirmation (R28).
- `dev:reset:db` drops and recreates only the development database by name, with `DROP DATABASE ... WITH (FORCE)` so open sessions are closed (R23). It refuses when that name is the test database name or a system database (R24). It never removes the Postgres server or its volume, so the test database, which is a second database under another name on the same server, survives. It runs no migration; TOKI-005 adds that step.
- `dev:reset:files` deletes every object in the development bucket and keeps the bucket.
- `dev:reset:mail` deletes all messages through Mailpit's HTTP API, called from inside a container of the `toki-dev` project, so R21 still holds; it does not restart the container.
- One shared guard is called first by every reset script. It reads the environment name variable from the TOKI-096 inventory and lets the script continue only on the value `development` (R10).
- `dev:reset` runs the same entry point as `pnpm dev:reset:db`, `pnpm dev:reset:files` and `pnpm dev:reset:mail`; it does not copy them. Later steps (such as migrate) are added inside that entry point, so `dev:reset` runs them too.
- Assumption: the folder name `infra/dev/` and the script language. The Blueprint fixes only the compose path and the script names.
- Variable names for the database, the bucket, credentials and ports are the ones in the TOKI-096 inventory (R17). The compose file and the scripts need these values; the list is handed to TOKI-096, which names them:
  - Postgres user, Postgres password and development database name;
  - test database name (read only by the guard of R24);
  - MinIO root user and MinIO root password;
  - development bucket name;
  - one host port for each port a service publishes;
  - environment name.
- `dev:up` creates the development bucket when it is missing (R27), so `dev:reset:files` always has a bucket to empty.

## Testing
- Each requirement is checked by hand once on the builder's machine with the command named in it; the output goes in the PR description.
- R10 is checked for all four reset scripts with the environment name variable set to `production`, set to an unknown value, unset, and set differently in the shell and in `.env`, against services that hold fake marker data.
- R12 is checked by hand in this ticket against a second database created only for the check.
- R4 to R8 use fake data only: one marker row, one small text file, one mail to a made-up address.
- One automated test is added here: the script-level smoke test of R30 (the guard refuses; each reset empties only its own store). It runs without the TOKI-008 harness. It writes fake marker data only, but it wipes the development data, like `dev:reset` (R30). Hand checks stay for the rest. The smoke test is run on the builder's machine only (concern 9). The test harness arrives in TOKI-008 and CI in TOKI-007.

## Data safety
- Credentials for the three services live in `.env`, which git ignores. The compose file and scripts hold no credential value.
- Caught mail stays in Mailpit on the development machine. Nothing relays it.
- Every published port is bound to `127.0.0.1` (R25), so the Mailpit inbox, Postgres and MinIO cannot be reached from the network.
- A reset acts only on the containers of the `toki-dev` project (R21), so a `.env` that points at another host cannot make it wipe that host.
- Reset scripts print no credential value.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The services are Postgres, MinIO and Mailpit, run from `infra/docker-compose.dev.yml` | R1, R20, R26, Layout |
| The commands are scripts in the root `package.json` | R16 |
| `dev:up` starts the services | R2, R3, R18, R19, R27 |
| `dev:down` stops them and keeps data | R4, named volumes and `MP_DATABASE` in Layout |
| `dev:reset:db` wipes Postgres and re-runs migrations | R5, R23 for the wipe. TOKI-003 ships the wipe only; TOKI-005 adds the migration step (decision of 2026-11-12, concern 1) |
| `dev:reset:files` empties the MinIO bucket | R6 |
| `dev:reset:mail` clears the Mailpit inbox | R7 |
| `dev:reset` does all three | R8, R9, R22 |
| No reset touches `.env` or the test database. Every reset refuses to run in production | R11, R12, R10, R21, R24; the production guard is decided (concern 2) and so is the test database location (concern 3) |
| A partial reset can leave references between the three. `dev:reset` is the one that returns a clean state | R5 to R7 each change one store only; R8 is the clean state. No cross-store cleanup is built |
| Sample data is not part of this ticket: `dev:seed` comes in TOKI-081 | Scope (Out), R16 |
| The agreed stack names Postgres 17 and MinIO. Development uses Mailpit | R1; MinIO and Mailpit are pinned to an exact tag (R26, concern 5) |
| Secrets live in `.env`, never in git | R15, R17, R18, R19, Data safety |
| Milestone: M1 Foundation and design system. The M1 exit check includes "pnpm dev runs" | Planning fact. This spec delivers the services only. TOKI-001 owns the root `pnpm dev` script; it does not start the services, the builder runs `pnpm dev:up` first (concern 6) |
| Size: M (about one working session with Claude) | Planning fact; no design impact. Scope is kept to one compose file, six scripts and one smoke test |
| Needs: TOKI-001 (pnpm monorepo and TypeScript) and TOKI-096 (decision of 2026-11-12) | Planning fact. The root `package.json` from TOKI-001 must exist before R16. TOKI-003 now also needs TOKI-096 for the variable names (R17, plan change in Scope) |
| Needed by: TOKI-005 | R2 gives TOKI-005 a running Postgres; TOKI-005 adds the migration step to `dev:reset:db` (concern 1) |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; no design impact. Neighbouring tickets are listed in Scope (Out) |

## Open questions from the intent
- What does `dev:reset:db` do before TOKI-005 is done? Answered: it is a wipe only; TOKI-005 adds the "re-run migrations" step. See concern 1.

## Areas of concern
1. `dev:reset:db` must re-run migrations, but the migration workflow arrives in TOKI-005, which needs this ticket. Options: ship the wipe only and let TOKI-005 add the migration step, or call a migration script that is skipped while it is missing. Decided: TOKI-003 ships `dev:reset:db` as a wipe only. TOKI-005 adds the "re-run migrations" step to `dev:reset:db`. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
2. The Blueprint does not say how a reset knows it is in production (which variable, which value), or whether it should also refuse when the signal is missing. Decided: a reset runs only when the environment name variable is `development`; with `production`, any other value or no value it refuses (R10). The variable is the environment name row of the TOKI-096 inventory, which that spec now lists as read by TOKI-003. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Added: the scripts load the root `.env` themselves, because pnpm does not (R10). Each reset acts only through the containers of the dev Compose project (`docker compose ... exec`) and refuses when that project is not the one running (R21). When the shell and the root `.env` both set the variable, both must say `development`; a script refuses when they disagree (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
3. The Blueprint does not say where the test database lives (same Postgres server under another name, or a separate one); TOKI-008 owns it and comes later. R12 can only be fully checked then. Decided: the test database is a second database, under another name, on the same development Postgres server. `dev:reset:db` wipes only the development database; it never drops the server, the volume or the test database. TOKI-008 still owns creating the test database. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Added: R12 is checked by hand in this ticket, against a second database created only for the check (R12). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
4. The compose file needs variable names for the database, the bucket, credentials and ports. TOKI-096 owns the inventory and `.env.example` but is not listed as a need of TOKI-003. Either TOKI-096 goes first, or this ticket picks names that TOKI-096 then adopts. Decided: TOKI-096 is done first and names every phase 1 variable. TOKI-003 uses exactly the names in the TOKI-096 inventory and invents none. Plan change: TOKI-003 now also needs TOKI-096. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
5. The Blueprint names Postgres 17 but gives no version for MinIO or Mailpit, and no host ports. Unpinned images can change under the builder. Decided: the MinIO and Mailpit images are pinned to an exact tag (never `latest`, no floating tag); the exact tag is chosen when the ticket is built (R26). Host ports come from variables in the TOKI-096 inventory and are bound to `127.0.0.1` (R25). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
6. The M1 exit check says "pnpm dev runs". The Blueprint does not say whether `pnpm dev` starts the services itself or expects `dev:up` first, or which ticket owns `pnpm dev`. Answered in part: TOKI-001 creates the root `pnpm dev` script; it runs the `dev` script of every workspace project that has one. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Decided for the rest: `pnpm dev` does not start the services; the builder runs `pnpm dev:up` first. This agrees with the TOKI-001 spec. What the builder sees when `pnpm dev` runs with the services down is not this ticket's to define. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
7. The Blueprint does not say whether a reset asks for confirmation before it deletes data. This spec assumes no prompt, so that scripts and Claude can run it. Decided: no confirmation prompt before a reset (R28). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
8. The Blueprint does not say who creates the MinIO bucket. This spec assumes `dev:up` does; the server (a later ticket) could own it instead. Decided: `dev:up` creates the development bucket when it is missing (R27). Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
9. The smoke test of R30 needs Docker, and the definition of done asks for "CI is green". CI arrives in TOKI-007 and has no Docker services. Decided: the smoke test is run on the builder's machine only; the builder runs it whenever a reset script changes. "CI is green" applies to the CI that exists when the ticket is built. Decided by Thanh Truong (lead, as product owner) on 2026-11-16. Owner: Thanh Truong.
