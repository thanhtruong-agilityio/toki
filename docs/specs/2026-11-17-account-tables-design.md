# Account tables design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/account-tables.md (Thanh Truong)
Ticket: TOKI-019

## Goal
The builder (Thanh working with Claude) needs the database to hold accounts: who a person is, their role and status, the sign-in codes that were issued, the sessions that are open and the devices that registered for push. Sign-in, the first Admin, member management, sessions and the permission rules all read and write these records, and every conversation table points to the account table. This work adds the four tables in one migration, with the rules of each column kept in the table itself, and states once the conventions that every later server table follows.

## Scope
- In:
  - The tables `users`, `login_codes`, `sessions` and `devices`, their constraints and indexes, and the one migration that creates them after `workspaces`.
  - Their definitions in the server modules that own them (Layout).
  - The conventions for server tables: ids, timestamps, names, soft deactivation, foreign keys, migration names (Design, "Conventions for server tables"), recorded in `apps/server/src/db/README.md` from TOKI-005.
  - Database tests of the tables.
- Out (not now):
  - Everything that reads or writes the tables: the sign-in rules and routes (TOKI-022), the first Admin and the first workspace row (TOKI-020), invitations and member changes (TOKI-024), the list of sessions and the emergency link (TOKI-026), accepting an invitation (TOKI-097), device registration for push (TOKI-074), the permission functions (TOKI-027).
  - The table of invitations: TOKI-024 owns it (concern 1). This work stores no invitation.
  - Columns of features that have their own ticket: job title, time zone, status text, Pause and Focus, look, accent, density and notification switches. Each of those tickets adds its columns in its own migration (concern 8).
  - Seed data. The tables are created empty.
  - The conversation tables (TOKI-028) and every later table.

## Requirements
All times are `timestamptz`. All text limits are character counts. Every check below is a database test (Testing) that sends SQL to a throwaway database made by the TOKI-005 R13 rules, unless it says otherwise.

