import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  hashLinkToken,
  issueEmergencyLink,
} from "../../src/modules/auth/emergency.js";
import { printLink, useLink } from "./emergency-fixtures.js";
import { createHarness, type Harness } from "./test-harness.js";

// Polls until a backend of this database waits on a lock (a transaction waits for another).
async function waitForLockWait(sql: postgres.Sql, ms = 10_000) {
  const stop = Date.now() + ms;
  for (;;) {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from pg_stat_activity
      where datname = current_database() and wait_event_type = 'Lock'`;
    if (row!.n > 0) return;
    if (Date.now() > stop) throw new Error("no backend waits on a lock");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const rows = (userId: string) =>
  h.sql`select token_hash, used_at, cancelled_at, expires_at, created_at from emergency_links where user_id = ${userId} order by created_at, id`;

describe("issueEmergencyLink (TOKI-026 R25, R48)", () => {
  it("returns a token of 43 base64url characters and stores only its hash", async () => {
    const id = await h.addUser("a@example.com");
    const issued = await printLink(h, id);
    expect(issued.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = (await rows(id))[0]!;
    expect(stored.token_hash).toBe(
      createHash("sha256").update(issued.token).digest("hex"),
    );
    expect(stored.token_hash).toBe(hashLinkToken(issued.token));
    // No column of the row holds the token or part of it.
    const everything = JSON.stringify(
      await h.sql`select * from emergency_links where user_id = ${id}`,
    );
    expect(everything).not.toContain(issued.token);
  });

  it("expires 10 minutes after the time it is given", async () => {
    const id = await h.addUser("ttl@example.com");
    const issued = await printLink(h, id);
    expect(issued.expiresAt.getTime() - h.clock.now()).toBe(600_000);
    const stored = (await rows(id))[0]!;
    expect(
      (stored.expires_at as Date).getTime() -
        (stored.created_at as Date).getTime(),
    ).toBe(600_000);
  });

  it("cancels the earlier open link of the same member (R48)", async () => {
    const id = await h.addUser("two@example.com");
    const first = await printLink(h, id);
    h.clock.advance(1000);
    const second = await printLink(h, id);
    const [a, b] = await rows(id);
    expect(a!.cancelled_at).not.toBeNull();
    expect(a!.used_at).toBeNull();
    expect(b!.cancelled_at).toBeNull();

    const old = await useLink(h, first.token);
    expect(old.statusCode).toBe(400);
    expect(h.json(old).error.code).toBe("emergency_link_invalid");
    const fresh = await useLink(h, second.token);
    expect(fresh.statusCode).toBe(200);
  });

  it("leaves the links of another member and a used link as they were", async () => {
    const sam = await h.addUser("sam@example.com");
    const lee = await h.addUser("lee@example.com");
    const used = await printLink(h, sam);
    await useLink(h, used.token);
    const theirs = await printLink(h, lee);
    await printLink(h, sam);
    const samRows = await rows(sam);
    expect(samRows[0]!.used_at).not.toBeNull();
    expect(samRows[0]!.cancelled_at).toBeNull();
    const leeRows = await rows(lee);
    expect(leeRows).toHaveLength(1);
    expect(leeRows[0]!.cancelled_at).toBeNull();
    expect((await useLink(h, theirs.token)).statusCode).toBe(200);
  });

  it("gives 'concurrent' to a run that meets another run for the same member (R48)", async () => {
    const id = await h.addUser("race@example.com");
    const account = { id, workspaceId: h.workspaceId };
    const url = h.config.database.url;
    // Two connections of their own: the connection of the harness serves one transaction at a time, so
    // two runs on it never overlap. Run A holds its insert open while run B starts.
    const holder = postgres(url, { max: 1, onnotice: () => {} });
    const racer = postgres(url, { max: 1, onnotice: () => {} });
    try {
      let release!: () => void;
      const hold = new Promise<void>((resolve) => (release = resolve));
      let inserted!: () => void;
      const ready = new Promise<void>((resolve) => (inserted = resolve));
      const at = new Date(h.clock.now());
      const running = holder.begin(async (tx) => {
        await tx`insert into emergency_links (id, workspace_id, user_id, token_hash, created_at, expires_at)
          values (${crypto.randomUUID()}, ${h.workspaceId}, ${id}, ${"a".repeat(64)}, ${at}, ${new Date(at.getTime() + 600_000)})`;
        inserted();
        await hold;
      });
      await ready;
      const racing = issueEmergencyLink(drizzle(racer), account, at);
      // B has to be waiting on a lock of A's insert before A commits: B's cancel step has run by then
      // and found nothing to cancel, and B's insert waits for A's unique index entry. Not a sleep: the
      // test polls Postgres until a backend of this database waits on a lock.
      await waitForLockWait(h.sql);
      release();
      await running;
      expect(await racing).toBe("concurrent");
    } finally {
      await holder.end();
      await racer.end();
    }
    const open = (await rows(id)).filter(
      (r) => r.used_at === null && r.cancelled_at === null,
    );
    expect(open).toHaveLength(1);
    expect(open[0]!.token_hash).toBe("a".repeat(64));
  });

  it("ends two overlapping runs with exactly one open link and at most one 'concurrent'", async () => {
    const id = await h.addUser("overlap@example.com");
    const account = { id, workspaceId: h.workspaceId };
    const now = new Date(h.clock.now());
    // The pool of the harness may run the two transactions at the same time or one after the other;
    // both are correct under R48: either one run meets the other and answers 'concurrent', or the
    // second cancels the first. What must hold is one open link, and no error.
    const results = await Promise.all([
      issueEmergencyLink(h.db, account, now),
      issueEmergencyLink(h.db, account, now),
    ]);
    expect(
      results.filter((r) => r === "concurrent").length,
    ).toBeLessThanOrEqual(1);
    expect(
      results.filter((r) => r !== "concurrent").length,
    ).toBeGreaterThanOrEqual(1);
    const open = (await rows(id)).filter(
      (r) => r.used_at === null && r.cancelled_at === null,
    );
    expect(open).toHaveLength(1);
  });
});
