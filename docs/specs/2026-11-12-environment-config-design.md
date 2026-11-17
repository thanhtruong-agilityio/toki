# Environment configuration design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/environment-config.md (Thanh Truong)
Ticket: TOKI-096

## Goal
The builder and whoever operates the server need one complete list of the configuration values Toki needs. Today no such list exists, so nobody can tell which values are needed, which are missing, or who must supply them. This work writes that list, a matching `.env.example`, the list of values that come from outside, and the rules for keeping secrets in each environment.

## Scope
- In: the inventory of the phase 1 environment variables, including the connection value for the test database; `.env.example` matching it (this work creates the file); the list of external values (domain, mail account, VPS; backup storage is dropped, concern 4); a written rule for how secrets are kept in development and in production.
- Out (not now):
  - Reading and validating the variables, and refusing to start when one is missing: TOKI-004.
  - The development services (Postgres, MinIO, Mailpit) and the reset scripts: TOKI-003.
  - The Postgres connection and migrations: TOKI-005. Sending mail over SMTP: TOKI-021.
  - Creating the workspace, the first admin and #general on an empty database (flow F01): TOKI-020 "First admin from environment variables" (M2). This work only lists the values that flow needs, and TOKI-020 reads exactly those names.
  - The production image and Compose: TOKI-084. Automated deploy: TOKI-085. The installation guide: TOKI-087, which points to the `.env.example` made here and writes no second one (Blueprint, ticket TOKI-087).
  - `CLAUDE.md` and the `docs/` folders: TOKI-095.
  - Choosing the VPS provider and region and the domain. This work records each as an external value with an owner; it does not decide them. The mail account is decided (concern 1). Backup storage is not part of this work (concern 4).
  - `.gitignore`: owned by TOKI-001, which sets the patterns `.env`, `.env.*`, `!.env.example` (decision of 2026-11-13). This work adds no `.gitignore` and only checks that `.env.example` is not ignored (R8).
  - Any environment other than development and production, except the connection value for the test database, which the inventory lists (see concern 6). Its CI value is written directly in the CI workflow, not in this work (R13).
  - Variables that only later phases need (video, the dedicated mail service with inbound mail, AI). The inventory covers phase 1 only (see concern 7). SMTP for sign-in mail is phase 1 and in scope.
- Plan change: TOKI-003 and TOKI-006 now also need TOKI-096 (decision of 2026-11-12); the Blueprint plan must be updated.