- R1. One new migration creates `users`, `login_codes`, `sessions` and `devices`, in that order, and no other table. It applies on an empty database after the `workspaces` migration, and on a database that already holds `workspaces` rows without changing them. Check: apply all migrations to an empty database; the four tables exist, and `workspaces` and the four are the only tables outside the migration bookkeeping. Insert a `workspaces` row, apply again; the row is still there.
- R2. The columns of each table are exactly the ones listed in Data model, with their types and null rules. Check: a test reads `information_schema.columns` for the four tables and compares name, type and `is_nullable` with the list; one missing, extra or different column fails the test.
- R3. Every table has `id`, of type `uuid`, as primary key. The table definition gives it a default that makes a UUIDv7 with the generator chosen in TOKI-005 (R8 of that spec). Check: for each table, a test in its module inserts a row through the server database client without an id; the 13th hex digit of the stored id is `7`.
- R4. Every table has `workspace_id`, required, with a foreign key to `workspaces.id`. Check: an insert with a `workspace_id` that is not in `workspaces` fails with a foreign-key error on each table; an insert with no `workspace_id` fails with a not-null error naming the column.
- R5. Every foreign key in these tables refuses to delete the row it points to (`ON DELETE RESTRICT`); no row is deleted by cascade. Check: a test reads `pg_constraint` and finds every foreign key of the four tables with `confdeltype = 'r'`; deleting a `users` row that a `sessions` row points to fails.
- R6. The server writes every time column; the database sets none. No time column has a default. Check: a test reads `information_schema.columns`; every `timestamptz` column of the four tables has a null `column_default`, and an insert that omits `created_at` fails with a not-null error naming the column. A search of the three module `schema.ts` files finds no `defaultNow` and no `now()`.
- R7. `users.email` is required, at most 254 characters, and equal to its own trimmed lower-case form; the table rejects anything else. Two rows of one workspace cannot have the same `email`. Check: tests insert (a) `Minh@Example.com` and get a check-constraint error, (b) ` minh@example.com` with a space and get the same, (c) a 255-character address and get the same, (d) a 254-character lower-case address and succeed, (e) the same address twice in one workspace and get a unique-violation error, (f) the same address in a second workspace and succeed.
- R8. `users.display_name` is required, 1 to 80 characters (D-033). Check: tests insert an empty name and an 81-character name and get check-constraint errors, an 80-character name and a one-character name and succeed. The part of an address before the @ is at most 64 characters by the mail standard, so a name made from it (D-150) always fits; making it is TOKI-020 and TOKI-097.
- R9. `users.role` is `member` or `admin`, required, with no default (D-152, D-090). Check: tests insert `owner`, `guest` and an empty value and get check-constraint errors, insert `member` and `admin` and succeed, and insert no role and get a not-null error.
- R10. `users.status` is `active` or `deactivated`, required, with no default. There is no status `invited` (concern 2). Check: tests insert `invited` and `Active` and get check-constraint errors, insert `active` and `deactivated` and succeed.
- R11. `users.language` is `en` or `vi`, required, and `en` when the insert gives none (D-018). Check: an insert without it stores `en`; an insert of `fr` gets a check-constraint error; `vi` succeeds.
- R12. A deactivated account stays a row. Deactivating changes `status` and nothing else, and the same `id` serves the person again after reactivation (D-094, D-181). Check: a test sets `status` to `deactivated` and back to `active` on a row that has a session and a device; the `id`, `email`, `display_name`, `role` and `created_at` are unchanged and the rows that point to it are still there.
- R13. `login_codes` stores one row per accepted code request with the columns of Data model. `purpose` is `sign_in` or `invitation`, `email` is required and follows the rule of R7, and `user_id` may be empty and, when set, points to `users.id`. Check: tests insert a purpose `other`, an email with capitals, and a `user_id` that is not in `users`, and get a check-constraint, a check-constraint and a foreign-key error; they insert a row with an empty `user_id` and succeed.
- R14. `login_codes.request_hash` and `code_hash` are required and are 64 lower-case hexadecimal characters; `request_hash` is unique across the table. No column holds a code or a request value in clear. Check: tests insert a 63-character value, a value with an upper-case letter and a value with a `g` and get check-constraint errors; a second row with the same `request_hash` gets a unique-violation error; the column list (R2) has no column other than the hash columns that could hold a code.
- R15. `login_codes.wrong_tries` is required, starts at 0 and is between 0 and 5 (D-137). `expires_at` is required and later than `created_at`. `used_at` and `cancelled_at` may be empty. Check: an insert without `wrong_tries` stores 0; 6 and -1 get check-constraint errors; 5 succeeds; an `expires_at` equal to `created_at` gets a check-constraint error.
- R16. `sessions` stores one row per sign-in with the columns of Data model. `user_id` is required and points to `users.id`. `secret_hash` is required, 64 lower-case hexadecimal characters and unique. `kind` is `cookie` or `token`. `user_agent` may be empty and is at most 512 characters. `last_used_at` is required. Check: tests insert a `kind` of `bearer`, a 65-character hash, a duplicate `secret_hash`, a 513-character `user_agent` and a missing `user_id`, and get a check-constraint, a check-constraint, a unique-violation, a check-constraint and a not-null error; a row with no `user_agent` succeeds.
- R17. A session is ended, not deleted: `ended_at` and `ended_reason` are both empty or both set, and `ended_reason` is `signed_out`, `replaced`, `revoked` or `deactivated` (D-158). Check: tests insert `ended_at` without a reason, a reason without `ended_at`, and the reason `expired`, and get check-constraint errors; each of the four reasons with an `ended_at` succeeds.
- R18. A partial index on `sessions (user_id)` for rows with an empty `ended_at` exists, so the list of a person's live sessions and the end of all of them (TOKI-026, TOKI-024) read by person. Check: a test finds the index in `pg_indexes` with its `WHERE ended_at IS NULL` condition.
- R19. Two partial indexes on `login_codes` for rows with purpose `sign_in` exist: one on `(email, created_at)`, for the counts of 5 in 15 minutes and 60 seconds, and one on `(created_at)`, for the removal of old rows (TOKI-022 R4, R5, R48). Check: a test finds both in `pg_indexes` with the `WHERE purpose = 'sign_in'` condition.
- R20. `devices` stores one push registration of a signed-in device with the columns of Data model. `user_id` and `session_id` are required and point to `users.id` and `sessions.id`; `session_id` is unique, so a session has at most one registration. `kind` is `web`, `ios` or `android`. `push_address` is required and is a JSON object. Check: tests insert a `kind` of `desktop`, a second row with the same `session_id`, a `push_address` that is a JSON string, and a `session_id` that is not in `sessions`, and get a check-constraint, a unique-violation, a check-constraint and a foreign-key error; a row with `kind` `web` and an object succeeds.
- R21. The table definitions are in the module that owns each table and are not exported from the module's `index.ts`: `users` in `modules/members/schema.ts`, `login_codes` and `sessions` in `modules/auth/schema.ts`, `devices` in `modules/notifications/schema.ts`. No schema file imports another module's file. Check: `pnpm lint` exits 0 with the files in place; a test or script lists the four table names exported by the three `index.ts` files and finds none; a search of the three `schema.ts` files finds no import that leaves its module folder except `drizzle-orm` and the shared database helpers of `src/db/`.
- R22. The foreign keys that cross a module boundary (R4, `login_codes.user_id`, `sessions.user_id`, `devices.user_id`, `devices.session_id`) are written as SQL in the migration file, with the names `<table>_<column>_fkey`, because a schema file may not import another module's table. Check: a test finds all of them in `pg_constraint` by those names (R4, R5), and `pnpm db:generate` run again after the migration is applied makes no new file.
- R23. The migration is named `<number>_account_tables` and is the only migration of this ticket; the whole `apps/server/migrations/` change, SQL and `meta/` files, is committed (TOKI-005 R3, R11). Check: `git status` after `pnpm db:generate --name account_tables` shows one new SQL file named so and updated `meta/` files; the migration folder in the PR has nothing else new.
- R24. `apps/server/src/db/README.md` gains a section "Table conventions" with the rules of "Conventions for server tables" below. Check: the section exists and lists each of them.
- R25. The tables are created empty, and the five tables (`workspaces` and these four) can be emptied by one `TRUNCATE` statement that names them, with no `CASCADE`, as the test harness does between files (TOKI-008 R6). Check: after the migration the four tables hold no row; a test inserts a row into each (with its parents), runs `TRUNCATE workspaces, users, login_codes, sessions, devices`, and the statement succeeds and the five tables hold no row.

