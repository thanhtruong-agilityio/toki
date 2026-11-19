import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "../migrated-db.js";
import { insertUser, insertWorkspace } from "../test-rows.js";

// The real command in a child process against a migrated database (TOKI-026 R18 to R23, R35, R36).
// Fake addresses and a fake environment only.
const serverDir = path.resolve(import.meta.dirname, "../..");
const repoRoot = path.resolve(serverDir, "../..");
const entry = path.join(serverDir, "src/cli/emergency-link.ts");

let t: Awaited<ReturnType<typeof createMigratedDb>>;
let ws: string;
beforeAll(async () => {
  t = await createMigratedDb();
  ws = await insertWorkspace(t.sql);
});
afterAll(async () => {
  await t?.close();
});

const baseEnv = () => ({
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  NODE_ENV: "development",
  DATABASE_URL: t.url,
  APP_ORIGIN: "http://localhost:5173",
});

type Result = { code: number | null; out: string; err: string };

function run(
  args: string[],
  env: Record<string, string | undefined> = baseEnv(),
  how: "node" | "pnpm" = "node",
): Promise<Result> {
  const clean = Object.fromEntries(
    Object.entries(env).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
  const child =
    how === "node"
      ? spawn(process.execPath, ["--import", "tsx", entry, ...args], {
          cwd: serverDir,
          env: clean,
          stdio: ["ignore", "pipe", "pipe"],
        })
      : spawn("corepack", ["pnpm", "--silent", "emergency:link", ...args], {
          cwd: repoRoot,
          env: clean,
          stdio: ["ignore", "pipe", "pipe"],
        });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  return new Promise((resolve) =>
    child.on("exit", (code) => resolve({ code, out, err })),
  );
}

const links = (userId: string) =>
  t.sql`select * from emergency_links where user_id = ${userId} order by created_at, id`;
const addUser = (email: string, values: Record<string, unknown> = {}) =>
  insertUser(t.sql, { workspace_id: ws, email, ...values });
const jsonLines = (text: string) =>
  text
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, unknown>);
const LINK = /^http:\/\/localhost:5173\/emergency#([A-Za-z0-9_-]{43})\n$/;

describe("an Active member (R19, R25, R35)", () => {
  for (const role of ["member", "admin"] as const) {
    it(`prints one link for a ${role}, logs one JSON line to standard error and stores the hash`, async () => {
      const id = await addUser(`${role}@example.com`, { role });
      const res = await run([`${role}@example.com`]);
      expect(res.code).toBe(0);
      expect(res.out).toMatch(LINK);
      const token = LINK.exec(res.out)![1]!;
      const lines = jsonLines(res.err);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        level: 30,
        msg: "emergency_link_issued",
        operator: os.userInfo().username,
        userId: id,
      });
      expect(lines[0]).toHaveProperty("linkId");
      expect(lines[0]).toHaveProperty("expiresAt");
      expect(res.err).not.toContain(`${role}@example.com`);
      expect(res.err).not.toContain(token);
      const rows = await links(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.token_hash).toBe(
        createHash("sha256").update(token).digest("hex"),
      );
      expect(rows[0]!.id).toBe(lines[0]!.linkId);
      expect(
        (rows[0]!.expires_at as Date).getTime() -
          (rows[0]!.created_at as Date).getTime(),
      ).toBe(600_000);
      // No column holds the token or the link.
      expect(JSON.stringify(rows)).not.toContain(token);
    });
  }

  it("trims the address and reads it in lower case", async () => {
    const id = await addUser("mixed@example.com");
    const res = await run(["  Mixed@Example.COM "]);
    expect(res.code).toBe(0);
    expect(await links(id)).toHaveLength(1);
  });

  it("cancels the earlier link of the same member (R48)", async () => {
    const id = await addUser("again@example.com");
    await run(["again@example.com"]);
    const second = await run(["again@example.com"]);
    expect(second.code).toBe(0);
    const rows = await links(id);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.cancelled_at).not.toBeNull();
    expect(rows[1]!.cancelled_at).toBeNull();
  });

  it("prints a link that is the same single line in the documented form (R18)", async () => {
    const id = await addUser("pnpm@example.com");
    const res = await run(["pnpm@example.com"], baseEnv(), "pnpm");
    expect(res.out).toMatch(LINK);
    expect(res.out.split("\n").filter(Boolean)).toHaveLength(1);
    expect(res.code).toBe(0);
    expect(await links(id)).toHaveLength(1);
  });

  it("prints the link with the SMTP variables unset and with an unreachable SMTP host (R23)", async () => {
    await addUser("nomail@example.com");
    const res = await run(["nomail@example.com"], {
      ...baseEnv(),
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
    });
    expect(res.code).toBe(0);
    expect(res.out).toMatch(LINK);
  });
});