## Requirements
- R1. An inventory file exists with one row per environment variable and these columns: Name, Purpose, Read by, Required, Default, Development value, Supplied by, Secret.
- R2. The inventory has at least one row for each category in "Categories to cover" below, or a line that states why the category needs no variable. The SMTP category is phase 1 and cannot be waived. Each of the two values "first admin email" and "first admin name" has its own row.
- R3. `.env.example` exists, and the set of variable names in it equals the set of names in the inventory. A non-secret entry holds the row's Development value (which is the Default when the row has one); a secret entry is empty (R9). Check: the two sorted name lists are identical, and each non-secret value equals the inventory's Development value.
- R4. Every inventory row that production reads and has Required = yes has a non-empty "Supplied by". For the values of the first installation it names a person. For rows that differ per installation (domain, workspace name, mail account) it names a role (for example "the operator of that installation"). For domain, mail account and VPS the owner is recorded in the external values list (R6), which is the source; the inventory row points to it.
- R5. Every inventory row that development reads and has Required = yes has a development value in hand. Check: a local `.env` filled by following the inventory has no unset and no empty required variable. A secret in development is a throwaway local value chosen by the builder when filling `.env`; no development service supplies it.
- R6. An external values list exists with one row each for domain, mail account and VPS, and these columns: Value needed, Owner, Status (in hand or open), Needed before. It has no backup storage row: backup is deferred to a later phase (concern 4). The mail account is decided (concern 1); its row names Thanh Truong as owner and holds no address. The VPS provider and region (concern 2) and the domain (concern 4) are marked "external, owner Thanh Truong", are needed before the phase 1 deploy, and may have the status open when this ticket merges; they do not block merge. Decided by Thanh (lead) on 2026-11-16 and 2026-11-17.
- R7. A "How secrets are kept" section exists with one entry for development and one for production. The development entry states where the `.env` file lives, who may read it, and that it is never committed. The production entry states that the `.env` file lives on the server of that installation and is never committed; its exact place on the server, who may read it, how it is backed up and where the deploy gets its secrets are left to TOKI-085 "Automated deploy" (concern 9).
- R8. `.env`, `.env.local` and `apps/server/.env` are ignored by git and `.env.example` is not, under the TOKI-001 patterns. Check: `git check-ignore` prints the path for the first three and nothing for `.env.example`. If TOKI-001 is not merged when this work is reviewed, R8 is recorded as pending and run when it merges.
- R9. No file committed by this work holds a secret or a real credential value. Check: every row with Secret = yes has an empty value in `.env.example` and no value in the inventory; and, independent of the flag, a search of the committed files for credential-like values (a `://user:password@` form, long random strings, key prefixes) finds none. A row whose value holds a password, such as a connection URL, is marked Secret = yes. The first admin email is personal data: `.env.example` and the inventory hold only a fake address on a reserved test domain, or leave it empty.
- R10. Every phase 1 variable that TOKI-003, TOKI-004, TOKI-005, TOKI-006 and TOKI-008 read is named in the inventory before those tickets start. Check at this ticket's close: this work is merged before any of the five starts. The other half, that none of them uses a name outside the inventory, is checked in each ticket's own review (TOKI-003 R17, TOKI-004 R13; the specs of TOKI-005, TOKI-006 and TOKI-008 state the same). When one of them finds it needs a variable that is missing, it adds the row and the `.env.example` line in its own PR (concern 10).
- R11. The database connection is one URL variable, `DATABASE_URL` (Secret = yes, read by the server), plus `TEST_DATABASE_URL` for tests (Secret = yes, read by tests). The inventory has no separate rows for the parts of the app connection (host, port, user, password, name). The Postgres service credentials read by compose stay as their own rows. Check: both rows exist, `TEST_DATABASE_URL` Purpose names the test database, and no app-connection parts row exists. Decided by Thanh (lead) on 2026-11-16.
- R12. The server rows are: port (default 3000), bind host (default `127.0.0.1`; containers set `0.0.0.0`), environment name, and log level. The development host ports default to web 5173, Postgres 5432 and MinIO 9000. Check: each of these rows exists with that Default. Decided by Thanh (lead) on 2026-11-16.
- R13. The CI value of `TEST_DATABASE_URL` is written directly in the CI workflow. It is a throwaway value, uses no repository secret, and its database name ends in `_test`. A throwaway value is allowed for a Secret = yes row only in CI; no other file may hold one (R9). Check: the CI workflow (TOKI-008) holds the value with no `secrets.` reference and a name ending in `_test`. Decided by Thanh (lead) on 2026-11-16.

## Design
### Inventory columns
- Name: the variable name. The Blueprint names no variable, so every phase 1 name is chosen in this work. TOKI-003, TOKI-004, TOKI-005 and TOKI-006 use exactly these names and invent none (see concern 7).
- Purpose: one sentence.
- Read by: which consumer reads the variable: server (TOKI-004), compose and dev scripts (TOKI-003), web dev server (TOKI-006) or tests (TOKI-008). A row can name more than one. The environments the row applies to follow from it (the test database connection is read by tests only).
- Required: yes or no, for the consumers in Read by. For a server row, TOKI-004 stops the server when a required variable is missing. Unset and empty both count as missing, so `cp .env.example .env` with a secret left empty is missing. A row the server does not read (compose credentials, test database connection) is not checked by TOKI-004.
- Default: the value used when the variable is unset. It must be safe in every environment, including production, or "none". Never a secret. A value that only suits development goes in Development value, not here, so a production server with the variable unset still counts it as missing.
- Development value: the non-secret value for development, which `.env.example` holds. Empty for a secret (see R5).
- Supplied by: who provides the value in production (see R4).
- Secret: yes or no. Assumption: this column, Read by and Development value are added to the five the ticket lists, so that R5, R9 and R4 can be checked.

