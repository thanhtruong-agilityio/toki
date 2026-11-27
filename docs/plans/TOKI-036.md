# TOKI-036 Messages and events tables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans with
> cl-dev:test-driven-development, task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** the tables `messages`, `events` and `event_counters`, the one writer, lock, reads and
pruning of the event log, and a real `eventNumber` in the bootstrap answer.

**Architecture:** two new server modules (`messages`, `realtime`) with Drizzle table files and one
migration whose keys that leave a module, functions and triggers are written by hand. Event numbers
come from a counter row locked until the commit.

**Tech Stack:** TypeScript, Drizzle ORM 0.45 with postgres.js 4, drizzle-kit 0.31, PostgreSQL 17,
Fastify 5, Vitest.

**Spec:** `docs/specs/2026-11-20-messages-events-tables-design.md`. **Read the requirement named in a
task before its first step; its "Check:" sentence lists the cases the test must hold.**

## AC -> step -> test

Paths of tests are under `apps/server/tests/` unless they start with `packages/`.

| AC | Task | Test file :: test |
|---|---|---|
| R1 columns, allow-list, empty | 2 | `messages-tables.db.test.ts` :: "R1: has the fourteen columns and no column outside the allow-list" |
| R2 id, UUIDv7, repeat | 2 | same :: "R2: makes a UUIDv7, keeps a given id, refuses a repeat" |
| R3 kind and shapes | 2 | same :: "R3: ..." (`it.each` over the refused rows) |
| R4 body length | 2 | same :: "R4: counts 10,000 code points" |
| R5 thread depth | 2 | same :: "R5: one level, one conversation" |
| R6 lifecycle | 2 | same :: "R6: deleted_at and deleted_by go together" |
| R7 immutable columns | 2 | same :: "R7: refuses a change of %s" |
| R8 no delete | 2 | same :: "R8: refuses every delete" |
| R9 keys | 2 | same :: "R9: every key is enforced and restricts" |
| R10 times | 2 | same :: "R10: three timestamptz columns with no default" |
| R11 indexes, no sort | 3 | `messages-reads.db.test.ts` :: "R11: %s uses the index with no Sort" |
| R12 order and cursor | 3 | same :: "R12: pages of 7 return every row once, both ways" |
| R13 events table | 2 | `events-tables.db.test.ts` :: "R13: ..." |
| R14 counter and triggers | 2 | same :: "R14: ..." |
| R15 recordEvent | 5 | `realtime/append.db.test.ts` :: "R15: ..."; `realtime/record-input.test.ts` :: "refuses a wrong scope before any statement", type test |
| R16 no gap | 5 | `realtime/append.db.test.ts` :: "R16: B waits and no number is visible", "R16: a rollback gives its number back", "R16: 24 transactions leave 1 to M" |
| R17 one transaction | 5 | same :: "R17: ..." |
| R18 lock order | 5 | same :: "R18: numbers stay together", "R18: two writers of one conversation finish", "R18: documents the rule no FOR UPDATE on these rows" |
| R19 last number, bootstrap | 7, 9 | `realtime/read-prune.db.test.ts` :: "R19: ..."; `bootstrap/event-number.db.test.ts`, `bootstrap/bounds.db.test.ts`, `bootstrap/build.db.test.ts` |
| R20 oldest, prune | 7 | `realtime/read-prune.db.test.ts` :: "R20: ..." |
| R21 starter, main | 8 | `realtime/prune-start.db.test.ts`; `main-pruning.db.test.ts` |
| R22 shared values | 1, 2 | `packages/shared/tests/messages/limits.test.ts`, `packages/shared/tests/realtime/event-log.test.ts`; `events-tables.db.test.ts` :: "R22: the checks hold the shared values" |
| R23 one migration | 2 | `messages-tables.db.test.ts` :: "R23: three CREATE TABLE statements"; `migrate.db.test.ts`; `pnpm db:generate` reports no change (command) |
| R24 boundaries, TRUNCATE | 2, 4, 10 | `messages/exports.test.ts`, `realtime/exports.test.ts`, `realtime/boundaries.test.ts`, `conversation-tables.db.test.ts` :: "R23: one TRUNCATE empties every table"; `pnpm lint` |
| R25 nothing else changes | 10 | `realtime/boundaries.test.ts`; commands of Task 10 (routes, `changes.ts` unchanged) |
| R26 readEventsAfter | 7 | `realtime/read-prune.db.test.ts` :: "R26: ..." |
| R27 lockEventCounter | 6 | `realtime/lock.db.test.ts` :: "R27: ..." |

## Global Constraints

- Test-first: each new test is run and seen failing for the right reason before its code.
- Database tests use throwaway databases, made-up data, and never sleep for a result.
- No server code writes a row of `messages`; only `modules/realtime/` calls `appendEvent` or
  `recordEvent` (R25).
- No log line and no error text built here holds a body or a payload.
- `modules/conversations/changes.ts` and `apps/server/src/app.ts` do not change.
- Conventional Commits, lowercase subject, each ending `(TOKI-036)`.
- Before each commit: `corepack pnpm exec prettier --write` on the touched files, then
  `corepack pnpm lint` and `corepack pnpm typecheck`. The code in this plan is not wrapped to the
  Prettier width.
- Node 22: `export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"`, then `corepack pnpm`.
- `.env` is never created or read.

## Design

### Pieces

