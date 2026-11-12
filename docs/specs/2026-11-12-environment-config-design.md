# Environment configuration design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/environment-config.md (Thanh Truong)
Ticket: TOKI-096

## Goal
The builder and whoever operates the server need one complete list of the configuration values Toki needs. Today no such list exists, so nobody can tell which values are needed, which are missing, or who must supply them. This work writes that list, a matching `.env.example`, the list of values that come from outside, and the rules for keeping secrets in each environment.

## Scope
- In: the inventory of the phase 1 environment variables, including the connection value for the test database; `.env.example` matching it; the list of external values (domain, mail account, VPS, backup storage); a written rule for how secrets are kept in development and in production.
- Out (not now):
  - Reading and validating the variables, and refusing to start when one is missing: TOKI-004.
  - The development services (Postgres, MinIO, Mailpit) and the reset scripts: TOKI-003.
  - The Postgres connection and migrations: TOKI-005. Sending mail over SMTP: TOKI-021.
  - Creating the workspace, the first admin and #general on an empty database (flow F01). This work only lists the values that flow needs.
  - The production image and Compose: TOKI-084. Automated deploy: TOKI-085. The installation guide: TOKI-087.
  - `CLAUDE.md` and the `docs/` folders: TOKI-095.
  - Choosing the mail account, the VPS provider and region, the domain and the backup storage. This work records each as open with an owner; it does not decide them.
  - Any environment other than development and production, except the connection value for the test database, which the inventory lists (see concern 6). What CI needs is still open.
  - Variables that only later phases need (video, mail, AI). The inventory covers phase 1 only (see concern 7).
- Plan change: TOKI-003 and TOKI-006 now also need TOKI-096 (decision of 2026-11-12); the Blueprint plan must be updated.

## Requirements
- R1. An inventory file exists with one row per environment variable and these columns: Name, Purpose, Required, Default, Supplied by, Secret.
- R2. The inventory has at least one row for each category in "Categories to cover" below, or a line that states why the category needs no variable.
- R3. `.env.example` exists, and the set of variable names in it equals the set of names in the inventory. Check: the two sorted name lists are identical.
- R4. Every inventory row with Required = yes has a non-empty "Supplied by" that names a person for production.
- R5. Every inventory row with Required = yes has a development value in hand. Check: a local `.env` filled by following the inventory has no empty required variable.
- R6. An external values list exists with one row each for domain, mail account, VPS and backup storage, and these columns: Value needed, Owner, Status (in hand or open), Needed before.
- R7. A "How secrets are kept" section exists with one entry for development and one for production. Each entry states where the `.env` file lives, who may read it, and that it is never committed.
- R8. `.env` is ignored by git and `.env.example` is not. Check: `git check-ignore .env` matches, `git check-ignore .env.example` does not.
- R9. No file committed by this work holds a secret or a real credential value. Check: every row with Secret = yes has an empty value in `.env.example` and no value in the inventory.
- R10. Every phase 1 variable that TOKI-003, TOKI-004, TOKI-005 and TOKI-006 read is named in the inventory before those tickets start. Check: this work is merged before any of the four starts, and none of the four uses a variable name that is not in the inventory.
- R11. The inventory has a row for the connection value of the test database. Check: the row exists and its Purpose names the test database.

## Design
### Inventory columns
- Name: the variable name. The Blueprint names no variable, so every phase 1 name is chosen in this work. TOKI-003, TOKI-004, TOKI-005 and TOKI-006 use exactly these names and invent none (see concern 7).
- Purpose: one sentence.
- Required: yes or no. TOKI-004 uses this to decide which missing variable stops the server.
- Default: the value used when the variable is unset, or "none". Never a secret.
- Supplied by: who provides the value in production. For development, the row says where the value comes from (a default, or the local development service).
- Secret: yes or no. Assumption: this column is added to the five the ticket lists, so that R9 can be checked.

### Categories to cover
Derived from the Blueprint technical design and flow F01. These are kinds of value, not variable names.
- Database connection (Postgres).
- Test database connection. The test database is a second database, under another name, on the same development Postgres server.
- File storage (S3-compatible; MinIO in development).
- Mail over SMTP (Mailpit in development).
- First admin email and first admin name.
- Workspace name.
- Domain.
- Backup storage.

### Layout
Assumption: the Blueprint does not say where these files live (see concern 8).
```
toki/
├─ .env.example            names from the inventory, no secret values
├─ .gitignore              ignores .env
└─ docs/
   └─ environment-config.md   inventory, external values list, how secrets are kept
```

## Testing
- No test harness exists yet (TOKI-008 comes later), so the checks are run by hand and their output is pasted into the PR.
- R3: extract the names from the inventory and from `.env.example`, sort both, compare. The lists must be identical.
- R8: run the two `git check-ignore` commands.
- R1, R2, R4, R6, R7, R9, R11: read the file against each requirement, row by row.
- R5: fill a local `.env` from the inventory and confirm no required variable is empty. Fake or local-only values only.
- R10: confirm this work is merged before TOKI-003, TOKI-004, TOKI-005 and TOKI-006 start. When each of the four is reviewed, compare the variable names it reads with the inventory; every name must be in the inventory.