## Design
### Conventions for server tables
Stated once here; TOKI-028 and later tickets follow them. A sibling ticket that needs another rule says so in its own spec.
1. Ids: `uuid`, primary key, UUIDv7 made in the server by the default on the column (TOKI-005 R8). Every table has a required `workspace_id` that points to `workspaces.id` (D-004).
2. Names: tables are plural `snake_case` nouns; columns are `snake_case`; a reference to another table is `<singular>_id`; a time is `<event>_at`; a flag that is a time (used, cancelled, ended) is a nullable `<event>_at`, not a boolean. Drizzle properties are `camelCase`, mapped to the column names by explicit name. Constraints and indexes are named `<table>_<column or purpose>_<kind>` where kind is `check`, `key`, `fkey` or `idx`.
3. Time: `timestamptz`. The server writes every time from the clock of TOKI-008 (R19 of that spec), so tests can move the clock. A new table does not give a time column a database default. `workspaces.created_at` keeps the database default that TOKI-005 R15 gave it; the table is not changed here.
4. Closed lists of values are `text` with a named check constraint, not a Postgres enum: adding a value is a one-line migration, and a table test names every allowed value.
5. Soft deactivation: nothing in the account area is deleted. A person is deactivated by `users.status`; a session is ended by `ended_at`; no foreign key cascades a delete (R5).
6. Foreign keys: `ON DELETE RESTRICT`. A key that crosses a module boundary is written as SQL in the migration (R22); inside one module Drizzle writes it.
7. Hashes: stored as 64 lower-case hexadecimal characters of a SHA-256 or an HMAC-SHA-256 (concern 6).
8. Migrations: one migration per ticket that changes the structure, created with `pnpm db:generate --name <slug>`, so the file is `<number>_<slug>.sql`; forward-only (TOKI-005 R11). Two branches that each add a migration both take the next number; the one that merges second runs `db:generate` again after rebasing, so the numbers and the `meta/` files follow merge order.

### Data model
`users`, one row per person who has an account, defined in `modules/members/schema.ts` (the `members` module owns `users`, as the technical design lists it):
- `id` (R3), `workspace_id` (R4).
- `email`: text, required, trimmed lower case, at most 254 characters (R7). 254 is the longest address the mail standard allows; this limit is Decided in this spec. Unique with `workspace_id` (`users_workspace_id_email_key`). The unique index also serves the lookup by address that sign-in makes.
- `display_name`: text, required, 1 to 80 characters (R8, D-033).
- `role`: text, required, `member` or `admin` (R9). Guest is a phase 5 role (D-152); adding it is a later migration.
- `status`: text, required, `active` or `deactivated` (R10).
- `language`: text, required, `en` or `vi`, default `en` (R11). Sign-in needs it to choose the language of the mail (TOKI-022 `User.language`); Preferences (TOKI-078) writes it.
- `created_at`: timestamptz, required (R6).
Not stored: last active (the Admin table of TOKI-025 can read the latest `sessions.last_used_at` of the person), who invited the person (the invitation records it, concern 1), the inviter's name, and any password (D-011).

