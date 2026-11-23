# Prototype seed data design

Date: 2026-11-23 · Status: draft for review
Intent: docs/intents/prototype-seed-data.md (Thanh Truong)
Ticket: TOKI-081

## Goal
After `pnpm dev:reset:db` the development database has tables and no row. The builder needs the prototype's sample workspace (Hugepig Studio: eight people, channels, direct messages, messages, a thread, reactions, a pin) loaded with one command, so that every screen of the message feed has something to show, and the end-to-end flows have a known starting point. A production installation must never get it.
This work writes the command, the data, the entries the modules expose for it, and the rules that keep it out of production and make a second run harmless.

## Scope
- In:
  - The root script `dev:seed` (`scripts/seed.sh`) and the command behind it, `apps/server/src/cli/seed.ts`.
  - The step `seedPrototypeWorkspace` in `apps/server/src/seed/` (outside `modules/`), with the sample data as one typed file.
  - One narrow seed file in each module that owns a table the seed fills: `members`, `conversations`, `messages` (messages, the thread summary, the pin) and `reactions`.
  - The two guards that keep the command out of production, the empty-database rule and the idempotence rule.
  - The list of what the sample may not contain, with the reason for each.
  - A row in "Common commands" of `CLAUDE.md`.
- Out (not now):
  - Sample files and images: TOKI-063 adds them to the seed once file storage exists (plan). Attachments of the other kinds the prototype draws (link card, poll, voice message, Meet card, approval card) are not built in phase 1; no ticket of the plan adds them to the seed.
  - Profile fields of a person (job title, time zone, city, status), unread counts, drafts, notes, tasks, reminders, calendar events, automations and the mail of the prototype: the tables or columns do not exist yet (concern 1).
  - Wiring the seed into the end-to-end runs: TOKI-090 owns it. This ticket exports the function (R17) and the command.
  - Whether the production image carries the seed files: TOKI-084 owns the image. This ticket's guards (R2, R3) hold whichever way it decides.
  - A reset that also seeds: `dev:reset` stays a wipe (TOKI-003 R8). The order is `pnpm dev:reset:db`, `pnpm dev:seed`, then start the server (first-admin spec, concern 13).

## What the prototype holds, and what the seed takes
Counted from the prototype's data (`PEOPLE`, `D.convs`, `D.msgs`). "Kept" is what this spec seeds.

| Item | In the prototype | Kept | Why the rest is left out |
| :---- | :---- | :---- | :---- |
| People | 8 in `PEOPLE` (Lan Owner, Minh Admin, 6 with no role) and 1 guest, Linh Phương | 8 | Lan's role becomes Admin because there is no Owner (D-152). The guest is left out: Guest is a phase 5 role and the table accepts Member and Admin only (D-152, TOKI-019 R9). |
| Automation sender | `BOTS.auto` ("Toki Automations") | 0 | No message of the sample is sent by it; it is not a person. |
| Channels | 9 (7 public, 2 private) | 8 (7 public, 1 private) | `#client-saigon-coffee` is the guest's channel ("Linh ... is a guest here") and 2 of its 4 messages are hers: it goes with the guest. |
| Direct messages | 3 DMs and 1 group (Lan, Alex, Thu) | 4 | none |
| Messages | 63 (58 roots, 5 replies) | 54 (51 roots, 3 replies) | 4 of the guest's channel; 3 with no text (a voice message, a Meet card, an approval card: a message needs a text, TOKI-037 R4, and the table does not hold the attachment); the 2 replies under the Meet card cannot stay without their root. |
| Threads | 2 (under `l6` and `l15`) | 1 (under `l6`, 3 replies) | The root of the other is the Meet card. |
| Reactions | 29 rows on 13 messages, 7 emoji (👋 👍 🚀 ✅ 🎉 👀 😂) | 27 rows on 12 messages | The guest's channel holds one message with 2 rows. The 4 rows of 👋 that are kept are written as 🎉 (R11). |
| Pins | 1 (`l3`) | 1 | none |
| Attachments | 10 (3 files, 2 images, 1 link card, 1 poll, 1 voice message, 1 Meet card, 1 approval card) | 0 | See Scope. The text of a message that has one is kept as written, so some texts mention a file or a poll that is not there until TOKI-063. |
| System lines | 0 | 0 | The prototype draws none (see R12). |