### Categories to cover
Derived from the Blueprint technical design, flow F01 and the variables the sibling specs hand to this inventory (TOKI-003 "Design", TOKI-004 concern 2, TOKI-006 concern 1, TOKI-008 concern 4). These are kinds of value, not variable names.
- Server (read by TOKI-004): the port, the bind host, the environment name and the log level (R12). The environment name is also the production signal that the reset guard reads; allowed values `development` and `production` (TOKI-003 R10).
- Database connection (Postgres): one URL variable, `DATABASE_URL` (R11, concern 11).
- Postgres service (read by compose): user, password, development database name.
- Test database: the test database name (read by the reset guard, TOKI-003 R24) and the connection value `TEST_DATABASE_URL` (read by tests, TOKI-008). The test database is a second database, under another name, on the same development Postgres server.
- File storage (S3-compatible; MinIO in development): MinIO root user and password, development bucket name.
- Host ports of the three development services (Postgres, MinIO, Mailpit): one variable per published port (TOKI-003 R25); defaults in R12. The web dev server has no variable of its own: its proxy target for `/api/v1` (TOKI-006 R7) is derived from the server port.
- Mail over SMTP (Mailpit in development), including the sender address as its own variable (concern 1).
- First admin email.
- First admin name.
- Workspace name.
- Domain.
- Backup storage: no variable in phase 1. Backup is deferred to a later phase (Blueprint decision D-092; concern 4).

### Layout
The Blueprint does not say where these files live. The places below follow the TOKI-095 spec, R6 (concern 8). `.gitignore` is TOKI-001's and is not part of this work.
```
toki/
├─ .env.example            names from the inventory, no secret values
└─ docs/
   └─ environment-config.md   inventory, external values list, how secrets are kept
```

## Testing
- No test harness exists yet (TOKI-008 comes later), so the checks are run by hand and their output is pasted into the PR.
- R3: extract the names from the inventory and from `.env.example`, sort both, compare. The lists must be identical; then compare each non-secret value with the inventory's Development value. The check stays manual in this ticket: no script and no CI check (decided by Thanh (lead) on 2026-11-16; scope is fixed by the ticket; concern 10).
- R8: run the `git check-ignore` commands.
- R9: also search the committed files for credential-like values, without using the Secret column.
- R1, R2, R4, R6, R7, R9: read the file against each requirement, row by row.
- R11, R12: read the inventory for the rows and Defaults named there, and confirm no app-connection parts row exists.
- R13: read the CI workflow when TOKI-008 adds it; the value must carry no `secrets.` reference and a name ending in `_test`. Pending until then.
- R5: fill a local `.env` from the inventory and confirm no required variable is empty. Fake or local-only values only.
- R10: confirm this work is merged before TOKI-003, TOKI-004, TOKI-005, TOKI-006 and TOKI-008 start. The name check belongs to each of those tickets' reviews, not to this ticket's close.

## Data safety
- Secrets live in `.env`, never in git.
- The inventory, `.env.example` and this spec hold no secret and no real credential value, not even as an example. The only exception is a fake first admin email on a reserved test domain (R9).
- A value marked Secret is never pasted into a ticket, a PR, a log or a chat.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint intent I17 environment-config, one ticket by decision: TOKI-096 | Scope. All of this spec is one piece of work; it is not split. |
| Milestone M1, whose goal includes "its configuration is known" | Planning fact; no design impact. R1 to R7 make the configuration known. |
| Size M (about one working session with Claude) | Scope. Only documents and `.env.example`; no server code. |
| Needs no other ticket; needed by TOKI-004 and TOKI-087 | Planning fact. R1 gives TOKI-004 the Required column; R6 and R7 give TOKI-087 its inputs, and TOKI-087 reuses the `.env.example` made here. By the decision of 2026-11-12, TOKI-003 and TOKI-006 now also need this ticket (Scope, plan change; R10). |
| Scope fixed by the ticket | Scope "In" lists the same four items and nothing else; `.gitignore` is TOKI-001's (Scope "Out"). |
| Inventory of every environment variable: name, purpose, required or not, default, who supplies it | R1, R2, R4, R10, R11. The inventory covers phase 1 only (concern 7). |
| `.env.example` matching the inventory | R3 (names and values). |
| The list of values that must come from outside: domain, mail account, VPS, backup storage | R6, for domain, mail account and VPS. Backup storage is dropped from this work: backup is deferred to a later phase (D-092; concern 4). |
| How secrets are kept per environment | R7. The details of the production `.env` are left to TOKI-085 (concern 9). |
| Secrets live in `.env`, never in git | R8, R9, Data safety. |
| Each company runs its own copy on one VPS (single-tenant, self-hosted) | One production `.env` per installation (R7). Domain and workspace name are per-installation rows (R2); their Supplied by names a role (R4). |
| Mail goes through configurable SMTP; development uses Mailpit | SMTP category in R2; development values point at the local service (R5). |
| The first admin and #general are created from environment variables when the database is empty | First admin and workspace name categories in R2. |
| This file holds no secret and no real credential value | R9, Data safety. |

