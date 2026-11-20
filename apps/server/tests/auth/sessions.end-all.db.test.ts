import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  onSessionsEnded,
  type EndReason,
} from "../../src/modules/auth/index.js";
import { bearer, DAY, makeSession } from "./session-fixtures.js";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
let stopListening: () => void;
const heard: Array<{ ids: string[]; reason: EndReason }> = [];
beforeAll(async () => {
  h = await createHarness();
  stopListening = onSessionsEnded((ids, reason) => {
    heard.push({ ids, reason });
  });
});
afterAll(async () => {
  stopListening?.();
  await h?.close();
});
beforeEach(() => {
  heard.length = 0;
});

const endAll = (headers: Record<string, string>) =>
  h.call({ method: "DELETE", url: "/api/v1/auth/sessions", headers });
const protectedGet = (headers: Record<string, string>) =>
  h.call({ method: "GET", url: "/api/v1/protected", headers });
const list = (headers: Record<string, string>) =>
  h.call({ method: "GET", url: "/api/v1/auth/sessions", headers });

describe("DELETE /auth/sessions (TOKI-026 R13 to R15)", () => {
  it("keeps the session of the request and ends every other live one (TS-216)", async () => {
    const id = await h.addUser("all@example.com");
    const mine = await makeSession(h, id);
    const b = await makeSession(h, id);
    const c = await makeSession(h, id);
    const res = await endAll(bearer(mine.secret));
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
    for (const gone of [b, c]) {
      const after = await protectedGet(bearer(gone.secret));
      expect(after.statusCode).toBe(401);
      expect(h.json(after).error.code).toBe("session_ended");
    }
    // Another tab of the same browser sends the same secret and still passes.
    expect((await protectedGet(bearer(mine.secret))).statusCode).toBe(200);
    expect((await protectedGet(bearer(mine.secret))).statusCode).toBe(200);
    const listed = h.json(await list(bearer(mine.secret))) as unknown as {
      sessions: { id: string; current: boolean }[];
    };
    expect(listed.sessions).toEqual([
      expect.objectContaining({ id: mine.id, current: true }),
    ]);
    expect(heard).toHaveLength(1);
    expect(heard[0]!.reason).toBe("revoked");
    expect([...heard[0]!.ids].sort()).toEqual([b.id, c.id].sort());
  });

  it("answers 204 and changes nothing when there is no other live session", async () => {
    const id = await h.addUser("alone@example.com");
    const mine = await makeSession(h, id);
    const res = await endAll(bearer(mine.secret));
    expect(res.statusCode).toBe(204);
    expect(heard).toEqual([]);
  });

  it("never touches the sessions of other people", async () => {
    const sam = await h.addUser("sam@example.com");
    const lee = await h.addUser("lee@example.com");
    const mine = await makeSession(h, sam);
    await makeSession(h, sam);
    const theirs = await makeSession(h, lee);
    await endAll(bearer(mine.secret));
    expect((await protectedGet(bearer(theirs.secret))).statusCode).toBe(200);
  });

  it("leaves a row idle for 31 days with no ended_at as it was, and reports nothing for ended ones", async () => {
    const id = await h.addUser("idle@example.com");
    const mine = await makeSession(h, id);
    const idle = await makeSession(h, id, { idleMs: 31 * DAY });
    const ended = await makeSession(h, id, { endedAs: "signed_out" });
    const live = await makeSession(h, id);
    await endAll(bearer(mine.secret));
    const rows =
      await h.sql`select id, ended_at, ended_reason from sessions where user_id = ${id}`;
    const by = (sid: string) => rows.find((r) => r.id === sid)!;
    expect(by(idle.id).ended_at).toBeNull();
    expect(by(ended.id).ended_reason).toBe("signed_out");
    expect(by(live.id).ended_reason).toBe("revoked");
    expect(heard.flatMap((e) => e.ids)).toEqual([live.id]);
  });
});