Kept messages per conversation: `general` 5, `project-launch` 16 (13 roots and 3 replies), `mobile-release` 6, `design-crit` 4, `dev-infra` 4, `random` 4, `leadership` 4, `reading-club` 1, direct message with Minh 3, with Sam 3, with Jordan 2, the group 2. Total 54.

## Requirements
In the checks below, "the seeded database" is a database that the migrations built and the harness emptied, after one call of `seedPrototypeWorkspace` with the clock of R9.

- R1. The root `package.json` gains one script, `dev:seed`, that runs `bash scripts/seed.sh`. `scripts/seed.sh` sources `scripts/lib.sh` and `scripts/guard.sh`, calls `guard_development` first (the guard of TOKI-003 R10: every source that sets `NODE_ENV`, the shell and the root `.env`, must say `development`, and a script refuses when they disagree or when none sets it), and only then runs `pnpm --filter @toki/server run seed`. `dev:reset` and the other `dev:*` scripts do not call it, and `dev:reset:db` still ends with tables and no row. With `--check` the script runs the guard and stops with exit 0 before it starts the command. Check: `scripts/seed.test.sh` runs `seed.sh --check` six times as TOKI-003 R10 does (`production` in `.env`, an unknown value in `.env`, removed from `.env`, `development` in `.env` with `production` exported, the other way round, removed from `.env` with `production` exported): each exits non-zero and prints a refusal that names `NODE_ENV`; with `development` in both it exits 0. The test never writes `.env` (it points the guard at a temporary env file, as the smoke test does). `pnpm run` lists `dev:seed`; the `dev:reset` entry points contain no call of `seed`.
- R2. The command has its own guard, which runs before it opens a connection. `apps/server/src/cli/seed.ts` reads only `NODE_ENV` and `DATABASE_URL`, through a new `readSeedConfig` of `cli/config.ts` (the file imports no code of `src/config.ts`, which reaches the mail module, as `emergency:link` does, TOKI-026 R23). It runs only when `NODE_ENV` is exactly `development`: a missing value, `production`, `test` and any other value exit 1 with a message that names `NODE_ENV` and no value, and write nothing. Check: a process test starts the command with `NODE_ENV` set to `production`, to `test`, to an empty string and removed, each with a `DATABASE_URL` that no server answers on: each exits 1, the message names `NODE_ENV`, and none reports a connection error (no connection was tried).
- R3. Nothing starts the seed by itself. The server's `main.ts`, `app.ts`, every route and every module file except the four seed entry files (R4) import no name of `apps/server/src/seed/` and no `seed*` entry. Check: a test reads the import lines of every file under `apps/server/src/` and `apps/server/tests/` and fails when a file other than `src/seed/**`, `src/cli/seed.ts`, the four entry files, their `index.ts` re-exports and test files imports one of them; a test reads the `scripts` of the root and server `package.json` and finds `seed` only in `dev:seed` and the server `seed` script.
- R4. The seed writes through the public entries of the modules and reads no table. `apps/server/src/seed/` imports only the `index.ts` of `workspace`, `members`, `conversations`, `messages` and `reactions`, and `packages/shared`. Four files add five entries, one for each kind of row, each narrow on purpose (it fixes what no caller of it may choose, as `createFirstAdminAccount` does, first-admin spec concern 14): `seedAccounts(tx, input)` of `members`; `seedConversations(tx, input)` of `conversations`; `seedMessages(tx, input)` and `seedPins(tx, input)` of `messages`; `seedReactions(tx, input)` of `reactions`. Each takes the caller's transaction, opens none, takes the ids and times it is given, and writes the rows through the module's own table definition. No table is exported from any `index.ts`; the export-name test of each module lists the new name. Check: the import-line test of TOKI-020 R14 (extended to `src/seed/`) passes; each export-name test lists exactly its module's names; a boundary test finds no import of a `schema.ts` from outside its module.
- R5. People. The workspace is created by `createWorkspace` with the name `Hugepig Studio`. Eight accounts are written by `seedAccounts`, all with status `active` and language `en`, in this order, with these display names and roles:

  | Key | Display name | Role | Email |
  | :---- | :---- | :---- | :---- |
  | lan | Lan Nguyễn | admin | lan@hugepig.example |
  | minh | Minh Trần | admin | minh@hugepig.example |
  | alex | Alex Phạm | member | alex@hugepig.example |
  | sam | Sam Lê | member | sam@hugepig.example |
  | thu | Thu Hoàng | member | thu@hugepig.example |
  | khoa | Khoa Đỗ | member | khoa@hugepig.example |
  | mai | Mai Vũ | member | mai@hugepig.example |
  | jordan | Jordan Davis | member | jordan@hugepig.example |

  Every address is on the domain `hugepig.example`, a name that no one can register (`.example` is reserved), so no mail to a seeded person reaches a real mailbox and no real person's address is in the repository. Each address passes `parseEmail` unchanged. Lan is an Admin because the Owner role is gone (D-152): there are 2 Admins and 6 Members. Check: the seeded database holds 1 workspace named `Hugepig Studio` and 8 `users` rows equal to the table, `parseEmail(email) === email` for each, no address outside `@hugepig.example`, and no role other than `member` and `admin`.
