import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrationsFolder, runMigrations } from "../../src/db/migrate.js";
import {
  insertAdminAction,
  insertInvitation,
  insertMemberRequest,
  insertUser,
  insertWorkspace,
} from "../test-rows.js";
import { createThrowawayDb } from "../throwaway-db.js";

type PgError = Error & { code?: string; constraint_name?: string };

const CHECK = "23514";
const UNIQUE = "23505";
const FOREIGN = "23503";
const NOT_NULL = "23502";
const FIXED = new Date("2026-01-01T00:00:00.000Z");
const LATER = new Date("2026-01-02T00:00:00.000Z");
const NO_ROW = "00000000-0000-7000-8000-000000000000";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let sql: Sql;
let ws: string;
let admin: string;
let emptyCounts: Record<string, number>;
const tables = ["invitations", "admin_actions", "member_requests"] as const;

beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  sql = postgres(throwaway.url, { max: 1, onnotice: () => {} });
  emptyCounts = {};
  for (const table of tables) {
    const [row] = await sql<
      { n: number }[]
    >`select count(*)::int as n from ${sql(table)}`;
    emptyCounts[table] = row!.n;
  }
  ws = await insertWorkspace(sql);
  admin = await insertUser(sql, { workspace_id: ws, role: "admin" });
});
afterAll(async () => {
  await sql?.end();
  await throwaway?.drop();
});

async function failsWith(
  run: PromiseLike<unknown>,
  code: string,
  name: string,
) {
  let error: PgError | null = null;
  try {
    await run;
  } catch (e) {
    error = e as PgError;
  }
  expect(error, "the statement should have failed").not.toBeNull();
  expect(error?.code).toBe(code);
  expect(error?.constraint_name).toBe(name);
}

const invitation = (values: Record<string, unknown> = {}) =>
  insertInvitation(sql, { workspace_id: ws, invited_by: admin, ...values });
const action = (values: Record<string, unknown> = {}) =>
  insertAdminAction(sql, { workspace_id: ws, actor_id: admin, ...values });
const request = (values: Record<string, unknown> = {}) =>
  insertMemberRequest(sql, { workspace_id: ws, user_id: admin, ...values });

async function columns(table: string) {
  const rows = await sql<
    { column_name: string; data_type: string; is_nullable: string }[]
  >`
    select column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
    order by column_name`;
  return Object.fromEntries(
    rows.map((r) => [
      r.column_name,
      `${r.data_type}${r.is_nullable === "YES" ? " null" : ""}`,
    ]),
  );
}

