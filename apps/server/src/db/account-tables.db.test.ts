import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayDb } from "../tests/throwaway-db.js";
import { migrationsFolder, runMigrations } from "./migrate.js";
import {
  insertDevice,
  insertLoginCode,
  insertSession,
  insertUser,
  insertWorkspace,
} from "./test-rows.js";

// The constraint tests send SQL text, so they prove what the database
// enforces whatever the Drizzle definitions say (R22, Layout). Every "must
// fail" case asserts the constraint name or column in the Postgres error.

type PgError = Error & {
  code?: string;
  constraint_name?: string;
  column_name?: string;
};

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let sql: Sql;
let emptyCounts: Record<string, number>;
let ws: string;
const tables = ["users", "login_codes", "sessions", "devices"] as const;

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
});
afterAll(async () => {
  await sql?.end();
  await throwaway?.drop();
});

async function fails(run: PromiseLike<unknown>): Promise<PgError> {
  let error: unknown = null;
  try {
    await run;
  } catch (e) {
    error = e;
  }
  expect(error, "the statement should have failed").not.toBeNull();
  return error as PgError;
}

async function failsWith(
  run: PromiseLike<unknown>,
  code: string,
  name: string,
) {
  const error = await fails(run);
  expect(error.code).toBe(code);
  expect(error.constraint_name).toBe(name);
}
const checkFails = (run: PromiseLike<unknown>, name: string) =>
  failsWith(run, "23514", name);

const hex = (c: string) => c.repeat(64);

describe("migration file and columns (R1, R2, R25)", () => {
  it("has one migration file with four CREATE TABLE statements in order (R1, R23)", () => {
    const files = readdirSync(migrationsFolder).filter((f) =>
      /^\d{4}_account_tables\.sql$/.test(f),
    );
    expect(files).toHaveLength(1);
    const text = readFileSync(join(migrationsFolder, files[0]!), "utf8");
    const names = [...text.matchAll(/CREATE TABLE "(\w+)"/g)].map((m) => m[1]);
    expect(names).toEqual(["users", "login_codes", "sessions", "devices"]);
  });

  it("keeps an existing workspaces row when the migration is applied (R1)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "toki-mig-"));
    mkdirSync(join(dir, "meta"));
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, "meta", "_journal.json"), "utf8"),
    );
    const first = journal.entries[0];
    writeFileSync(
      join(dir, "meta", "_journal.json"),
      JSON.stringify({ ...journal, entries: [first] }),
    );
    copyFileSync(
      join(migrationsFolder, `${first.tag}.sql`),
      join(dir, `${first.tag}.sql`),
    );
    const own = await createThrowawayDb();
    const client = postgres(own.url, { max: 1, onnotice: () => {} });
    try {
      await runMigrations(own.url, dir);
      const id = await insertWorkspace(client);
      await runMigrations(own.url, migrationsFolder);
      const rows = await client`select id from workspaces`;
      expect(rows.map((r) => r.id)).toEqual([id]);
      const [{ n }] = await client`select count(*)::int as n from users`;
      expect(n).toBe(0);
    } finally {
      await client.end();
      await own.drop();
    }
  });

  it("has exactly the listed columns, types and null rules (R2)", async () => {
    const uuid = "uuid",
      text = "text",
      tz = "timestamp with time zone";
    const expected: Record<string, [string, string, "YES" | "NO"][]> = {
      users: [
        ["id", uuid, "NO"],
        ["workspace_id", uuid, "NO"],
        ["email", text, "NO"],
        ["display_name", text, "NO"],
        ["role", text, "NO"],
        ["status", text, "NO"],
        ["language", text, "NO"],
        ["created_at", tz, "NO"],
      ],
      login_codes: [
        ["id", uuid, "NO"],
        ["workspace_id", uuid, "NO"],
        ["created_at", tz, "NO"],
        ["purpose", text, "NO"],
        ["email", text, "NO"],
        ["user_id", uuid, "YES"],
        ["request_hash", text, "NO"],
        ["code_hash", text, "NO"],
        ["expires_at", tz, "NO"],
        ["wrong_tries", "integer", "NO"],
        ["used_at", tz, "YES"],
        ["cancelled_at", tz, "YES"],
      ],
      sessions: [
        ["id", uuid, "NO"],
        ["workspace_id", uuid, "NO"],
        ["created_at", tz, "NO"],
        ["user_id", uuid, "NO"],
        ["secret_hash", text, "NO"],
        ["kind", text, "NO"],
        ["user_agent", text, "YES"],
        ["last_used_at", tz, "NO"],
        ["ended_at", tz, "YES"],
        ["ended_reason", text, "YES"],
      ],
      devices: [
        ["id", uuid, "NO"],
        ["workspace_id", uuid, "NO"],
        ["created_at", tz, "NO"],
        ["user_id", uuid, "NO"],
        ["session_id", uuid, "NO"],
        ["push_channel", text, "NO"],
        ["push_address", "jsonb", "NO"],
      ],
    };
    for (const table of tables) {
      const rows = await sql<
        { column_name: string; data_type: string; is_nullable: "YES" | "NO" }[]
      >`
        select column_name, data_type, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = ${table}`;
      const actual = rows
        .map((r) => [r.column_name, r.data_type, r.is_nullable] as const)
        .sort((a, b) => a[0].localeCompare(b[0]));
      const want = [...expected[table]!].sort((a, b) =>
        a[0].localeCompare(b[0]),
      );
      expect(actual, table).toEqual(want);
    }
  });

  it("creates the tables empty (R25)", () => {
    expect(emptyCounts).toEqual({
      users: 0,
      login_codes: 0,
      sessions: 0,
      devices: 0,
    });
  });
});

