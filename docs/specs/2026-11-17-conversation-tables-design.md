# Conversation tables design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/conversation-tables.md (Thanh Truong)
Ticket: TOKI-028

## Goal
The builder needs tables that say which conversations exist and who belongs to them, before the channel API, the direct-message API, the bootstrap call and the messages table are built.
The tables must hold by themselves the rules that application code can get wrong under load or by mistake: unique channel names, one direct message per set of people, a group limit of 8, one #general, and a kind and privacy that never change after creation.

## Scope
- In:
  - The tables `conversations` and `conversation_members`, their constraints, indexes and the migrations that create them.
  - The module `apps/server/src/modules/conversations/` with the table definitions and two small public functions: one builds the key of a direct message or group (R10, R11), one gives the notification level that applies to a member (R14).
  - The limits and the channel-name pattern in `packages/shared`, so server and web use one set of numbers (R15).
  - The per-member columns for notification level, mute and star (R13, R14), because the Blueprint lists them with these tables and a decision defines each (D-046, D-103, D-143).
- Out (not now):
  - Creating #general, the first workspace row and the first Admin: TOKI-020. The tables are created empty.
  - Every request that creates, lists, joins, leaves, edits, archives, restores or adds people to a channel, and the check that only an Admin creates a channel or removes a person: TOKI-029. The last-member rule (D-051) is carried out by the leave request of TOKI-029; see the hand-off in Design.
  - Opening a direct message or group, and refusing a guest: TOKI-030.
  - The bootstrap call and the unread counts it returns: TOKI-031.
  - The read pointer (the message each person has read up to): TOKI-053 adds its column to `conversation_members`. It points to a message, and the `messages` table (TOKI-036) does not exist when this ticket is built. Unread counts and the New divider are TOKI-053 and TOKI-054.
  - The request that saves a person's notification level, mute and star, and the Details panel that shows them (TOKI-035): who builds the request is open (concern 2).
  - The messages, events and pins tables: TOKI-036 and later. The accounts tables: TOKI-019.
  - A role per conversation: none exists (concern 7).

