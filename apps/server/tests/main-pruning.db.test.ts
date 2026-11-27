import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { createMigratedDb } from "./migrated-db.js";
import { insertWorkspace } from "./test-rows.js";
import { createThrowawayDb } from "./throwaway-db.js";

// The pruning in the started process (TOKI-036 R21). main.test.ts runs with no
// Postgres, so the cases that need one are here. Fake values only.
const entry = new URL("../src/main.ts", import.meta.url).pathname;
const cwd = new URL("..", import.meta.url).pathname;

async function freePort() {
  return new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

const children: ReturnType<typeof spawn>[] = [];
afterEach(() => {
  for (const child of children.splice(0)) child.kill("SIGKILL");
});

function start(env: Record<string, string>) {
  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    cwd,
    env: { ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let out = "";
  child.stdout.on("data", (d) => (out += d));
  const exited = new Promise<number | null>((resolve) =>
    child.on("exit", (code) => resolve(code)),
  );
  return { child, out: () => out, exited };
}

async function until(check: () => boolean, ms = 15000) {
  const stop = Date.now() + ms;
  while (!check()) {
    if (Date.now() > stop) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 25));
  }
}

const validEnv = (port: number, databaseUrl: string) => ({
  NODE_ENV: "development",
  SERVER_PORT: String(port),
  DATABASE_URL: databaseUrl,
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1",
  SMTP_TLS: "none",
  MAIL_FROM_ADDRESS: "toki@example.com",
  FIRST_ADMIN_EMAIL: "admin@example.com",
  FIRST_ADMIN_NAME: "Test Admin",
  WORKSPACE_NAME: "Test Workspace",
  AUTH_CODE_SECRET: "x".repeat(32),
  APP_ORIGIN: "http://localhost:5173",
});

const lines = (out: string) =>
  out
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { msg: string; count?: number });

describe("the pruning of events in the started process (R21)", () => {
  it("prunes at the start and stops before the exit on SIGTERM", async () => {
    const t = await createMigratedDb();
    try {
      const workspace = await insertWorkspace(t.sql);
      await t.sql`insert into event_counters (workspace_id, last_number) values (${workspace}, 1)`;
      await t.sql`
        insert into events (workspace_id, number, scope, type, payload, created_at)
        values (${workspace}, 1, 'workspace', 'message.created', '{}', '2020-01-01')`;
      const port = await freePort();
      const proc = start(validEnv(port, t.url));
      await until(() => proc.out().includes("events_pruned"));
      proc.child.kill("SIGTERM");
      expect(await proc.exited).toBe(0);

      const pruning = lines(proc.out()).filter((l) =>
        /^(events_pruned|event_pruning)/.test(l.msg),
      );
      expect(pruning.map((l) => [l.msg, l.count])).toEqual([
        ["events_pruned", 1],
        ["event_pruning_stopped", undefined],
      ]);
      const [left] = await t.sql`select count(*)::int as n from events`;
      expect(left!.n).toBe(0);
    } finally {
      await t.close();
    }
  }, 30_000);

  it("keeps listening on a database with no tables and logs the failed run", async () => {
    const empty = await createThrowawayDb();
    try {
      const port = await freePort();
      const proc = start(validEnv(port, empty.url));
      await until(() => proc.out().includes("event_pruning_failed"));
      const health = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(health.status).toBe(200);
      proc.child.kill("SIGTERM");
      expect(await proc.exited).toBe(0);
      const failed = lines(proc.out()).find(
        (l) => l.msg === "event_pruning_failed",
      );
      expect(failed).toMatchObject({ count: 0 });
      expect(proc.out()).toContain("event_pruning_stopped");
    } finally {
      await empty.drop();
    }
  }, 30_000);
});
