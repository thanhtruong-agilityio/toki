import { spawn } from "node:child_process";
import { createServer } from "node:net";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMigratedDb } from "./tests/migrated-db.js";

// Starts the real main.ts against a migrated, empty database (TOKI-020 R12).
// Fake values only.
const entry = new URL("./main.ts", import.meta.url).pathname;
const cwd = new URL("..", import.meta.url).pathname;

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});

async function freePort() {
  return new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

function start(port: number) {
  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    cwd,
    env: {
      NODE_ENV: "development",
      SERVER_PORT: String(port),
      DATABASE_URL: t.url,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
      SMTP_TLS: "none",
      MAIL_FROM_ADDRESS: "toki@example.com",
      FIRST_ADMIN_EMAIL: "admin@example.com",
      FIRST_ADMIN_NAME: "Test Admin",
      WORKSPACE_NAME: "Test Workspace",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  const exited = new Promise<number | null>((resolve) =>
    child.on("exit", (code) => resolve(code)),
  );
  return { child, out: () => out, exited };
}

async function until(check: () => boolean | Promise<boolean>, ms = 5000) {
  const stop = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > stop) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 25));
  }
}

const countRows = async (sql: postgres.Sql) =>
  Promise.all(
    ["workspaces", "users", "conversations", "conversation_members"].map(
      async (table) =>
        (await sql.unsafe<{ n: number }[]>(`select count(*)::int as n from ${table}`))[0]!.n,
    ),
  );

const readRows = async (sql: postgres.Sql) => ({
  workspaces: await sql`select * from workspaces order by id`,
  users: await sql`select * from users order by id`,
  conversations: await sql`select * from conversations order by id`,
  members: await sql`select * from conversation_members order by conversation_id, user_id`,
});

describe("the started process on an empty database (TOKI-020 R12)", () => {
  it("listens, answers /healthz and writes the four rows; a second start changes nothing", async () => {
    const firstPort = await freePort();
    const first = start(firstPort);
    await until(() => first.out().includes("first_admin_created"));
    expect((await fetch(`http://127.0.0.1:${firstPort}/healthz`)).status).toBe(200);
    expect(await countRows(t.sql)).toEqual([1, 1, 1, 1]);
    const snapshot = await readRows(t.sql);
    expect((snapshot.users[0] as { email: string }).email).toBe("admin@example.com");
    expect((snapshot.users[0] as { display_name: string }).display_name).toBe("Test Admin");
    expect((snapshot.workspaces[0] as { name: string }).name).toBe("Test Workspace");
    expect((snapshot.conversations[0] as { name: string }).name).toBe("general");
    first.child.kill("SIGTERM");
    expect(await first.exited).toBe(0);

    const port = await freePort();
    const second = start(port);
    await until(() => second.out().includes("listening"));
    expect((await fetch(`http://127.0.0.1:${port}/healthz`)).status).toBe(200);
    await until(() => second.out().includes("first_admin_skipped"));
    expect(await countRows(t.sql)).toEqual([1, 1, 1, 1]);
    expect(await readRows(t.sql)).toEqual(snapshot);
    second.child.kill("SIGTERM");
    expect(await second.exited).toBe(0);
  });
});
