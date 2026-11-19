import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrationsFolder, runMigrations } from "../../src/db/migrate.js";
import { insertUser, insertWorkspace } from "../test-rows.js";
import { createThrowawayDb } from "../throwaway-db.js";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
let sql: Sql;
let ws: string;
let user: string;
beforeAll(async () => {
  throwaway = await createThrowawayDb();
  await runMigrations(throwaway.url, migrationsFolder);
  sql = postgres(throwaway.url, { max: 1, onnotice: () => {} });
  ws = await insertWorkspace(sql);
  user = await insertUser(sql, { workspace_id: ws });
});
afterAll(async () => {
  await sql?.end();
  await throwaway?.drop();
});

const at = new Date("2026-01-01T00:00:00Z");
const plus = (ms: number) => new Date(at.getTime() + ms);
const hex = (c: string, n = 64) => c.repeat(n);

type PgError = Error & { code?: string; constraint_name?: string };
const failure = (run: PromiseLike<unknown>) =>
  run.then(
    () => null,
    (e: unknown) => e as PgError,
  );

async function insertLink(
  values: Partial<{
    user_id: string;
    token_hash: string;
    created_at: Date;
    expires_at: Date;
    used_at: Date | null;
    cancelled_at: Date | null;
    session_id: string | null;
  }> = {},
) {
  const row = {
    id: crypto.randomUUID(),
    workspace_id: ws,
    user_id: user,
    token_hash: hex("a"),
    created_at: at,
    expires_at: plus(600_000),
    ...values,
  };
  return sql`insert into emergency_links ${sql(row as unknown as Record<string, never>)} returning id`;
}

describe("emergency_links (TOKI-026 R25, R38, R48)", () => {
  it("has the named checks, key, index and foreign keys, and no foreign key on session_id", async () => {
    const constraints = await sql<{ conname: string; contype: string }[]>`
      select conname, contype from pg_constraint
      where conrelid = 'emergency_links'::regclass order by conname`;
    const names = constraints.map((c) => c.conname);
    expect(names).toEqual(
      expect.arrayContaining([
        "emergency_links_pkey",
        "emergency_links_token_hash_check",
        "emergency_links_token_hash_key",
        "emergency_links_expires_at_check",
        "emergency_links_user_id_fkey",
        "emergency_links_workspace_id_fkey",
      ]),
    );
    const foreign = constraints.filter((c) => c.contype === "f");
    expect(foreign.map((c) => c.conname).sort()).toEqual([
      "emergency_links_user_id_fkey",
      "emergency_links_workspace_id_fkey",
    ]);
    const index = await sql<{ indexdef: string }[]>`
      select indexdef from pg_indexes
      where tablename = 'emergency_links' and indexname = 'emergency_links_user_id_open_key'`;
    expect(index).toHaveLength(1);
    expect(index[0]!.indexdef).toMatch(/UNIQUE/i);
    expect(index[0]!.indexdef).toMatch(/used_at IS NULL/i);
    expect(index[0]!.indexdef).toMatch(/cancelled_at IS NULL/i);
  });

  it("refuses the delete of a user or a workspace that has a link (ON DELETE RESTRICT)", async () => {
    const rows = await sql<{ confdeltype: string }[]>`
      select confdeltype from pg_constraint
      where conrelid = 'emergency_links'::regclass and contype = 'f'`;
    expect(rows.map((r) => r.confdeltype)).toEqual(["r", "r"]);
  });

  it("refuses a hash of 63 characters, and an upper-case one", async () => {
    expect(
      (await failure(insertLink({ token_hash: hex("a", 63) })))
        ?.constraint_name,
    ).toBe("emergency_links_token_hash_check");
    expect(
      (await failure(insertLink({ token_hash: hex("A") })))?.constraint_name,
    ).toBe("emergency_links_token_hash_check");
  });

  it("refuses expires_at equal to or before created_at", async () => {
    expect(
      (await failure(insertLink({ token_hash: hex("b"), expires_at: at })))
        ?.constraint_name,
    ).toBe("emergency_links_expires_at_check");
  });

  it("makes no time with a default: created_at is required", async () => {
    const error = await failure(
      sql`insert into emergency_links (workspace_id, user_id, token_hash, expires_at) values (${ws}, ${user}, ${hex("c")}, ${plus(600_000)})`,
    );
    expect(error?.code).toBe("23502");
  });

  it("holds one open link per person: a second fails until the first is used or cancelled", async () => {
    const other = await insertUser(sql, { workspace_id: ws });
    await insertLink({ user_id: other, token_hash: hex("d") });
    const second = await failure(
      insertLink({ user_id: other, token_hash: hex("e") }),
    );
    expect(second?.code).toBe("23505");
    expect(second?.constraint_name).toBe("emergency_links_user_id_open_key");

    await sql`update emergency_links set used_at = ${plus(1000)} where token_hash = ${hex("d")}`;
    await insertLink({ user_id: other, token_hash: hex("e") });
    await sql`update emergency_links set cancelled_at = ${plus(2000)} where token_hash = ${hex("e")}`;
    await insertLink({ user_id: other, token_hash: hex("f") });
  });

  it("keeps the token hash unique", async () => {
    const third = await insertUser(sql, { workspace_id: ws });
    await insertLink({ user_id: third, token_hash: hex("1") });
    await sql`update emergency_links set used_at = ${plus(1)} where token_hash = ${hex("1")}`;
    const again = await failure(
      insertLink({ user_id: third, token_hash: hex("1") }),
    );
    expect(again?.constraint_name).toBe("emergency_links_token_hash_key");
  });

  it("takes a session_id that points to no session: there is no foreign key on it", async () => {
    const fourth = await insertUser(sql, { workspace_id: ws });
    const [row] = await insertLink({
      user_id: fourth,
      token_hash: hex("2"),
      session_id: crypto.randomUUID(),
    });
    expect(row!.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