- R6. Conversations. `#general` is written by `createGeneralChannel` (the one writer of its fixed values, TOKI-028 R25), created by Lan, with the topic and description below set afterwards by `seedConversations`, and with all 8 people as members. The other 7 channels, the 3 direct messages and the group are written by `seedConversations`: a channel with its name, topic, description, privacy, creator and members; a direct message and the group with the key of `buildDmKey` (name, topic and description null), created by Lan. Every text is the prototype's. The rows are:

  | Conversation | Kind | Created by | Members | Topic and description |
  | :---- | :---- | :---- | :---- | :---- |
  | general | public, `is_general` | lan | all 8 | "Company-wide announcements and general chat" / "Everything that concerns the whole studio. Keep it friendly and keep it short." |
  | project-launch | public | lan | all 8 | "Everything for the 1.0 launch: checklist, builds, announcement" / "The working room for the launch. Decisions get pinned. Daily Meet when we are close." |
  | mobile-release | public | minh | lan, minh, alex, khoa, jordan | "TestFlight builds, store review, release notes" / "Builds, crashes and store submissions for iOS and Android." |
  | design-crit | public | sam | lan, sam, thu, mai, alex | "Share work in progress and get quick feedback" / "Post a screen, say what kind of feedback you want, and we respond within the day." |
  | dev-infra | public | minh | lan, minh, khoa | "Servers, tailnet, certificates, snapshots" / "Infrastructure notes for the dev environment on the company tailnet." |
  | random | public | lan | lan, minh, alex, sam, thu, khoa, mai | "Everything that is not work" / "Lunch plans, football, music." |
  | reading-club | public | sam | minh, sam, mai | "One book a month, chat on Fridays" / "Optional. Pick up any time." |
  | leadership | private | lan | lan, minh, thu | "Private: hiring, budget, roadmap" / "Only the three of us. Hiring, contracts and anything not ready for the team." |
  | direct message | `dm` | lan | lan, minh | none |
  | direct message | `dm` | lan | lan, sam | none |
  | direct message | `dm` | lan | lan, jordan | none |
  | group | `group_dm` | lan | lan, alex, thu | none |

  Jordan is not in `random`, as in the prototype. Member rows: 42 in the channels and 9 in the direct messages and the group, 51 in all. For Lan's own rows the notification level is the prototype's: `all` in every conversation the prototype marks `all`, `mentions` in `design-crit` and `random`, and `project-launch` is starred; every other member row has a null level and is not starred (the prototype is one person's view, Lan's). Check: after the seed, the rows of `conversations` and `conversation_members` equal the table column by column (names, kinds, privacy, creators, topics, descriptions, member sets, levels, stars), counts 12 conversations and 51 member rows; `#general` has `is_general` true and 8 members; a direct message holds the key of `buildDmKey` of its two people.
