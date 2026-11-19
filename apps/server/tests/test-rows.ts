import { createHash } from "node:crypto";
import type { Sql } from "postgres";

// Test-only (R26): inserts valid rows by SQL, so the tests of any module can
// create parent rows without importing another module's table (TOKI-002 R7,
// R17). Each function gives every required column a valid value, takes the
// column values to override (snake_case, as in the table), and returns the
// new row's id. Parent ids are passed in. Only *.test.ts files import this.

type Values = Record<string, unknown>;

const FIXED = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-01-01T00:10:00.000Z");

// A 64-character lower-case hex string made from a seed, unique per seed.
const hex = (seed: string) => createHash("sha256").update(seed).digest("hex");

async function insert(sql: Sql, table: string, row: Values): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into ${sql(table)} ${sql(row as Record<string, never>)} returning id`;
  return rows[0]!.id;
}

export function insertWorkspace(
  sql: Sql,
  values: Values = {},
): Promise<string> {
  const id = crypto.randomUUID();
  return insert(sql, "workspaces", {
    id,
    name: "Test workspace",
    created_at: FIXED,
    ...values,
  });
}

export function insertUser(
  sql: Sql,
  values: { workspace_id: string } & Values,
): Promise<string> {
  const id = crypto.randomUUID();
  return insert(sql, "users", {
    id,
    email: `${id}@example.com`,
    display_name: "Test user",
    role: "member",
    status: "active",
    language: "en",
    created_at: FIXED,
    ...values,
  });
}

export function insertLoginCode(
  sql: Sql,
  values: { workspace_id: string } & Values,
): Promise<string> {
  const id = crypto.randomUUID();
  return insert(sql, "login_codes", {
    id,
    created_at: FIXED,
    purpose: "sign_in",
    email: `${id}@example.com`,
    user_id: null,
    request_hash: hex(`request:${id}`),
    code_hash: hex(`code:${id}`),
    expires_at: LATER,
    wrong_tries: 0,
    used_at: null,
    cancelled_at: null,
    ...values,
  });
}

export function insertSession(
  sql: Sql,
  values: { workspace_id: string; user_id: string } & Values,
): Promise<string> {
  const id = crypto.randomUUID();
  return insert(sql, "sessions", {
    id,
    created_at: FIXED,
    secret_hash: hex(`secret:${id}`),
    kind: "cookie",
    user_agent: null,
    last_used_at: FIXED,
    ended_at: null,
    ended_reason: null,
    ...values,
  });
}

export function insertDevice(
  sql: Sql,
  values: {
    workspace_id: string;
    user_id: string;
    session_id: string;
  } & Values,
): Promise<string> {
  const id = crypto.randomUUID();
  const { push_address, ...rest } = values;
  return insert(sql, "devices", {
    id,
    created_at: FIXED,
    push_channel: "web_push",
    push_address: sql.json((push_address ?? {}) as never),
    ...rest,
  });
}

// A channel by default (TOKI-028). Pass `kind`, `name`, `dm_key` and so on to
// override. A direct message or group needs its member rows in the same
// transaction (R21): use insertDirectConversation.
export function insertConversation(
  sql: Sql,
  values: { workspace_id: string; created_by: string } & Values,
): Promise<string> {
  const id = crypto.randomUUID();
  return insert(sql, "conversations", {
    id,
    kind: "channel",
    name: `channel-${id.slice(0, 8)}`,
    topic: null,
    description: null,
    is_private: false,
    is_general: false,
    dm_key: null,
    created_at: FIXED,
    archived_at: null,
    ...values,
  });
}

export async function insertConversationMember(
  sql: Sql,
  values: {
    conversation_id: string;
    user_id: string;
    workspace_id: string;
  } & Values,
): Promise<void> {
  await sql`insert into conversation_members ${sql({
    notification_level: null,
    is_muted: false,
    is_starred: false,
    created_at: FIXED,
    ...values,
  } as unknown as Record<string, never>)}`;
}

// A direct message (2 people) or group (3 to 8) and its member rows, in one
// transaction, with the key sorted in byte order as the database checks it.
export function insertDirectConversation(
  sql: Sql,
  values: { workspace_id: string; user_ids: string[] } & Values,
): Promise<string> {
  const { user_ids, ...rest } = values;
  const key = [...user_ids].sort().join(",");
  return sql.begin(async (tx) => {
    const id = await insertConversation(tx as unknown as Sql, {
      kind: user_ids.length === 2 ? "dm" : "group_dm",
      name: null,
      is_private: true,
      dm_key: key,
      created_by: user_ids[0]!,
      ...rest,
    });
    for (const user_id of user_ids) {
      await insertConversationMember(tx as unknown as Sql, {
        conversation_id: id,
        user_id,
        workspace_id: values.workspace_id,
      });
    }
    return id;
  });
}