| Piece | Holds | Depends on |
|---|---|---|
| `packages/shared/src/messages/{limits,index}.ts` | `MESSAGE_TEXT_MAX`, `MESSAGE_KINDS` | nothing |
| `packages/shared/src/realtime/{event-log,index}.ts` | `EVENT_SCOPES`, `EVENT_RETENTION_DAYS`, `EVENT_PRUNE_INTERVAL_MS` | nothing |
| `modules/messages/schema.ts`, `index.ts` | table `messages`; the index exports nothing | shared |
| `modules/realtime/schema.ts` | tables `events`, `event_counters` | shared |
| `modules/realtime/append.ts` | scope check, raise of the counter, insert (internal) | schema |
| `modules/realtime/record.ts` | `recordEvent`: append, then `pg_notify` | append |
| `modules/realtime/lock.ts` | `lockEventCounter` | schema |
| `modules/realtime/read.ts` | the three reads | schema |
| `modules/realtime/prune.ts` | `pruneEvents`, `startEventPruning` | schema |
| one migration | three tables, indexes, hand-written keys, functions, triggers | TOKI-028 tables |
| `bootstrap/event-number.ts`, `build.ts` | `readEventNumber(tx, workspaceId)` calls `getLastEventNumber` | realtime index |
| `main.ts` | starts the pruning after `listen`; `onClose` awaits its stop before the connection closes | realtime index |

### Migration

Generated with `db:generate --name messages_events_tables`, then edited by hand as
`0002_conversation_tables.sql` is: the keys that leave the module (`ON DELETE RESTRICT`, the
workspace key before the composite conversation key, so an unknown workspace names its own key),
then the functions and triggers, each raising `23514` with the trigger's name as the constraint.
The self-reference `messages_parent_id_fkey` (with `.onDelete("restrict")`, because Drizzle's
default is `no action`) and both partial indexes stay in the schema file.

- `messages_thread_depth_trg` refuses a parent that is a reply or a system line, **and a parent it
  cannot find**. With "refuse only what is found", a row whose `parent_id` is its own `id` would
  pass the trigger and then satisfy the foreign key. It looks the parent up by `id` only, so a
  parent of another conversation passes the trigger and the composite key names that error. It takes
  no lock: a parent's `kind` and `parent_id` never change and no row is deleted.
- `events_number_trg` and `event_counters_step_trg` fire before the check constraints. The tests of
  `events_number_check` (-1, 2^53) and of `event_counters_last_number_check` therefore disable the
  one trigger, so each refusal can only come from the check; 0 needs no disabling (lock the counter
  at 0, then insert). The tests that set a counter to a large number disable the step trigger the
  same way. `disable trigger` always runs inside a transaction that enables it again or rolls back,
  so a failing test cannot leave it off.
- The step trigger also fires for the proposed row of `insert ... on conflict`; the proposal is 1 in
  `appendEvent` and 0 in `lockEventCounter`, which the trigger accepts.
- Postgres evaluates checks in name order (see departure 3).

### Event log code

- `appendEvent` checks scope against the two ids first and throws a plain error before any
  statement, then runs the counter upsert (`returning last_number`) and the insert.
- `bigint` columns use Drizzle's `number` mode; `min` and `max` are converted with `Number`.
- Errors of the database pass through unchanged (spec, "Errors").
- `getLastEventNumber` uses the query builder, so the statement reads `from "event_counters"`, the
  text that the statement test of the bootstrap call matches.
- `pruneEvents`: one grouped statement for the cut of each workspace, then per workspace one delete
  per batch, filtered by workspace on both levels (numbers repeat across workspaces). The batch is
  `number = any(array(select ... order by number limit n for update))`. The `array(...)` form is
  deliberate: with `in (select ... limit n for update)` the planner may run the subquery again for
  each row and delete more than `n`. Two runs lock rows in the same order, so they wait for each
  other and cannot deadlock, and a batch is short only when nothing is left.
- `startEventPruning` runs at once, then on the schedule. A tick while a run is in progress does
  nothing. The returned `stop` cancels the schedule and awaits the run.

### Departures from the spec

What each check proves does not change, except in 4.

1. R21 and the Layout put the two process cases in `tests/main.test.ts`. That file runs with no
   Postgres (`vitest.config.ts` excludes only `*.db.test.ts`), so they go into a new
   `tests/main-pruning.db.test.ts`.
2. The Layout names `realtime/prune-start.test.ts`; its checks need a real prune, so the file is
   `realtime/prune-start.db.test.ts`.
3. R3 lists "a system line with `also_in_channel` true" under the named checks.
   `messages_also_in_channel_check` refuses it first, and with a parent the parent clause refuses
   it, so that clause of `messages_system_shape_check` has no case of its own. The test asserts the
   name Postgres reports.
4. R25 asks for "a test of the registered routes" that compares the list with the one before. A
   permanent list of every route would fail each later ticket that adds one. The comparison is made
   once (Task 10, output in the pull request), and a lasting test proves that the two new modules
   register no route.

## Tasks

### Task 0: set up

- [ ] `corepack pnpm install --frozen-lockfile` in the worktree.
- [ ] Start a throwaway Postgres in the session scratchpad (`$S`), version 17 if one is installed,
  else the installed one:

```bash
initdb -D "$S/pg" -U toki --auth=trust
pg_ctl -D "$S/pg" -o "-c unix_socket_directories= -p 54399" -l "$S/pg.log" start
export TEST_DATABASE_URL=postgres://toki@127.0.0.1:54399/toki_test
```

The name must end in `_test` (`tests/guard.ts`); the global setup creates the database. Do not set
`DATABASE_URL`: the guard refuses a test database that is also the development one.