`login_codes`, one row per accepted request for a code, in `modules/auth/schema.ts`:
- `id`, `workspace_id`, `created_at`.
- `purpose`: text, required, `sign_in` or `invitation` (R13).
- `email`: text, required, same rule as `users.email` (R7 form, no uniqueness).
- `user_id`: uuid, nullable, points to `users.id`; empty when the address has no account yet.
- `request_hash`: text, required, unique, 64 hex characters (R14).
- `code_hash`: text, required, 64 hex characters (R14).
- `expires_at`: timestamptz, required, later than `created_at` (R15). The 10 minutes are set by TOKI-022 (D-136).
- `wrong_tries`: integer, required, default 0, 0 to 5 (R15, D-137).
- `used_at`, `cancelled_at`: timestamptz, nullable.
- Indexes: R19.
These are the columns TOKI-022 lists under its Data model, one for one.

`sessions`, one row per sign-in, in `modules/auth/schema.ts`:
- `id`, `workspace_id`, `created_at`.
- `user_id`: uuid, required, points to `users.id`.
- `secret_hash`: text, required, unique, 64 hex characters (R16). The secret itself is never stored.
- `kind`: text, required, `cookie` or `token` (R16).
- `user_agent`: text, nullable, at most 512 characters (R16).
- `last_used_at`: timestamptz, required.
- `ended_at`, `ended_reason`: nullable together (R17).
- Index: R18.
These are the columns TOKI-022 lists. The 30-day rule is not stored: a session is live while it is not ended and was used less than 30 days ago (TOKI-022).

`devices`, one row per push registration of a signed-in device, in `modules/notifications/schema.ts`:
- `id`, `workspace_id`, `created_at`.
- `user_id`: uuid, required, points to `users.id`.
- `session_id`: uuid, required, unique, points to `sessions.id` (R20). Ending the session lets TOKI-074 remove the registration of that session (F06).
- `kind`: text, required, `web`, `ios` or `android` (R20). The technical design names Web Push for phase 1 and APNs and FCM later; the three values are the three channels.
- `push_address`: jsonb, required, a JSON object (R20): what the channel needs to deliver to the device. For `web` it is the subscription the browser gives. Its fields are checked by TOKI-074, which owns registration; the table only keeps an object (Decided in this spec, concern 3).
The signed-in devices list of F06 (device kind, browser, last use) is not read from this table: it is read from `sessions`, which has `user_agent` and `last_used_at` for every signed-in device, push or not (concern 3).

### Errors
- A row that breaks a rule is refused by the database with the Postgres error of the named constraint; the code that writes turns it into its own error (TOKI-004 format). No server code needs to repeat a rule for the table to hold.

### Layout
```
apps/server/
├─ migrations/
│  ├─ NNNN_account_tables.sql      the four tables, checks, indexes and cross-module foreign keys; meta/ updated
├─ src/
│  ├─ db/
│  │  ├─ README.md                 gains "Table conventions"
│  │  └─ account-tables.db.test.ts constraint, index and key tests in plain SQL (R1, R2, R4 to R20, R22, R25)
│  └─ modules/
│     ├─ members/    schema.ts (users), schema.db.test.ts (R3, R6, R12 for users), index.ts
│     ├─ auth/       schema.ts (login_codes, sessions), schema.db.test.ts (R3, R6), index.ts
│     └─ notifications/ schema.ts (devices), schema.db.test.ts (R3, R6), index.ts
```
- A module that does not exist yet gets its folder, `schema.ts` and an `index.ts` that exports nothing; the ticket that builds the module fills `index.ts`.
- `drizzle.config.ts` already reads `src/modules/*/schema.ts` (TOKI-005), so the three files are found without a change.
- The constraint tests use SQL text, not the Drizzle objects, so they prove what the database enforces whatever the definitions say, and no test file imports another module's table (TOKI-002 R7, R17). The id and time tests (R3, R6) use the module's own table object, because the id default is made by Drizzle in the server.

