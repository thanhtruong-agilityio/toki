# Environment configuration design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/environment-config.md (Thanh Truong)
Ticket: TOKI-096

## Goal
The builder and whoever operates the server need one complete list of the configuration values Toki needs. Today no such list exists, so nobody can tell which values are needed, which are missing, or who must supply them. This work writes that list, a matching `.env.example`, the list of values that come from outside, and the rules for keeping secrets in each environment.

## Scope
- In: the inventory of the phase 1 environment variables, including the connection value for the test database; `.env.example` matching it (this work creates the file); the list of external values (domain, mail account, VPS, backup storage); a written rule for how secrets are kept in development and in production.
- Out (not now):
  - Reading and validating the variables, and refusing to start when one is missing: TOKI-004.
  - The development services (Postgres, MinIO, Mailpit) and the reset scripts: TOKI-003.
  - The Postgres connection and migrations: TOKI-005. Sending mail over SMTP: TOKI-021.
  - Creating the workspace, the first admin and #general on an empty database (flow F01): TOKI-020 "First admin from environment variables" (M2). This work only lists the values that flow needs, and TOKI-020 reads exactly those names.
  - The production image and Compose: TOKI-084. Automated deploy: TOKI-085. The installation guide: TOKI-087, which points to the `.env.example` made here and writes no second one (Blueprint, ticket TOKI-087).
  - `CLAUDE.md` and the `docs/` folders: TOKI-095.
  - Choosing the mail account, the VPS provider and region, the domain and the backup storage. This work records each as open with an owner; it does not decide them.
  - `.gitignore`: owned by TOKI-001, which sets the patterns `.env`, `.env.*`, `!.env.example` (decision of 2026-11-13). This work adds no `.gitignore` and only checks that `.env.example` is not ignored (R8).
  - Any environment other than development and production, except the connection value for the test database, which the inventory lists (see concern 6). Where the CI value of that connection comes from is still open.
  - Variables that only later phases need (video, the dedicated mail service with inbound mail, AI). The inventory covers phase 1 only (see concern 7). SMTP for sign-in mail is phase 1 and in scope.
- Plan change: TOKI-003 and TOKI-006 now also need TOKI-096 (decision of 2026-11-12); the Blueprint plan must be updated.

## Requirements
- R1. An inventory file exists with one row per environment variable and these columns: Name, Purpose, Read by, Required, Default, Development value, Supplied by, Secret.
- R2. The inventory has at least one row for each category in "Categories to cover" below, or a line that states why the category needs no variable. The SMTP category is phase 1 and cannot be waived. Each of the two values "first admin email" and "first admin name" has its own row.
- R3. `.env.example` exists, and the set of variable names in it equals the set of names in the inventory. A non-secret entry holds the row's Development value (which is the Default when the row has one); a secret entry is empty (R9). Check: the two sorted name lists are identical, and each non-secret value equals the inventory's Development value.
- R4. Every inventory row that production reads and has Required = yes has a non-empty "Supplied by". For the values of the first installation it names a person. For rows that differ per installation (domain, workspace name, mail account) it names a role (for example "the operator of that installation"). For domain, mail account, VPS and backup storage the owner is recorded in the external values list (R6), which is the source; the inventory row points to it.
- R5. Every inventory row that development reads and has Required = yes has a development value in hand. Check: a local `.env` filled by following the inventory has no unset and no empty required variable. A secret in development is a throwaway local value chosen by the builder when filling `.env`; no development service supplies it.
- R6. An external values list exists with one row each for domain, mail account, VPS and backup storage, and these columns: Value needed, Owner, Status (in hand or open), Needed before.
- R7. A "How secrets are kept" section exists with one entry for development and one for production. Each entry states where the `.env` file lives, who may read it, and that it is never committed.
- R8. `.env`, `.env.local` and `apps/server/.env` are ignored by git and `.env.example` is not, under the TOKI-001 patterns. Check: `git check-ignore` prints the path for the first three and nothing for `.env.example`. If TOKI-001 is not merged when this work is reviewed, R8 is recorded as pending and run when it merges.
- R9. No file committed by this work holds a secret or a real credential value. Check: every row with Secret = yes has an empty value in `.env.example` and no value in the inventory; and, independent of the flag, a search of the committed files for credential-like values (a `://user:password@` form, long random strings, key prefixes) finds none. A row whose value holds a password, such as a connection URL, is marked Secret = yes. The first admin email is personal data: `.env.example` and the inventory hold only a fake address on a reserved test domain, or leave it empty.
- R10. Every phase 1 variable that TOKI-003, TOKI-004, TOKI-005, TOKI-006 and TOKI-008 read is named in the inventory before those tickets start. Check at this ticket's close: this work is merged before any of the five starts. The other half, that none of them uses a name outside the inventory, is checked in each ticket's own review (TOKI-003 R17, TOKI-004 R13; the specs of TOKI-005, TOKI-006 and TOKI-008 state the same). When one of them finds it needs a variable that is missing, it adds the row and the `.env.example` line in its own PR (concern 10).
- R11. The inventory has a row for the connection value of the test database. Check: the row exists and its Purpose names the test database.