- [ ] Run `corepack pnpm exec vitest run --project server-db` once before any change and write down
  the failures of the baseline (Postgres older than 17 fails some tests of other tickets).

### Task 1: shared values (R22)

**Files:** create `packages/shared/src/messages/{limits,index}.ts`,
`packages/shared/src/realtime/{event-log,index}.ts`,
`packages/shared/tests/messages/limits.test.ts`, `packages/shared/tests/realtime/event-log.test.ts`;
modify `packages/shared/src/index.ts`.

**Produces:** `MESSAGE_TEXT_MAX`, `MESSAGE_KINDS`, `MessageKind`, `EVENT_SCOPES`, `EventScope`,
`EVENT_RETENTION_DAYS`, `EVENT_PRUNE_INTERVAL_MS` from `@toki/shared`.

- [ ] Tests: each value equals the value below, imported from `../../src/index.js`; and
  `existsSync` of `src/messages.ts` is false. Run `corepack pnpm exec vitest run packages/shared`:
  FAIL, the names are not exported.
- [ ] Code:

```ts
// messages/limits.ts
export const MESSAGE_TEXT_MAX = 10_000;
export const MESSAGE_KINDS = ["user", "system"] as const;
export type MessageKind = (typeof MESSAGE_KINDS)[number];

// realtime/event-log.ts
export const EVENT_SCOPES = ["workspace", "conversation", "user"] as const;
export type EventScope = (typeof EVENT_SCOPES)[number];
export const EVENT_RETENTION_DAYS = 7;
export const EVENT_PRUNE_INTERVAL_MS = 3_600_000;
```

Each `index.ts` is `export * from "./<file>.js";`; the package index gains
`export * from "./messages/index.js";` and `export * from "./realtime/index.js";`.

- [ ] PASS; commit `feat(shared): add the message and event log values (TOKI-036)`.

### Task 2: tables and migration (R1 to R10, R13, R14, R22, R23)

**Files:** create `apps/server/src/modules/messages/{schema,index}.ts`,
`apps/server/src/modules/realtime/schema.ts`,
`apps/server/migrations/0005_messages_events_tables.sql` (and `meta/`),
`apps/server/tests/messages-tables.db.test.ts`, `apps/server/tests/events-tables.db.test.ts`;
modify `apps/server/tests/test-rows.ts`, `apps/server/tests/conversation-tables.db.test.ts`.

**Produces:** tables of the two schema files; `insertMessage(sql, values)` in `test-rows.ts`:

```ts
// A user message by default (TOKI-036). A reply passes `parent_id`; a system
// line passes `kind`, `system_type` and `system_user_ids`, and an empty body.
export function insertMessage(
  sql: Sql,
  values: {
    workspace_id: string;
    conversation_id: string;
    author_id: string;
  } & Values,
): Promise<string> {
  const id = crypto.randomUUID();
  return insert(sql, "messages", {
    id,
    kind: "user",
    body: "Test message",
    also_in_channel: false,
    created_at: FIXED,
    ...values,
  });
}
```

- [ ] Write `messages-tables.db.test.ts` and `events-tables.db.test.ts` in the style of
  `conversation-tables.db.test.ts`: `createMigratedDb()`, rows by SQL text, each refusal asserted as
  `{ constraint_name: "<name>" }` next to an accepted row. Cases: the "Check:" sentences of R1 to
  R10, R13, R14, R22 (database part: `pg_get_constraintdef` of `messages_body_check`,
  `messages_kind_check`, `events_scope_check` holds the shared numbers and lists) and R23. Points:
  - R1 allow-list constant: `reply_count`, `last_reply_at`, `reply_user_ids`, `summary_version`,
    `search_vector`.
  - R3: the `deleted_at` case sets `deleted_by` too; the `also_in_channel` case expects
    `messages_also_in_channel_check`.
  - R5: add "a row whose `parent_id` is its own id" refused by `messages_thread_depth_trg`; the
    other-conversation reply expects `messages_parent_id_fkey`.
  - R2: every case is SQL text except the id that the caller leaves out. The UUIDv7 default is
    Drizzle's `$defaultFn` (the column has no database default), so that case inserts with
    `t.db.insert(messages)` from the ticket's own `schema.js`.
  - R9: `pg_constraint` rows of the three tables with `contype = 'f'` all have `confdeltype = 'r'`,
    and the set of their names is these nine: `messages_workspace_id_fkey`,
    `messages_conversation_id_fkey`, `messages_author_id_fkey`, `messages_deleted_by_fkey`,
    `messages_parent_id_fkey`, `events_workspace_id_fkey`, `events_conversation_id_fkey`,
    `events_user_id_fkey`, `event_counters_workspace_id_fkey`.
  - R13/R14: an accepted event needs its counter first; disable triggers as in "Migration".
  - R22: `pg_get_constraintdef` rewrites `in (...)` as `= ANY (ARRAY[...])`, so the test collects
    the quoted values of the definition with `/'([a-z_]+)'/g` and compares them with
    `MESSAGE_KINDS` and `EVENT_SCOPES`.
- [ ] The TRUNCATE test of TOKI-028 has no CASCADE, so it fails with the new tables: in
  `conversation-tables.db.test.ts` add a message, a counter row (insert 1) and an event, add
  `messages`, `events`, `event_counters` to `tables`, and rename the case "empties the eleven tables
  named, with no CASCADE".
- [ ] Run both: FAIL, `relation "messages" does not exist`.
- [ ] `modules/messages/schema.ts` (header comment as in the conversations schema):

