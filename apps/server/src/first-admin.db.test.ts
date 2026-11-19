import { readFileSync } from "node:fs";
import { createTestClock } from "@toki/shared";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createDb } from "./db/client.js";
import { runMigrations, migrationsFolder } from "./db/migrate.js";
import {
  ATTEMPT_TIMEOUT_MS,
  ensureFirstAdmin,
  MAX_ATTEMPTS,
  RETRY_DELAY_MS,
  type FirstAdminDeps,
  type FirstAdminHooks,
} from "./first-admin.js";
import {
  getConversationFacts,
  isConversationMember,
} from "./modules/conversations/index.js";
import { createMigratedDb } from "./tests/migrated-db.js";
import { insertUser, insertWorkspace } from "./tests/test-rows.js";
import { createThrowawayDb } from "./tests/throwaway-db.js";

// Fake data only. The address, its part before the @, the display name and
// the workspace name must appear in no log line (R13).
const EMAIL = "minh.tran@example.com";
const CONFIG = { email: EMAIL, name: "Minh Tran", workspaceName: "Test Workspace" };
const SECRETS = [EMAIL, "minh.tran", "Minh Tran", "Test Workspace"];

type Line = { level: string; message: string; fields: Record<string, unknown> };
const everyLine: Line[] = [];

function makeLogger() {
  const lines: Line[] = [];
  const push = (level: string) => (fields: Record<string, unknown>, message: string) => {
    const line = { level, message, fields };
    lines.push(line);
    everyLine.push(line);
  };
  return { lines, logger: { info: push("info"), warn: push("warn"), error: push("error") } };
}

const never = () => new Promise<void>(() => undefined);

// A sleep that returns at once for the retry delay and never for the attempt
// deadline, and records what it was asked to wait for.
function makeSleep(onDelay?: () => Promise<void> | void) {
  const calls: number[] = [];
  const sleep = async (ms: number) => {
    calls.push(ms);
    if (ms === ATTEMPT_TIMEOUT_MS) return never();
    await onDelay?.();
  };
  return { calls, sleep };
}

let t: Awaited<ReturnType<typeof createMigratedDb>>;
beforeAll(async () => {
  t = await createMigratedDb();
});
afterAll(async () => {
  await t?.close();
});
beforeEach(async () => {
  const tables = await t.sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'`;
  await t.sql.unsafe(
    `truncate ${tables.map((r) => `"${r.tablename}"`).join(", ")} cascade`,
  );
});

function setup(overrides: Partial<FirstAdminDeps> = {}) {
  const { lines, logger } = makeLogger();
  const { calls, sleep } = makeSleep();
  const clock = createTestClock();
  const abort = new AbortController();
  const deps: FirstAdminDeps = {
    db: t.db,
    config: CONFIG,
    clock,
    logger,
    sleep,
    signal: abort.signal,
    ...overrides,
  };
  return { deps, lines, calls, clock, abort };
}

const rows = async (table: string) =>
  t.sql.unsafe<Record<string, unknown>[]>(`select * from ${table} order by 1`);
const counts = async () => [
  (await rows("workspaces")).length,
  (await rows("users")).length,
  (await rows("conversations")).length,
  (await rows("conversation_members")).length,
];
const codeError = (code: string) => Object.assign(new Error("hook failed"), { code });