## Design
### Inventory columns
- Name: the variable name. The Blueprint names no variable, so every phase 1 name is chosen in this work. TOKI-003, TOKI-004, TOKI-005 and TOKI-006 use exactly these names and invent none (see concern 7).
- Purpose: one sentence.
- Read by: which consumer reads the variable: server (TOKI-004), compose and dev scripts (TOKI-003), web dev server (TOKI-006) or tests (TOKI-008). A row can name more than one. The environments the row applies to follow from it (the test database connection is read by tests only).
- Required: yes or no, for the consumers in Read by. For a server row, TOKI-004 stops the server when a required variable is missing. Unset and empty both count as missing, so `cp .env.example .env` with a secret left empty is missing. A row the server does not read (compose credentials, test database connection, proxy target) is not checked by TOKI-004.
- Default: the value used when the variable is unset. It must be safe in every environment, including production, or "none". Never a secret. A value that only suits development goes in Development value, not here, so a production server with the variable unset still counts it as missing.
- Development value: the non-secret value for development, which `.env.example` holds. Empty for a secret (see R5).
- Supplied by: who provides the value in production (see R4).
- Secret: yes or no. Assumption: this column, Read by and Development value are added to the five the ticket lists, so that R5, R9 and R4 can be checked.

### Categories to cover
Derived from the Blueprint technical design, flow F01 and the variables the sibling specs hand to this inventory (TOKI-003 "Design", TOKI-004 concern 2, TOKI-006 concern 1, TOKI-008 concern 4). These are kinds of value, not variable names.
- Server (read by TOKI-004): the server port and the environment name. The environment name is also the production signal that the reset guard reads; allowed values `development` and `production` (TOKI-003 R10).
- Database connection (Postgres): see concern 11 for the shape.
- Postgres service (read by compose): user, password, development database name.
- Test database: the test database name (read by the reset guard, TOKI-003 R24) and the connection value (read by tests, TOKI-008). The test database is a second database, under another name, on the same development Postgres server.
- File storage (S3-compatible; MinIO in development): MinIO root user and password, development bucket name.
- Host ports of the three development services (Postgres, MinIO, Mailpit): one variable per published port (TOKI-003 R25).
- Mail over SMTP (Mailpit in development).
- Web dev server: the proxy target for `/api/v1` (TOKI-006 R7).
- First admin email.
- First admin name.
- Workspace name.
- Domain.
- Backup storage.

### Layout
Assumption: the Blueprint does not say where these files live (see concern 8). `.gitignore` is TOKI-001's and is not part of this work.
```
toki/
├─ .env.example            names from the inventory, no secret values
└─ docs/
   └─ environment-config.md   inventory, external values list, how secrets are kept
```

## Testing
- No test harness exists yet (TOKI-008 comes later), so the checks are run by hand and their output is pasted into the PR.
- R3: extract the names from the inventory and from `.env.example`, sort both, compare. The lists must be identical; then compare each non-secret value with the inventory's Development value. The check is manual. No script is added (scope is fixed by the ticket); see concern 10.
- R8: run the `git check-ignore` commands.
- R9: also search the committed files for credential-like values, without using the Secret column.
- R1, R2, R4, R6, R7, R9, R11: read the file against each requirement, row by row.
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
| The list of values that must come from outside: domain, mail account, VPS, backup storage | R6. |
| How secrets are kept per environment | R7. |
| Secrets live in `.env`, never in git | R8, R9, Data safety. |
| Each company runs its own copy on one VPS (single-tenant, self-hosted) | One production `.env` per installation (R7). Domain and workspace name are per-installation rows (R2); their Supplied by names a role (R4). |
| Mail goes through configurable SMTP; development uses Mailpit | SMTP category in R2; development values point at the local service (R5). |
| The first admin and #general are created from environment variables when the database is empty | First admin and workspace name categories in R2. |
| This file holds no secret and no real credential value | R9, Data safety. |

## Open questions from the intent
- 1. Which account sends sign-in emails? Not answered. The Blueprint leaves it open and only suggests a company Google account. Carried forward as concern 1.
- 2. Which VPS provider and region? Not answered. The Blueprint leaves it open. Carried forward as concern 2.
- 3. Which environments are in scope? Development and production. Source: the intent (question 3) and Blueprint intent I17 "Done", which name only these two. Test and CI are not mentioned there. Answered in part: the inventory also lists the connection value for the test database. Where the CI value of that connection comes from is still open; see concern 6.
- 4. Who are the named owners of the production values? Not answered. Carried forward as concern 3.
- 5. What are the domain and the backup storage? Answered in part. Carried forward as concern 4.
- 6. Can this ticket close while questions 1 and 2 are open? Not decided. The Blueprint supports "yes" only as an inference; the lead or the BA must record it. Carried forward as concern 5.