```ts
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),
    authorId: uuid("author_id").notNull(),
    kind: text("kind").notNull(),
    systemType: text("system_type"),
    systemUserIds: uuid("system_user_ids").array(),
    body: text("body").notNull(),
    parentId: uuid("parent_id"),
    alsoInChannel: boolean("also_in_channel").notNull().default(false),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: uuid("deleted_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "messages_kind_check",
      sql`${table.kind} in (${sql.raw(MESSAGE_KINDS.map((k) => `'${k}'`).join(", "))})`,
    ),
    check(
      "messages_system_shape_check",
      sql`${table.kind} <> 'system' or (${table.systemType} is not null and ${table.systemType} ~ '^[a-z][a-z0-9_]{0,63}$' and ${table.systemUserIds} is not null and ${table.body} = '' and ${table.parentId} is null and not ${table.alsoInChannel} and ${table.editedAt} is null and ${table.deletedAt} is null and ${table.deletedBy} is null)`,
    ),
    check(
      "messages_user_shape_check",
      sql`${table.kind} <> 'user' or (${table.systemType} is null and ${table.systemUserIds} is null)`,
    ),
    check(
      "messages_body_check",
      sql`char_length(${table.body}) <= ${sql.raw(String(MESSAGE_TEXT_MAX))}`,
    ),
    check(
      "messages_also_in_channel_check",
      sql`not ${table.alsoInChannel} or ${table.parentId} is not null`,
    ),
    check(
      "messages_deleted_check",
      sql`(${table.deletedAt} is null) = (${table.deletedBy} is null)`,
    ),
    unique("messages_id_conversation_id_key").on(table.id, table.conversationId),
    foreignKey({
      name: "messages_parent_id_fkey",
      columns: [table.parentId, table.conversationId],
      foreignColumns: [table.id, table.conversationId],
    }).onDelete("restrict"),
    index("messages_conversation_main_idx")
      .on(table.conversationId, table.createdAt, table.id)
      .where(sql`${table.parentId} is null or ${table.alsoInChannel}`),
    index("messages_thread_idx")
      .on(table.parentId, table.createdAt, table.id)
      .where(sql`${table.parentId} is not null`),
  ],
);
```

`modules/messages/index.ts`: a comment saying TOKI-037 adds the functions, and `export {};`.

- [ ] `modules/realtime/schema.ts`:

```ts
const MAX = sql.raw(String(Number.MAX_SAFE_INTEGER));

export const events = pgTable(
  "events",
  {
    workspaceId: uuid("workspace_id").notNull(),
    number: bigint("number", { mode: "number" }).notNull(),
    scope: text("scope").$type<EventScope>().notNull(),
    conversationId: uuid("conversation_id"),
    userId: uuid("user_id"),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ name: "events_pkey", columns: [table.workspaceId, table.number] }),
    check("events_number_check", sql`${table.number} between 1 and ${MAX}`),
    check(
      "events_scope_check",
      sql`${table.scope} in (${sql.raw(EVENT_SCOPES.map((s) => `'${s}'`).join(", "))})`,
    ),
    check(
      "events_scope_shape_check",
      sql`(${table.scope} = 'workspace' and ${table.conversationId} is null and ${table.userId} is null) or (${table.scope} = 'conversation' and ${table.conversationId} is not null and ${table.userId} is null) or (${table.scope} = 'user' and ${table.userId} is not null and ${table.conversationId} is null)`,
    ),
    check("events_type_check", sql`${table.type} ~ '^[a-z][a-z0-9_.]{0,63}$'`),
    check("events_payload_check", sql`jsonb_typeof(${table.payload}) = 'object'`),
    index("events_created_at_idx").on(table.createdAt),
  ],
);

export const eventCounters = pgTable(
  "event_counters",
  {
    workspaceId: uuid("workspace_id").primaryKey(),
    lastNumber: bigint("last_number", { mode: "number" }).notNull(),
  },
  (table) => [
    check("event_counters_last_number_check", sql`${table.lastNumber} between 0 and ${MAX}`),
  ],
);
```

- [ ] `corepack pnpm --filter ./apps/server db:generate --name messages_events_tables`. Read the
  SQL: three `CREATE TABLE`, no other table touched, the two indexes carry their `WHERE`, the parent
  key says `ON DELETE restrict`. Then append, with `--> statement-breakpoint` between statements:

```sql
-- Written by hand (R9, R13, R14): the keys that leave the module, ON DELETE RESTRICT.
-- Each workspace key comes before the composite key, so an unknown workspace id
-- names the key under test.
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id","workspace_id") REFERENCES "conversations"("id","workspace_id") ON DELETE RESTRICT;
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
ALTER TABLE "events" ADD CONSTRAINT "events_conversation_id_fkey" FOREIGN KEY ("conversation_id","workspace_id") REFERENCES "conversations"("id","workspace_id") ON DELETE RESTRICT;
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
ALTER TABLE "event_counters" ADD CONSTRAINT "event_counters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;

-- Written by hand (R5): one level. A parent that is not found is refused too, so
-- a row cannot be its own parent.
CREATE FUNCTION "messages_thread_depth"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM messages p
    WHERE p.id = NEW.parent_id AND p.parent_id IS NULL AND p.kind = 'user';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'messages: a reply needs a root message as its parent'
      USING ERRCODE = '23514', CONSTRAINT = 'messages_thread_depth_trg';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "messages_thread_depth_trg" BEFORE INSERT ON "messages"
FOR EACH ROW WHEN (NEW.parent_id IS NOT NULL)
EXECUTE FUNCTION "messages_thread_depth"();

-- Written by hand (R7)
CREATE FUNCTION "messages_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'messages: the place and origin of a message cannot change'
    USING ERRCODE = '23514', CONSTRAINT = 'messages_immutable_trg';
END
$$;
CREATE TRIGGER "messages_immutable_trg" BEFORE UPDATE ON "messages"
FOR EACH ROW
WHEN (OLD.workspace_id IS DISTINCT FROM NEW.workspace_id
  OR OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
  OR OLD.author_id IS DISTINCT FROM NEW.author_id
  OR OLD.kind IS DISTINCT FROM NEW.kind
  OR OLD.system_type IS DISTINCT FROM NEW.system_type
  OR OLD.system_user_ids IS DISTINCT FROM NEW.system_user_ids
  OR OLD.parent_id IS DISTINCT FROM NEW.parent_id
  OR OLD.created_at IS DISTINCT FROM NEW.created_at)
EXECUTE FUNCTION "messages_immutable"();

-- Written by hand (R8). TRUNCATE is not blocked.
CREATE FUNCTION "messages_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'messages: a message is soft deleted, never removed'
    USING ERRCODE = '23514', CONSTRAINT = 'messages_no_delete_trg';
END
$$;
CREATE TRIGGER "messages_no_delete_trg" BEFORE DELETE ON "messages"
FOR EACH ROW EXECUTE FUNCTION "messages_no_delete"();

-- Written by hand (R13)
CREATE FUNCTION "events_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'events: an event cannot change'
    USING ERRCODE = '23514', CONSTRAINT = 'events_no_update_trg';
END
$$;
CREATE TRIGGER "events_no_update_trg" BEFORE UPDATE ON "events"
FOR EACH ROW EXECUTE FUNCTION "events_no_update"();

-- Written by hand (R14): the number of an event is the counter of its workspace.
CREATE FUNCTION "events_number"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM event_counters c
    WHERE c.workspace_id = NEW.workspace_id AND c.last_number = NEW.number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'events: the number does not come from the counter'
      USING ERRCODE = '23514', CONSTRAINT = 'events_number_trg';
  END IF;
  RETURN NEW;
END
$$;
CREATE TRIGGER "events_number_trg" BEFORE INSERT ON "events"
FOR EACH ROW EXECUTE FUNCTION "events_number"();

-- Written by hand (R14): the counter starts at 0 or 1, rises by 1, is never deleted.
CREATE FUNCTION "event_counters_step"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.last_number IN (0, 1) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.last_number = OLD.last_number + 1 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'event_counters: the counter starts at 0 or 1, rises by 1 and is never deleted'
    USING ERRCODE = '23514', CONSTRAINT = 'event_counters_step_trg';
END
$$;
CREATE TRIGGER "event_counters_step_trg" BEFORE INSERT OR UPDATE OR DELETE ON "event_counters"
FOR EACH ROW EXECUTE FUNCTION "event_counters_step"();
```

- [ ] Run the two test files, `conversation-tables.db.test.ts` and `migrate.db.test.ts`: PASS. Run
  `db:generate` again: "No schema changes". Commit `feat(server): add the messages, events and event counter tables (TOKI-036)`.

### Task 3: the two reads of a conversation (R11, R12)

**Files:** create `apps/server/tests/messages-reads.db.test.ts`. No source change: the indexes
exist. To see the test fail for the right reason, first run it with
`drop index messages_conversation_main_idx, messages_thread_idx` in its `beforeAll` (the plan then
has no index), see the R11 cases fail, then remove that line.

- [ ] Rows by one `insert ... select from generate_series`: 40 conversations, 18,000 roots and 2,000
  replies, then `analyze messages`. For each of the six queries of R11: in one transaction
  `set local enable_seqscan = off; set local enable_bitmapscan = off; explain (format json) ...`;
  walk the plan tree, assert one node has `"Index Name"` equal to the expected index and none has
  `"Node Type": "Sort"` (or `"Incremental Sort"`). The `where` of the main list is written exactly
  `conversation_id = $1 and (parent_id is null or also_in_channel)`.
- [ ] R12: three `created_at` values, random ids, walk backward then forward in pages of 7 with
  `(created_at, id) < / > (...)`; both walks hold every id once and are the reverse of each other;
  an id with a 2001 time part and today's `created_at` sorts at today.
- [ ] PASS; commit `test(server): prove the order and the indexes of the two message reads (TOKI-036)`.

### Task 4: the export list of messages (R24, first part)

**Files:** create `apps/server/tests/messages/exports.test.ts`.

- [ ] `messages/exports.test.ts`: `Object.keys(await import(index))` is empty and no export is a
  table of `schema.js` (a copy of the four lines of `leakedTables` in
  `../conversations/exports.test.ts`). This test describes code that Task 2 wrote, so it is seen
  failing once with an export of `messages` added to the index by hand, then removed.
- [ ] Commit `test(server): hold the export list of the messages module (TOKI-036)`.

### Task 5: recordEvent (R15 to R18)

**Files:** create `apps/server/src/modules/realtime/{append,record,index}.ts`,
`apps/server/tests/realtime/{helpers.ts,record-input.test.ts,append.db.test.ts}`.

**Produces:** `recordEvent(tx: Tx, input: EventInput): Promise<StoredEvent>`, types `EventInput`,
`StoredEvent`.