- R7. Messages. `seedMessages` writes the 54 messages of the table "What the prototype holds", each with its conversation, author, text, parent and time as the prototype has them: the text copied as written (diacritics, quotes and the `@Lan` mention included), no text over 10,000 code points and none empty, the author a member of the conversation, `kind` `user`, `also_in_channel` false, no `deleted_at`. The message `l13` has `edited_at` set one minute after its `created_at` (a sample value; the prototype only says "edited"); no other message has one. Check: the seeded database holds 54 `messages` rows, per conversation 5, 16, 6, 4, 4, 4, 4, 1, 3, 3, 2, 2; a data test compares each row's conversation, author, text, parent and minute with the typed data file, and a second test fails when the file holds a message whose author is not in its conversation's member list, a text that is empty, a text over 10,000 code points, or a conversation that does not exist.
- R8. The thread. Three messages of `project-launch` (`l6a`, `l6b`, `l6c`, authors jordan, alex and khoa) have `parent_id` the id of `l6` (alex's "TestFlight build 214 is live..."), `also_in_channel` false. After the replies are written, `seedMessages` calls `recomputeThreadSummary(tx, rootId)` of the `messages` module (TOKI-045 R9) for the root, so the summary columns come from the same function the replies route uses and not from a second copy of the rule. Check: the row of `l6` has `reply_count` 3, `last_reply_at` equal to the `created_at` of `l6c`, `reply_user_ids` the ids of jordan, alex, khoa in that order, `summary_version` 1; every other message has `reply_count` 0; the main list of `project-launch` read through `GET /api/v1/conversations/{id}/messages` as Lan holds 13 messages and none of the three replies, and `GET .../messages/{rootId}/replies` of TOKI-045 returns the three in time order.
- R9. Time. The sample is placed relative to the moment of the run, with the prototype's own gaps. The prototype's clock stands at 10:42 on its "today" (a Tuesday, 10 November 2026), its "yesterday" is the day before, and its wall times are those of Ho Chi Minh City (UTC+07:00, the zone of 7 of the 8 people; the workspace has no time zone setting). `seedPrototypeWorkspace` takes the clock as a parameter; with `now` the clock's time, every instant `P` of the data (messages, channel creation, account creation, reactions, the pin) is stored as `P + (now - T)`, where `T` is 10 November 2026 10:42 at UTC+07:00. So with the clock set to `T` every message lands at the prototype's wall time on 9 and 10 November 2026, and with any other clock every gap is the same and the newest sample message (`l14`, 10:20) is 22 minutes before `now`, never after it. The command passes the system clock (TOKI-008 R19: no direct read of the system time in the step). The channels' creation dates are the prototype's ("Jan 8", "Sep 2", "Sep 14", "Sep 20", "Oct 1", "Mar 4", "Feb 3") at 09:00 UTC+07:00 of 2026 and `#general` and `random` carry "Jan 8"; the accounts and the workspace are created at the creation time of `#general`; a direct message or the group is created one minute before its first message; a member row has the creation time of its conversation (these are sample values: the prototype has dates but no hours). Check, with the controllable clock of TOKI-008 set to `T`: the `created_at` of `g1` is 15:10 on 9 November UTC+07:00 and that of `l14` is 10:20 on 10 November; with the clock set to `T` plus 400 days every `created_at` is 400 days later; no `created_at`, `edited_at` or `pinned_at` of the seed is after `now` in either run; in each conversation the order by (`created_at`, `id`) is the prototype's order (no two messages of one conversation share a minute).
- R10. Ids. Every id of the seed (workspace excepted: `createWorkspace` makes its own, as the first-admin step does) is a lower-case UUIDv7 made with `createUuidV7Generator` of `packages/shared`, built for each row with a clock fixed at that row's own stored time and a random source that the caller passes in (the command passes `node:crypto`'s `randomBytes`; a test passes a fixed source). The step reads neither the system time nor a random source itself. Check: every seeded user, conversation and message id has `7` as its 13th hex digit and a time part equal to the row's `created_at` in milliseconds; two calls on emptied databases with the same clock and the same fixed random source write identical rows (ids included); the source file of the step contains neither `Date.now`, `new Date()` without an argument, `Math.random`, nor `crypto.random` (the lint rule that checks the clock, `scripts/check-clock-use.sh`, passes).
- R11. Reactions. `seedReactions` writes 27 rows of `message_reactions` (TOKI-046 R1) on 12 messages: 9 `👍`, 3 `🚀`, 4 `✅`, 8 `🎉`, 2 `👀`, 1 `😂`, and none of any other emoji. The prototype's `👋` is not one of the 8 fixed emoji (D-017, TOKI-046 R3) and the table refuses it, so the seed writes `🎉` for it: `g1` (the welcome to Jordan, 4 people) is the only kept message that had `👋`, and the welcome message has no `🎉` of its own, so no (person, emoji) pair is written twice. Every reaction is by a member of the message's conversation, has the `created_at` of its message plus one minute (a sample value), and a message has at most one row for each (person, emoji). The data file holds the prototype's `👋` as it is and one mapping table `{ "👋": "🎉" }`, applied in one place, so the mapping can be read and changed without touching the rows. Check: the seeded database holds 27 rows on 12 messages with the counts above; `select distinct emoji` returns only members of `REACTION_EMOJI`; every row passes `message_reactions_emoji_check` (the insert would fail otherwise); a unit test fails when the data file holds an emoji that is neither in `REACTION_EMOJI` nor a key of the mapping; the entry of `g1` read through the history route shows one chip `🎉` with the ids of lan, minh, sam, mai in id order.
- R12. The pin and the lines. `seedPins` writes one row of `message_pins` (TOKI-048 R1): the message `l3` ("Reminder: UI freeze is Thursday..."), `pinned_by` its author thu (the prototype marks it pinned and names no one; the channel description says "Decisions get pinned"), `pinned_at` one minute after the message (sample values). The pin is written as a row only: the seed writes no system line, so no `message_pinned` line appears, because the prototype draws no system line in its data. The seed writes no message of kind `system` at all, no channel-created, member-joined or topic line (TOKI-037 R16). Check: `message_pins` holds 1 row; the entry of `l3` read through the history route has `pinned` equal to `{ by: <thu>, at: <time> }` and every other entry has `pinned` null; `GET /api/v1/conversations/{id}/pins` of TOKI-048 returns `l3` alone; the seeded database holds no `messages` row of `kind` `system`.
- R13. What the seed does not write. After the seed the tables of sign-in and sessions (`sessions`, `login_codes`, `devices`, `emergency_links`), of invitations and of the event log (`events`, and `event_counters` at its start value) hold no row, and the seeded database holds no account with a role other than `member` or `admin`, no conversation whose name is `client-saigon-coffee`, no reaction `👋`, no message with an empty text and no message authored by anyone outside the 8. The seed makes no session, no code and sends no mail: the person signs in with the usual code, and in development the mail lands in the Mailpit inbox (TOKI-021). Check: counts of those tables are 0; the other facts by a query each. Nothing in the seed calls `recordChange`, `recordEvent` or `appendEvent`: a test builds the step with a recording handler list and finds no call.
- R14. The empty-database rule and the order. The step runs in one transaction. First it takes the advisory lock of the first set-up, `ADVISORY_KEYS.firstAdmin` under `ADVISORY_NAMESPACE` (`db/advisory-locks.ts`; no new key), so a seed and the server's first set-up (TOKI-020 R9) never interleave: the second waits, then reads what the first left. Then it counts the rows of `workspaces` and `users`. It answers one of three results: `loaded` (both counts are 0: it writes everything), `already_loaded` (the database holds the sample, defined in R15: it writes nothing) and `not_empty` (any other state: it writes nothing). Check: three database tests, one for each result, counting the rows of every table touched before and after; one test starts two calls at once on an empty database with a test hook of the step, awaited inside its transaction after the lock (as TOKI-020 "Test hooks" does), that holds the first and finds one set of rows, results `loaded` and `already_loaded`.
- R15. Run twice, and the server's own set-up. The sample is "already loaded" when the database holds exactly one workspace named `Hugepig Studio`, the 8 addresses of R5 and a `project-launch` channel; the check reads those three facts only, so a person's edit of a message does not turn it into "not empty". A second `dev:seed` after a first writes nothing, exits 0 and says the sample is already loaded. A database on which the server's first set-up already ran (one workspace, one first Admin, `#general`) is `not_empty`: the command writes nothing, exits 1 and says to run `pnpm dev:reset:db` first, then `pnpm dev:seed`, then start the server (first-admin spec, concern 13). After the seed, the server's `ensureFirstAdmin` finds accounts and returns `skipped` (TOKI-020 R7): the `FIRST_ADMIN_*` values of `.env` are not used and not needed to differ. Check: a database test calls the seed twice (second result `already_loaded`, no row added or changed); one calls `ensureFirstAdmin` first and then the seed (`not_empty`, counts unchanged) and one calls the seed first and then `ensureFirstAdmin` (`skipped`, counts unchanged); a process test runs the command against the test database in each of the three states and reads the exit codes 0, 0 and 1 and the three messages.
- R16. All or nothing. A failure at any step (a row refused by a table check, a missing module entry, a lost connection) rolls back the whole transaction: no row of the seed stays, the command exits 1 and the message holds the name of the step and no value. Check: with a hook that throws after the accounts, after the conversations, after the messages, after the reactions and after the pins in turn, the counts of every table of R14 are those of an empty database each time; the captured output holds no email, display name or message text of the sample.
- R17. One function, three callers. `seedPrototypeWorkspace(deps, hooks?)` of `apps/server/src/seed/index.ts` takes `{ db, clock, randomBytes, logger }` and returns `loaded`, `already_loaded` or `not_empty`; it never reads `process.env`, so the command, a database test and (later) the end-to-end setup of TOKI-090 call the same function. It also exports `PROTOTYPE_SEED`, the typed data (R5 to R12), so a test can read the expected values without a second copy. The command logs through the server's logger with the fields `result` and the counts (`users`, `conversations`, `messages`, `reactions`, `pins`) and writes one line on standard output with the result; it logs no email, name, topic or text. Check: the three callers named above exist in the tests (the command by the process test of R15, the function by the database tests, `PROTOTYPE_SEED` by the data tests); the log lines of a run are read and hold only the named fields.
- R18. The seed is visible to the app, not only to SQL. After the seed, the app's own read paths show the sample to the right people. Check, through the real routes with a session of the person (the test makes the session itself, as the route tests of TOKI-022 do): Lan's conversation list (`listConversationSummaries`) holds the 11 conversations she is a member of (7 channels, the 3 direct messages and the group) and not `reading-club`; Alex gets 404 `not_found` for `leadership` (a private channel he is not in, TOKI-037 R1 step 2); a person who is not in `reading-club` (Lan) gets 403 `forbidden` on its history and Minh reads its 1 message; each seeded direct message and the group show their messages to their members; every kept message is returned by the history of its conversation, and the roots and replies are told apart (R8).
- R19. A person can sign in as a seeded person. After the seed, the sign-in flow of TOKI-022 for `lan@hugepig.example` finds an active account and sends its code (TOKI-021), which the test reads from the mail catcher's capture; the same holds for each of the 8. Check: the sign-in route test asks for a code for each of the 8 addresses and gets the "code sent" answer, and an address `lan@hugepig.invalid` that is not seeded gets the same answer and no mail (TOKI-022's rule that the answer does not reveal whether an account exists). This is a check of the data (every account is active, lower-case, valid), not a new sign-in path.
- R20. Documentation. "Common commands" of `CLAUDE.md` gains one row, `pnpm dev:seed`, that says: loads the prototype's sample workspace into an empty development database; run after `pnpm dev:reset:db` and before the server starts; refuses outside development and on a database that holds other data. The row lists no password and no code (there is none); it names the domain `hugepig.example` and Mailpit as where the sign-in code arrives. Check: the row is in the file; `pnpm format:check` passes.
- R21. Sample data stays sample. The seed file, the command and the four entry files carry a header that says the data is for development and tests only and that production starts with `#general` only (D-031, D-147). A test fails when a file outside `apps/server/src/seed/`, `scripts/`, test files and `docs/` contains the string `hugepig.example`; this keeps the sample's addresses from spreading into code that runs in production. Check: the test passes today and fails when a line `const addr = "lan@hugepig.example"` is added to a file of `apps/server/src/modules/`.

