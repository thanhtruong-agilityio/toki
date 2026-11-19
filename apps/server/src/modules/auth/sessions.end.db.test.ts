import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  AccountNotActiveError,
  createSession,
  endSessionOfRequest,
  endSessionsOfUser,
  onSessionsEnded,
  reportSessionsEnded,
  type EndReason,
} from "./index.js";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
const heard: Array<{ ids: string[]; reason: EndReason }> = [];
beforeAll(async () => {
  h = await createHarness();
  onSessionsEnded((ids, reason) => {
    heard.push({ ids, reason });
  });
});
afterAll(async () => {
  await h?.close();
});
beforeEach(() => {
  heard.length = 0;
});

const get = (secret?: string, via: "cookie" | "token" = "cookie") =>
  h.call({
    method: "GET",
    url: "/api/v1/protected",
    headers: secret
      ? via === "cookie"
        ? h.withCookie(secret)
        : { authorization: `Bearer ${secret}` }
      : {},
  });
const del = (secret?: string) =>
  h.call({
    method: "DELETE",
    url: "/api/v1/auth/session",
    headers: secret ? h.withCookie(secret) : {},
  });
const sessionId = async (secret: string) => {
  const { sha256 } = await import("./secrets.js");
  return (
    await h.sql`select id from sessions where secret_hash = ${sha256(secret)}`
  )[0]!.id as string;
};