`helpers.ts` (test only): `setup()` returns `createMigratedDb()` plus a workspace, a user, a
channel; `counted(url)` returns a Drizzle client whose postgres client records each statement with
`debug`; `waitForLockOf(sql, pid)` polls
`select wait_event_type from pg_stat_activity where pid = ...` until `Lock`, with a deadline;
`gate()` returns a promise and its resolver, to hold a transaction open.

- [ ] `record-input.test.ts` (no database): a fake `tx` whose every method records a call and
  throws; each wrong combination of scope and ids rejects and records nothing. Type test, never run:

```ts
const typeOnly = (db: Db, input: EventInput) =>
  // @ts-expect-error recordEvent takes a transaction, not the database
  recordEvent(db, input);
void typeOnly; // lint refuses an unused name
```

- [ ] Drizzle wraps a failed query in `DrizzleQueryError`: a database error that comes through a
  module function is asserted on its cause, `{ cause: { code: "40001" } }` (also `40P01`, and
  `{ cause: { constraint_name } }`), as `tests/bootstrap/read-tx.db.test.ts` does.
- [ ] `append.db.test.ts`: the "Check:" sentences of R15 to R18. LISTEN case: `sql.listen`, open a
  transaction that records, then `pg_notify('toki_events', 'marker')` from a third connection and
  wait for it: it is the only message; commit: the workspace id arrives; a rolled-back record: a
  second marker arrives and nothing before it. R16 stress: 8 clients, 24 transactions, a
  `mulberry32(36)` generator decides count (1 to 3) and commit; the reader repeats 200 times in a
  `repeatable read` transaction. R18 deadlock case in the order of "Tests" below.
- [ ] FAIL: module not found.
- [ ] Code:

```ts
// append.ts: internal to the module (R15).
export type EventInput = {
  workspaceId: string;
  scope: EventScope;
  conversationId?: string | null;
  userId?: string | null;
  type: string;
  payload: Record<string, unknown>;
  at: Date;
};
export type StoredEvent = {
  workspaceId: string;
  number: number;
  scope: EventScope;
  conversationId: string | null;
  userId: string | null;
  type: string;
  payload: Record<string, unknown>;
  createdAt: Date;
};

export async function appendEvent(tx: Tx, input: EventInput): Promise<StoredEvent> {
  const { workspaceId, scope, type, payload } = input;
  const conversationId = input.conversationId ?? null;
  const userId = input.userId ?? null;
  // Checked before any statement, so a refused event raises no counter.
  const wanted = { conversation: scope === "conversation", user: scope === "user" };
  if ((conversationId !== null) !== wanted.conversation || (userId !== null) !== wanted.user) {
    throw new Error(`An event of scope '${scope}' has the wrong conversation or user id.`);
  }
  // The row lock of this statement is held until the transaction ends (R16).
  const [counter] = await tx
    .insert(eventCounters)
    .values({ workspaceId, lastNumber: 1 })
    .onConflictDoUpdate({
      target: eventCounters.workspaceId,
      set: { lastNumber: sql`${eventCounters.lastNumber} + 1` },
    })
    .returning({ lastNumber: eventCounters.lastNumber });
  const event: StoredEvent = {
    workspaceId,
    number: counter!.lastNumber,
    scope,
    conversationId,
    userId,
    type,
    payload,
    createdAt: input.at,
  };
  await tx.insert(events).values(event);
  return event;
}

// record.ts
export async function recordEvent(tx: Tx, input: EventInput): Promise<StoredEvent> {
  const event = await appendEvent(tx, input);
  // Postgres delivers it at the commit and drops it at a rollback.
  await tx.execute(sql`select pg_notify('toki_events', ${input.workspaceId})`);
  return event;
}
```

An unknown `scope` string passes this check when it carries no id and is refused by
`events_scope_check`. `index.ts` exports `recordEvent` and the two types.

- [ ] PASS; commit `feat(server): write numbered events in the transaction of their change (TOKI-036)`.

### Task 6: lockEventCounter (R27)

**Files:** create `apps/server/src/modules/realtime/lock.ts`,
`apps/server/tests/realtime/lock.db.test.ts`; modify `realtime/index.ts`,
`realtime/record-input.test.ts` (type test for `lockEventCounter`).

- [ ] Tests: the "Check:" sentence of R27, case by case. Errors are asserted on `cause`; the type
  test ends with `void` of its name, as in Task 5. FAIL: not exported.
- [ ] Code:

```ts
export async function lockEventCounter(tx: Tx, workspaceId: string): Promise<void> {
  // A workspace with no event gets a row to lock, with 0.
  await tx
    .insert(eventCounters)
    .values({ workspaceId, lastNumber: 0 })
    .onConflictDoNothing({ target: eventCounters.workspaceId });
  await tx
    .select({ lastNumber: eventCounters.lastNumber })
    .from(eventCounters)
    .where(eq(eventCounters.workspaceId, workspaceId))
    .for("no key update");
}
```

- [ ] PASS; commit `feat(server): lock the event counter for the writer of a user message (TOKI-036)`.

### Task 7: reads and prune (R19 first part, R20, R26)

**Files:** create `apps/server/src/modules/realtime/{read,prune}.ts`,
`apps/server/tests/realtime/read-prune.db.test.ts`; modify `realtime/index.ts`.

**Produces:** `getLastEventNumber(client: DbClient, workspaceId: string): Promise<number>`,
`getOldestEventNumber(...): Promise<number | null>`,
`readEventsAfter(client, workspaceId, after, limit): Promise<StoredEvent[]>`,
`pruneEvents(db: Db, { before: Date, batchSize?: number }): Promise<number>`.

