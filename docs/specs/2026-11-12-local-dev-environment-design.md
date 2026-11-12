# Local development environment design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/local-dev-environment.md (Thanh Truong)
Ticket: TOKI-003

## Goal
The builder needs the three backing services of Toki (database, file storage, mail catcher) on the development machine, started with one command.
The builder also needs a safe way back to a clean state, for one kind of data or for all of it.
Later foundation work, starting with TOKI-005, relies on these services being available locally.

## Scope
- In: `infra/docker-compose.dev.yml` with Postgres, MinIO and Mailpit; the six root scripts `dev:up`, `dev:down`, `dev:reset:db`, `dev:reset:files`, `dev:reset:mail`, `dev:reset`; the guards that keep a reset away from `.env`, the test database and production.
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
  - The root `pnpm dev` script: TOKI-001 creates it (decision of 2026-11-12). The intent does not ask for it here.
- Plan change: TOKI-003 now also needs TOKI-096 (decision of 2026-11-12); the Blueprint plan must be updated.

## Requirements
- R1. `infra/docker-compose.dev.yml` exists and defines three services: Postgres 17, MinIO and Mailpit. Check: `docker compose -f infra/docker-compose.dev.yml config --services` lists exactly three names.
- R2. `pnpm dev:up` starts the three services and exits 0 only when all three are healthy. Check: `docker compose -f infra/docker-compose.dev.yml ps` shows three running services.
- R3. `pnpm dev:up` run a second time exits 0 and leaves existing data unchanged.
- R4. `pnpm dev:down` stops the three services and keeps their data. Check: write one table row, one stored file and one caught mail; run `dev:down` then `dev:up`; all three are still there.
- R5. `pnpm dev:reset:db` leaves the development database with no table and no row from before. It wipes only the development database: it never drops the Postgres server, the volume or the test database. Stored files and caught mail are unchanged. In this ticket the script is a wipe only; TOKI-005 adds the "re-run migrations" step (concern 1).
- R6. `pnpm dev:reset:files` leaves the development bucket present and holding zero objects. The database and caught mail are unchanged.
- R7. `pnpm dev:reset:mail` leaves the Mailpit inbox with zero messages. The database and stored files are unchanged.
- R8. `pnpm dev:reset` runs the three resets in one command. Check: afterwards the checks of R5, R6 and R7 all pass.
- R9. `pnpm dev:reset` exits non-zero and names the failed step when any of the three resets fails.
- R10. Each of the four reset scripts refuses to run in production. Check: with the production signal set (concern 2), the script exits non-zero, prints a refusal message and changes no data.
- R11. No reset changes `.env`. Check: the checksum of `.env` is the same before and after `pnpm dev:reset`.
- R12. No reset touches the test database. Check: a marker row written to the test database is still there after `pnpm dev:reset`. The test database is a second database, under another name, on the same development Postgres server; TOKI-008 creates it (concern 3).
- R13. Mail sent to the Mailpit SMTP port is caught and readable on the development machine. Check: send one mail to an outside address; it appears in the Mailpit web inbox.
- R14. The compose file sets no mail relay. Check: `infra/docker-compose.dev.yml` holds no relay or outside SMTP setting.
- R15. The compose file holds no credential value; it reads them from `.env`. Check: every credential in `docker-compose.dev.yml` is a `${...}` reference.
- R16. The root `package.json` holds the six scripts named in Scope and no `dev:seed` script. Check: `pnpm run` lists the six.
- R17. The compose file and the dev scripts read only environment variables named in the TOKI-096 inventory; this ticket invents no variable name. Check: every `${...}` name in `infra/docker-compose.dev.yml` and every variable the scripts in `infra/dev/` read appears in the TOKI-096 inventory.

## Design
### Errors
- Docker is not running or not installed -> the script exits non-zero and says so.
- A value the compose file needs is missing from `.env` -> `dev:up` exits non-zero and prints the name of the missing variable.
- A reset is run while the service it needs is stopped -> the script exits non-zero, says to run `pnpm dev:up` first and changes nothing.
- A reset is run in production -> refusal, as in R10. The guard runs before any other step.
- One step of `dev:reset` fails -> the remaining steps still run, then the script exits non-zero (R9). Assumption: run all, report at the end.

### Layout
```
toki/
├─ package.json                 the six dev:* scripts
└─ infra/
   ├─ docker-compose.dev.yml    Postgres 17, MinIO, Mailpit, one named volume each
   └─ dev/                      the reset scripts and the shared production guard
```
- Data lives in named Docker volumes, so `dev:down` (stop without removing volumes) keeps it.
- `dev:reset:db` drops and recreates only the development database by name. It never removes the Postgres server or its volume, so the test database, which is a second database under another name on the same server, survives. It runs no migration; TOKI-005 adds that step.
- `dev:reset:files` deletes every object in the development bucket and keeps the bucket.
- `dev:reset:mail` deletes all messages through Mailpit; it does not restart the container.
- One shared guard is called first by every reset script; `dev:reset` calls the three scripts, it does not copy them.
- Assumption: the folder name `infra/dev/` and the script language. The Blueprint fixes only the compose path and the script names.
- Variable names for the database, the bucket, credentials and ports are the ones in the TOKI-096 inventory (R17).
- Assumption: `dev:up` creates the development bucket when it is missing, so `dev:reset:files` always has a bucket to empty.