describe("R5, R6, R17: an empty database", () => {
  it("writes the four rows, column by column, with the instant of the clock", async () => {
    const { deps, lines, clock } = setup();
    expect(await ensureFirstAdmin(deps)).toBe("created");
    expect(await counts()).toEqual([1, 1, 1, 1]);
    const instant = new Date(clock.now()).toISOString();
    const [ws] = await rows("workspaces");
    const [user] = await rows("users");
    const [conv] = await rows("conversations");
    const [member] = await rows("conversation_members");
    expect(ws).toMatchObject({ name: "Test Workspace" });
    expect(user).toMatchObject({
      workspace_id: ws!.id,
      email: EMAIL,
      display_name: "Minh Tran",
      role: "admin",
      status: "active",
      language: "en",
    });
    expect((user!.created_at as Date).toISOString()).toBe(instant);
    expect(conv).toMatchObject({
      workspace_id: ws!.id,
      kind: "channel",
      name: "general",
      topic: null,
      description: null,
      is_private: false,
      is_general: true,
      archived_at: null,
      created_by: user!.id,
    });
    expect((conv!.created_at as Date).toISOString()).toBe(instant);
    expect(member).toMatchObject({
      conversation_id: conv!.id,
      user_id: user!.id,
      notification_level: null,
      is_muted: false,
      is_starred: false,
    });
    expect((member!.created_at as Date).toISOString()).toBe(instant);
    expect(lines.map((l) => l.message)).toEqual(["first_admin_created"]);
    expect(lines[0]!.fields).toEqual({
      workspaceId: ws!.id,
      userId: user!.id,
      conversationId: conv!.id,
      adopted: false,
    });
  });

  it("names the Admin from the part before the @ when no name is given (R6)", async () => {
    const { deps } = setup({ config: { email: "minh@example.com", workspaceName: "W" } });
    expect(await ensureFirstAdmin(deps)).toBe("created");
    expect((await rows("users"))[0]).toMatchObject({ display_name: "minh" });
  });

  it("opens no session, code or device, and #general cannot be archived (R15, R17)", async () => {
    const { deps } = setup();
    await ensureFirstAdmin(deps);
    for (const table of ["sessions", "login_codes", "devices"]) {
      expect(await rows(table)).toEqual([]);
    }
    await expect(
      t.sql`update conversations set archived_at = now() where is_general`,
    ).rejects.toMatchObject({ code: "23514" });
    const [user] = await rows("users");
    const [conv] = await rows("conversations");
    expect(await isConversationMember(t.db, user!.id as string, conv!.id as string)).toBe(true);
    expect(
      (await getConversationFacts(t.db, user!.id as string, conv!.id as string))?.isGeneral,
    ).toBe(true);
  });

  it("imports no mail layer and takes no mail dependency (R15)", () => {
    const source = readFileSync(new URL("./first-admin.ts", import.meta.url), "utf8");
    const imports = source.split("\n").filter((l) => /^\s*(import|} from)/.test(l));
    expect(imports.filter((l) => /mail/i.test(l))).toEqual([]);
    expect(Object.keys(setup().deps).sort()).toEqual(
      ["clock", "config", "db", "logger", "signal", "sleep"],
    );
  });
});

describe("R7, R8: a database that has data", () => {
  it("skips a second run whatever the variables say, and writes no row on three runs", async () => {
    const first = setup();
    expect(await ensureFirstAdmin(first.deps)).toBe("created");
    const before = await Promise.all(
      ["workspaces", "users", "conversations", "conversation_members"].map(rows),
    );
    for (let i = 0; i < 3; i++) {
      const again = setup({
        config: { email: "other@example.com", name: "Other", workspaceName: "Other" },
      });
      expect(await ensureFirstAdmin(again.deps)).toBe("skipped");
      expect(again.lines.map((l) => [l.level, l.message, l.fields])).toEqual([
        ["info", "first_admin_skipped", { reason: "database_not_empty" }],
      ]);
    }
    const after = await Promise.all(
      ["workspaces", "users", "conversations", "conversation_members"].map(rows),
    );
    expect(after).toEqual(before);
    expect(await counts()).toEqual([1, 1, 1, 1]);
  });

  it("skips a database that has one account and no #general", async () => {
    const workspaceId = await insertWorkspace(t.sql);
    await insertUser(t.sql, { workspace_id: workspaceId });
    const { deps } = setup();
    expect(await ensureFirstAdmin(deps)).toBe("skipped");
    expect(await counts()).toEqual([1, 1, 0, 0]);
  });

  it("adopts the one workspace that has no account and keeps its name", async () => {
    const workspaceId = await insertWorkspace(t.sql, { name: "Existing" });
    const { deps, lines } = setup();
    expect(await ensureFirstAdmin(deps)).toBe("created");
    expect(await counts()).toEqual([1, 1, 1, 1]);
    const [ws] = await rows("workspaces");
    expect(ws).toMatchObject({ id: workspaceId, name: "Existing" });
    expect((await rows("users"))[0]).toMatchObject({ workspace_id: workspaceId });
    expect(lines[0]!.fields).toMatchObject({ workspaceId, adopted: true });
  });

  it("writes nothing and warns when there are several workspaces and no account", async () => {
    await insertWorkspace(t.sql);
    await insertWorkspace(t.sql);
    const { deps, lines } = setup();
    expect(await ensureFirstAdmin(deps)).toBe("skipped");
    expect(await counts()).toEqual([2, 0, 0, 0]);
    expect(lines.map((l) => [l.level, l.message, l.fields])).toEqual([
      ["warn", "first_admin_workspace_without_account", { reason: "several_workspaces" }],
    ]);
  });
});