async function defaults(table: string) {
  const rows = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
      and column_default is not null`;
  return rows.map((r) => r.column_name);
}

async function constraints(table: string) {
  const rows = await sql<{ conname: string }[]>`
    select conname from pg_constraint
    where conrelid = ${table}::regclass and contype <> 'n'
    order by conname`;
  return rows.map((r) => r.conname);
}

describe("the migration file (R36)", () => {
  const files = readdirSync(migrationsFolder).filter((f) =>
    /^\d{4}_member_management\.sql$/.test(f),
  );
  it("is one file that creates the three tables and no other", () => {
    expect(files).toHaveLength(1);
    const text = readFileSync(join(migrationsFolder, files[0]!), "utf8");
    const created = [...text.matchAll(/CREATE TABLE "([a-z_]+)"/g)].map(
      (m) => m[1],
    );
    expect(created.sort()).toEqual([...tables].sort());
    expect(text).not.toMatch(/ALTER TABLE "users"/);
    expect(text).not.toMatch(/\bINSERT\b/i);
  });
  it("inserts no row", () => {
    expect(emptyCounts).toEqual({
      invitations: 0,
      admin_actions: 0,
      member_requests: 0,
    });
  });
  it("gives no column a database default", async () => {
    for (const table of tables) expect(await defaults(table)).toEqual([]);
  });
});

describe("invitations (R38)", () => {
  it("has the columns of the data model", async () => {
    expect(await columns("invitations")).toEqual({
      code_issued_at: "timestamp with time zone",
      code_serial: "integer",
      created_at: "timestamp with time zone",
      email: "text",
      expires_at: "timestamp with time zone",
      id: "uuid",
      invited_by: "uuid",
      mail_status: "text",
      revoked_at: "timestamp with time zone null",
      role: "text",
      sent_at: "timestamp with time zone",
      token_hash: "text",
      used_at: "timestamp with time zone null",
      used_by: "uuid null",
      user_id: "uuid null",
      workspace_id: "uuid",
    });
  });
  it("has the named constraints and the partial unique index", async () => {
    expect(await constraints("invitations")).toEqual([
      "invitations_closed_check",
      "invitations_code_serial_check",
      "invitations_email_check",
      "invitations_email_length_check",
      "invitations_expires_at_check",
      "invitations_invited_by_fkey",
      "invitations_mail_status_check",
      "invitations_pkey",
      "invitations_role_check",
      "invitations_token_hash_check",
      "invitations_token_hash_key",
      "invitations_used_by_fkey",
      "invitations_user_id_fkey",
      "invitations_workspace_id_fkey",
    ]);
    const [index] = await sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where indexname = 'invitations_open_email_key'`;
    expect(index?.indexdef).toMatch(/UNIQUE INDEX/);
    expect(index?.indexdef).toMatch(/\(workspace_id, email\)/);
    expect(index?.indexdef).toMatch(
      /WHERE \(\(used_at IS NULL\) AND \(revoked_at IS NULL\)\)/,
    );
  });
  it("accepts a valid row", async () => {
    const id = await invitation();
    const [row] = await sql`select role from invitations where id = ${id}`;
    expect(row?.role).toBe("member");
  });
  it.each([
    ["Sam@example.com", "invitations_email_check"],
    ["sam @example.com", "invitations_email_check"],
    [`${"a".repeat(243)}@example.com`, "invitations_email_length_check"],
  ])("refuses the address %s", async (email, name) => {
    await failsWith(invitation({ email }), CHECK, name);
  });
  it("accepts an address of 254 characters", async () => {
    await invitation({ email: `${"a".repeat(242)}@example.com` });
  });
  it("refuses a role that is not member or admin", async () => {
    await failsWith(
      invitation({ role: "owner" }),
      CHECK,
      "invitations_role_check",
    );
    await invitation({ role: "admin" });
  });
  it.each([
    ["a".repeat(63)],
    ["a".repeat(65)],
    ["A".repeat(64)],
    ["g".repeat(64)],
  ])("refuses the token hash %s", async (token_hash) => {
    await failsWith(
      invitation({ token_hash }),
      CHECK,
      "invitations_token_hash_check",
    );
  });
  it("refuses a second row with the same token hash", async () => {
    const token_hash = "b".repeat(64);
    await invitation({ token_hash });
    await failsWith(
      invitation({ token_hash }),
      UNIQUE,
      "invitations_token_hash_key",
    );
  });
  it("refuses a negative code serial", async () => {
    await failsWith(
      invitation({ code_serial: -1 }),
      CHECK,
      "invitations_code_serial_check",
    );
  });
  it("refuses a mail status that is not sent or failed", async () => {
    await failsWith(
      invitation({ mail_status: "queued" }),
      CHECK,
      "invitations_mail_status_check",
    );
    await invitation({ mail_status: "failed" });
  });
  it("refuses an expiry that is not later than the send", async () => {
    await failsWith(
      invitation({ sent_at: FIXED, expires_at: FIXED }),
      CHECK,
      "invitations_expires_at_check",
    );
  });
  it("refuses a row that is both used and revoked", async () => {
    await failsWith(
      invitation({ used_at: LATER, used_by: admin, revoked_at: LATER }),
      CHECK,
      "invitations_closed_check",
    );
  });
  it("allows one unclosed invitation for an address, and a new one after a close", async () => {
    const email = "open@example.com";
    const first = await invitation({ email });
    await failsWith(
      invitation({ email }),
      UNIQUE,
      "invitations_open_email_key",
    );
    // An expired invitation is still unclosed.
    await sql`update invitations set expires_at = ${LATER} where id = ${first}`;
    await failsWith(
      invitation({ email }),
      UNIQUE,
      "invitations_open_email_key",
    );
    await sql`update invitations set revoked_at = ${LATER} where id = ${first}`;
    const second = await invitation({ email });
    await sql`update invitations set used_at = ${LATER}, used_by = ${admin} where id = ${second}`;
    await invitation({ email });
  });
  it("allows the same address in another workspace", async () => {
    const other = await insertWorkspace(sql);
    const otherAdmin = await insertUser(sql, { workspace_id: other });
    await invitation({ email: "both@example.com" });
    await insertInvitation(sql, {
      workspace_id: other,
      invited_by: otherAdmin,
      email: "both@example.com",
    });
  });
  it.each([
    ["workspace_id", "invitations_workspace_id_fkey"],
    ["invited_by", "invitations_invited_by_fkey"],
    ["user_id", "invitations_user_id_fkey"],
    ["used_by", "invitations_used_by_fkey"],
  ])("refuses an unknown %s", async (column, name) => {
    const values: Record<string, unknown> = { [column]: NO_ROW };
    if (column === "used_by") values.used_at = LATER;
    await failsWith(invitation(values), FOREIGN, name);
  });
  it("refuses the deletion of a person an invitation points to", async () => {
    const person = await insertUser(sql, { workspace_id: ws });
    await invitation({ user_id: person });
    await failsWith(
      sql`delete from users where id = ${person}`,
      FOREIGN,
      "invitations_user_id_fkey",
    );
  });
  it.each([
    "email",
    "role",
    "invited_by",
    "token_hash",
    "code_serial",
    "code_issued_at",
    "mail_status",
    "created_at",
    "sent_at",
    "expires_at",
  ])("requires %s", async (column) => {
    let error: PgError | null = null;
    try {
      await invitation({ [column]: null });
    } catch (e) {
      error = e as PgError;
    }
    expect(error?.code).toBe(NOT_NULL);
  });
});