## Testing
- Written test-first, as the Blueprint asks for backend work. Database tests only; fake data only (`@example.com` addresses, fake hashes made of repeated hex digits).
- Files that end in `.db.test.ts` run in the database project of TOKI-008, one at a time, against the test database; each starts with empty tables (TOKI-008 R6). They apply migrations through `runMigrations` (TOKI-005). Nothing touches the development database (TOKI-005 R13).
- `account-tables.db.test.ts`: R1 and R2 (columns), R4 and R5 (keys), R7 to R11 and R13 to R17 (value rules), R18 and R19 (indexes), R20, R22 (foreign key names), R25. Every "must fail" case asserts the constraint name in the Postgres error, so a failure for another reason (a missing parent, a missing column) does not pass; the "must succeed" cases next to each prove the data was valid otherwise.
- Module tests: R3 (UUIDv7 id through the server client for each table) and R6 (an insert without `created_at` fails; none of the three files uses a time default), and R12 (status round trip) in the `members` file.
- R21 runs as `pnpm lint` plus a small test that reads the three `index.ts` files for the four table names. R23 and R24 are checked by hand once and the output goes in the PR: run `pnpm db:generate --name account_tables`, look at `git status`, run it again and see no new file (R22); read the README section.
- R25: the test inserts a workspace, a user, a login code, a session and a device, then runs `TRUNCATE` on all five tables in one statement; it succeeds and every table is empty.

## Data safety
- No code, secret or session value is stored in clear: only hashes (R14, R16). No test uses a real address; fake data only.
- `user_agent` can hold a long header; it is cut by the writer (TOKI-022) and limited by the table (R16).
- `push_address` can hold a push endpoint, which lets anyone who has it send a notification to that device; it is never logged, and no route returns it to another person (TOKI-074).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Scope is four tables: users, login_codes, sessions, devices | Scope In; R1, R2. The invitation table is not among them (concern 1) |
| Every table carries `workspace_id`; IDs are UUIDv7 with the TOKI-005 generator | R3, R4; convention 1 |
| Roles are Member and Admin, no Owner; the last Admin is protected; nobody deactivates themselves | R9 allows only `member` and `admin`. The two protections need the count of Admins and the actor, so they are rules of TOKI-024, inside one transaction (concern 7) |
| Deactivation keeps the account; an invited deactivated person gets the same account back; no permanent deletion | R10, R12, R5; convention 5; concern 2 |
| A display name is 1 to 80 characters and starts as the part before the @ | R8 (limit, D-033); making the name from the address is TOKI-020 and TOKI-097 (D-150) |
| English is the default language | R11 (D-018) |
| A code lasts 10 minutes, works once, locks after the 5th wrong try, is cancelled by a newer code; code and secret are hashed | R14, R15 hold the shape (hashes, 0 to 5 tries, `used_at`, `cancelled_at`, `expires_at`); the timing and the rules that use them are TOKI-022 (D-136, D-137, D-082) |
| A session lasts 30 days and renews on every use; an ended session is refused | R16, R17 store `last_used_at`, `ended_at` and the reason; the 30-day rule and the refusal are TOKI-022 (D-011, D-138, D-158) |
| The signed-in devices list shows device kind, browser and last use | Read from `sessions` (`user_agent`, `last_used_at`), listed by TOKI-026; `devices` holds the push registration (concern 3) |
| Server modules never read each other's tables; a table lives in its own module | R21, R22; Layout |
| Milestone M2; size M; needs TOKI-005 | Planning facts. The design uses the migration workflow, the UUIDv7 generator and the throwaway test database of TOKI-005 |
| Needed by TOKI-020, TOKI-022, TOKI-027 and TOKI-028 | Data model lists the columns TOKI-022 asks for, one for one. TOKI-020 creates its rows through `members`; TOKI-027 reads `role` and `status`; TOKI-028 follows the conventions and points to `users.id` and `workspaces.id` |

## Open questions from the intent
- The Blueprint lists no open question for the spec on this ticket. Confirmed: the plan shows none for TOKI-019. Nothing to answer.
- Does this ticket also create the table of invitations, or does the ticket that manages invitations? Answered: TOKI-024. The plan names four tables for this ticket and puts the invitation behaviour (7 days, once, resend, revoke, who invited, the role) in TOKI-024. See concern 1.
- Which columns does each table need, given that the Blueprint only names the groups of content? Answered: the columns of Data model. They come from the decisions cited there and from the columns TOKI-022 lists; a column for a feature with no decision, or with its own ticket, is not created (concern 8).

