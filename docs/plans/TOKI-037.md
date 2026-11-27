# TOKI-037 Message API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans with
> cl-dev:test-driven-development, task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `POST` and `GET /api/v1/conversations/{id}/messages`, the grey system lines, the hidden
new direct message and the command that writes the missing "joined" lines.

**Architecture:** the `messages` module gets the routes, the send transaction, the history reads,
the one entry builder and the system-line handler. `conversations` turns `recordChange` into a list
of handlers that `app.ts` builds. `messages` never imports `realtime`; `app.ts` injects
`lockEventCounter`.

**Tech Stack:** TypeScript, Fastify 5, Drizzle ORM 0.45 with postgres.js 4, PostgreSQL 17, Zod 4,
Vitest.

**Spec:** `docs/specs/2026-11-20-message-api-design.md`. **Read the requirement named in a task
before its first step; its "Check:" sentence lists every case the tests of that task must hold.**
Tier: L.

## AC -> step -> test

Paths are under `apps/server/tests/` unless they start with `packages/`. Each test is named
`"R<n>: ..."`.

| AC | Task | Test file |
|---|---|---|
| R1 two routes, order of checks | 6 | `messages/send-access.db.test.ts`; `messages/history.db.test.ts` |
| R2 refusals by reason | 6, 8 | `messages/send-access.db.test.ts`; `messages/history.db.test.ts` |
| R3 send, stored row, 201 | 6 | `messages/send.db.test.ts`; `packages/shared/tests/messages/schemas.test.ts` |
| R4 validation | 1, 6 | `packages/shared/tests/messages/schemas.test.ts`; `messages/send.db.test.ts` |
| R5 repeat | 6, 7 | `messages/send-repeat.db.test.ts`; `messages/send-locks.db.test.ts` |
| R6 who may send | 6 | `messages/send-access.db.test.ts` |
| R7 read-only DM | 6, 7 | `messages/send-access.db.test.ts`; `messages/send-locks.db.test.ts` |
| R8 locks | 7 | `messages/send-locks.db.test.ts` |
| R9 order and clock | 7 | `messages/send-clock.db.test.ts` |
| R10 message_created | 6 | `messages/send-changes.db.test.ts`; `messages/boundaries.test.ts` |
| R11 four modes | 8 | `messages/history.db.test.ts` |
| R12 exact paging | 8 | `messages/history.db.test.ts` |
| R13 around | 8 | `messages/history.db.test.ts` |
| R14 what history holds | 8 | `messages/history.db.test.ts` |
| R15 MessageEntry | 1 | `packages/shared/tests/messages/schemas.test.ts` |
| R16 system lines | 4 | `messages/system-lines.db.test.ts` |
| R17 newcomer in #general | 5 | `members/join-lines.db.test.ts` |
| R18 modules and wiring | 2, 4, 6 | `conversations/changes.test.ts`; `messages/system-lines.db.test.ts`; `messages/exports.test.ts`; `conversations/exports.test.ts` |
| R19 hidden DM | 9 | `conversations/hidden-direct.db.test.ts`; `bootstrap/bounds.db.test.ts`; `messages/last-times.db.test.ts` |
| R20 reveal | 6, 7 | `messages/send-changes.db.test.ts`; `messages/send-locks.db.test.ts` |
| R21 compareDirect | 10 | `packages/client-core/src/conversations/selectors.test.ts`; `packages/client-core/src/api/parse.test.ts` |
| R22 shared values and codes | 1 | `packages/shared/tests/messages/schemas.test.ts` |
| R23 no text in logs | 12 | `messages/safety.db.test.ts` |
| R24 no table, no migration | 12 | `messages/safety.db.test.ts`; command `corepack pnpm db:generate` reports no change |
| R25 module, Origin, media type | 6 | `messages/send-access.db.test.ts` |
| R26 backfill | 11 | `messages/backfill.db.test.ts` |
| R27 entry builder | 3, 6, 8 | `messages/entry.test.ts`; `messages/send-changes.db.test.ts`; `messages/history.db.test.ts` |

## Global Constraints

- Test-first: each new test is run and seen failing for the right reason before its code.
- Database tests use throwaway databases and made-up data, and never sleep for a result; a race
  waits with `waitForLock` (`tests/conversations/channel-helpers.ts`).
- No new table, column or migration (R24).
- No file of `modules/messages/` imports `realtime` or calls `appendEvent` or `recordEvent`.
- No module reads another module's table; imports between modules go through `index.ts`.
- No log line holds a message text; a 500 of this work carries the Postgres code and constraint only.
- Conventional Commits, lowercase subject, each ending `(TOKI-037)`.
- Before each commit: `corepack pnpm exec prettier --write` on the touched files, then
  `corepack pnpm lint` and `corepack pnpm typecheck`. Code in this plan is not wrapped to Prettier.
- Node 22: `export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"`, then `corepack pnpm`.
- `.env` is never created or read.

## Design

### Pieces (`apps/server/src/` unless stated)