## Requirements
- R1. The tables `conversations` and `conversation_members` exist after the migrations are applied to an empty database, and are empty. `conversations` has exactly these columns: `id`, `workspace_id`, `kind`, `name`, `topic`, `description`, `is_private`, `is_general`, `dm_key`, `created_by`, `created_at`, `archived_at`. Check: a test applies the migrations to a throwaway database and reads the column names, types and nullability from the Postgres catalog, and counts zero rows in both tables.
- R2. `conversations.id` is a `uuid` primary key holding a UUIDv7 made in the server, with the same default and the same generator as `workspaces.id` (TOKI-005 R8). Check: insert a conversation without passing an id; the 13th hex digit of the stored id is `7`.
- R3. `kind` is required and is one of `channel`, `dm`, `group_dm`. A channel has a name that matches `^[a-z0-9-]{1,80}$` (D-040). Check: insert channels named `qa-team` (accepted), `a` (accepted), a name of exactly 80 characters (accepted), a name of 81 characters, an empty name, `Q&A Team!`, `qa team`, `QA` and no name (each refused by a check constraint; the error names the constraint), and a row with kind `other` (refused).
- R4. Channel names are unique within a workspace, archived channels included (D-040, D-128), and the database refuses the second row also when two transactions insert the same name at the same moment (D-115). Check: (a) insert `launch`, then insert `launch` again: unique violation; (b) archive `launch`, then insert `launch`: unique violation; (c) open two connections, insert `release` in the first without committing, start the same insert in the second, commit the first: exactly one `release` row exists and the second insert fails with the unique violation, not with another error.
- R5. A direct message or group has no name, topic or description, is private, and is never archived: for kind `dm` and `group_dm` the columns `name`, `topic` and `description` are null, `is_private` is true and `archived_at` is null. A channel has no `dm_key`. Check: inserts that break each part (a DM with a name, with a topic, with a description, not private, with an archive time; a channel with a `dm_key`) are each refused by a check constraint, and a valid DM is accepted.
- R6. `topic` is null or 1 to 250 characters (D-101). Check: a topic of 250 characters is accepted; one of 251, and an empty string, are refused; a null topic is accepted. A topic of 250 characters that contain multi-byte letters (Vietnamese text) is accepted, so the limit counts characters, not bytes.
- R7. `description` is a nullable text column with no length limit in the database (concern 1). Check: a description of 5,000 characters is accepted and read back unchanged; null is accepted.
- R8. `kind`, `is_private`, `is_general`, `dm_key` and `workspace_id` cannot be changed after the row is created (D-040, D-045): an update that changes any of them is refused. An update of `topic`, `description` and `archived_at` is accepted. Check: for each of the five columns, an update to a different valid value fails and the row is unchanged; updating the topic, the description and `archived_at` to a time and back to null succeeds; an update that sets a column to the value it already has succeeds.
- R9. #general is a conversation with `is_general` true. A row with `is_general` true is a public, active channel, and a workspace has at most one such row (D-034). Check: a general row that is a DM, that is private, or that has an archive time is refused, and an update that sets `archived_at` on the general row is refused (so #general cannot be archived); a second general row in the same workspace is refused; a general row in a second workspace is accepted; a channel that is not general may be archived.
- R10. A direct message or group has a `dm_key`, a channel has none. The key is the people's ids, in lowercase, sorted, joined by commas, 2 to 8 ids (D-045, D-086). Kind `dm` has a key of 2 ids, kind `group_dm` of 3 to 8 ids. `dm_key` is unique within a workspace. Check: a DM with a key of 2 ids is accepted; a DM with 3 ids and a group with 2 ids are refused; a group with 8 ids is accepted and one with 9 ids is refused; a key that is not a list of lowercase ids is refused; a second row with the same key is refused, also when the two inserts run in two transactions at the same moment (as in R4 (c)); a channel with a key and a DM or group with a null key are each refused.
- R11. A function `buildDmKey(userIds)` of the module returns `{ kind, key }` for a list of ids: the kind is `dm` for 2 people and `group_dm` for 3 to 8, and the key is the one R10 describes. The same people in any order, in upper or lower case, give the same result. It refuses a list with fewer than 2 different ids (messaging yourself is not supported, F25), a list with a repeated id, a list with more than 8 ids, and a value that is not a UUID. Check: unit tests for each case, including that `[a, b]` and `[b, a]` give one key, that `[a, b]` and `[a, b, c]` give different keys, and that a key of 8 people passes while 9 is refused; and a database test that inserts the DM built from `[a, b]`, then tries `[b, a]` and fails with the unique violation of R10.
- R12. `conversation_members` has exactly these columns: `conversation_id`, `user_id`, `workspace_id`, `notification_level`, `is_muted`, `is_starred`, `created_at`. The primary key is (`conversation_id`, `user_id`), so a person is a member of a conversation at most once. A person is a member exactly while a row exists: leaving deletes the row (concern 5). There is an index on `user_id` for "the conversations of this person". Check: a test reads the columns and the primary key from the catalog; inserting the same pair twice is refused; the index on `user_id` is listed.
- R13. `is_muted` and `is_starred` are required booleans, false by default (D-143, D-103). They belong to one row, so one person's value does not change another member's. Check: insert two members of one conversation, set `is_muted` and `is_starred` on the first; the second row still holds false for both.
- R14. `notification_level` is null or one of `all`, `mentions`, `nothing` (the labels 'All messages', 'Mentions only', 'Nothing'). Null means "the default for the conversation's kind": `mentions` for a channel, `all` for a direct message or group (D-046). The function `effectiveNotificationLevel(kind, level)` of the module returns the stored level when there is one and the default otherwise. Check: a database test refuses the value `loud` and accepts the three values and null; unit tests: `('channel', null)` gives `mentions`, `('dm', null)` and `('group_dm', null)` give `all`, and `('channel', 'nothing')` and `('dm', 'mentions')` give the stored value.
- R15. `packages/shared` exports `CHANNEL_NAME_MAX` (80), `CHANNEL_NAME_PATTERN`, `CHANNEL_TOPIC_MAX` (250) and `GROUP_DM_MAX_PEOPLE` (8), and the server uses them for its own checks. The database constraints and these values agree. Check: one test runs the same list of names, topics and group sizes through the exported values and through inserts into the tables, and both accept and refuse the same items, with the boundary cases 80 and 81, 250 and 251, 8 and 9.
- R16. Every foreign key is enforced and refuses to delete the row it points to (`ON DELETE RESTRICT`, as in TOKI-019): `conversations.workspace_id` references `workspaces.id`; `conversations.created_by` and `conversation_members.user_id` reference `users.id` (the table `users` of TOKI-019, in `modules/members`); `conversation_members.workspace_id` references `workspaces.id`; `conversation_members.conversation_id` references `conversations.id`. The constraints are named `<table>_<column>_fkey`. Check: for each of the five, an insert with an id that does not exist is refused with a foreign-key violation and with existing ids is accepted; a test reads `pg_constraint` and finds all five with `confdeltype = 'r'` and these names; deleting a conversation that has a member row fails.
- R17. Both tables have `created_at`, a timestamp with time zone, required. Following the server-table conventions of TOKI-019 (Design, "Conventions for server tables") the server writes it from the clock of TOKI-008 and the database gives no default; the same holds for `conversations.archived_at`, a nullable timestamp with time zone that the server sets when a channel is archived and clears when it is restored (D-029). There is no `updated_at`. Every table has `workspace_id` (Blueprint data model notes). Check: a test reads the catalog: the three time columns are `timestamptz`, have no column default, and `created_at` is not null; an insert that omits `created_at` fails with a not-null error naming the column.
- R18. The table definitions are in `apps/server/src/modules/conversations/schema.ts` and are not exported from the module's `index.ts`; the module exports only `buildDmKey`, `effectiveNotificationLevel` and their types, so no other module reads or writes these tables (TOKI-002 rules 2 and 17). Check: a test imports the module's index and lists its exported names, and they are exactly these; `pnpm lint` exits 0.
- R19. One migration, `<number>_conversation_tables.sql` made with `pnpm db:generate --name conversation-tables` (TOKI-019 convention), creates both tables, and no other table. It applies to a database that already holds the TOKI-005 and TOKI-019 migrations and keeps the TOKI-005 rules: forward-only, nothing that the previous release cannot run on. Check: the TOKI-005 test of applying all migrations to an empty database passes with the new file, and the tables exist afterwards (R1).
- R20. No row is inserted by the migrations. In particular #general is not created here (TOKI-020). Check: the R1 count of rows is zero after a migration run.