## Data safety
- Secrets live in `.env`, never in git.
- The inventory, `.env.example` and this spec hold no secret and no real credential value, not even as an example.
- A value marked Secret is never pasted into a ticket, a PR, a log or a chat.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint intent I17 environment-config, one ticket by decision: TOKI-096 | Scope. All of this spec is one piece of work; it is not split. |
| Milestone M1, whose goal includes "its configuration is known" | Planning fact; no design impact. R1 to R7 make the configuration known. |
| Size M (about one working session with Claude) | Scope. Only documents and `.env.example`; no server code. |
| Needs no other ticket; needed by TOKI-004 and TOKI-087 | Planning fact. R1 gives TOKI-004 the Required column; R6 and R7 give TOKI-087 its inputs. By the decision of 2026-11-12, TOKI-003 and TOKI-006 now also need this ticket (Scope, plan change; R10). |
| Scope fixed by the ticket | Scope "In" lists the same four items and nothing else. |
| Inventory of every environment variable: name, purpose, required or not, default, who supplies it | R1, R2, R4, R10, R11. The inventory covers phase 1 only (concern 7). |
| `.env.example` matching the inventory | R3. |
| The list of values that must come from outside: domain, mail account, VPS, backup storage | R6. |
| How secrets are kept per environment | R7. |
| Secrets live in `.env`, never in git | R8, R9, Data safety. |
| Each company runs its own copy on one VPS (single-tenant, self-hosted) | One production `.env` per installation (R7). Domain and workspace name are per-installation rows (R2). |
| Mail goes through configurable SMTP; development uses Mailpit | SMTP category in R2; development values point at the local service (R5). |
| The first admin and #general are created from environment variables when the database is empty | First admin and workspace name categories in R2. |
| This file holds no secret and no real credential value | R9, Data safety. |

## Open questions from the intent
- 1. Which account sends sign-in emails? Not answered. The Blueprint leaves it open and only suggests a company Google account. Carried forward as concern 1.
- 2. Which VPS provider and region? Not answered. The Blueprint leaves it open. Carried forward as concern 2.
- 3. Which environments are in scope? Development and production. Source: the intent (question 3) and Blueprint intent I17 "Done", which name only these two. Test and CI are not mentioned there. Answered in part: the inventory also lists the connection value for the test database. What CI needs is still open; see concern 6.
- 4. Who are the named owners of the production values? Not answered. Carried forward as concern 3.
- 5. What are the domain and the backup storage? Answered in part. Carried forward as concern 4.
- 6. Can this ticket close while questions 1 and 2 are open? Answered: yes, once each production value has a named owner. See concern 5.

## Areas of concern
1. The account that sends sign-in emails is not decided. The Blueprint wants it decided before the phase 1 deploy. Until then the SMTP rows have no production value. Owner: Thanh Truong.
2. The VPS provider and region are not decided. The Blueprint wants them decided before the phase 1 deploy. Owner: Thanh Truong.
3. No production owner is named for any value, so R4 cannot pass yet. The project has one builder; it is not stated whether that person owns every production value. Owner: Thanh Truong.
4. The domain and the backup storage have no value and no owner. It is also not stated whether backup storage is configured through environment variables at all. Answered in part: where backups are stored is an open item of TOKI-086 "Backup and restore" (M6; "Where backups are stored"), and the infrastructure notes say "Nightly encrypted backups to another provider". So the backup storage value is decided in TOKI-086; this ticket lists it as a value from outside. Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Plan tab, ticket TOKI-086; Technical design tab, Infrastructure and deployment. Still open: the domain, its owner, and whether backup storage is set through environment variables. Owner: Thanh Truong.
5. It is not stated whether the ticket can close while concerns 1 and 2 are open. The Blueprint says neither blocks phase 1, and I17 "Done" asks only for a named owner for production values, but neither says the ticket may close. Answered: yes, once each production value has a named owner. The Blueprint dates both items "Before the phase 1 deploy" and says none of the open items blocks phase 1, while this ticket is in M1; intent I17 "Done" asks for real values for development and only "a named owner for production". Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Questions & Gaps tab, open items; Plan tab, intent I17. This still depends on concern 3: the owners are not named yet. Owner: Thanh Truong.
6. Test and CI environments are not addressed. TOKI-003 mentions a test database and TOKI-007 runs tests in CI, so some configuration may be needed there. Answered in part: the test database is a second database, under another name, on the same development Postgres server, and the inventory must include the connection value for it (R11). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Still open: what configuration CI needs. Owner: Thanh Truong.
7. The Blueprint names no environment variable, and it is not stated whether the inventory covers phase 1 only or later phases too (video, mail, AI). The names chosen here bind TOKI-004. Decided: TOKI-096 is done first and names every phase 1 variable; the inventory covers phase 1 only. TOKI-003, TOKI-004, TOKI-005 and TOKI-006 use exactly the names in the TOKI-096 inventory and invent none (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
8. The file locations in Layout are assumptions. TOKI-095 decides where documents live, and the two tickets have no order between them. Owner: Thanh Truong.
9. The Blueprint says only that secrets live in `.env`. It does not say where the production `.env` is stored, who may read it, how it is backed up, or where the deploy on merge to `main` gets its secrets. R7 needs these answers. Owner: Thanh Truong.
10. No rule says who updates the inventory and `.env.example` when a later ticket adds a variable, so R3 can drift after this work ends. Owner: Thanh Truong.