- [ ] Tests: the "Check:" sentences of R19 (function), R20, R26. Events are made with `recordEvent`
  and chosen `at` values. Statement counts use `counted(url)`; the delete count is the statements
  that start with `delete from "events"`. R26 plan: the counted client records text and parameters;
  run `sql.unsafe("explain (format json) " + text, params)` with `enable_seqscan` off; the plan
  names `events_pkey` and holds no `Sort`. Two prunes
  together run on two clients with `Promise.all`. FAIL: not exported.
- [ ] Code:

```ts
// read.ts
export async function getLastEventNumber(client: DbClient, workspaceId: string): Promise<number> {
  const [row] = await client
    .select({ lastNumber: eventCounters.lastNumber })
    .from(eventCounters)
    .where(eq(eventCounters.workspaceId, workspaceId));
  return row?.lastNumber ?? 0;
}

export async function getOldestEventNumber(client: DbClient, workspaceId: string): Promise<number | null> {
  const [row] = await client
    .select({ oldest: sql<string | null>`min(${events.number})` })
    .from(events)
    .where(eq(events.workspaceId, workspaceId));
  return row?.oldest == null ? null : Number(row.oldest);
}

export async function readEventsAfter(
  client: DbClient,
  workspaceId: string,
  after: number,
  limit: number,
): Promise<StoredEvent[]> {
  if (!Number.isInteger(after) || after < 0) throw new Error("'after' is not a whole number of 0 or more.");
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error("'limit' is not between 1 and 1000.");
  return client
    .select()
    .from(events)
    .where(and(eq(events.workspaceId, workspaceId), gt(events.number, after)))
    .orderBy(asc(events.number))
    .limit(limit);
}

// prune.ts
const BATCH_SIZE = 5_000;

export async function pruneEvents(
  db: Db,
  { before, batchSize = BATCH_SIZE }: { before: Date; batchSize?: number },
): Promise<number> {
  const cuts = await db
    .select({ workspaceId: events.workspaceId, last: sql<string>`max(${events.number})` })
    .from(events)
    .where(lt(events.createdAt, before))
    .groupBy(events.workspaceId);
  let removed = 0;
  for (const { workspaceId, last } of cuts) {
    let count: number;
    do {
      const batch = db
        .select({ number: events.number })
        .from(events)
        .where(and(eq(events.workspaceId, workspaceId), lte(events.number, Number(last))))
        .orderBy(asc(events.number))
        .limit(batchSize)
        .for("update");
      // array(...) runs the sub-select once; `in (...)` may run it again per row.
      const result = await db
        .delete(events)
        .where(and(eq(events.workspaceId, workspaceId), sql`${events.number} = any(array${batch})`));
      count = result.count;
      removed += count;
    } while (count === batchSize);
  }
  return removed;
}
```

`result.count` and the SQL that `array${batch}` renders are confirmed by the tests (the recorded
statement must contain `= any(array(select`). `index.ts` exports the four.

- [ ] PASS; commit `feat(server): read the event log and remove old events (TOKI-036)`.

### Task 8: the starter and main (R21)

**Files:** modify `apps/server/src/modules/realtime/{prune,index}.ts`, `apps/server/src/main.ts`;
create `apps/server/tests/realtime/prune-start.db.test.ts`,
`apps/server/tests/main-pruning.db.test.ts`.

- [ ] `prune-start.db.test.ts`: the "Check:" of R21 with a fake `schedule` that records
  `(run, intervalMs)` and returns a spy, `createTestClock()`, and a log that collects calls. Awaiting
  a run: the test waits for the next log call (a promise resolved by the fake log). A failing run:
  call the starter with a `db` whose `select` throws once. `stop` waiting: hold the run with a row
  lock (`select ... for update` on the event from a second connection), call `stop`, see it
  unresolved after the lock wait shows, release, see it resolve.
- [ ] `main-pruning.db.test.ts`: `start`, `until`, `freePort`, `validEnv` as in `main.test.ts`
  (copied, so that file stays untouched), with `DATABASE_URL` of a throwaway database. Case 1,
  migrated: wait for `events_pruned`, `SIGTERM`, exit 0, `event_pruning_stopped` present and no
  `events_pruned` after it. Case 2, not migrated: wait for `event_pruning_failed`, `/healthz` 200,
  `SIGTERM`, exit 0.
- [ ] FAIL: `startEventPruning` not exported; no log line.
- [ ] Code, added to `prune.ts`:

```ts
export type Schedule = (run: () => void, intervalMs: number) => () => void;

export function startEventPruning({
  db,
  clock,
  schedule,
  log,
}: {
  db: Db;
  clock: Clock;
  schedule: Schedule;
  log: Pick<FastifyBaseLogger, "info" | "error">;
}): () => Promise<void> {
  let running: Promise<void> | null = null;
  const prune = async () => {
    try {
      const before = new Date(clock.now() - EVENT_RETENTION_DAYS * 86_400_000);
      const count = await pruneEvents(db, { before });
      log.info({ count }, "events_pruned");
    } catch (error) {
      log.error({ err: error, count: 0 }, "event_pruning_failed");
    }
  };
  const run = () => {
    running ??= prune().finally(() => {
      running = null;
    });
  };
  const cancel = schedule(run, EVENT_PRUNE_INTERVAL_MS);
  run();
  return async () => {
    cancel();
    await running;
    log.info({}, "event_pruning_stopped");
  };
}
```