## Design
### Data model
`conversations` (server module `conversations`, Blueprint "Conversations" row: kind, private flag, archive time):
- `id` uuid primary key, UUIDv7 (R2).
- `workspace_id` uuid, required, references `workspaces.id`. There is one workspace in phase 1; the column keeps the path to several (D-004).
- `kind` text, required: `channel`, `dm`, `group_dm`. A direct message and a group are different kinds because the Blueprint draws them differently (a DM row has an avatar, a group a group icon) and because the group limit is not the DM size. Text with a check constraint, not a Postgres enum: adding a kind later is a one-line constraint change, while an enum value cannot be removed.
- `name` text. Channels only (R3, R5). Unique per workspace with one plain unique constraint on (`workspace_id`, `name`); the pattern allows lowercase only, so no case-folding index is needed (R4). Null names do not collide.
- `topic` text, null or 1 to 250 characters (R6). Channels only (R5). The server maps an emptied topic to null.
- `description` text, null; shown under About in the Details panel next to the topic and edited by any member (D-105, F24). No limit in the database (R7, concern 1).
- `is_private` boolean, required, default false. A channel is public or private from creation (D-040); a DM and a group are always private (R5), which matches "visible only to members" (BR-09).
- `is_general` boolean, required, default false. It marks #general (D-034). A flag, not the name `general`, so the rule keeps holding if names can be changed later (D-105 says no rename in phase 1 only). At most one per workspace, and always a public, active channel (R9).
- `dm_key` text, null for channels, required for DMs and groups (R10). Rule: the ids of the people, in lowercase, sorted, joined by `,`. Decided in this spec: plain text and not a hash, so a constraint can check its shape and size, and a person can read it when debugging (at most 8 ids, 295 characters). The key is built by `buildDmKey` (R11) in the same transaction that inserts the member rows.
- `created_by` uuid, required, references `users.id`: the Admin who created the channel or the person who started the DM; shown as "creator" under About (F24).
- `created_at` timestamptz, required, written by the server (R17). Shown as the creation date under About.
- `archived_at` timestamptz, null while active; written by the server. Only channels are archived (R5); #general never (R9). A channel archived keeps its name (R4) and its members, and its messages stay readable (D-029, F26).
- Constraints (names `conversations_*`): kind values, channel shape, direct-message shape, name pattern, topic length, general shape, `dm_key` shape and size by kind, unique (`workspace_id`, `name`), unique (`workspace_id`, `dm_key`), unique (`workspace_id`) where `is_general`.
- A trigger on update refuses a change of `kind`, `is_private`, `is_general`, `dm_key` and `workspace_id` (R8). The server has no request that changes them (TOKI-029, TOKI-030); the trigger holds the rule if a later change forgets it. The name has no trigger: "no rename" is a phase-1 choice of the API (D-105), not a rule of the data.

