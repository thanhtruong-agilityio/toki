import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  onSessionsEnded,
  type EndReason,
} from "../../src/modules/auth/index.js";
import {
  bearer,
  DAY,
  makeSession,
  UUID_NOT_IN_USE,
} from "./session-fixtures.js";
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

const endOne = (id: string, headers: Record<string, string>) =>
  h.call({
    method: "DELETE",
    url: `/api/v1/auth/sessions/${id}`,
    headers,
  });
const protectedGet = (headers: Record<string, string>) =>
  h.call({ method: "GET", url: "/api/v1/protected", headers });
const list = (headers: Record<string, string>) =>
  h.call({ method: "GET", url: "/api/v1/auth/sessions", headers });
const row = async (id: string) =>
  (
    await h.sql`select ended_at, ended_reason from sessions where id = ${id}`
  )[0]!;

describe("DELETE /auth/sessions/:sessionId (TOKI-026 R7 to R12)", () => {
  it("ends another session of the person; the next request with it answers session_ended (TS-214)", async () => {
    const id = await h.addUser("one@example.com");
    const laptop = await makeSession(h, id);
    const phone = await makeSession(h, id);
    const res = await endOne(phone.id, bearer(laptop.secret));
    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
    expect((await row(phone.id)).ended_reason).toBe("revoked");
    expect((await row(laptop.id)).ended_at).toBeNull();

    const after = await protectedGet(bearer(phone.secret));
    expect(after.statusCode).toBe(401);
    expect(h.json(after).error.code).toBe("session_ended");
    expect((await protectedGet(bearer(laptop.secret))).statusCode).toBe(200);

    const listed = h.json(await list(bearer(laptop.secret))) as unknown as {
      sessions: { id: string }[];
    };
    expect(listed.sessions.map((s) => s.id)).toEqual([laptop.id]);
    expect(heard).toEqual([{ ids: [phone.id], reason: "revoked" }]);
  });

  it("answers 400 validation_failed for an id that is not a UUID and changes nothing", async () => {
    const id = await h.addUser("bad@example.com");
    const mine = await makeSession(h, id);
    const res = await endOne("not-a-uuid", bearer(mine.secret));
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("validation_failed");
    expect(heard).toEqual([]);
  });

  it("answers the same 404 for another person's session and for an id that does not exist", async () => {
    const sam = await h.addUser("sam@example.com");
    const lee = await h.addUser("lee@example.com");
    const mine = await makeSession(h, sam);
    const theirs = await makeSession(h, lee);
    const foreign = await endOne(theirs.id, bearer(mine.secret));
    const unknown = await endOne(UUID_NOT_IN_USE, bearer(mine.secret));
    expect(foreign.statusCode).toBe(404);
    expect(unknown.statusCode).toBe(404);
    expect(h.json(foreign)).toEqual(h.json(unknown));
    expect(h.json(foreign).error.code).toBe("not_found");
    expect((await row(theirs.id)).ended_at).toBeNull();
    expect(heard).toEqual([]);
  });

  it("refuses to end the session in use with current_session", async () => {
    const id = await h.addUser("self@example.com");
    const mine = await makeSession(h, id);
    const res = await endOne(mine.id, bearer(mine.secret));
    expect(res.statusCode).toBe(400);
    expect(h.json(res).error.code).toBe("current_session");
    expect((await protectedGet(bearer(mine.secret))).statusCode).toBe(200);
    expect(heard).toEqual([]);
  });

  it("answers 204 and changes nothing for an own session already ended or idle for 31 days", async () => {
    const id = await h.addUser("twice@example.com");
    const mine = await makeSession(h, id);
    const ended = await makeSession(h, id, { endedAs: "signed_out" });
    const idle = await makeSession(h, id, { idleMs: 31 * DAY });
    const endedAt = (await row(ended.id)).ended_at;
    for (const target of [ended, idle]) {
      const res = await endOne(target.id, bearer(mine.secret));
      expect(res.statusCode).toBe(204);
    }
    expect((await row(ended.id)).ended_at).toEqual(endedAt);
    expect((await row(ended.id)).ended_reason).toBe("signed_out");
    expect((await row(idle.id)).ended_at).toBeNull();
    expect(heard).toEqual([]);
  });

  it("ends a session once when two requests arrive together", async () => {
    const id = await h.addUser("race@example.com");
    const mine = await makeSession(h, id);
    const target = await makeSession(h, id);
    const [a, b] = await Promise.all([
      endOne(target.id, bearer(mine.secret)),
      endOne(target.id, bearer(mine.secret)),
    ]);
    expect([a.statusCode, b.statusCode]).toEqual([204, 204]);
    expect(heard.flatMap((e) => e.ids)).toEqual([target.id]);
  });
});