`main.ts`: `let stopPruning: (() => Promise<void>) | undefined;` before the close hook; in the hook
`await stopPruning?.();` between `await firstAdmin;` and `await connection.close();`; after the
`ensureFirstAdmin` call:

```ts
stopPruning = startEventPruning({
  db: connection.db,
  clock: systemClock,
  schedule: (run, intervalMs) => {
    const timer = setInterval(run, intervalMs).unref();
    return () => clearInterval(timer);
  },
  log: app.log,
});
```

- [ ] PASS, and `main.test.ts` still passes; commit `feat(server): prune old events every hour (TOKI-036)`.

### Task 9: bootstrap (R19)

**Files:** modify `apps/server/src/bootstrap/{event-number,build}.ts`,
`apps/server/tests/bootstrap/{build,bounds}.db.test.ts`; create
`apps/server/tests/bootstrap/event-number.db.test.ts`.

- [ ] New test: a fresh workspace answers `eventNumber` 0; after three committed `recordEvent` it
  answers 3; an event committed by a second connection from the `afterAccount` seam is not in that
  answer and is in the next. Change the lines R19 lists in the two old tests (fake takes
  `(tx, workspaceId)` and records both; 7 becomes 8 twice; the comment names eight statements;
  `reads[5]` matches `from "event_counters"`). FAIL: answers 0, counts 7.
- [ ] Code: `event-number.ts` becomes

```ts
import type { Tx } from "../db/client.js";
import { getLastEventNumber } from "../modules/realtime/index.js";

// The number of the last event of the log at the moment of the snapshot
// (TOKI-031 R11, changed by TOKI-036 R19): 0 means no event.
export function readEventNumber(tx: Tx, workspaceId: string): Promise<number> {
  return getLastEventNumber(tx, workspaceId);
}
```

In `build.ts`: the dependency type `(tx: Tx, workspaceId: string) => Promise<number>` and the call
`await readNumber(tx, facts.workspaceId)`.

- [ ] PASS (all of `tests/bootstrap`); commit `feat(server): answer the real event number in bootstrap (TOKI-036)`.

### Task 10: boundaries and proof (R24, R25)

**Files:** create `apps/server/tests/realtime/{exports,boundaries}.test.ts`.

- [ ] `exports.test.ts`: the index exports exactly the functions `recordEvent`, `lockEventCounter`,
  `getLastEventNumber`, `getOldestEventNumber`, `readEventsAfter`, `pruneEvents`,
  `startEventPruning`; not `appendEvent`; no table. A type import of `EventInput` and `StoredEvent`.
- [ ] `boundaries.test.ts` with `sourceFiles("src", false)`: outside `modules/realtime/` no file
  matches `recordEvent\(` or `appendEvent`; no file of `src` matches
  `insert\(\s*messages\b` or `insert\s+into\s+"?messages"?\b` (case-insensitive); no file of
  `modules/messages` or `modules/realtime` matches `\.(get|post|put|patch|delete)\(\s*["'\x60]/` or
  `\.route\(`; and no file of this ticket's two modules imports another module's `schema.js`.
  Seen failing first with a planted line in a temporary string fixture, as the pattern's own case.
- [ ] Routes, once. Write `apps/server/tests/zz-routes.db.test.ts` (never committed):

```ts
import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { createHarness } from "./auth/test-harness.js";

it("prints the routes", async () => {
  const h = await createHarness();
  writeFileSync(process.env.ROUTES_OUT!, h.app.printRoutes({ commonPrefix: false }));
  await h.close();
});
```

  Run it on the branch with
  `ROUTES_OUT="$S/routes-branch.txt" corepack pnpm exec vitest run --project server-db tests/zz-routes`.
  Then `git worktree add --detach "$S/base" github/main`, copy the file there, install, run it with
  `ROUTES_OUT="$S/routes-base.txt"`, and `diff` the two files: empty. Delete the temporary file and
  remove that worktree.
- [ ] `git diff github/main -- apps/server/src/modules/conversations/changes.ts
  apps/server/src/app.ts` is empty.
- [ ] `corepack pnpm lint && corepack pnpm format:check && corepack pnpm typecheck && corepack pnpm test`.
  Compare the failures with the baseline of Task 0.
- [ ] Commit `test(server): hold the boundaries of the messages and realtime modules (TOKI-036)`.

## Tests

The deadlock case of R18 runs in this order, and no earlier event of A names that conversation: B
locks the conversation `for update`; A appends an event of it (A takes the counter, then its key
check waits on B, read from `pg_stat_activity`); B appends, waits on the counter, and the database
ends one of the two with `40P01`. In the other order B only waits and nothing deadlocks.

## What can break

- **Riskiest step: Task 2.** One migration, hand-edited. A wrong statement shows only on an empty
  database in a test; `db:generate` must report no change afterwards.
- Shutdown waits for a prune in progress (R21). A first run over a large backlog delays it.
- A failed query of `recordEvent` carries its parameters, the payload included, in the Drizzle
  error. This ticket logs nothing, but TOKI-037 and TOKI-038 must sanitise the error before the
  shared handler logs it (as `conversations/safe-error.ts` does). Named in the pull request.
- Every bootstrap request now reads `event_counters`: a database behind on migrations fails there.
- Another branch may add migration `0005` first: then regenerate on top of `main` and re-append the
  hand-written part.
- Local Postgres may be older than 17: CI is the proof for the database tests.
- Roll back: revert the merge; the migration is forward-only, the unused tables stay.