describe("refusals (R20, R21, R35, R36)", () => {
  it("refuses an address with no account: exit 1, empty standard output, no row", async () => {
    const before = await t.sql`select count(*)::int as n from emergency_links`;
    const res = await run(["nobody@example.com"]);
    expect(res.code).toBe(1);
    expect(res.out).toBe("");
    expect(jsonLines(res.err)).toEqual([
      expect.objectContaining({
        level: 40,
        msg: "emergency_link_refused",
        reason: "no_account",
        operator: os.userInfo().username,
      }),
    ]);
    expect(res.err).not.toContain("nobody@example.com");
    expect(await t.sql`select count(*)::int as n from emergency_links`).toEqual(
      before,
    );
  });

  it("refuses a Deactivated account with its id but not its address", async () => {
    const id = await addUser("gone@example.com", { status: "deactivated" });
    const res = await run(["gone@example.com"]);
    expect(res.code).toBe(1);
    expect(res.out).toBe("");
    expect(jsonLines(res.err)[0]).toMatchObject({
      msg: "emergency_link_refused",
      reason: "deactivated",
      userId: id,
    });
    expect(res.err).not.toContain("gone@example.com");
    expect(await links(id)).toHaveLength(0);
  });

  it("exits with 2 for no argument, two arguments and a malformed or too long address, with no row", async () => {
    const before = await t.sql`select count(*)::int as n from emergency_links`;
    for (const args of [
      [],
      ["a@example.com", "b@example.com"],
      ["not-an-address"],
      // Every part is within its own limit (local part 64, labels 63), so only the 254 of the whole
      // address refuses it.
      [
        `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}.com`,
      ],
    ]) {
      const res = await run(args);
      expect(res.code, JSON.stringify(args)).toBe(2);
      expect(res.out).toBe("");
    }
    expect(await t.sql`select count(*)::int as n from emergency_links`).toEqual(
      before,
    );
  });

  it("gives the losing run of R48 exit 1 and a concurrent_issue line, when another run holds its insert", async () => {
    const id = await addUser("race@example.com");
    const holder = postgres(t.url, { max: 1, onnotice: () => {} });
    let release!: () => void;
    const hold = new Promise<void>((resolve) => (release = resolve));
    let inserted!: () => void;
    const ready = new Promise<void>((resolve) => (inserted = resolve));
    const now = new Date();
    const running = holder.begin(async (tx) => {
      await tx`insert into emergency_links (id, workspace_id, user_id, token_hash, created_at, expires_at)
        values (${crypto.randomUUID()}, ${ws}, ${id}, ${"c".repeat(64)}, ${now}, ${new Date(now.getTime() + 600_000)})`;
      inserted();
      await hold;
    });
    await ready;
    const racing = run(["race@example.com"]);
    // Not a sleep: wait until the command's backend waits on a lock of the held insert, which means its
    // cancel step has run and its own insert waits for the unique index entry.
    const stop = Date.now() + 20_000;
    for (;;) {
      const [row] = await t.sql<{ n: number }[]>`
        select count(*)::int as n from pg_stat_activity
        where datname = current_database() and wait_event_type = 'Lock'`;
      if (row!.n > 0) break;
      if (Date.now() > stop)
        throw new Error("the command never waited on a lock");
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    release();
    await running;
    await holder.end();
    const res = await racing;
    expect(res.code).toBe(1);
    expect(res.out).toBe("");
    expect(jsonLines(res.err)[0]).toMatchObject({
      msg: "emergency_link_refused",
      reason: "concurrent_issue",
      userId: id,
    });
    expect(res.err).not.toContain("race@example.com");
    expect(await links(id)).toHaveLength(1);
  });
});

describe("the configuration (R22)", () => {
  it("exits 1 naming the variable, never its value, when the database URL or the origin is missing or invalid", async () => {
    await addUser("cfg@example.com");
    for (const [name, env] of [
      ["DATABASE_URL", { ...baseEnv(), DATABASE_URL: undefined }],
      ["APP_ORIGIN", { ...baseEnv(), APP_ORIGIN: undefined }],
      ["APP_ORIGIN", { ...baseEnv(), APP_ORIGIN: "http://localhost:5173/app" }],
    ] as const) {
      const res = await run(["cfg@example.com"], env);
      expect(res.code, name).toBe(1);
      expect(res.out).toBe("");
      expect(res.err).toContain(name);
      expect(res.err).not.toContain("localhost:5173/app");
    }
    expect(
      await t.sql`select count(*)::int as n from emergency_links where user_id in (select id from users where email = 'cfg@example.com')`,
    ).toEqual([{ n: 0 }]);
  });

  it("refuses an http:// origin outside development, and accepts it in development", async () => {
    await addUser("env@example.com");
    for (const name of ["production", "staging", "prodution", undefined]) {
      const res = await run(["env@example.com"], {
        ...baseEnv(),
        NODE_ENV: name,
      });
      expect(res.code, String(name)).toBe(1);
      expect(res.err).toContain("APP_ORIGIN");
      expect(res.out).toBe("");
    }
    expect((await run(["env@example.com"])).code).toBe(0);
  });

  it("accepts an https:// origin with no environment name", async () => {
    await addUser("https@example.com");
    const res = await run(["https@example.com"], {
      ...baseEnv(),
      NODE_ENV: undefined,
      APP_ORIGIN: "https://toki.example.com",
    });
    expect(res.code).toBe(0);
    expect(res.out).toMatch(
      /^https:\/\/toki\.example\.com\/emergency#[A-Za-z0-9_-]{43}\n$/,
    );
  });
});

describe("what the output holds (R36)", () => {
  it("holds no token in any line of standard error and no address anywhere", async () => {
    await addUser("clean@example.com");
    const ok = await run(["clean@example.com"]);
    const refused = await run(["unknown-clean@example.com"]);
    const token = LINK.exec(ok.out)![1]!;
    for (const text of [ok.err, refused.err]) {
      expect(text).not.toContain(token);
      expect(text).not.toContain("clean@example.com");
    }
  });
});