describe("sign-out (R28, R33)", () => {
  it("ends the session, clears the cookie, and the same value answers session_ended", async () => {
    await h.addUser("out@example.com");
    const a = await h.signIn("out@example.com");
    const other = await h.signIn("out@example.com");
    const res = await del(a.secret);
    expect(res.statusCode).toBe(204);
    expect(String(res.headers["set-cookie"])).toBe(
      "toki_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    );
    expect(h.json(await get(a.secret)).error.code).toBe("session_ended");
    expect(h.json(await get()).error.code).toBe("unauthenticated");
    expect((await get(other.secret)).statusCode).toBe(200); // R31: another session works
    expect(heard).toEqual([
      { ids: [await sessionId(a.secret)], reason: "signed_out" },
    ]);
  });
  it("is not an error without a session, twice, or with an unknown one (R33)", async () => {
    for (const secret of [undefined, "unknown-value"]) {
      const res = await del(secret);
      expect(res.statusCode).toBe(204);
      expect(String(res.headers["set-cookie"])).toContain("Max-Age=0");
    }
    await h.addUser("twice@example.com");
    const a = await h.signIn("twice@example.com");
    expect((await del(a.secret)).statusCode).toBe(204);
    expect((await del(a.secret)).statusCode).toBe(204);
    expect(heard).toHaveLength(1);
  });
  it("answers the current session (R32)", async () => {
    const id = await h.addUser("cur@example.com", {
      display_name: "Cur",
      role: "admin",
      language: "vi",
    });
    const a = await h.signIn("cur@example.com");
    const res = await h.call({
      method: "GET",
      url: "/api/v1/auth/session",
      headers: h.withCookie(a.secret),
    });
    expect(h.json(res)).toEqual({
      user: {
        id,
        email: "cur@example.com",
        displayName: "Cur",
        role: "admin",
        language: "vi",
      },
    });
    expect(
      h.json(await h.call({ method: "GET", url: "/api/v1/auth/session" })).error
        .code,
    ).toBe("unauthenticated");
  });
});

describe("replacing (R34)", () => {
  it("ends the cookie session of the request with the reason replaced and sets a new cookie", async () => {
    await h.addUser("rep@example.com");
    const a = await h.signIn("rep@example.com");
    const b = await h.signIn("rep@example.com", "cookie", {
      headers: h.withCookie(a.secret),
    });
    expect(b.secret).not.toBe(a.secret);
    expect(h.json(await get(a.secret)).error.code).toBe("session_ended");
    expect((await get(b.secret)).statusCode).toBe(200);
    expect(heard.at(-1)).toEqual({
      ids: [await sessionId(a.secret)],
      reason: "replaced",
    });
  });
  it("does not replace anything for the token transport", async () => {
    await h.addUser("rep2@example.com");
    const a = await h.signIn("rep2@example.com");
    await h.signIn("rep2@example.com", "token", {
      headers: h.withCookie(a.secret),
    });
    expect((await get(a.secret)).statusCode).toBe(200);
  });
});

describe("createSession (R29)", () => {
  it("returns id and secret and refuses an account that is not Active", async () => {
    const id = await h.addUser("cs@example.com");
    const account = {
      id,
      workspaceId: h.workspaceId,
      status: "active" as const,
    };
    const made = await createSession(h.db, account, "token", {
      userAgent: "x",
    });
    expect((await get(made.secret, "token")).statusCode).toBe(200);
    await expect(
      createSession(
        h.db,
        { ...account, status: "deactivated" as never },
        "token",
      ),
    ).rejects.toBeInstanceOf(AccountNotActiveError);
  });
});

describe("endSessionsOfUser (R30)", () => {
  it("ends the live ones, honours only and except, returns the ids really ended", async () => {
    const id = await h.addUser("many@example.com");
    const s = [
      await h.signIn("many@example.com"),
      await h.signIn("many@example.com"),
      await h.signIn("many@example.com"),
    ];
    const ids = await Promise.all(s.map((x) => sessionId(x.secret)));
    expect(
      await endSessionsOfUser(h.db, id, { reason: "revoked", except: ids[0] }),
    ).toEqual(expect.arrayContaining([ids[1], ids[2]]));
    expect((await get(s[0]!.secret)).statusCode).toBe(200);
    expect(h.json(await get(s[1]!.secret)).error.code).toBe("session_ended");
    expect(heard.at(-1)!.reason).toBe("revoked");
    // only the live ones: nothing left but the first
    expect(
      await endSessionsOfUser(h.db, id, {
        reason: "revoked",
        only: [ids[1]!, ids[2]!],
      }),
    ).toEqual([]);
    expect(
      await endSessionsOfUser(h.db, id, { reason: "deactivated" }),
    ).toEqual([ids[0]]);
    expect(heard.at(-1)).toEqual({ ids: [ids[0]], reason: "deactivated" });
  });
});

describe("endSessionOfRequest (R52)", () => {
  it("returns the id, or null for none, unknown, ended and deactivated", async () => {
    const id = await h.addUser("er@example.com");
    const a = await h.signIn("er@example.com");
    expect(
      await endSessionOfRequest(h.db, { headers: {} }, "signed_out"),
    ).toBeNull();
    expect(
      await endSessionOfRequest(
        h.db,
        { headers: h.withCookie("unknown") },
        "signed_out",
      ),
    ).toBeNull();
    expect(
      await endSessionOfRequest(
        h.db,
        { headers: h.withCookie(a.secret) },
        "signed_out",
        { only: "cookie" },
      ),
    ).toBe(await sessionId(a.secret));
    expect(
      await endSessionOfRequest(
        h.db,
        { headers: h.withCookie(a.secret) },
        "signed_out",
      ),
    ).toBeNull();
    const b = await h.signIn("er@example.com");
    await h.sql`update users set status = 'deactivated' where id = ${id}`;
    expect(
      await endSessionOfRequest(
        h.db,
        { headers: h.withCookie(b.secret) },
        "signed_out",
      ),
    ).toBeNull();
  });
});

describe("transactions and reports (R50, R53)", () => {
  it("leaves the session undone and reports nothing when the caller's transaction rolls back", async () => {
    const id = await h.addUser("tx@example.com");
    const a = await h.signIn("tx@example.com");
    const sid = await sessionId(a.secret);
    let created: { id: string } | null = null;
    await h.db
      .transaction(async (tx) => {
        created = await createSession(
          tx,
          { id, workspaceId: h.workspaceId, status: "active" },
          "token",
        );
        await endSessionsOfUser(tx, id, { reason: "revoked" });
        throw new Error("rollback");
      })
      .catch(() => {});
    expect(created).not.toBeNull();
    expect(
      (await h.sql`select id from sessions where id = ${created!.id}`).length,
    ).toBe(0);
    expect((await get(a.secret)).statusCode).toBe(200);
    expect(heard).toEqual([]);
    // the caller reports after its own commit
    let ended: string[] = [];
    await h.db.transaction(async (tx) => {
      ended = await endSessionsOfUser(tx, id, { reason: "deactivated" });
    });
    expect(heard).toEqual([]);
    reportSessionsEnded(ended, "deactivated");
    expect(heard).toEqual([{ ids: [sid], reason: "deactivated" }]);
  });
});
