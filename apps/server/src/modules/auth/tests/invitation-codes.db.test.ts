import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkInvitationCode,
  createInvitationCode,
  pruneInvitationCodes,
} from "../index.js";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const rows = (purpose: string) =>
  h.sql`select * from login_codes where purpose = ${purpose} order by created_at`;

describe("invitation codes (R49)", () => {
  it("creates a code, checks it, and works once", async () => {
    const code = await createInvitationCode(h.db, {
      email: "inv@example.com",
      secret: "s1".repeat(10),
    });
    expect(code).toMatch(/^[0-9]{6}$/);
    expect(
      await checkInvitationCode(h.db, { secret: "s1".repeat(10), code }),
    ).toEqual({ result: "ok" });
    expect(
      await checkInvitationCode(h.db, { secret: "s1".repeat(10), code }),
    ).toEqual({ result: "expired" });
  });

  it("reports incorrect with triesLeft, then locked, as for a sign-in code", async () => {
    const secret = "s2".repeat(10);
    const code = await createInvitationCode(h.db, {
      email: "t@example.com",
      secret,
    });
    const bad = code === "111111" ? "222222" : "111111";
    for (const left of [4, 3, 2, 1]) {
      expect(await checkInvitationCode(h.db, { secret, code: bad })).toEqual({
        result: "incorrect",
        triesLeft: left,
      });
    }
    expect(await checkInvitationCode(h.db, { secret, code: bad })).toEqual({
      result: "locked",
    });
    expect(await checkInvitationCode(h.db, { secret, code })).toEqual({
      result: "locked",
    });
  });

  it("expires at exactly 10 minutes and knows an unknown secret as expired", async () => {
    const secret = "s3".repeat(10);
    const code = await createInvitationCode(h.db, {
      email: "e@example.com",
      secret,
    });
    h.clock.advance(600_000);
    expect(await checkInvitationCode(h.db, { secret, code })).toEqual({
      result: "expired",
    });
    expect(await checkInvitationCode(h.db, { secret: "nope", code })).toEqual({
      result: "expired",
    });
  });

  it("a new invitation code cancels the earlier one for that address (D-082)", async () => {
    const a = "a1".repeat(10);
    const b = "b1".repeat(10);
    const first = await createInvitationCode(h.db, {
      email: "c@example.com",
      secret: a,
    });
    await createInvitationCode(h.db, { email: "c@example.com", secret: b });
    expect(await checkInvitationCode(h.db, { secret: a, code: first })).toEqual(
      { result: "expired" },
    );
  });

  it("is not touched by a sign-in request, and does not touch one", async () => {
    await h.addUser("both@example.com");
    const secret = "q1".repeat(10);
    const code = await createInvitationCode(h.db, {
      email: "both@example.com",
      secret,
    });
    h.clock.advance(61_000);
    await h.requestCode("both@example.com");
    expect(await checkInvitationCode(h.db, { secret, code })).toEqual({
      result: "ok",
    });
    const signIn = await rows("sign_in");
    expect(
      signIn.filter(
        (r) => r.email === "both@example.com" && r.cancelled_at === null,
      ),
    ).toHaveLength(1);
  });

  it("leaves no live code when the caller's transaction is rolled back", async () => {
    const secret = "r1".repeat(10);
    let code = "";
    await h.db
      .transaction(async (tx) => {
        code = await createInvitationCode(tx, {
          email: "rb@example.com",
          secret,
        });
        throw new Error("rollback");
      })
      .catch(() => {});
    expect(await checkInvitationCode(h.db, { secret, code })).toEqual({
      result: "expired",
    });
  });
});

describe("pruneInvitationCodes (R51)", () => {
  it("deletes only invitation rows older than the time, at most `limit`, never a sign-in row", async () => {
    const { insertLoginCode } = await import("../../../tests/test-rows.js");
    const old = new Date(h.clock.now() - 9 * 86_400_000);
    for (let i = 0; i < 5; i++) {
      await insertLoginCode(h.sql, {
        workspace_id: h.workspaceId,
        purpose: "invitation",
        email: `p${i}@example.com`,
        created_at: old,
        expires_at: new Date(old.getTime() + 600_000),
      });
    }
    await insertLoginCode(h.sql, {
      workspace_id: h.workspaceId,
      purpose: "sign_in",
      email: "keep@example.com",
      created_at: old,
      expires_at: new Date(old.getTime() + 600_000),
    });
    const cutoff = new Date(h.clock.now() - 8 * 86_400_000);
    const invitationsBefore = (await rows("invitation")).length;
    expect(await pruneInvitationCodes(h.db, cutoff, 3)).toBe(3);
    expect((await rows("invitation")).length).toBe(invitationsBefore - 3);
    expect(await pruneInvitationCodes(h.db, cutoff, 100)).toBe(2);
    expect(
      (await rows("sign_in")).some((r) => r.email === "keep@example.com"),
    ).toBe(true);
    // a row created exactly at `olderThan` is not "before" it: it stays
    const atCutoff = await insertLoginCode(h.sql, {
      workspace_id: h.workspaceId,
      purpose: "invitation",
      email: "edge@example.com",
      created_at: cutoff,
      expires_at: new Date(cutoff.getTime() + 600_000),
    });
    expect(await pruneInvitationCodes(h.db, cutoff, 100)).toBe(0);
    expect(
      (await h.sql`select id from login_codes where id = ${atCutoff}`).length,
    ).toBe(1);
    // a recent invitation row stays
    expect((await rows("invitation")).length).toBeGreaterThan(0);
  });
});