`conversation_members`:
- `conversation_id` uuid references `conversations.id`; `user_id` uuid references `users.id`; together the primary key (R12).
- `workspace_id` uuid, required, references `workspaces.id`. A copy of the conversation's workspace, kept because every table carries it; the code that inserts a row copies it from the conversation.
- `notification_level` text, null or `all` / `mentions` / `nothing` (R14). Null follows the default of the conversation's kind (D-046) and is turned into a value by `effectiveNotificationLevel`. Decided in this spec: null and not a stored default, because the default depends on another table's `kind` (a column default cannot read it) and because the rule then lives in one function instead of in every insert path (TOKI-029, TOKI-030, #general at set-up, accepting an invitation).
- `is_muted` boolean, default false: hides the unread badge and bold, and stops toast, push and sound (D-103). The level `nothing` only stops toast, push and sound. `is_starred` boolean, default false: moves the conversation to Starred in that person's list (D-143). Both are personal (D-143, AC-138).
- `created_at` timestamptz, required, written by the server (R17): when the person joined. No `updated_at`.
- Indexes: the primary key serves "members of this conversation" and its count; an index on `user_id` serves "conversations of this person" (the list, the bootstrap call).
- Membership is the access rule: a person reads and writes a conversation only while a row exists (D-077, D-116, BR-09). Leaving deletes the row (concern 5). Private channels need no other flag for this; a public channel is not readable without a row either (D-116).
- No role column: the capability table has roles per workspace, not per conversation (D-090, concern 7).

Who adds which column later: the read pointer (`last_read_message_id` or the like) is added by TOKI-053 with its own migration, in `schema.ts` of this module, because it needs `messages` (TOKI-036). Nothing else in `conversation_members` is expected from a later milestone.

### Shared module (R15)
`packages/shared/src/conversations.ts`, exported from the package index: the four values above. The pattern is `/^[a-z0-9-]{1,80}$/`, written from `CHANNEL_NAME_MAX`. The server's constraints and request checks and the web app's create-channel form (D-127: spaces become hyphens and capitals lowercase while typing; that conversion belongs to the Admin page ticket, the final check to the server) read the same numbers.

### Foreign keys across modules
Drizzle's `references()` needs the other table's definition, and lint stops a module importing another module's table file (R18). So the foreign keys that leave the module (`workspace_id`, `created_by`, `user_id`) are plain `uuid` columns in `schema.ts` and their constraints are written as SQL in the migration file, named `<table>_<column>_fkey`, as TOKI-019 does (its R22); the same file holds the update trigger and any check constraint that the table builder cannot express. The key inside the module (`conversation_id`) uses `references()`. Decided in this spec: this keeps one rule for every module and needs no table exported across modules. The snapshot does not list the hand-written statements, so the next `db:generate` does not remove them; R8, R9 and R16 prove they exist. See concern 8.

### Hand-offs
- TOKI-029 (channel API): the leave request deletes the member row and, when none is left, sets `archived_at` in the same transaction. It first locks the conversation row (`select ... for update`), because two last members leaving together would otherwise each see the other and archive nothing. Whether a public channel is archived when it empties is concern 3. Who restores a channel with no members is open in the log (D-184) and is TOKI-029's.
- TOKI-029 maps the unique violation of R4 to the "name exists" answer to the second person (D-115) and turns an emptied topic into null.
- TOKI-030 (DM API): builds the key with `buildDmKey` and inserts the conversation and all member rows in one transaction; opens the existing conversation when the key exists. It refuses a guest (D-050) and a list that `buildDmKey` refuses.
- A DM appears in the other person's list only after the first message (F25). Both member rows are written when the DM is opened (decided in this spec, concern 6); the rule that hides an empty DM from the other person belongs to TOKI-031 and TOKI-033 and needs `messages` (TOKI-036).
- A deactivated person keeps their member rows: the same account returns with its channels (D-094, F41). Nothing here removes them; the read-only DM is a rule of the DM and message tickets.
- TOKI-020 (first Admin and #general) inserts the #general row with `is_general` true, `created_by` the first Admin, and a member row for the Admin; TOKI-097 adds a member row for each person who accepts an invitation.

### Errors
- Constraint failures are database errors with named constraints (`conversations_name_check`, `conversations_workspace_id_name_key`, and so on). Turning them into the TOKI-004 error format is the work of the request tickets (TOKI-029, TOKI-030); this ticket adds no route.
- `buildDmKey` throws a plain error with a message naming what is wrong (fewer than 2 people, repeated person, more than 8, not a UUID); the callers turn it into a 400.

### Layout
```
apps/server/
├─ migrations/                    <number>_conversation_tables.sql and meta/ (foreign keys, checks and trigger written into the generated file)
└─ src/modules/conversations/
   ├─ schema.ts                   conversations and conversation_members; not exported from index.ts
   ├─ dm-key.ts                   buildDmKey
   ├─ notification-level.ts       effectiveNotificationLevel
   ├─ index.ts                    exports the two functions and their types only
   ├─ *.db.test.ts                tests on a throwaway database (R1 to R10, R12 to R14 data part, R16 to R20)
   └─ *.test.ts                   unit tests of the two functions
packages/shared/src/conversations.ts   the four limits; exported from the package index
```

## Testing
- Written test-first, as the Blueprint asks for backend work.
- Database tests (`*.db.test.ts`, the database project of TOKI-008) run on the test database; each file starts with empty tables (TOKI-008 R6). They insert people (with an explicit `created_at`, R17) with the helper of the TOKI-019 tests if it has one; otherwise a helper in the test folder inserts a `users` row with the columns that table requires. They cover R1 to R10, R12 to R14, R16, R17 and R20. The two concurrent cases (R4 (c), R10) open two connections and wait for the second to fail after the first commits. R19 is the TOKI-005 test of applying all migrations, run with the new files.
- Unit tests (no database) cover `buildDmKey` (R11), `effectiveNotificationLevel` (R14) and the shared values (R15, the shared side). R15's agreement test and R18's export list need the database test project for the first and none for the second.
- R18's lint part is `pnpm lint`.
- Every check that names two parts proves both: R9 and R8 try each forbidden change one at a time, so a refusal cannot come from another constraint than the one under test (each test asserts the constraint name in the error).
- Fake data only: made-up names and generated ids.

## Data safety
- The tables hold no message text and no personal data beyond the ids of people. Membership is the access rule for private channels, direct messages and groups, so every later query that returns a conversation or its content joins `conversation_members` (BR-09); the table and the index on `user_id` are made for that.
- A private channel's name, topic and description are visible to its members only: the tickets that list channels (TOKI-034) must filter on membership; nothing here lists them.
- Tests use fake ids and names and never touch the development database (TOKI-008 R4, R16).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Channel names: lowercase letters, digits, hyphens, up to 80, unique, archived included, also for simultaneous requests (D-040, D-115, D-128) | R3, R4, R15; name pattern check and the unique constraint on (`workspace_id`, `name`) |
| Public or private fixed at creation; no rename in phase 1 (D-040, D-105) | R8 for `is_private` and `kind`; the name has no data rule, the API offers no rename (Design, Data model) |
| Channels archived, never deleted (D-029) | `archived_at` (R17); no request deletes a channel (TOKI-029), and a conversation that still has member rows cannot be deleted because of the foreign key (R16) |
| Topic up to 250; any member edits topic and description (D-101, D-105) | R6, R7, R8 (topic and description stay editable); who may edit is TOKI-029 |
| #general from set-up, cannot be left or archived (D-034) | R9 for archive and the single general row; R20 and Scope Out for creating it (TOKI-020); not leaving is the leave request of TOKI-029 |
| Group DM up to 8 counting the creator; no adding or removing (D-045, D-086, BR-36) | R10, R11, R15 for the size; R8 fixes the key; no add or remove request exists (TOKI-030) |
| The same people always lead to the same conversation; no messaging yourself (F25) | R10, R11 |
| Notification level default, mute and star personal (D-046, D-103, D-143) | R12 to R14 |
| Not joined means not readable; writing needs membership (D-116, D-077) | Membership row is the access rule (Design, Data model); data safety; checks on requests are TOKI-029, TOKI-030, TOKI-036 |
| Last member leaving a private channel archives it (D-051) | `archived_at` exists (R17); the leave request does it, with a lock (Hand-offs); for public channels see concern 3 |
| Every table carries `workspace_id`; UUIDv7 (data model notes, D-004) | R1, R2, R12, R16, R17 |
| Server modules never each other's tables | R18; foreign keys across modules are SQL constraints (Design, Foreign keys across modules) |
| Milestone M2; size M | Planning fact; the scope is two tables, two functions and four constants |
| Needs TOKI-019; needed by TOKI-029, TOKI-030, TOKI-036 | R16 uses `users` of TOKI-019; the hand-offs name what each later ticket takes from here |
| Belongs to intent I05 | Planning fact; no design impact |

## Open questions from the intent
- Is there a limit on the length of a channel description? Not answered. The log limits the topic (D-101) and says nothing about the description (D-105). Carried forward as concern 1.
- Does "archived when the last member leaves" apply to public channels too? Not answered. D-051 states the rule inside its answer about private channels; the requirement text FR-21 states it for "the channel". Carried forward as concern 3.
- When a person leaves a channel and comes back, do their notification level, mute and star come back? Not answered. Carried forward as concern 4.
- Which ticket builds the request that saves a person's notification level, mute and star? Not answered: no ticket in the plan names it. Carried forward as concern 2.
- Which ticket adds the read pointer? Answered: TOKI-053 (Read pointer) adds it to `conversation_members`, because it points to a message and `messages` comes with TOKI-036. See Scope and Design. Evidence: Blueprint plan, TOKI-053 and TOKI-036; technical design, data model table.
- How is a direct message or group keyed so the same people never get two conversations? Answered: the sorted, comma-joined ids of the people, with a unique constraint per workspace (R10, R11). Evidence: Blueprint technical design (data model notes: "a unique key built from the member list"); flow F25 ("the same set of people always leads to the same conversation").

## Areas of concern
1. The length limit of a channel description. Not decided: the log gives 250 characters for the topic (D-101) and no number for the description (D-105, F24). The column has no limit until the product owner decides. Proposal only, not a decision: 500 characters, with a check constraint and a form limit, added by a later migration. Owner: Thanh Truong (product owner).
2. Who builds the request that saves a person's notification level, mute and star. Not decided. The columns are here (R12 to R14) and the Details panel is TOKI-035, but no ticket in the plan lists the server request that writes them; TOKI-029 lists channel actions and TOKI-102 holds per-account switches only. Proposal only, not a decision: add it to the scope of TOKI-035, or give it a small ticket of its own. Without it the columns can be read but not changed. Owner: Thanh Truong (product owner).
3. Whether a public channel is archived when its last member leaves. Not decided. D-051 answers a question about private channels and ends "If the last member leaves, the channel is archived"; FR-21 and AC-056 say "the channel" and test a channel with one member without saying which kind; flow F23 shows the warning for private channels only, and says a public channel can be rejoined any time. Proposal only, not a decision: private channels only, as the flow shows. The tables support both. Owner: Thanh Truong (product owner).
4. Whether notification level, mute and star come back after a person leaves a channel and returns, including Undo within 5 seconds (D-069). Not decided: the log says Undo restores membership (AC-054) and says nothing about these settings. Leaving deletes the row, so as built they return to the defaults. Proposal only, not a decision: the screen keeps the person's settings for the 5 seconds of Undo and the request that restores membership sends them back; after those 5 seconds they reset. Owner: Thanh Truong (product owner).
5. Whether a person who left stays as a row (with a left time) or the row is deleted. Decided in this spec: the row is deleted. Reason: membership is the access rule (D-077, D-116, BR-09), and with a row that stays, every query would need a "not left" filter, and one that forgets it would show a private channel to someone who left it. No decision needs the left time: the leave line in the channel is a system message (F23), and old messages stay with the person as author (F23). The consequence for settings is concern 4. Owner: Thanh Truong.
6. When the other person's member row of a direct message is written. Decided in this spec: when the DM is opened, together with the creator's, in one transaction, so the key always matches the members. F25 says the DM appears in the other person's list only after the first message; that is a rule of what the list shows (TOKI-031, TOKI-033), not of what is stored. Owner: Thanh Truong.
7. A role per conversation. Decided: there is none. The capability table has roles per workspace (Member, Admin, Guest; D-090, D-152); what only a channel's members may do is decided by membership (D-077, D-047, D-085); "the channel's creator" in D-065 is `created_by`, which this table keeps. Owner: Thanh Truong.
8. Decisions the Blueprint leaves to the builder, Decided in this spec: (a) `kind` has three values and is text with a check constraint; (b) the DM key is plain sorted ids, not a hash (R10); (c) `notification_level` null means the kind's default (R14); (d) `is_general` is a flag, not the name; (e) the foreign keys that leave the module are written in SQL, because lint keeps modules apart (Design); (f) the only name rule is D-040's pattern, with no further rule such as no leading hyphen, since a narrower rule would be a new product decision; (g) conventions shared with TOKI-005 and TOKI-019: a UUIDv7 primary key made by the server with the generator of TOKI-005, times are `timestamptz` written by the server from the clock, no database default, no `updated_at` unless a decision needs it, closed lists as text with a named check constraint, foreign keys `ON DELETE RESTRICT` named `<table>_<column>_fkey`, one migration per ticket, plural snake_case table names, tables inside their module, one `workspace_id` on every table, and the foreign keys as in (e). Owner: Thanh Truong.