## Areas of concern
1. The account that sends sign-in emails is not decided. The Blueprint wants it decided before the phase 1 deploy. Until then the SMTP rows have no production value. Owner: Thanh Truong.
2. The VPS provider and region are not decided. The Blueprint wants them decided before the phase 1 deploy. Owner: Thanh Truong.
3. No production owner is named for any value, so R4 cannot pass yet. The project has one builder; it is not stated whether that person owns every production value. Owner: Thanh Truong.
4. The domain and the backup storage have no value and no owner. It is also not stated whether backup storage is configured through environment variables at all. Answered in part: where backups are stored is an open item of TOKI-086 "Backup and restore" (M6; "Where backups are stored"), and the infrastructure notes say "Nightly encrypted backups to another provider". So the backup storage value is decided in TOKI-086; this ticket lists it as a value from outside. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-086; Technical design tab, Infrastructure and deployment. Still open: the domain, its owner, and whether backup storage is set through environment variables. Owner: Thanh Truong.
5. It is not stated whether the ticket can close while concerns 1 and 2 are open. Inferred, not decided: the Blueprint dates both open items "Before the phase 1 deploy" and says none of the open items blocks phase 1, while this ticket is in M1; intent I17 "Done" asks for a value for development and "a named owner for production". These support "yes, once each production value has a named owner" only by inference; none states that the ticket may close. The intent's Proposed outcome also says "real values in hand for each environment", which reads the other way. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Questions & Gaps tab, open items; Plan tab, intent I17. The decision log of 2026-11-12 does not decide it. Left open for the BA or the lead to record. It also depends on concern 3. Owner: BA (Thanh Truong as lead).
6. Test and CI environments are not addressed. TOKI-003 mentions a test database and TOKI-007 runs tests in CI, so some configuration may be needed there. Answered in part: the test database is a second database, under another name, on the same development Postgres server, and the inventory must include the connection value for it (R11). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Also decided on 2026-11-12: TOKI-008 adds the Postgres service and the end-to-end job to the CI workflow (ci-pipeline concerns 1 and 5; test-harness R13), and the TOKI-007 workflow uses no `secrets.` and no `.env` file (ci-pipeline R11). Still open, one question: where the CI value of the test database connection comes from (for example a throwaway value written in the workflow), and whether that is allowed for a row marked Secret = yes. Owner: BA (Thanh Truong as lead).
7. The Blueprint names no environment variable, and it is not stated whether the inventory covers phase 1 only or later phases too (video, mail, AI). The names chosen here bind TOKI-004. Decided: TOKI-096 is done first and names every phase 1 variable; the inventory covers phase 1 only. TOKI-003, TOKI-004, TOKI-005 and TOKI-006 use exactly the names in the TOKI-096 inventory and invent none (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
8. The file locations in Layout are assumptions. TOKI-095 decides where documents live, and the two tickets have no order between them. Owner: Thanh Truong.
9. The Blueprint says only that secrets live in `.env`. It does not say where the production `.env` is stored, who may read it, how it is backed up, or where the deploy on merge to `main` gets its secrets. R7 needs these answers. Owner: Thanh Truong.
10. No rule was stated for who updates the inventory and `.env.example` when a later ticket adds a variable, so R3 can drift after this work ends. Answered from the Blueprint plan: a later ticket adds its own variable to this ticket's list and `.env.example` (ticket TOKI-074 "Web Push" adds the VAPID keys "to the configuration list and `.env.example` of TOKI-096"). The rule recorded here: the ticket that needs a new variable adds the row and the `.env.example` line in its own PR, and TOKI-087 reuses the same file. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-074 and TOKI-087. Still open: whether the name comparison of R3 becomes a script run in CI after TOKI-007. Adding it now would go beyond the scope fixed by the ticket. Owner: BA (Thanh Truong as lead).
11. The shape of the database connection is not decided, and it binds three tickets. The compose file needs separate database name, user, password and port (TOKI-003 R15, R17, "Design"); the migrations work uses one connection value (TOKI-005 uses `DATABASE_URL` as a stand-in); R11 here speaks of one connection value for the test database. If both forms are listed, one password sits in two or three variables that can drift. Options, none chosen: parts only; one URL only; or one URL derived from the parts. Not decided in the decision log of 2026-11-12. Owner: BA (Thanh Truong as lead).
12. The default values of the server port and of the three host ports are not fixed. TOKI-006 concern 1 lists the server port default as still open; TOKI-003 R25 takes host ports from this inventory. This ticket has to fix them. Not decided in the decision log of 2026-11-12. Owner: BA (Thanh Truong as lead).
13. Wording of the placeholder rule differs between specs: the TOKI-005 spec (R10, Data safety) says "only a placeholder in `.env.example`" for the connection value, while this spec requires an empty value for every secret (R9). This spec keeps "empty" (R3, R9); the TOKI-005 spec needs the same wording. Owner: Thanh Truong.