describe("R9: two processes at once", () => {
  it("makes one set of rows: the second waits on the advisory lock, then skips", async () => {
    const second = t.connect();
    let release!: () => void;
    const paused = new Promise<void>((resolve) => (release = resolve));
    const first = setup();
    const other = setup({ db: second.db });
    const firstRun = ensureFirstAdmin(first.deps, { afterCount: () => paused });
    // Wait until the first call is inside its transaction, past its count.
    await waitFor(async () =>
      (await t.sql`select 1 from pg_locks where locktype = 'advisory' and granted`).length > 0,
    );
    const secondRun = ensureFirstAdmin(other.deps);
    await waitFor(async () =>
      (await t.sql`select 1 from pg_locks where locktype = 'advisory' and not granted`).length > 0,
    );
    release();
    const results = await Promise.all([firstRun, secondRun]);
    expect(results.sort()).toEqual(["created", "skipped"]);
    expect(await counts()).toEqual([1, 1, 1, 1]);
  });
});

async function waitFor(check: () => Promise<boolean>, ms = 5000) {
  const stop = Date.now() + ms;
  while (!(await check())) {
    if (Date.now() > stop) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe("R10: one transaction", () => {
  const failing: [string, keyof FirstAdminHooks][] = [
    ["afterWorkspace", "afterWorkspace"],
    ["afterAccount", "afterAccount"],
    ["afterGeneral", "afterGeneral"],
  ];
  it.each(failing)("leaves nothing when %s fails, then a clean run creates", async (_n, hook) => {
    const { deps, lines, calls } = setup();
    const hooks: FirstAdminHooks = {
      [hook]: async () => {
        throw codeError("XX000");
      },
    };
    expect(await ensureFirstAdmin(deps, hooks)).toBe("failed");
    expect(await counts()).toEqual([0, 0, 0, 0]);
    expect(lines.map((l) => l.message)).toEqual(["first_admin_failed"]);
    expect(lines[0]!.fields).toEqual({ code: "XX000", attempt: 1, retry: false });
    expect(calls.filter((c) => c === RETRY_DELAY_MS)).toEqual([]);
    expect(await ensureFirstAdmin(setup().deps)).toBe("created");
  });

  it("reports a real unique violation by code and constraint, never the address", async () => {
    const { deps, lines, calls } = setup();
    const result = await ensureFirstAdmin(deps, {
      afterWorkspace: async ({ tx, workspaceId }) => {
        const { sql } = await import("drizzle-orm");
        await tx.execute(sql`
          insert into users (id, workspace_id, email, display_name, role, status, created_at)
          values (${crypto.randomUUID()}, ${workspaceId}, ${EMAIL}, 'X', 'member', 'active', now())`);
      },
    });
    expect(result).toBe("failed");
    expect(await counts()).toEqual([0, 0, 0, 0]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fields).toMatchObject({
      code: "23505",
      constraint: "users_workspace_id_email_key",
      attempt: 1,
      retry: false,
    });
    // R18 (c): a failure off the list ends the step with no wait.
    expect(calls.filter((c) => c === RETRY_DELAY_MS)).toEqual([]);
  });
});

describe("R11, R18: failures and retries", () => {
  it("retries a code on the list and creates on the third attempt", async () => {
    const { deps, lines, calls } = setup();
    let n = 0;
    const result = await ensureFirstAdmin(deps, {
      afterWorkspace: async () => {
        if (++n <= 2) throw codeError("57P03");
      },
    });
    expect(result).toBe("created");
    expect(calls.filter((c) => c === RETRY_DELAY_MS)).toEqual([RETRY_DELAY_MS, RETRY_DELAY_MS]);
    expect(await counts()).toEqual([1, 1, 1, 1]);
    expect(lines.map((l) => l.message)).toEqual([
      "first_admin_failed",
      "first_admin_failed",
      "first_admin_created",
    ]);
    expect(lines.slice(0, 2).map((l) => [l.fields.attempt, l.fields.retry])).toEqual([
      [1, true],
      [2, true],
    ]);
  });

  it("creates after the migrations are applied during the wait (42P01 then created)", async () => {
    const bare = await createThrowawayDb();
    const { db, close } = createDb(bare.url);
    try {
      const { lines, logger } = makeLogger();
      const calls: number[] = [];
      const sleep = async (ms: number) => {
        calls.push(ms);
        if (ms === ATTEMPT_TIMEOUT_MS) return never();
        await runMigrations(bare.url, migrationsFolder);
      };
      const result = await ensureFirstAdmin({
        db,
        config: CONFIG,
        clock: createTestClock(),
        logger,
        sleep,
        signal: new AbortController().signal,
      });
      expect(result).toBe("created");
      expect(lines.map((l) => l.message)).toEqual(["first_admin_failed", "first_admin_created"]);
      expect(lines[0]!.fields).toEqual({ code: "42P01", attempt: 1, retry: true });
    } finally {
      await close();
      await bare.drop();
    }
  });

  it("gives up on a database with no migration: MAX_ATTEMPTS lines, nine delays, no throw", async () => {
    const bare = await createThrowawayDb();
    const { db, close } = createDb(bare.url);
    try {
      const { lines, logger } = makeLogger();
      const { calls, sleep } = makeSleep();
      const result = await ensureFirstAdmin({
        db,
        config: CONFIG,
        clock: createTestClock(),
        logger,
        sleep,
        signal: new AbortController().signal,
      });
      expect(result).toBe("failed");
      expect(lines).toHaveLength(MAX_ATTEMPTS);
      expect(lines.every((l) => l.fields.code === "42P01")).toBe(true);
      expect(lines.at(-1)!.fields.retry).toBe(false);
      expect(calls.filter((c) => c === RETRY_DELAY_MS)).toHaveLength(MAX_ATTEMPTS - 1);
    } finally {
      await close();
      await bare.drop();
    }
  });

  it("returns failed, without throwing, when nothing listens", async () => {
    const { db, close } = createDb("postgres://fake:fake@127.0.0.1:1/fake");
    try {
      const { lines, logger } = makeLogger();
      const { calls, sleep } = makeSleep();
      const result = await ensureFirstAdmin({
        db,
        config: CONFIG,
        clock: createTestClock(),
        logger,
        sleep,
        signal: new AbortController().signal,
      });
      expect(result).toBe("failed");
      expect(lines).toHaveLength(MAX_ATTEMPTS);
      expect(lines.at(-1)!.fields).toMatchObject({ attempt: MAX_ATTEMPTS, retry: false });
      expect(calls.filter((c) => c === RETRY_DELAY_MS)).toHaveLength(MAX_ATTEMPTS - 1);
    } finally {
      await close();
    }
  });
});

describe("R19: one attempt is bounded", () => {
  it("fails an attempt that does not end with attempt_timeout, and a later one creates", async () => {
    const { deps, lines } = setup();
    let fail!: () => void;
    const stuck = new Promise<void>((_, reject) => (fail = () => reject(codeError("XX000"))));
    stuck.catch(() => undefined);
    let counted = 0;
    // The deadline sleep resolves by hand; the retry delay at once.
    let deadline!: () => void;
    const sleeps: number[] = [];
    const sleep = (ms: number) => {
      sleeps.push(ms);
      if (ms === ATTEMPT_TIMEOUT_MS && sleeps.filter((s) => s === ms).length === 1) {
        return new Promise<void>((resolve) => (deadline = resolve));
      }
      if (ms === ATTEMPT_TIMEOUT_MS) return never();
      return Promise.resolve();
    };
    const run = ensureFirstAdmin({ ...deps, sleep }, { afterCount: () => (++counted === 1 ? stuck : Promise.resolve()) });
    await waitFor(async () => deadline !== undefined);
    deadline();
    // Let the abandoned attempt roll back so it holds no lock for the next one.
    await waitFor(async () => lines.length === 1);
    fail();
    expect(await run).toBe("created");
    expect(lines[0]!.fields).toEqual({ code: "attempt_timeout", attempt: 1, retry: true });
    expect(await counts()).toEqual([1, 1, 1, 1]);
  });

  it("ends with 55P03 about ten seconds after a lock it cannot get", async () => {
    const { deps, lines, abort } = setup();
    // Stop after the first failure so the test lasts one lock timeout.
    const logger = {
      ...deps.logger,
      error: (fields: Record<string, unknown>, message: string) => {
        deps.logger.error(fields, message);
        abort.abort();
      },
    };
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    // A client of its own: t.sql has one connection and must stay free.
    const holderClient = postgres(t.url, { max: 1, onnotice: () => undefined });
    const holder = holderClient.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(1414482761, 1)`;
      await held;
    });
    await waitFor(async () =>
      (await t.sql`select 1 from pg_locks where locktype = 'advisory' and granted`).length > 0,
    );
    const started = Date.now();
    const result = await ensureFirstAdmin({ ...deps, logger });
    const took = Date.now() - started;
    release();
    await holder;
    await holderClient.end();
    expect(result).toBe("stopped");
    expect(lines[0]!.fields).toMatchObject({ code: "55P03", attempt: 1, retry: true });
    expect(took).toBeGreaterThan(9000);
    expect(took).toBeLessThan(13000);
  }, 30_000);
});

describe("R20: shutdown", () => {
  it("starts no new attempt once the signal aborts during the wait", async () => {
    const { lines, abort, deps } = setup();
    const sleep = (ms: number) => (ms === ATTEMPT_TIMEOUT_MS ? never() : never());
    const run = ensureFirstAdmin(
      { ...deps, sleep },
      {
        afterWorkspace: async () => {
          throw codeError("57P03");
        },
      },
    );
    await waitFor(async () => lines.length === 1);
    abort.abort();
    expect(await run).toBe("stopped");
    expect(lines.map((l) => l.message)).toEqual(["first_admin_failed", "first_admin_stopped"]);
    expect(lines[1]!.fields).toEqual({ attempt: 2 });
    expect(await counts()).toEqual([0, 0, 0, 0]);
  });

  it("lets the attempt in progress commit: created, not stopped", async () => {
    const { deps, abort } = setup();
    let release!: () => void;
    const paused = new Promise<void>((resolve) => (release = resolve));
    const run = ensureFirstAdmin(deps, { afterCount: () => paused });
    await waitFor(async () =>
      (await t.sql`select 1 from pg_locks where locktype = 'advisory' and granted`).length > 0,
    );
    abort.abort();
    release();
    expect(await run).toBe("created");
    expect(await counts()).toEqual([1, 1, 1, 1]);
  });
});

describe("R13: the app log stream", () => {
  it("holds none of the personal values in the serialized log of the real app logger", async () => {
    const { Writable } = await import("node:stream");
    const { buildApp } = await import("./app.js");
    let text = "";
    const logStream = new Writable({
      write(chunk, _enc, done) {
        text += chunk.toString();
        done();
      },
    });
    const app = buildApp({
      config: {
        server: { env: "development", port: 0, host: "127.0.0.1", logLevel: "info" },
        database: { url: t.url },
      },
      logStream,
      mail: { send: async () => undefined } as never,
    });
    const runs: Promise<unknown>[] = [];
    // created, skipped, and a real unique violation (its detail names the address)
    runs.push(ensureFirstAdmin({ ...setup().deps, logger: app.log }));
    await Promise.all(runs);
    await ensureFirstAdmin({ ...setup().deps, logger: app.log });
    await t.sql`truncate workspaces cascade`;
    await ensureFirstAdmin({ ...setup().deps, logger: app.log }, {
      afterWorkspace: async ({ tx, workspaceId }) => {
        const { sql } = await import("drizzle-orm");
        await tx.execute(sql`
          insert into users (id, workspace_id, email, display_name, role, status, created_at)
          values (${crypto.randomUUID()}, ${workspaceId}, ${EMAIL}, 'X', 'member', 'active', now())`);
      },
    });
    await app.close();
    const lines = text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>);
    const names = lines.map((l) => l.msg);
    expect(names).toEqual(
      expect.arrayContaining(["first_admin_created", "first_admin_skipped", "first_admin_failed"]),
    );
    for (const secret of SECRETS) expect(text).not.toContain(secret);
  });
});

describe("R13: what the log holds", () => {
  it("holds none of the personal values, and only the lines and fields of the spec", () => {
    expect(everyLine.length).toBeGreaterThan(10);
    const text = JSON.stringify(everyLine);
    for (const secret of SECRETS) expect(text).not.toContain(secret);
    const allowed: Record<string, string[]> = {
      first_admin_created: ["workspaceId", "userId", "conversationId", "adopted"],
      first_admin_skipped: ["reason"],
      first_admin_workspace_without_account: ["reason"],
      first_admin_failed: ["code", "constraint", "attempt", "retry"],
      first_admin_stopped: ["attempt"],
    };
    for (const line of everyLine) {
      expect(Object.keys(allowed)).toContain(line.message);
      for (const key of Object.keys(line.fields)) {
        expect(allowed[line.message]).toContain(key);
      }
    }
  });
});