## Design
### Where it lives
```
toki/
├─ package.json                          dev:seed -> bash scripts/seed.sh
├─ scripts/
│  ├─ seed.sh                            guard_development, --check, then the server script
│  └─ seed.test.sh                       the six guard cases (R1)
└─ apps/server/
   ├─ package.json                       script "seed": tsx --env-file-if-exists=../../.env src/cli/seed.ts
   └─ src/
      ├─ cli/seed.ts                     the command: NODE_ENV check, config, connection, one call, exit code
      ├─ cli/config.ts                   readSeedConfig (NODE_ENV and DATABASE_URL only)
      ├─ seed/
      │  ├─ index.ts                     seedPrototypeWorkspace, PROTOTYPE_SEED
      │  ├─ data.ts                      the sample, typed: people, conversations, messages, reactions, pin, mapping
      │  └─ time.ts                      P + (now - T), the 9 and 10 November anchors
      └─ modules/
         ├─ members/seed.ts              seedAccounts
         ├─ conversations/seed.ts        seedConversations
         ├─ messages/seed.ts             seedMessages, seedPins
         └─ reactions/seed.ts            seedReactions
```
- `seed/` sits outside `modules/` like `first-admin.ts`, for the same reason: a step inside one module that calls the others would make an import cycle, and it may import only the `index.ts` of each module (TOKI-002 R17).
- Each `modules/<name>/seed.ts` is re-exported from that module's `index.ts`. The five names are the only way the seed reaches a table. Nothing else imports them (R3).

