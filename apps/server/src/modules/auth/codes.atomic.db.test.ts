import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

// A source of secrets the test can force: the next secret is a fixed value, so
// a session with that secret already stored makes the insert fail (R43).
const forced: { next: string | null } = { next: null };
vi.mock("./secrets.js", async (importOriginal) => {
  const real = await importOriginal<typeof import("./secrets.js")>();
  return {
    ...real,
    newSecret: () => {
      if (forced.next) {
        const value = forced.next;
        forced.next = null;
        return value;
      }
      return real.newSecret();
    },
  };
});

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("marking the code used and creating the session are one transaction (R43)", () => {
  it("leaves the code unused when the session insert fails, and the same exchange then succeeds", async () => {
    const { sha256 } = await import("./secrets.js");
    const id = await h.addUser("atomic@example.com");
    h.clock.advance(61_000);
    const asked = await h.requestCode("atomic@example.com");
    await h.flush();
    const requestId = h.json(asked).requestId as string;
    const code = h.lastCode();

    // A session that already holds the secret the exchange is about to draw.
    const taken = "taken-secret-value";
    await h.sql`insert into sessions (id, workspace_id, user_id, created_at, secret_hash, kind, last_used_at)
      values (${crypto.randomUUID()}, ${h.workspaceId}, ${id}, ${new Date(h.clock.now())}, ${sha256(taken)}, 'token', ${new Date(h.clock.now())})`;
    forced.next = taken;

    const failed = await h.exchange(requestId, code);
    expect(failed.statusCode).toBe(500);
    const [row] =
      await h.sql`select used_at from login_codes where email = 'atomic@example.com'`;
    expect(row!.used_at).toBeNull();

    const again = await h.exchange(requestId, code);
    expect(again.statusCode).toBe(200);
    const [after] =
      await h.sql`select used_at from login_codes where email = 'atomic@example.com'`;
    expect(after!.used_at).not.toBeNull();
  });
});