describe("keys and times (R4, R5, R6, R22)", () => {
  const expectedKeys = [
    "users_workspace_id_fkey",
    "login_codes_workspace_id_fkey",
    "login_codes_user_id_fkey",
    "sessions_workspace_id_fkey",
    "sessions_user_id_fkey",
    "devices_workspace_id_fkey",
    "devices_user_id_fkey",
    "devices_session_id_fkey",
  ];

  it("has every foreign key by name, all ON DELETE RESTRICT (R5, R22)", async () => {
    const rows = await sql<{ conname: string; confdeltype: string }[]>`
      select conname, confdeltype from pg_constraint
      where contype = 'f' and conrelid in
        ('users'::regclass, 'login_codes'::regclass, 'sessions'::regclass, 'devices'::regclass)`;
    expect(rows.map((r) => r.conname).sort()).toEqual([...expectedKeys].sort());
    expect(rows.every((r) => r.confdeltype === "r")).toBe(true);
  });

  it("refuses a workspace_id that is not in workspaces (R4)", async () => {
    const missing = crypto.randomUUID();
    const user = await insertUser(sql, { workspace_id: ws });
    const session = await insertSession(sql, {
      workspace_id: ws,
      user_id: user,
    });
    await failsWith(
      insertUser(sql, { workspace_id: missing }),
      "23503",
      "users_workspace_id_fkey",
    );
    await failsWith(
      insertLoginCode(sql, { workspace_id: missing }),
      "23503",
      "login_codes_workspace_id_fkey",
    );
    await failsWith(
      insertSession(sql, { workspace_id: missing, user_id: user }),
      "23503",
      "sessions_workspace_id_fkey",
    );
    await failsWith(
      insertDevice(sql, {
        workspace_id: missing,
        user_id: user,
        session_id: session,
      }),
      "23503",
      "devices_workspace_id_fkey",
    );
  });

  it("requires workspace_id on every table (R4)", async () => {
    const id = () => crypto.randomUUID();
    const t = new Date("2026-01-01T00:00:00Z");
    const user = await insertUser(sql, { workspace_id: ws });
    const session = await insertSession(sql, {
      workspace_id: ws,
      user_id: user,
    });
    const statements = [
      sql`insert into users (id, email, display_name, role, status, created_at)
          values (${id()}, ${id() + "@example.com"}, 'A', 'member', 'active', ${t})`,
      sql`insert into login_codes (id, created_at, purpose, email, request_hash, code_hash, expires_at, wrong_tries)
          values (${id()}, ${t}, 'sign_in', ${id() + "@example.com"}, ${hex("a")}, ${hex("b")}, ${new Date(t.getTime() + 600000)}, 0)`,
      sql`insert into sessions (id, created_at, user_id, secret_hash, kind, last_used_at)
          values (${id()}, ${t}, ${user}, ${hex("c")}, 'cookie', ${t})`,
      sql`insert into devices (id, created_at, user_id, session_id, push_channel, push_address)
          values (${id()}, ${t}, ${user}, ${session}, 'web_push', '{}'::jsonb)`,
    ];
    for (const statement of statements) {
      const error = await fails(statement);
      expect(error.code).toBe("23502");
      expect(error.column_name).toBe("workspace_id");
    }
  });

  it("refuses to delete a row that another row points to (R5)", async () => {
    const user = await insertUser(sql, { workspace_id: ws });
    await insertSession(sql, { workspace_id: ws, user_id: user });
    await failsWith(
      sql`delete from users where id = ${user}`,
      "23503",
      "sessions_user_id_fkey",
    );
  });

  it("gives no time column a database default and refuses a missing created_at (R6)", async () => {
    const rows = await sql<
      {
        table_name: string;
        column_name: string;
        column_default: string | null;
      }[]
    >`
      select table_name, column_name, column_default from information_schema.columns
      where table_schema = 'public' and table_name in ('users','login_codes','sessions','devices')
        and data_type = 'timestamp with time zone'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(
        row.column_default,
        `${row.table_name}.${row.column_name}`,
      ).toBeNull();
    }
    const error = await fails(
      sql`insert into users (id, workspace_id, email, display_name, role, status)
          values (${crypto.randomUUID()}, ${ws}, 'x1@example.com', 'A', 'member', 'active')`,
    );
    expect(error.code).toBe("23502");
    expect(error.column_name).toBe("created_at");
  });
});

describe("users (R7 to R11)", () => {
  const user = (over: Record<string, unknown>) =>
    insertUser(sql, { workspace_id: ws, ...over });

  it("refuses an address with capitals or whitespace (R7)", async () => {
    await checkFails(user({ email: "Minh@Example.com" }), "users_email_check");
    await checkFails(user({ email: " minh@example.com" }), "users_email_check");
    await checkFails(
      user({ email: "minh@example.com\t" }),
      "users_email_check",
    );
  });

  it("limits the address to 254 code points (R7)", async () => {
    await checkFails(
      user({ email: "a".repeat(243) + "@example.com" }),
      "users_email_length_check",
    );
    await user({ email: "b".repeat(242) + "@example.com" });
    await user({ email: "😀".repeat(254) });
  });

  it("makes the address unique per workspace (R7)", async () => {
    await user({ email: "same@example.com" });
    await failsWith(
      user({ email: "same@example.com" }),
      "23505",
      "users_workspace_id_email_key",
    );
    const other = await insertWorkspace(sql);
    await insertUser(sql, { workspace_id: other, email: "same@example.com" });
  });

  it("limits the display name to 1 to 80 code points (R8)", async () => {
    await checkFails(
      user({ display_name: "" }),
      "users_display_name_length_check",
    );
    await checkFails(
      user({ display_name: "x".repeat(81) }),
      "users_display_name_length_check",
    );
    await user({ display_name: "x".repeat(80) });
    await user({ display_name: "😀".repeat(80) });
    await user({ display_name: "x" });
  });

  it("accepts only member and admin as role, with no default (R9)", async () => {
    for (const role of ["owner", "guest", ""]) {
      await checkFails(user({ role }), "users_role_check");
    }
    await user({ role: "member" });
    await user({ role: "admin" });
    const error = await fails(
      sql`insert into users (id, workspace_id, email, display_name, status, created_at)
          values (${crypto.randomUUID()}, ${ws}, 'norole@example.com', 'A', 'active', now())`,
    );
    expect(error.code).toBe("23502");
    expect(error.column_name).toBe("role");
  });

  it("accepts only active and deactivated as status (R10)", async () => {
    await checkFails(user({ status: "invited" }), "users_status_check");
    await checkFails(user({ status: "Active" }), "users_status_check");
    await user({ status: "active" });
    await user({ status: "deactivated" });
  });

  it("defaults the language to en and accepts en and vi only (R11)", async () => {
    const id = crypto.randomUUID();
    await sql`insert into users (id, workspace_id, email, display_name, role, status, created_at)
      values (${id}, ${ws}, 'lang@example.com', 'A', 'member', 'active', now())`;
    const [row] = await sql`select language from users where id = ${id}`;
    expect(row!.language).toBe("en");
    await checkFails(user({ language: "fr" }), "users_language_check");
    await user({ language: "vi" });
  });
});

describe("login_codes (R13 to R15, R19)", () => {
  const code = (over: Record<string, unknown>) =>
    insertLoginCode(sql, { workspace_id: ws, ...over });

  it("checks purpose, address and user (R13)", async () => {
    await checkFails(code({ purpose: "other" }), "login_codes_purpose_check");
    await checkFails(
      code({ email: "Minh@Example.com" }),
      "login_codes_email_check",
    );
    await failsWith(
      code({ user_id: crypto.randomUUID() }),
      "23503",
      "login_codes_user_id_fkey",
    );
    await checkFails(
      code({ email: "a".repeat(243) + "@example.com" }),
      "login_codes_email_length_check",
    );
    await code({ user_id: null });
    await code({ purpose: "invitation" });
  });

  it("stores only 64 lower-case hex hashes, request_hash unique (R14)", async () => {
    await checkFails(
      code({ request_hash: "a".repeat(63) }),
      "login_codes_request_hash_check",
    );
    await checkFails(
      code({ request_hash: "A".repeat(64) }),
      "login_codes_request_hash_check",
    );
    await checkFails(
      code({ request_hash: "g".repeat(64) }),
      "login_codes_request_hash_check",
    );
    await checkFails(
      code({ code_hash: "a".repeat(63) }),
      "login_codes_code_hash_check",
    );
    await checkFails(
      code({ code_hash: "G".repeat(64) }),
      "login_codes_code_hash_check",
    );
    await code({ request_hash: hex("1") });
    await failsWith(
      code({ request_hash: hex("1") }),
      "23505",
      "login_codes_request_hash_key",
    );
  });

  it("defaults wrong_tries to 0 and keeps it between 0 and 5; expires_at is later than created_at (R15)", async () => {
    const id = crypto.randomUUID();
    const t = new Date("2026-01-01T00:00:00Z");
    await sql`insert into login_codes (id, workspace_id, created_at, purpose, email, request_hash, code_hash, expires_at)
      values (${id}, ${ws}, ${t}, 'sign_in', 'tries@example.com', ${hex("2")}, ${hex("3")}, ${new Date(t.getTime() + 600000)})`;
    const [row] =
      await sql`select wrong_tries from login_codes where id = ${id}`;
    expect(row!.wrong_tries).toBe(0);
    await checkFails(code({ wrong_tries: 6 }), "login_codes_wrong_tries_check");
    await checkFails(
      code({ wrong_tries: -1 }),
      "login_codes_wrong_tries_check",
    );
    await code({ wrong_tries: 5 });
    await checkFails(
      code({ created_at: t, expires_at: t }),
      "login_codes_expires_at_check",
    );
  });

  it("has the two partial indexes of the sign-in counts and the removal (R19)", async () => {
    const rows = await sql<{ indexname: string; indexdef: string }[]>`
      select indexname, indexdef from pg_indexes where tablename = 'login_codes'`;
    const byName = Object.fromEntries(
      rows.map((r) => [r.indexname, r.indexdef]),
    );
    expect(byName["login_codes_sign_in_email_created_at_idx"]).toMatch(
      /\(email, created_at\)/,
    );
    expect(byName["login_codes_sign_in_email_created_at_idx"]).toMatch(
      /WHERE \(purpose = 'sign_in'::text\)/,
    );
    expect(byName["login_codes_sign_in_created_at_idx"]).toMatch(
      /\(created_at\)/,
    );
    expect(byName["login_codes_sign_in_created_at_idx"]).toMatch(
      /WHERE \(purpose = 'sign_in'::text\)/,
    );
    expect(Object.keys(byName).sort()).toEqual([
      "login_codes_pkey",
      "login_codes_request_hash_key",
      "login_codes_sign_in_created_at_idx",
      "login_codes_sign_in_email_created_at_idx",
    ]);
  });
});

describe("sessions (R16 to R18)", () => {
  let user: string;
  beforeAll(async () => {
    user = await insertUser(sql, { workspace_id: ws });
  });
  const session = (over: Record<string, unknown>) =>
    insertSession(sql, { workspace_id: ws, user_id: user, ...over });

  it("checks kind, hash, user agent and user (R16)", async () => {
    await checkFails(session({ kind: "bearer" }), "sessions_kind_check");
    await checkFails(
      session({ secret_hash: "a".repeat(65) }),
      "sessions_secret_hash_check",
    );
    await session({ secret_hash: hex("4") });
    await failsWith(
      session({ secret_hash: hex("4") }),
      "23505",
      "sessions_secret_hash_key",
    );
    await checkFails(
      session({ user_agent: "x".repeat(513) }),
      "sessions_user_agent_length_check",
    );
    const error = await fails(session({ user_id: null }));
    expect(error.code).toBe("23502");
    expect(error.column_name).toBe("user_id");
    await session({ user_agent: null });
  });

  it("ends a session with a reason, never one without the other (R17)", async () => {
    const t = new Date("2026-01-02T00:00:00Z");
    await checkFails(
      session({ ended_at: t, ended_reason: null }),
      "sessions_ended_check",
    );
    await checkFails(
      session({ ended_at: null, ended_reason: "signed_out" }),
      "sessions_ended_check",
    );
    await checkFails(
      session({ ended_at: t, ended_reason: "expired" }),
      "sessions_ended_reason_check",
    );
    for (const reason of ["signed_out", "replaced", "revoked", "deactivated"]) {
      await session({ ended_at: t, ended_reason: reason });
    }
  });

  it("has the partial index of live sessions (R18)", async () => {
    const [row] = await sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes where indexname = 'sessions_user_id_live_idx'`;
    expect(row?.indexdef).toMatch(/\(user_id\)/);
    expect(row?.indexdef).toMatch(/WHERE \(ended_at IS NULL\)/);
  });
});