### How it works
1. `pnpm dev:seed` runs the shell guard (R1), then the server script, which runs the command.
2. The command checks `NODE_ENV` (R2), reads `DATABASE_URL`, opens one connection and calls `seedPrototypeWorkspace` with the system clock (TOKI-008) and `node:crypto`'s `randomBytes`.
3. The step opens one transaction, takes the first-set-up lock, counts workspaces and users (R14) and, on an empty database, writes in this order: workspace, accounts, `#general` and the other conversations with their members, messages (roots, then replies), the thread summary, reactions, the pin.
4. It commits and returns `loaded`. The command prints the result and exits 0 (`loaded`, `already_loaded`) or 1 (`not_empty`, a failure).

### Decided in this spec
These are technical choices that the Blueprint leaves to the builder.
- Method: module entries, in one transaction, not the HTTP routes and not SQL. The routes read the clock at the request, so they cannot place a message in the past (TOKI-037 R3), they need a session for each person and they write an event for every change; SQL would read tables of other modules. Entries keep the module rule and let the step choose times and ids.
- The five entries are narrow and named `seed*`, and a test fixes who imports them (R3), because a general "create account with any role" entry is what the first-admin spec refused (its concern 14).
- Times are shifted by `now - T`, so the sample always looks like "yesterday and today", the newest message is never in the future, and a test that fixes the clock to `T` gets the prototype's exact wall times (R9).
- `👋` becomes `🎉` (R11): both are greetings of welcome, the 8 emoji have no wave, and the welcome message has no `🎉` of its own. Dropping the chip would lose the only reaction of the welcome message.
- The guest, the guest's channel and the three messages with no text are left out whole, and the attachments of every kind are left out (Scope): a message needs a text and the tables hold no attachment.
- The pin and the thread summary: the pin is a row with no system line (R12); the summary is made by `recomputeThreadSummary` (R8).
- The first-set-up lock is reused (R14). Reason: the two steps are the same event, the set-up of an empty installation, and one key means they can never both write.
- No events and no system lines: the sample is loaded before any client connects, so there is nobody to tell; and the event log is pruned after 7 days (TOKI-036), so seeded events would be gone in a week and a reconnecting client would be told things that never needed telling.