## Open questions from the intent
- 1. Which account sends sign-in emails? Answered: Thanh Truong's own Gmail account, set through the SMTP environment variables; no committed file holds the address or the password. Decided by Thanh on 2026-11-17. See concern 1.
- 2. Which VPS provider and region? Accepted as an external value: owner Thanh Truong, tracked in R6, chosen before the phase 1 deploy; it does not block merge. Accepted by Thanh on 2026-11-17. See concern 2.
- 3. Which environments are in scope? Development and production. Source: the intent (question 3) and Blueprint intent I17 "Done", which name only these two. Test and CI are not mentioned there. Answered: the inventory also lists the connection value for the test database, and its CI value is written in the CI workflow (R13, concern 6). Decided by Thanh (lead) on 2026-11-16.
- 4. Who are the named owners of the production values? Answered: Thanh Truong for every production value of the first installation; rows that differ per installation name the role "the operator of that installation". Decided by Thanh on 2026-11-17. See concern 3.
- 5. What are the domain and the backup storage? Answered: the domain is accepted as an external value, owner Thanh Truong, tracked in R6, chosen before the phase 1 deploy; backup storage is dropped from this work because backup is deferred (D-092). Decided by Thanh on 2026-11-17. See concern 4.
- 6. Can this ticket close while questions 1 and 2 are open? Yes. Items 1 and 2 are external, owner Thanh Truong, tracked in R6, and do not block merge. Decided by Thanh (lead) on 2026-11-16. See concern 5.