describe("devices (R20, R27)", () => {
  let user: string;
  beforeAll(async () => {
    user = await insertUser(sql, { workspace_id: ws });
  });
  const device = async (over: Record<string, unknown>) => {
    const session = await insertSession(sql, {
      workspace_id: ws,
      user_id: user,
    });
    return insertDevice(sql, {
      workspace_id: ws,
      user_id: user,
      session_id: session,
      ...over,
    });
  };

  it("checks channel, session and address (R20)", async () => {
    await checkFails(
      device({ push_channel: "desktop" }),
      "devices_push_channel_check",
    );
    const session = await insertSession(sql, {
      workspace_id: ws,
      user_id: user,
    });
    await insertDevice(sql, {
      workspace_id: ws,
      user_id: user,
      session_id: session,
    });
    await failsWith(
      insertDevice(sql, {
        workspace_id: ws,
        user_id: user,
        session_id: session,
      }),
      "23505",
      "devices_session_id_key",
    );
    await checkFails(
      sql`insert into devices (id, workspace_id, created_at, user_id, session_id, push_channel, push_address)
          values (${crypto.randomUUID()}, ${ws}, now(), ${user}, ${await insertSession(sql, { workspace_id: ws, user_id: user })}, 'web_push', '"text"'::jsonb)`,
      "devices_push_address_check",
    );
    await failsWith(
      device({ session_id: crypto.randomUUID() }),
      "23503",
      "devices_session_id_fkey",
    );
    await device({
      push_channel: "web_push",
      push_address: { endpoint: "https://push.example.com/x" },
    });
  });

  it("has the index on user_id (R27)", async () => {
    const [row] = await sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes where indexname = 'devices_user_id_idx'`;
    expect(row?.indexdef).toMatch(/\(user_id\)/);
  });
});

describe("test-rows helper (R26)", () => {
  it("inserts a valid row with no values and stores an overridden value", async () => {
    const w = await insertWorkspace(sql);
    const w2 = await insertWorkspace(sql, { name: "Named" });
    const [named] = await sql`select name from workspaces where id = ${w2}`;
    expect(named!.name).toBe("Named");
    const u = await insertUser(sql, { workspace_id: w, display_name: "Over" });
    const [user] = await sql`select display_name from users where id = ${u}`;
    expect(user!.display_name).toBe("Over");
    const c = await insertLoginCode(sql, {
      workspace_id: w,
      purpose: "invitation",
    });
    const [code] = await sql`select purpose from login_codes where id = ${c}`;
    expect(code!.purpose).toBe("invitation");
    const s = await insertSession(sql, {
      workspace_id: w,
      user_id: u,
      kind: "token",
    });
    const [session] = await sql`select kind from sessions where id = ${s}`;
    expect(session!.kind).toBe("token");
    const d = await insertDevice(sql, {
      workspace_id: w,
      user_id: u,
      session_id: s,
      push_channel: "fcm",
    });
    const [device] =
      await sql`select push_channel from devices where id = ${d}`;
    expect(device!.push_channel).toBe("fcm");
  });

  it("gives every time column a fixed date", async () => {
    const w = await insertWorkspace(sql);
    const [row] = await sql`select created_at from workspaces where id = ${w}`;
    expect((row!.created_at as Date).toISOString()).toBe(
      "2026-01-01T00:00:00.000Z",
    );
  });
});