## Areas of concern
1. Who owns the table of invitations. Decided in this spec: TOKI-024 creates and owns `invitations` in its own migration, in the `members` module. Reason: the plan gives this ticket four tables and lists no invitation among them; TOKI-024 holds the invitation rules (D-037, D-099, D-094, D-111, D-110) and TOKI-097 and TOKI-025 read it through the `members` module. This ticket keeps the account side ready for it: `login_codes.purpose` has the value `invitation` (R13), and `users` allows a deactivated row to be reused (R12). Owner: Thanh Truong.
2. Where "Invited" is stored. Decided in this spec: not in `users`. A person who has only been invited has no `users` row; the row appears when the invitation is accepted (TOKI-097), and for a deactivated person the invitation points to the existing row, which stays `deactivated` and unable to sign in until acceptance (D-094). So `users.status` is `active` or `deactivated` (R10), and "Invited" and "Expired" on the Admin page come from the invitation (TOKI-024, TOKI-025). Reason: a row with status `invited` would need a display name and a role before the person has chosen to join, and a deactivated person could not be both deactivated and invited. Hand-off: the TOKI-022 spec describes the account read function as returning a status among Invited, Active and Deactivated; `members` can return `Invited` from the invitation, and TOKI-022's "no Active or Deactivated account" case (its `user_id` empty) already matches this model. Owner: Thanh Truong.
3. What `devices` holds. Decided in this spec: the push registration of a signed-in device (`kind`, `push_address`, its session), as the technical design describes it ("several devices per person, each with a kind and a push address"). The signed-in devices list of F06 and AC-133 (device kind, browser, last use) is read from `sessions`, which already stores `user_agent` and `last_used_at` for every sign-in (TOKI-022 R35), because a device that never turned on push must appear in the list, and a copy of those values on `devices` would have to be kept in step. TOKI-026 turns `user_agent` into a device kind and a browser. `push_address` is one JSON object because the three channels differ (a browser subscription, an APNs token, an FCM token); TOKI-074 defines its content for `web`. If the product wants kind and browser stored as columns, that is a change to R2 and R20. Owner: Thanh Truong.
4. Foreign keys across modules. Decided in this spec: they are written as SQL in the migration (R22). Reason: TOKI-002 rule 2 and R17 forbid a schema file from importing another module's table, and Drizzle needs the table to describe a key. Cost: the Drizzle snapshot does not know these keys, so a later `db:generate` neither shows nor drops them; R22 checks that a second generate makes no file and that the keys exist. Owner: Thanh Truong.
5. Timestamps and the clock. Decided in this spec: the server writes the time columns of these tables from the injected clock and the database has no default for them (R6, convention 3), as TOKI-022 requires ("never by a database default"). `workspaces.created_at` keeps its database default from TOKI-005 R15; it is not changed here, so two conventions exist in the schema, and the reason is only the order of the tickets. Owner: Thanh Truong.
6. How hashes are stored. Decided in this spec: 64 lower-case hexadecimal characters in a `text` column with a check (R14, R16, convention 7). Reason: the TOKI-022 spec names SHA-256 and HMAC-SHA-256 without a form for the stored value; hexadecimal is readable in a database tool and compares as plain text. Hand-off: TOKI-022 writes and compares that form. Owner: Thanh Truong.
7. The last Admin and self-deactivation. Decided in this spec: the table does not enforce them (R9). The rule needs a count of active Admins and the person who acts, so TOKI-024 checks it inside one transaction that locks the Admin rows (D-153, D-090); a trigger would hide the rule from the code that must show "Make someone else an Admin first". Owner: Thanh Truong.
8. Columns left to other tickets. Decided in this spec: this ticket creates no column for job title, time zone (D-144), status text, Pause and Focus (D-072), look, accent, density (D-175) or the notification switches (D-142, D-088). The technical design lists some of them under the accounts group, but each has a ticket and a decision to be built from (TOKI-078, TOKI-076, TOKI-102, TOKI-057), and the migrations are forward-only, so each adds its columns when it is built. `language` is the exception because sign-in reads it (R11). Owner: Thanh Truong.
9. Migration numbering. Decided in this spec: the next free number, named by `--name` (convention 8). TOKI-028 adds a migration at the same time; the one that merges second regenerates its migration after rebasing. This is a process rule, not a table rule. Owner: Thanh Truong.
10. Which module owns which table. Decided in this spec: `users` in `members`, `login_codes` and `sessions` in `auth` (as TOKI-022's module boundaries say), `devices` in `notifications` (it holds push channels, and the worker that sends push is that module). Ending a session reaches `devices` through the listener that TOKI-022 exports (R50 of that spec), not through a join. Owner: Thanh Truong.