describe("admin_actions (R31, R38)", () => {
  it("has the columns of the data model", async () => {
    expect(await columns("admin_actions")).toEqual({
      action: "text",
      actor_id: "uuid",
      created_at: "timestamp with time zone",
      detail: "jsonb",
      id: "uuid",
      target_email: "text null",
      target_user_id: "uuid null",
      workspace_id: "uuid",
    });
  });
  it("has the named constraints", async () => {
    expect(await constraints("admin_actions")).toEqual([
      "admin_actions_action_check",
      "admin_actions_actor_id_fkey",
      "admin_actions_detail_check",
      "admin_actions_pkey",
      "admin_actions_target_email_check",
      "admin_actions_target_email_length_check",
      "admin_actions_target_user_id_fkey",
      "admin_actions_workspace_id_fkey",
    ]);
  });
  it.each([
    "invitation_created",
    "invitation_resent",
    "invitation_revoked",
    "role_changed",
    "account_deactivated",
    "account_reactivated",
  ])("accepts the action %s", async (name) => {
    await action({ action: name });
  });
  it("refuses any other action", async () => {
    await failsWith(
      action({ action: "account_deleted" }),
      CHECK,
      "admin_actions_action_check",
    );
  });
  it("refuses a detail that is not an object", async () => {
    await failsWith(
      sql`insert into admin_actions (id, workspace_id, actor_id, action, detail, created_at)
          values (${crypto.randomUUID()}, ${ws}, ${admin}, 'role_changed', '[]'::jsonb, ${FIXED})`,
      CHECK,
      "admin_actions_detail_check",
    );
    await failsWith(
      sql`insert into admin_actions (id, workspace_id, actor_id, action, detail, created_at)
          values (${crypto.randomUUID()}, ${ws}, ${admin}, 'role_changed', '"x"'::jsonb, ${FIXED})`,
      CHECK,
      "admin_actions_detail_check",
    );
  });
  it("holds the target address to the rule of an address", async () => {
    await failsWith(
      action({ target_email: "Sam@example.com" }),
      CHECK,
      "admin_actions_target_email_check",
    );
    await failsWith(
      action({ target_email: `${"a".repeat(243)}@example.com` }),
      CHECK,
      "admin_actions_target_email_length_check",
    );
    await action({ target_email: "sam@example.com" });
  });
  it.each([
    ["workspace_id", "admin_actions_workspace_id_fkey"],
    ["actor_id", "admin_actions_actor_id_fkey"],
    ["target_user_id", "admin_actions_target_user_id_fkey"],
  ])("refuses an unknown %s", async (column, name) => {
    await failsWith(action({ [column]: NO_ROW }), FOREIGN, name);
  });
  it("refuses an update and a delete, naming the trigger", async () => {
    const id = await action();
    await failsWith(
      sql`update admin_actions set action = 'invitation_revoked' where id = ${id}`,
      CHECK,
      "admin_actions_append_only_trg",
    );
    await failsWith(
      sql`delete from admin_actions where id = ${id}`,
      CHECK,
      "admin_actions_append_only_trg",
    );
    const [row] = await sql`select action from admin_actions where id = ${id}`;
    expect(row?.action).toBe("role_changed");
  });
  it("does not block TRUNCATE, so the test emptying step works", async () => {
    const other = await createThrowawayDb();
    const client = postgres(other.url, { max: 1, onnotice: () => {} });
    try {
      await runMigrations(other.url, migrationsFolder);
      const w = await insertWorkspace(client);
      const u = await insertUser(client, { workspace_id: w });
      await insertAdminAction(client, { workspace_id: w, actor_id: u });
      await client`truncate admin_actions`;
      const [row] = await client`select count(*)::int as n from admin_actions`;
      expect(row?.n).toBe(0);
    } finally {
      await client.end();
      await other.drop();
    }
  });
});