| Piece | Holds |
|---|---|
| `packages/shared/src/messages/schemas.ts`, `mentions.ts` | constants, `MessageTextSchema`, request and response schemas, `MessageEntry`; the type `MentionDelta` |
| `modules/messages/entry.ts` | `buildMessageEntry`, `buildMessageEntries` |
| `modules/messages/system-lines.ts` | `createSystemLineHandler` |
| `modules/messages/send.ts` | the send transaction |
| `modules/messages/history.ts` | latest, before, after, around |
| `modules/messages/access.ts` | R1 steps 2 and 3, the answers of R2 |
| `modules/messages/last-times.ts` | `listLastMessageTimes` |
| `modules/messages/backfill.ts`, `cli/backfill-join-lines.ts` | R26 |
| `modules/messages/routes.ts` | `messageRoutes`, the safe error |
| `modules/conversations/changes.ts`, `lock.ts`, `summaries.ts`, `general.ts` | handler list and union; `lockConversation`; `hideUnstartedDirects`; `listGeneralMemberJoins` |
| `app.ts` | builds `recordChange`, wires everything |

### Decisions

- `app.ts` builds the handler list inline (`change-handlers.ts` is TOKI-064's). A new option of
  `buildApp`, `changeHandlers`, appends handlers after the system-line handler: the tests' recording
  handler stands where the event handler of TOKI-038 will stand. `messageDeps` is the test seam of
  the message routes.
- The accept route (TOKI-097) already exists, so this ticket passes `recordChange` through
  `registerMembersRoutes` to `acceptInvitation` (R17).
- `messages` may not read `conversations`, so `conversations` gains the export `lockConversation`
  (not named in the spec's layout).
- The line handler takes the workspace id from the actor's account (`getAccountsByIds`), so no route
  changes except `fields` (R16).
- History uses the index of TOKI-036 R11: the anchor time is a scalar subquery inside the row
  comparison. A page with rows is one statement; only an empty `before` or `after` page runs a
  second one, to tell "no more messages" from "no such message".
- Surrogates are refused with `/\p{Surrogate}/u`, which is `!text.isWellFormed()` without a change of
  the TypeScript `lib`.
- `backfill:join-lines` takes no argument and runs once for each workspace of `listWorkspaceIds`.

### Accepted deviation from a check (approved by the developer on 2026-11-27)

R27 asks that an entry "holds what the fake readers return" and shows "empty values", but R15 gives
the entry no key for a reader. This ticket tests that each reader is called once, with which ids, and
which readers a send calls. The value assertions come with the keys (TOKI-046, 050, 058). The PR
says so.

---

## Task 0: test database (no commit)

- [ ] Start a throwaway server and use it for every database test of this plan:

```bash
docker run -d --rm --name toki-037-pg -e POSTGRES_USER=toki -e POSTGRES_PASSWORD=toki-037-throwaway -p 127.0.0.1:5437:5432 postgres:17.12
```

```bash
export TEST_DATABASE_URL=postgres://toki:toki-037-throwaway@127.0.0.1:5437/toki_test
```

- [ ] `corepack pnpm install --frozen-lockfile`, then `corepack pnpm test` on the untouched tree.
  Expected: green. Record any failure before changing code.
- Run one database file:
  `corepack pnpm --filter @toki/server exec vitest run -c vitest.db.config.ts tests/messages/send.db.test.ts`
- Remove at the end: `docker stop toki-037-pg`.

## Task 1: shared schemas, constants, error codes

**Files:** create `packages/shared/src/messages/schemas.ts`, `packages/shared/src/messages/mentions.ts`,
`packages/shared/tests/messages/schemas.test.ts`; modify `packages/shared/src/messages/index.ts`,
`packages/shared/src/error.ts`.

**Produces:** `MESSAGE_PAGE_DEFAULT`, `MESSAGE_PAGE_MAX`, `MESSAGE_FILES_MAX`, `SYSTEM_LINE_TYPES`,
`SystemLineType`, `MessageTextSchema`, `SendMessageBodySchema`, `SendMessageResponseSchema`,
`MessageHistoryQuerySchema`, `MessageHistoryResponseSchema`, `MessageEntrySchema`, `MessageEntry`,
`MentionDelta`, `ErrorCodes.messageIdInUse`, `ErrorCodes.conversationReadOnly`.

- [ ] Write the tests: `MessageTextSchema` and the body accept 1 and 10,000 code points (letters,
  and `"😀".repeat(10_000)`), refuse 10,001, `""`, `" \t\n"`, `"a\u0000"`, `"\ud800"`; accept
  `"​"`; return the text unchanged for `"  a\n "`. The body refuses a v4 id, an upper-case id and
  each of `parentId`, `attachmentIds`, `createdAt`, `authorId`. The query: default limit 50, refuses 0,
  101, two cursors, an unknown key, a repeated key (array). The entry accepts a user message and a
  system line and refuses an added key, a missing key, `kind: "other"`, an unknown `system.type`, a
  non-ISO time, a user message with `system` set. The registry has both codes and no duplicate value.
  A type import of every name from `@toki/shared`.
- [ ] Run: `corepack pnpm exec vitest run packages/shared/tests/messages`. Expected: FAIL (missing exports).
- [ ] Implement:

```ts
// schemas.ts
import { z } from "zod";
import { UUID_PATTERN, UUID_V7_PATTERN } from "../channels/limits.js";
import { MESSAGE_KINDS, MESSAGE_TEXT_MAX } from "./limits.js";

export const MESSAGE_PAGE_DEFAULT = 50;
export const MESSAGE_PAGE_MAX = 100;
export const MESSAGE_FILES_MAX = 10; // D-042; enforced by TOKI-058
export const SYSTEM_LINE_TYPES = ["channel_created", "member_joined", "members_added", "member_left", "topic_changed"] as const;
export type SystemLineType = (typeof SYSTEM_LINE_TYPES)[number];

export const MessageTextSchema = z.string().refine(
  (text) =>
    !text.includes("\u0000") &&
    !/\p{Surrogate}/u.test(text) &&
    Array.from(text).length <= MESSAGE_TEXT_MAX &&
    text.trim() !== "",
);

export const SendMessageBodySchema = z.strictObject({
  id: z.string().regex(UUID_V7_PATTERN),
  text: MessageTextSchema,
});

const Id = z.string().regex(UUID_PATTERN);
const Time = z.iso.datetime();

export const MessageEntrySchema = z
  .strictObject({
    id: Id,
    conversationId: Id,
    kind: z.enum(MESSAGE_KINDS),
    authorId: Id,
    parentId: Id.nullable(),
    text: z.string().nullable(),
    system: z.strictObject({ type: z.enum(SYSTEM_LINE_TYPES), userIds: z.array(Id) }).nullable(),
    createdAt: Time,
    editedAt: Time.nullable(),
    deletedAt: Time.nullable(),
  })
  .refine((m) => (m.kind === "system") === (m.system !== null));
export type MessageEntry = z.infer<typeof MessageEntrySchema>;

export const SendMessageResponseSchema = z.strictObject({ message: MessageEntrySchema });

export const MessageHistoryQuerySchema = z
  .strictObject({
    limit: z.coerce.number().int().min(1).max(MESSAGE_PAGE_MAX).default(MESSAGE_PAGE_DEFAULT),
    before: Id.optional(),
    after: Id.optional(),
    around: Id.optional(),
  })
  .refine((q) => [q.before, q.after, q.around].filter((v) => v !== undefined).length <= 1);

export const MessageHistoryResponseSchema = z.strictObject({
  messages: z.array(MessageEntrySchema),
  hasOlder: z.boolean(),
  hasNewer: z.boolean(),
});
```

```ts
// mentions.ts: the shape of TOKI-050 R3; that ticket adds the schema
export type MentionDelta = {
  mentions: { userIds: string[]; channel: boolean };
  added: string[];
  removed: string[];
  channelAdded: boolean;
  channelRemoved: boolean;
};
```

  Add `export * from "./schemas.js"; export type * from "./mentions.js";` to the index, and
  `messageIdInUse: "message_id_in_use"`, `conversationReadOnly: "conversation_read_only"` to `ErrorCodes`.
- [ ] Run the tests (PASS), then `corepack pnpm test packages/client-core` (the client reader walks
  shared schemas). Commit `feat(shared): add the message schemas and error codes (TOKI-037)`.

## Task 2: the list of change handlers

**Files:** modify `modules/conversations/changes.ts`, `index.ts`, `channels.ts` (only `fields`),
`tests/conversations/exports.test.ts`, test files that read `change.conversationId` (narrow the
union); create `tests/conversations/changes.test.ts`.

**Produces:** `createRecordChange(handlers): RecordChange`, types `Change`, `ConversationChange`,
`MemberStatusChange`, `ChangeHandler`, `HandlerResult`, `RecordChange`.

- [ ] Tests (no database): order of two handlers; `change.message` from the first reaches the second;
  a first handler that returns `{ extra: 1 } as HandlerResult` makes `extra` a field the second sees; a
  handler returning nothing leaves the same object; a throwing handler stops the later ones and the
  error reaches the caller. In `channels.edit.db.test.ts`: `fields` is `["topic"]`, `["description"]`,
  both, and holds only the changed field. In the export test add `createRecordChange`.
- [ ] See them fail. Implement:

```ts
import type { MentionDelta, MessageEntry } from "@toki/shared";
import type { DbClient } from "../../db/client.js";

export type ConversationChange = {
  type:
    | "channel_created" | "member_joined" | "member_left" | "members_added" | "member_removed"
    | "details_changed" | "channel_archived" | "channel_restored" | "settings_changed"
    | "message_created" | "direct_conversation_appeared";
  actorId: string;
  conversationId: string;
  // The people the change is about.
  userIds: readonly string[];
  at: Date;
  fields?: readonly ("topic" | "description")[];
  message?: MessageEntry;
  mentionDelta?: MentionDelta;
};

// TOKI-056 R8: a change of a person, not of a conversation.
export type MemberStatusChange = {
  type: "member_status_changed";
  actorId: string;
  workspaceId: string;
  userIds: readonly [string];
  at: Date;
  status: { text: string | null; clearAt: string | null; reason: "set" | "cleared" | "expired" };
};

export type Change = ConversationChange | MemberStatusChange;
// A key a handler returns is a field of the change for the handlers after it.
export type HandlerResult = { message?: MessageEntry };
export type ChangeHandler = (tx: DbClient, change: Change) => Promise<void | HandlerResult>;
export type RecordChange = (tx: DbClient, change: Change) => Promise<void>;

export function createRecordChange(handlers: readonly ChangeHandler[]): RecordChange {
  return async (tx, change) => {
    let current = change;
    for (const handler of handlers) {
      const result = await handler(tx, current);
      if (result) current = { ...current, ...result };
    }
  };
}

export const recordChange: RecordChange = async () => {};
```

  In `editChannelDetails`: `fields: (["topic", "description"] as const).filter((f) => f in set),`.
- [ ] `corepack pnpm typecheck`, the conversation tests, commit
  `feat(server): run a list of handlers for each change (TOKI-037)`.

## Task 3: the entry builder

**Files:** create `modules/messages/entry.ts`, `tests/messages/entry.test.ts`.

**Produces:** `MessageRow`, `EntryReader`, `EntryReaders`, `buildMessageEntry(db, row, readers?)`,
`buildMessageEntries(db, rows, readers?)`.

- [ ] Tests with hand-made rows and `vi.fn(async () => new Map())`: each given reader is called once
  for 50 rows, with the ids of user rows that are not deleted only; no reader is called when no such row
  exists; a deleted row has `text: null`; a system row has `text: null` and `system`; a user row with
  empty body has `text: ""`; the result parses with `MessageEntrySchema`; with no readers the result is
  the same.
- [ ] See them fail. Implement:

```ts
import type { MessageEntry, SystemLineType } from "@toki/shared";
import type { DbClient } from "../../db/client.js";
import type { messages } from "./schema.js";

export type MessageRow = typeof messages.$inferSelect;
export type EntryReader = (db: DbClient, messageIds: string[]) => Promise<Map<string, unknown>>;
export type EntryReaders = {
  listReactions?: EntryReader;
  listPinned?: EntryReader;
  listMentions?: EntryReader;
  listFiles?: EntryReader;
  readLinkPreviews?: EntryReader;
};

function toEntry(row: MessageRow): MessageEntry {
  const line = row.kind === "system";
  return {
    id: row.id,
    conversationId: row.conversationId,
    kind: row.kind as MessageEntry["kind"],
    authorId: row.authorId,
    parentId: row.parentId,
    text: line || row.deletedAt ? null : row.body,
    system: line ? { type: row.systemType as SystemLineType, userIds: row.systemUserIds ?? [] } : null,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt?.toISOString() ?? null,
    deletedAt: row.deletedAt?.toISOString() ?? null,
  };
}

// Every place that returns or sends an entry goes through here (R27). A reader is called once for
// the page. The ticket that adds a key maps the reader's answer to it, with its empty value.
export async function buildMessageEntries(db: DbClient, rows: readonly MessageRow[], readers: EntryReaders = {}): Promise<MessageEntry[]> {
  const ids = rows.filter((r) => r.kind === "user" && r.deletedAt === null).map((r) => r.id);
  if (ids.length > 0) {
    for (const read of Object.values(readers)) await (read as EntryReader | undefined)?.(db, ids);
  }
  return rows.map(toEntry);
}

export async function buildMessageEntry(db: DbClient, row: MessageRow, readers?: EntryReaders): Promise<MessageEntry> {
  const [entry] = await buildMessageEntries(db, [row], readers);
  return entry!;
}
```

- [ ] Run (PASS). Commit `feat(server): build every message entry in one place (TOKI-037)`.

## Task 4: system lines, wired into the app

**Files:** create `modules/messages/system-lines.ts`, `tests/messages/system-lines.db.test.ts`; modify
`modules/messages/index.ts`, `modules/conversations/index.ts` (export type `GetAccountsByIds`),
`app.ts`, `tests/auth/test-harness.ts` (pass `changeHandlers`), `tests/messages/exports.test.ts`,
`tests/realtime/boundaries.test.ts`.

**Consumes:** Task 2, Task 3. **Produces:** `createSystemLineHandler({ getAccountsByIds }): ChangeHandler`;
`BuildAppOptions.changeHandlers?: ChangeHandler[]`.

- [ ] Tests: through `createHarness({ changeHandlers: [recording] })`, real requests: create, join,
  add, leave, topic edit each leave one line (type, author, `system_user_ids`, `created_at` = clock),
  and `recording` receives it as `change.message`. Leaving and emptying a private channel writes one
  `member_left` line only. A restore by a non-member Admin leaves one `member_joined`. Description only:
  none; topic and description: one `topic_changed` with `userIds: []`. Remove, archive, settings,
  repeat/`changed: false`: none. A throwing `recording` rolls back the change and the line. Hand-made
  changes of `member_status_changed`, `activity_changed`, `later_changed`, `quiet_changed`,
  `notification_preferences_changed` and an unlisted type write nothing. Two connections doing leave
  and restore at once finish without SQLSTATE `40P01`. Update the exports list; in the boundaries test
  remove the rule "no code of the server writes a row of messages" and narrow "register no route" to
  `inRealtime`.
- [ ] See them fail. Implement:

```ts
import type { SystemLineType } from "@toki/shared";
import { uuidv7 } from "uuidv7";
import type { Change, ChangeHandler, ConversationChange, GetAccountsByIds } from "../conversations/index.js";
import { buildMessageEntry } from "./entry.js";
import { messages } from "./schema.js";

function lineOf(change: Change): { change: ConversationChange; type: SystemLineType } | null {
  switch (change.type) {
    case "channel_created":
    case "member_joined":
    case "members_added":
    case "member_left":
      return { change, type: change.type };
    case "details_changed":
      return change.fields?.includes("topic") ? { change, type: "topic_changed" } : null;
    default:
      return null;
  }
}

// First in the list (R18): the line is inserted before any handler takes the counter lock.
export function createSystemLineHandler(deps: { getAccountsByIds: GetAccountsByIds }): ChangeHandler {
  return async (tx, input) => {
    const line = lineOf(input);
    if (!line) return;
    const { change, type } = line;
    const [actor] = await deps.getAccountsByIds(tx, [change.actorId]);
    if (!actor) throw new Error("A system line has no actor account.");
    const [row] = await tx
      .insert(messages)
      .values({
        id: uuidv7(),
        workspaceId: actor.workspaceId,
        conversationId: change.conversationId,
        authorId: actor.id,
        kind: "system",
        systemType: type,
        systemUserIds: type === "topic_changed" ? [] : [...change.userIds],
        body: "",
        createdAt: change.at,
      })
      .returning();
    return { message: await buildMessageEntry(tx, row!) };
  };
}
```

  In `app.ts`, inside `if (db)`:

```ts
const recordChange = createRecordChange([
  createSystemLineHandler({ getAccountsByIds }),
  ...(changeHandlers ?? []),
]);
// channelRoutes({ db, clock, getAccountsByIds, recordChange, ...channelDeps })
```

- [ ] Run the new file, then the whole server database project (a channel change now runs two more
  statements). Commit `feat(server): write the grey system lines of channel changes (TOKI-037)`.

## Task 5: the newcomer line of #general

**Files:** modify `modules/conversations/general.ts`, `modules/members/accept.ts`,
`invitation-join.ts`, `invitation-join.routes.ts`, `routes.ts`, `app.ts`; create
`tests/members/join-lines.db.test.ts`.

**Produces:** `addMemberToGeneral(tx, { workspaceId, userId, createdAt, recordChange? })`;
`acceptInvitation(tx, { token, now }, deps?: { recordChange?: RecordChange })`;
`acceptWithCode(db, { ..., recordChange? })`; `MembersDeps.recordChange?`.

- [ ] Tests: the real accept route leaves one `member_joined` line in #general by the newcomer; a throw
  in `joinHooks.inTransaction` leaves none; `acceptInvitation` twice (second refused) leaves one; a
  person brought back who still has the member row gets none; the first Admin's set-up leaves none; the
  statement log of an accept shows no `for update` / `for share` / `for no key update` after the insert
  of the line. Existing accept and general tests pass unchanged.
- [ ] See them fail. In `addMemberToGeneral`:

```ts
if (added.length !== 1) return false;
// `tx` keeps the type of the other writes of this file; RecordChange takes a DbClient.
await input.recordChange?.(tx as DbClient, {
  type: "member_joined",
  actorId: input.userId,
  conversationId: generalId,
  userIds: [input.userId],
  at: input.createdAt,
});
return true;
```

  Pass `recordChange` down each layer to it; `app.ts` gives it to `registerMembersRoutes`.
  `members` imports only `type RecordChange` from `../conversations/index.js`.
- [ ] Run members and conversations tests. Commit
  `feat(server): write the joined line of a newcomer in general (TOKI-037)`.

## Task 6: send

**Files:** create `modules/conversations/lock.ts`, `modules/messages/{access,last-times,send,routes}.ts`,
tests `messages/{send,send-access,send-repeat,send-changes,last-times}.db.test.ts`,
`messages/boundaries.test.ts`, `messages/helpers.ts`; modify both `index.ts`, `app.ts`, the two export
tests, the test harness (`messageDeps`).

**Produces:** `lockConversation(tx, id, "share" | "no key update")`;
`listLastMessageTimes(tx, ids): Promise<Map<string, Date>>`; `sendMessage(deps, actor, conversationId, body)`;
`messageRoutes(input: MessageDepsInput)`; `BuildAppOptions.messageDeps?`.

- [ ] Write the tests from the Check sentences of R1 to R7, R10, R20, R25 and R27 (send part), and
  for R18 that `buildApp` registers both paths (`app.hasRoute`).
  `helpers.ts` makes a channel, a private channel, a DM and a group with members by `test-rows.ts`, and
  `post(h, who, conversationId, body)`. The recording handler comes in through `changeHandlers`.
  `boundaries.test.ts` scans `modules/messages` for an import of `realtime` and for
  `appendEvent|recordEvent`, with a planted line.
- [ ] See them fail (404 "No such route").
- [ ] Implement:

```ts
// conversations/lock.ts
export async function lockConversation(tx: DbClient, conversationId: string, strength: "share" | "no key update"): Promise<void> {
  await tx.select({ id: conversations.id }).from(conversations).where(eq(conversations.id, conversationId)).for(strength);
}
```

```ts
// messages/last-times.ts
export const inMainList = sql`(${messages.parentId} is null or ${messages.alsoInChannel})`;

export async function listLastMessageTimes(tx: DbClient, conversationIds: readonly string[]): Promise<Map<string, Date>> {
  const rows = await tx
    .select({ conversationId: messages.conversationId, at: max(messages.createdAt) })
    .from(messages)
    .where(and(inArray(messages.conversationId, [...conversationIds]), eq(messages.kind, "user"), inMainList))
    .groupBy(messages.conversationId);
  return new Map(rows.map((r) => [r.conversationId, r.at!]));
}
```

```ts
// messages/access.ts
export type Actor = { id: string; role: string };
export type AccessDeps = { getConversationFacts: typeof getConversationFacts; canReadConversation: typeof canReadConversation };

export const notFound = () => new AppError(404, ErrorCodes.notFound, "No such conversation.");

export function refusalOf(reason: string): Error {
  if (reason === "not_a_member") return new AppError(403, ErrorCodes.forbidden, "You are not allowed to do this.");
  if (reason === "channel_archived") return new AppError(409, ErrorCodes.channelArchived, "The channel is archived.");
  return new Error(`A permission function refused with ${reason}.`);
}

// R1 steps 2 and 3.
export async function checkRead(deps: AccessDeps, client: DbClient, actor: Actor, id: string): Promise<ConversationFacts> {
  const facts = await deps.getConversationFacts(client, actor.id, id);
  if (!facts || (facts.kind !== "public_channel" && !facts.isMember)) throw notFound();
  const decision = deps.canReadConversation(actor, facts);
  if (!decision.allowed) throw refusalOf(decision.reason);
  return facts;
}
```

```ts
// messages/send.ts (core)
export async function sendMessage(deps: SendDeps, account: Actor, conversationId: string, body: SendMessageBody) {
  const before = await checkRead(deps, deps.db, account, conversationId);
  // The members of a direct message never change, so this read needs no lock (R7).
  const otherId = before.kind === "dm"
    ? (await listMemberIds(deps.db, conversationId)).find((id) => id !== account.id)
    : undefined;
  return deps.db.transaction(async (tx) => {
    const accounts = await deps.getAccountsByIds(tx, otherId ? [account.id, otherId] : [account.id], { lock: "share" });
    const sender = accounts.find((a) => a.id === account.id);
    if (!sender) throw new AppError(401, ErrorCodes.unauthenticated, "A session is required.");
    if (sender.status === "deactivated") throw new AppError(401, ErrorCodes.accountDeactivated, "This account is deactivated.");
    await lockConversation(tx, conversationId, before.kind === "dm" ? "no key update" : "share");
    const actor = { id: sender.id, role: sender.role };
    const facts = await checkRead(deps, tx, actor, conversationId);
    const found = await findById(tx, body.id);
    if (found) return repeatOf(deps, tx, found, conversationId, actor.id);
    const decision = deps.canPostInConversation(actor, facts);
    if (!decision.allowed) throw refusalOf(decision.reason);
    if (otherId && accounts.find((a) => a.id === otherId)?.status === "deactivated") {
      throw new AppError(409, ErrorCodes.conversationReadOnly, "This conversation is read-only.");
    }
    const reveals = facts.kind === "dm" && !(await listLastMessageTimes(tx, [conversationId])).has(conversationId);
    // The last lock of a send; the time is set after it (R9).
    await deps.lockEventCounter(tx, sender.workspaceId);
    const [newest] = await tx.select({ createdAt: messages.createdAt }).from(messages)
      .where(and(eq(messages.conversationId, conversationId), inMainList))
      .orderBy(desc(messages.createdAt), desc(messages.id)).limit(1);
    const now = deps.clock.now();
    const createdAt = new Date(newest ? Math.max(now, newest.createdAt.getTime() + 1) : now);
    const [row] = await tx.insert(messages)
      .values({ id: body.id, workspaceId: sender.workspaceId, conversationId, authorId: actor.id, kind: "user", body: body.text, createdAt })
      .onConflictDoNothing({ target: messages.id })
      .returning();
    if (!row) return repeatOf(deps, tx, (await findById(tx, body.id))!, conversationId, actor.id);
    const mentionDelta = await deps.saveMentions(tx, { conversation: facts, actor, messageId: row.id, text: body.text });
    const { listMentions, listFiles } = deps.readers;
    const message = await buildMessageEntry(tx, row, { listMentions, listFiles });
    const change = { actorId: actor.id, conversationId, at: createdAt };
    if (reveals) {
      await deps.recordChange(tx, { ...change, type: "direct_conversation_appeared", userIds: [actor.id, otherId!] });
    }
    await deps.recordChange(tx, { ...change, type: "message_created", userIds: [], message, mentionDelta });
    return { status: 201 as const, message };
  }, { isolationLevel: "read committed" });
}

// A repeat is a read (R5): the stored message as it stands, built with every reader.
async function repeatOf(deps: SendDeps, tx: DbClient, row: MessageRow, conversationId: string, actorId: string) {
  if (row.conversationId !== conversationId || row.authorId !== actorId || row.kind !== "user") {
    throw new AppError(409, ErrorCodes.messageIdInUse, "This message id is already in use.");
  }
  return { status: 200 as const, message: await buildMessageEntry(tx, row, deps.readers) };
}
```

  `findById` is `select().from(messages).where(eq(messages.id, id)).limit(1)`.

  `routes.ts`: `messageRoutes({ db, clock, getAccountsByIds, recordChange, lockEventCounter, readers?,
  saveMentions?, publishLive?, linkAttachments?, hasAttachments?, readRecord?, getConversationFacts?,
  canReadConversation?, canPostInConversation? })`. Defaults: `readers {}`; `saveMentions` returns the
  empty delta `{ mentions: { userIds: [], channel: false }, added: [], removed: [], channelAdded:
  false, channelRemoved: false }`; the three real functions. The other options are declared for later
  tickets and unused here: `publishLive?: (audience: unknown, kind: string, data: unknown) => void`,
  `linkAttachments?: (tx, input: { messageId; conversationId; workspaceId; actorId; fileIds: string[] }) => Promise<void>`,
  `hasAttachments?: (tx, messageId: string) => Promise<boolean>`, `readRecord?: (input: unknown) => Promise<unknown>`.
  `linkAttachments` is never called here: the strict body names no file.
  The route parses `z.string().regex(UUID_PATTERN)` for `:id`, then `SendMessageBodySchema.parse(request.body ?? {})`,
  sets `reply.code(status)` and returns `{ message }`. Every handler is wrapped: `AppError` and `ZodError`
  pass; anything else becomes `new Error("The message request failed (<code>, <constraint>).")`, built as
  `conversations/safe-error.ts` builds it.

  `app.ts`: `await scope.register(messageRoutes({ db, clock, getAccountsByIds, recordChange, lockEventCounter, ...messageDeps }));`
- [ ] Run the new files. Commit `feat(server): send a message to a conversation (TOKI-037)`.

## Task 7: the races and the clock

**Files:** create `tests/messages/send-locks.db.test.ts`, `send-clock.db.test.ts`.

- [ ] Write the cases of R8, R9, and the two-connection cases of R5, R7 and R20: use the `whileHeld`
  pattern of `channels.locks.db.test.ts` (a second connection holds the row, the request waits, commit,
  then check). For R9 hold the counter with `lockEventCounter(drizzle(other), workspaceId)` in a
  transaction, move the clock, commit. Isolation: a recording handler runs
  `show transaction_isolation`. Two sends with one id: start both while a holder has the counter lock.
- [ ] These test code that exists. To see each fail for the right reason, remove the lock it covers
  (conversation lock, counter call, `+ 1`) once, run, and restore; note in the commit body which line
  each case guards.
- [ ] Commit `test(server): cover the races and the time rule of a send (TOKI-037)`.

## Task 8: history

**Files:** create `modules/messages/history.ts`, `tests/messages/history.db.test.ts`; modify `routes.ts`.

**Produces:** `readHistory(db, conversationId, query, readers): Promise<MessageHistoryResponse>`.

- [ ] Tests from R11 to R14, the history parts of R1, R2 and R27 (statement count one with no reader;
  201 body, repeat body, history item and change message are equal), and an `explain` of the three
  statement shapes showing `messages_conversation_main_idx` and no `Sort` for latest, before and after.
- [ ] See them fail.
- [ ] Implement:

```ts
const key = sql`(${messages.createdAt}, ${messages.id})`;
// A scalar subquery, so the row comparison can use the index. No row: null, and nothing matches.
const anchorKey = (conversationId: string, id: string) =>
  sql`((select m.created_at from messages m where m.id = ${id} and m.conversation_id = ${conversationId} and (m.parent_id is null or m.also_in_channel)), ${id}::uuid)`;

const page = (db: DbClient, conversationId: string, where: SQL | undefined, newestFirst: boolean, take: number) =>
  db.select().from(messages)
    .where(and(eq(messages.conversationId, conversationId), inMainList, where))
    .orderBy(...(newestFirst ? [desc(messages.createdAt), desc(messages.id)] : [asc(messages.createdAt), asc(messages.id)]))
    .limit(take);
```

  - latest: `page(.., undefined, true, limit + 1)`; `hasOlder = rows.length > limit`; keep the first
    `limit`, reverse; `hasNewer = false`.
  - before: `where key < anchorKey`, newest first, `limit + 1`; `hasNewer = true`. after: `key >
    anchorKey`, oldest first; `hasOlder = true`. When no row comes back, run
    `exists(db, conversationId, anchor)` (id, conversation, main list); false: `notFound()`.
  - around: `older = floor((limit - 1) / 2)`, `newer = ceil((limit - 1) / 2)`;
    `unionAll(page(.., key <= anchorKey, true, older + 2), page(.., key > anchorKey, false, newer + 1))
    .orderBy(sql\`created_at\`, sql\`id\`)`. Find the anchor by id (absent: `notFound()`); `hasOlder` when
    more than `older` rows precede it, `hasNewer` when more than `newer` follow; slice.
  - Build with `buildMessageEntries(db, rows, readers)`.
  - Route: parse the id, then `MessageHistoryQuerySchema.parse(request.query)`, then `checkRead` with the
    session account, then `readHistory`.
- [ ] Run (PASS). Commit `feat(server): load the history of a conversation (TOKI-037)`.

## Task 9: the hidden direct message

**Files:** modify `packages/shared/src/direct-conversations.ts` (`lastMessageAt:
z.iso.datetime().nullable()`), `modules/conversations/{summaries,direct-open,deps,index}.ts`,
`bootstrap/build.ts`, `app.ts`; the tests of TOKI-030 R17/R18 and TOKI-031 R2/R7/R14/R17;
every fixture that `corepack pnpm typecheck` reports (web, client-core, ui-web, `e2e/support`), each
with `lastMessageAt: null`. Create `tests/conversations/hidden-direct.db.test.ts`.

**Produces:** type `ListLastMessageTimes`; `listConversationSummaries(tx, workspaceId, userId,
{ listLastMessageTimes })`; `hideUnstartedDirects(rows, userId, times)`;
`ConversationSummary.lastMessageAt: Date | null`; `DirectDeps.listLastMessageTimes`.

- [ ] Tests from R19. `bounds.db.test.ts`: 9 statements, the new read from `"messages"` after the
  conversations read.
- [ ] See them fail. Implement:

```ts
export function hideUnstartedDirects<T extends { id: string; kind: string; createdBy: string }>(
  rows: readonly T[], userId: string, times: ReadonlyMap<string, Date>,
): T[] {
  return rows.filter((r) => r.kind !== "dm" || r.createdBy === userId || times.has(r.id));
}
```

  `listConversationSummaries` also selects `createdBy`, calls `listLastMessageTimes` once with the ids
  of its `dm` and `group_dm` rows (also when there are none), filters, drops `createdBy` and adds
  `lastMessageAt`. `bootstrap/build.ts` uses `deps.listLastMessageTimes ?? listLastMessageTimes` and puts
  `lastMessageAt?.toISOString() ?? null` on direct entries. `openDirect`: `entryOf(found, at)`; an
  existing conversation reads its time inside the transaction, a new one has `null`.
- [ ] `corepack pnpm typecheck && corepack pnpm test`. Commit
  `feat(server): hide a new direct message until its first message (TOKI-037)`.

## Task 10: order of direct messages in the client

**Files:** modify `packages/client-core/src/conversations/selectors.ts` and its test,
`api/parse.test.ts`.

- [ ] Tests from R21: newest time first, `null` last by name, equal times by name, channels and
  starred unchanged; the lenient parse keeps `lastMessageAt`.
- [ ] See them fail. Implement and use it as `pick(...)` sorted on `{ row, entry }` pairs:

```ts
type Item = { row: ListRow; entry: BootstrapConversation };
const lastOf = (e: BootstrapConversation) => (e.kind === "channel" ? null : e.lastMessageAt);

// F09: newest message first; a conversation with none comes after, by name.
export function compareDirect(a: Item, b: Item): number {
  const x = lastOf(a.entry);
  const y = lastOf(b.entry);
  if (x === y) return compareByName(a.row, b.row);
  if (x === null) return 1;
  if (y === null) return -1;
  return x < y ? 1 : -1;
}
```

- [ ] Commit `feat(client-core): order direct messages by their latest message (TOKI-037)`.

## Task 11: backfill the joined lines

**Files:** modify `modules/conversations/{general,index}.ts`, `modules/messages/index.ts`,
`apps/server/package.json` (`"backfill:join-lines": "tsx --env-file-if-exists=../../.env
src/cli/backfill-join-lines.ts"`), the root `package.json` (`"backfill:join-lines": "pnpm --filter
@toki/server run backfill:join-lines"`, as `db:migrate`), `CLAUDE.md` (Commands); create `modules/messages/backfill.ts`, `cli/backfill-join-lines.ts`,
`tests/messages/backfill.db.test.ts`.

- [ ] Tests from R26 (a test trigger on `messages` raises on the second insert for the rollback case),
  and one process test of the command as `tests/cli/emergency-link.process.db.test.ts` does it.
- [ ] See them fail. Implement `listGeneralMemberJoins(tx, workspaceId)` (member rows of the
  `is_general` conversation joined to it: `{ conversationId, userId, joinedAt, createdBy }`), then:

```ts
export async function backfillGeneralJoinLines(db: Db, input: { workspaceId: string }): Promise<number> {
  return db.transaction(async (tx) => {
    // Members first: a member row that is visible has its line (if any) committed too.
    const joins = await listGeneralMemberJoins(tx, input.workspaceId);
    if (joins.length === 0) return 0;
    const lines = await tx.select({ userIds: messages.systemUserIds }).from(messages)
      .where(and(eq(messages.conversationId, joins[0]!.conversationId), eq(messages.kind, "system"), eq(messages.systemType, "member_joined")));
    const named = new Set(lines.flatMap((l) => l.userIds ?? []));
    const missing = joins.filter((j) => j.userId !== j.createdBy && !named.has(j.userId));
    for (const j of missing) {
      await tx.insert(messages).values({
        id: uuidv7(), workspaceId: input.workspaceId, conversationId: j.conversationId, authorId: j.userId,
        kind: "system", systemType: "member_joined", systemUserIds: [j.userId], body: "", createdAt: j.joinedAt,
      });
    }
    return missing.length;
  });
}
```

  The command takes no argument (otherwise exit 2), reads the database address with
  `loadProcessConfig(["database"])` as `db/migrate-cli.ts` does,
  runs every id of `listWorkspaceIds`, prints the count of lines, exits 1 on a failure with the
  Postgres code only.
- [ ] Commit `feat(server): add the command that writes the missing joined lines (TOKI-037)`.

## Task 12: safety and the whole suite

- [ ] Create `tests/messages/safety.db.test.ts` from R23 and R24: force a constraint failure on a send
  (a test check constraint on `messages`) and find neither the text nor `detail` in `h.logText()`; send
  and read with a known text and find it in no log line; row counts of every table but `messages` and
  `event_counters` unchanged after a send and a backfill; `saveMentions` and `linkAttachments`
  recorders: once and zero for a stored message, zero and zero for a repeat and a refusal. See the log
  case fail by throwing the raw error once.
- [ ] Run and expect success: `corepack pnpm lint`, `typecheck`, `test`, `build`, `size`,
  `i18n:check`, `corepack pnpm db:generate` (no change), `test:e2e`.
- [ ] Commit `test(server): check logs and writes of the message routes (TOKI-037)`.

## What can break

| Risk | Guard |
|---|---|
| The required key `lastMessageAt` breaks fixtures, or a new client reads an old server | typecheck finds every fixture (Task 9); client and server ship together |
| A deadlock between a send, a leave, an archive, an accept | lock order account, conversation, counter last; Task 4 and Task 7 two-connection tests |
| The history query stops using the index | `explain` test (Task 8) |
| More statements in channel routes and accept break existing counts | whole database project after Tasks 4 and 5 |
| A union `Change` breaks readers of `conversationId` | typecheck (Task 2) |
| A race test passes without the lock it claims to cover | Task 7 removes the lock once and sees red |
| Two sends with one id race past the lookup | the counter lock serialises inserts of a workspace; R5 two-connection test (Task 7) |
| A system line row blocks a test that deletes a conversation or a user | only SQL-only table tests delete them, none after an app request (checked 2026-11-27) |

Riskiest step: Task 6 with Task 7 (the send transaction). Rollback: revert the merge; no schema or
data change except lines already written, which stay readable rows of `messages`.