## Testing
- Each requirement is checked by hand once on the builder's machine with the command named in it; the output goes in the PR description.
- R10 is checked for all four reset scripts with the production signal set, against services that hold fake marker data.
- R4 to R8 use fake data only: one marker row, one small text file, one mail to a made-up address.
- No automated test is added here. The test harness arrives in TOKI-008 and CI in TOKI-007.

## Data safety
- Credentials for the three services live in `.env`, which git ignores. The compose file and scripts hold no credential value.
- Caught mail stays in Mailpit on the development machine. Nothing relays it.
- Reset scripts print no credential value.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| The services are Postgres, MinIO and Mailpit, run from `infra/docker-compose.dev.yml` | R1, Layout |
| The commands are scripts in the root `package.json` | R16 |
| `dev:up` starts the services | R2, R3 |
| `dev:down` stops them and keeps data | R4, named volumes in Layout |
| `dev:reset:db` wipes Postgres and re-runs migrations | R5 for the wipe. TOKI-003 ships the wipe only; TOKI-005 adds the migration step (decision of 2026-11-12, concern 1) |
| `dev:reset:files` empties the MinIO bucket | R6 |
| `dev:reset:mail` clears the Mailpit inbox | R7 |
| `dev:reset` does all three | R8, R9 |
| No reset touches `.env` or the test database. Every reset refuses to run in production | R11, R12, R10; the test database location is decided (concern 3); the open part is concern 2 |
| A partial reset can leave references between the three. `dev:reset` is the one that returns a clean state | R5 to R7 each change one store only; R8 is the clean state. No cross-store cleanup is built |
| Sample data is not part of this ticket: `dev:seed` comes in TOKI-081 | Scope (Out), R16 |
| The agreed stack names Postgres 17 and MinIO. Development uses Mailpit | R1; image tags for MinIO and Mailpit in concern 5 |
| Secrets live in `.env`, never in git | R15, R17, Data safety |
| Milestone: M1 Foundation and design system. The M1 exit check includes "pnpm dev runs" | Planning fact. This spec delivers the services only. TOKI-001 owns the root `pnpm dev` script; whether it starts the services is still open (concern 6) |
| Size: M (about one working session with Claude) | Planning fact; no design impact. Scope is kept to one compose file and six scripts |
| Needs: TOKI-001 | Planning fact. The root `package.json` from TOKI-001 must exist before R16. TOKI-003 now also needs TOKI-096 for the variable names (R17, plan change in Scope) |
| Needed by: TOKI-005 | R2 gives TOKI-005 a running Postgres; TOKI-005 adds the migration step to `dev:reset:db` (concern 1) |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; no design impact. Neighbouring tickets are listed in Scope (Out) |

## Open questions from the intent
- What does `dev:reset:db` do before TOKI-005 is done? Answered: it is a wipe only; TOKI-005 adds the "re-run migrations" step. See concern 1.

## Areas of concern
1. `dev:reset:db` must re-run migrations, but the migration workflow arrives in TOKI-005, which needs this ticket. Options: ship the wipe only and let TOKI-005 add the migration step, or call a migration script that is skipped while it is missing. Decided: TOKI-003 ships `dev:reset:db` as a wipe only. TOKI-005 adds the "re-run migrations" step to `dev:reset:db`. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
2. The Blueprint does not say how a reset knows it is in production (which variable, which value), or whether it should also refuse when the signal is missing. R10 cannot be built without this. Owner: Thanh Truong.
3. The Blueprint does not say where the test database lives (same Postgres server under another name, or a separate one); TOKI-008 owns it and comes later. R12 can only be fully checked then. Decided: the test database is a second database, under another name, on the same development Postgres server. `dev:reset:db` wipes only the development database; it never drops the server, the volume or the test database. TOKI-008 still owns creating the test database. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
4. The compose file needs variable names for the database, the bucket, credentials and ports. TOKI-096 owns the inventory and `.env.example` but is not listed as a need of TOKI-003. Either TOKI-096 goes first, or this ticket picks names that TOKI-096 then adopts. Decided: TOKI-096 is done first and names every phase 1 variable. TOKI-003 uses exactly the names in the TOKI-096 inventory and invents none. Plan change: TOKI-003 now also needs TOKI-096. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
5. The Blueprint names Postgres 17 but gives no version for MinIO or Mailpit, and no host ports. Unpinned images can change under the builder. Owner: Thanh Truong.
6. The M1 exit check says "pnpm dev runs". The Blueprint does not say whether `pnpm dev` starts the services itself or expects `dev:up` first, or which ticket owns `pnpm dev`. Answered in part: TOKI-001 creates the root `pnpm dev` script; it runs the `dev` script of every workspace project that has one. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Still open: whether `pnpm dev` also starts the services or expects `dev:up` first. Owner: Thanh Truong.
7. The Blueprint does not say whether a reset asks for confirmation before it deletes data. This spec assumes no prompt, so that scripts and Claude can run it. Owner: Thanh Truong.
8. The Blueprint does not say who creates the MinIO bucket. This spec assumes `dev:up` does; the server (a later ticket) could own it instead. Owner: Thanh Truong.