## Areas of concern
1. The account that sends sign-in emails is not decided in the Blueprint, which wants it decided before the phase 1 deploy and only suggests a company Google account. Decided: the first installation sends sign-in mail from Thanh Truong's own Gmail account, set through the SMTP environment variables; the sender address is its own variable in the SMTP rows of the inventory. The address and its password are kept only in `.env`; no committed file holds them (R9). The mail account row of the external values list names Thanh Truong as owner (R6). Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Owner: Thanh Truong.
2. The VPS provider and region are not decided. The Blueprint wants them decided before the phase 1 deploy, suggests Singapore or Vietnam as the region, and says the Docker Compose setup is provider-neutral. Accepted: they are an external value, owner Thanh Truong, tracked in R6 and chosen before the phase 1 deploy; they do not block merge of TOKI-096. Accepted by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Owner: Thanh Truong.
3. No production owner was named for any value, so R4 could not pass. Decided: Thanh Truong owns every production value of the first installation. A row that differs per installation (domain, workspace name, mail account) names the role "the operator of that installation" (R4). Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Owner: Thanh Truong.
4. The domain and the backup storage had no value and no owner, and it was not stated whether backup storage is configured through environment variables at all. Domain. Accepted: it is an external value, owner Thanh Truong, tracked in R6 and chosen before the phase 1 deploy; it does not block merge of TOKI-096. Backup storage. Decided: it is not part of this work. Backup is deferred to a later phase, so the external values list has no backup storage row and phase 1 has no environment variable for backup (R2, R6); where backups are stored and how that is configured are decided with backup in that later phase. Evidence: Toki Blueprint, decision D-092 "Backup and recovery" (Deferred, 13 Nov 2026); Plan tab, ticket TOKI-096, whose list of values from outside is "domain, mail account, VPS" and whose note reads "The spec asks for a backup storage value; backup is deferred (D-092)". Decided by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Owner: Thanh Truong.
5. Can the ticket close while concerns 1 and 2 are open? Decided: yes. The mail account and the VPS provider are external, owner Thanh Truong, tracked in R6, and do not block merge. Decided by Thanh (lead) on 2026-11-16. Owner: Thanh Truong.
6. Test and CI environments. The test database is a second database, under another name, on the same development Postgres server, and the inventory includes `TEST_DATABASE_URL` for it (R11). Decided by Thanh (lead, as product owner) on 2026-11-12: TOKI-008 adds the Postgres service and the end-to-end job to the CI workflow (ci-pipeline concerns 1 and 5; test-harness R13), and the TOKI-007 workflow uses no `secrets.` and no `.env` file (ci-pipeline R11). Decided by Thanh (lead) on 2026-11-16: the CI value of the test database connection is written directly in the CI workflow, is throwaway, uses no repository secret, and its database name ends in `_test`; a throwaway value is allowed for a Secret = yes row only in CI (R13). Closed. Owner: Thanh Truong.
7. The Blueprint names no environment variable, and it is not stated whether the inventory covers phase 1 only or later phases too (video, mail, AI). The names chosen here bind TOKI-004. Decided: TOKI-096 is done first and names every phase 1 variable; the inventory covers phase 1 only. TOKI-003, TOKI-004, TOKI-005 and TOKI-006 use exactly the names in the TOKI-096 inventory and invent none (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
8. The file locations in Layout were assumptions, because TOKI-095 decides where documents live and the two tickets have no order between them. Answered: the inventory, the external values list and "How secrets are kept" are one file, `docs/environment-config.md`, and `.env.example` is at the repository root. Evidence: the TOKI-095 spec (`docs/specs/2026-11-12-claude-project-setup-design.md`), R6: a reference document is one file `docs/<topic>.md`, and "this is the place that TOKI-096 uses for `docs/environment-config.md`"; R8 of this spec, which keeps `.env` at the root beside `.env.example`. Owner: Thanh Truong.
9. The Blueprint says only that secrets live in `.env`. It does not say where the production `.env` is stored, who may read it, how it is backed up, or where the deploy on merge to `main` gets its secrets. Accepted: this work states only that the production `.env` lives on the server of that installation and is never committed (R7). Its exact place on the server, who may read it, how it is backed up and where the deploy gets its secrets are decided in TOKI-085 "Automated deploy" (M6). Accepted by Thanh (Thanh Truong, lead, as product owner) on 2026-11-17. Owner: Thanh Truong.
10. No rule was stated for who updates the inventory and `.env.example` when a later ticket adds a variable, so R3 can drift after this work ends. Answered from the Blueprint plan: a later ticket adds its own variable to this ticket's list and `.env.example` (ticket TOKI-074 "Web Push" adds the VAPID keys "to the configuration list and `.env.example` of TOKI-096"). The rule recorded here: the ticket that needs a new variable adds the row and the `.env.example` line in its own PR, and TOKI-087 reuses the same file. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-074 and TOKI-087. Decided by Thanh (lead) on 2026-11-16: the R3 name comparison stays a manual check in this ticket, with no script and no CI check. Closed. Owner: Thanh Truong.
11. The shape of the database connection. Decided: one URL variable, `DATABASE_URL`, plus `TEST_DATABASE_URL` for tests; no parts rows for the app connection. The Postgres service credentials that compose reads stay as their own rows (R11). Decided by Thanh (lead) on 2026-11-16. Closed. Owner: Thanh Truong.
12. Default values. Decided: server port 3000, web 5173, Postgres 5432, MinIO 9000; the server rows also include bind host (default `127.0.0.1`; containers set `0.0.0.0`), environment name and log level (R12). Decided by Thanh (lead) on 2026-11-16. Not covered by this decision: the Mailpit host ports (TOKI-003 R25); they are not fixed yet and the owner is Thanh Truong. Owner: Thanh Truong.
13. Placeholder wording. Decided: every secret in `.env.example` is an empty value, not a placeholder (R3, R9). TOKI-005 is aligned to this in its own PR. Decided by Thanh (lead) on 2026-11-16. Closed here. Owner: Thanh Truong.