### Errors
- `NODE_ENV` is not `development` -> exit 1 before any connection (R2); the shell guard refuses earlier (R1).
- `DATABASE_URL` is missing or invalid -> exit 1, the message names the variable (the way `emergency:link` does).
- The database cannot be reached, or a table does not exist (migrations not applied) -> exit 1, nothing written.
- The database holds other data -> `not_empty`, exit 1, the message says what to run (R15).
- The sample is already there -> `already_loaded`, exit 0 (R15).
- A step fails -> the whole transaction rolls back and the command exits 1 (R16).

## Testing
- Shell: `scripts/seed.test.sh` for the guard (R1). It runs without Docker and never writes `.env`.
- Unit (no database): the typed data (R5 to R7, R11, R12: counts, authors in their conversations, no empty or over-long text, no emoji outside `REACTION_EMOJI` and the mapping), the time shift (R9, with the clock of TOKI-008), the id generator use (R10), the import-line tests (R3, R4, R21), `readSeedConfig` and the NODE_ENV refusal (R2).
- Database (`*.db.test.ts`, the harness of TOKI-008 empties the tables): the three results and the lock (R14, R15), the counts and column-by-column equality (R5 to R9, R11, R12), the empty tables (R13), the rollback hooks (R16), the real read paths and sign-in (R18, R19).
- Process: the command run against the test database for the guard and the three states (R2, R15).
- Timing is never tested with a real timer: every check of R9 uses the controllable clock.
- Hand check once, output in the PR: `pnpm dev:reset:db`, `pnpm dev:seed`, `pnpm dev`, sign in as `lan@hugepig.example` with the code from Mailpit and open `project-launch`; run `pnpm dev:seed` again and read "already loaded".