describe("member_requests (R13, R38)", () => {
  it("has the columns of the data model", async () => {
    expect(await columns("member_requests")).toEqual({
      action: "text",
      claim_id: "uuid",
      claimed_at: "timestamp with time zone",
      completed_at: "timestamp with time zone null",
      created_at: "timestamp with time zone",
      id: "uuid",
      request_hash: "text",
      request_key: "text",
      response_body: "jsonb null",
      response_status: "integer null",
      state: "text",
      user_id: "uuid",
      workspace_id: "uuid",
    });
  });
  it("has the named constraints", async () => {
    expect(await constraints("member_requests")).toEqual([
      "member_requests_action_check",
      "member_requests_done_check",
      "member_requests_pkey",
      "member_requests_request_hash_check",
      "member_requests_request_key_check",
      "member_requests_state_check",
      "member_requests_user_id_fkey",
      "member_requests_user_id_request_key_key",
      "member_requests_workspace_id_fkey",
    ]);
  });
  it.each([[""], ["a".repeat(65)], ["a b"], ["a/b"]])(
    "refuses the key '%s'",
    async (request_key) => {
      await failsWith(
        request({ request_key }),
        CHECK,
        "member_requests_request_key_check",
      );
    },
  );
  it("accepts a key of 64 characters", async () => {
    await request({ request_key: "A-z_0".repeat(12) + "abcd" });
  });
  it("refuses an action that is not invite or resend", async () => {
    await failsWith(
      request({ action: "revoke" }),
      CHECK,
      "member_requests_action_check",
    );
    await request({ action: "resend" });
  });
  it("refuses a request hash that is not 64 lower-case hexadecimal characters", async () => {
    await failsWith(
      request({ request_hash: "A".repeat(64) }),
      CHECK,
      "member_requests_request_hash_check",
    );
  });
  it("refuses a state that is not pending or done", async () => {
    await failsWith(
      request({ state: "failed" }),
      CHECK,
      "member_requests_state_check",
    );
  });
  it("needs a status and a body when done, and neither while pending", async () => {
    await failsWith(
      request({ state: "done" }),
      CHECK,
      "member_requests_done_check",
    );
    await failsWith(
      request({ state: "done", response_status: 200 }),
      CHECK,
      "member_requests_done_check",
    );
    await failsWith(
      request({ state: "pending", response_status: 200 }),
      CHECK,
      "member_requests_done_check",
    );
    await request({
      state: "done",
      response_status: 200,
      response_body: { results: [] },
      completed_at: LATER,
    });
  });
  it("is unique by person and key, and two people may use the same key", async () => {
    await request({ request_key: "same" });
    await failsWith(
      request({ request_key: "same" }),
      UNIQUE,
      "member_requests_user_id_request_key_key",
    );
    const other = await insertUser(sql, { workspace_id: ws, role: "admin" });
    await request({ request_key: "same", user_id: other });
  });
  it.each([
    ["workspace_id", "member_requests_workspace_id_fkey"],
    ["user_id", "member_requests_user_id_fkey"],
  ])("refuses an unknown %s", async (column, name) => {
    await failsWith(request({ [column]: NO_ROW }), FOREIGN, name);
  });
});