## Data safety
- The sample holds no real address: the domain `hugepig.example` cannot receive mail (R5, R21).
- The command logs counts and a result only (R17); no email, name or text goes to a log.
- The seed makes no session, no code and no credential (R13).
- It writes nothing when the database holds other data (R14, R15), so pointing `DATABASE_URL` at a database in use cannot change it; the `NODE_ENV` guards stop it earlier (R1, R2).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Hugepig Studio, 8 people, Member and Admin only, no Owner | R5, "What the prototype holds" |
| For development and tests; never in production | R1, R2, R3, R14, R15, R21; hand-off of the image to TOKI-084 (Scope) |
| Only the 8 fixed emoji; 👋 is not one of them | R11, the mapping |
| 1 to 10,000 characters; threads one level deep | R7, R8 |
| Guest is phase 5; the tables accept Member and Admin only | R5, R13, "What the prototype holds" |
| Files and images join in TOKI-063 | Scope (Out), "What the prototype holds" |
| No real person's address | R5, R21 |
| UUIDv7 from the shared generator; time from the injected clock | R9, R10 |
| Modules called only through public interfaces | R4, R3, "Where it lives" |
| A reset wipes; the seed fills an empty database; the order is wipe, seed, start | R1, R14, R15, Scope (Out) |
| Needs TOKI-045, 046, 048 and the built first admin, account, conversation, local-dev and messages tables | R8 (`recomputeThreadSummary`), R11 (`message_reactions`), R12 (`message_pins`), R14 (the lock of TOKI-020), R1 (`scripts/` of TOKI-003) |
| Milestone M3, size M | Planning fact: one command, one data file, five small entries in four files |
| Belongs to I06 realtime-messaging | Planning fact |

## Open questions from the intent
1. Which parts of the prototype's data the seed may not contain, and why. Answered: the table "What the prototype holds" and R13.
2. How the seed treats `👋`. Answered: it writes `🎉` through one mapping (R11).
3. How the data is written. Answered: module entries in one transaction (R4, "Decided in this spec").
4. What the command does when the first set-up already ran, when run twice and in production. Answered: R1, R2, R14, R15.
5. Which ticket adds the data that later tickets create to the seed. Not answered: see concern 1.

## Areas of concern
1. Who adds later data to the seed. The plan says only that TOKI-063 adds files and images. Three more kinds are not owned: the profile fields of a person (job title, time zone, city, status text, presence; TOKI-057 and TOKI-078 add the columns), the unread counts and the @mention mark of the prototype (the read pointer is TOKI-053's), and the attachments that are not files or images (link card, poll, voice message, Meet card, approval card), whose tickets may not exist in phase 1. Not decided. Proposal, not a decision: the ticket that adds a table or a column the prototype's sample also fills extends the seed in its own pull request, as TOKI-063 does, and the seed's data file is the one place to add it. Owner: the product owner, with the owner of each of those tickets.
2. Whether the seed leaves out the guest's channel and the three messages with no text. The Blueprint says "the sample channels and messages" and does not list what is left out. Decided in this spec: they are left out (R7, "What the prototype holds"), for the reasons given there (Guest is phase 5, D-152; a message needs a text, TOKI-037 R4). If the product owner wants the sample to show the guest channel from phase 5, it is added then, with the Guest role. Owner: Thanh Truong.
3. The mapping of `👋` to `🎉`. The log fixes 8 emoji (D-017) and says nothing about the sample's wave. Decided in this spec: the seed writes `🎉` (R11), one mapping table. Reason: the welcome message has no `🎉` of its own, so the chip stays and the greeting meaning is kept. Owner: Thanh Truong.
4. Where the sample's hours and some dates come from. The prototype gives day and hour for messages and a month and day for channels, but no hour for channel creation, no account creation date, no pinner, no reaction time and no edit time. Decided in this spec: the sample values of R6, R9, R11 and R12 (09:00 UTC+07:00 for a channel, the creation time of `#general` for the accounts, the author for the pin, one minute after the message for a pin, a reaction and an edit). They have no product meaning; a test or a screen must not depend on them. Owner: Thanh Truong.
5. What the sample's people are for in the end-to-end runs. TOKI-090 chooses its 12 flows from the journeys (D-091); which flows use which person, and whether a flow needs data this seed does not hold (a Guest, a deactivated person, an archived channel), is its decision. Decided here only for this ticket: the seed gives it the 8 people, the 12 conversations and the function of R17. Owner: the owner of TOKI-090.
