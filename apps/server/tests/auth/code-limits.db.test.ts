import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkCodeRequestLimits } from "../../src/modules/auth/index.js";
import { insertLoginCode } from "../test-rows.js";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const at = (offsetMs: number) => new Date(h.clock.now() + offsetMs);
const row = (email: string, purpose: "sign_in" | "invitation", ageMs: number) =>
  insertLoginCode(h.sql, {
    workspace_id: h.workspaceId,
    email,
    purpose,
    created_at: at(-ageMs),
    expires_at: at(600_000 - ageMs),
  });
const check = (email: string) =>
  checkCodeRequestLimits(h.db, { email, now: at(0) });

describe("checkCodeRequestLimits (R50 to R53)", () => {
  it("is ok for an address with no rows", async () => {
    expect(await check("none@example.com")).toEqual({ result: "ok" });
  });

  it("counts rows of both purposes for the 5 in 15 minutes (R50, R52)", async () => {
    const e = "mix@example.com";
    // 2 sign-in and 3 invitation rows, 2 minutes apart, the oldest 10 minutes old
    await row(e, "sign_in", 600_000);
    await row(e, "invitation", 480_000);
    await row(e, "sign_in", 360_000);
    await row(e, "invitation", 240_000);
    expect(await check(e)).toEqual({ result: "ok" });
    await row(e, "invitation", 120_000);
    // 5 rows: the wait is until the oldest is 15 minutes old: 900 - 600 = 300 s
    expect(await check(e)).toEqual({
      result: "request_limit",
      retryAfterSeconds: 300,
    });
  });

  it("is ok again once the oldest of the 5 is 15 minutes old (R50)", async () => {
    const e = "edge@example.com";
    for (const age of [900_000, 700_000, 500_000, 300_000, 100_000]) {
      await row(e, "invitation", age);
    }
    // the row at exactly 900 s is outside the window: 4 rows count
    expect(await check(e)).toEqual({ result: "ok" });
  });

  it("refuses a row of either purpose that is under 60 seconds old (R51)", async () => {
    for (const purpose of ["sign_in", "invitation"] as const) {
      const e = `soon-${purpose}@example.com`;
      await row(e, purpose, 30_000);
      expect(await check(e)).toEqual({
        result: "resend_too_soon",
        retryAfterSeconds: 30,
      });
    }
    const e = "sixty@example.com";
    await row(e, "invitation", 60_000);
    expect(await check(e)).toEqual({ result: "ok" });
  });

  it("answers request_limit with the longer of the two waits when both apply (R51)", async () => {
    const e = "both@example.com";
    for (const age of [800_000, 600_000, 400_000, 200_000, 10_000]) {
      await row(e, "sign_in", age);
    }
    // the 15-minute wait is 100 s, the 60-second wait is 50 s
    expect(await check(e)).toEqual({
      result: "request_limit",
      retryAfterSeconds: 100,
    });
  });

  it("does not count the rows of another address", async () => {
    await row("other@example.com", "sign_in", 10_000);
    expect(await check("mine@example.com")).toEqual({ result: "ok" });
  });

  it("changes no row and cancels no code (read-only apart from the lock)", async () => {
    const e = "ro@example.com";
    const id = await row(e, "invitation", 120_000);
    await check(e);
    const [r] =
      await h.sql`select cancelled_at, used_at from login_codes where id = ${id}`;
    expect(r).toEqual({ cancelled_at: null, used_at: null });
  });
});

describe("the sign-in request counts both purposes (R52, R53)", () => {
  it("5 invitation rows make the next sign-in request answer code_request_limit", async () => {
    const e = "five@example.com";
    for (const age of [800_000, 600_000, 400_000, 200_000, 100_000]) {
      await row(e, "invitation", age);
    }
    const res = await h.requestCode(e);
    expect(res.statusCode).toBe(429);
    expect(h.json(res).error.code).toBe("code_request_limit");
    expect(h.json(res).error.details.retryAfterSeconds).toBe(100);
    expect(res.headers["retry-after"]).toBe("100");
  });

  it("a sign-in request 30 seconds after an invitation code answers code_resend_too_soon", async () => {
    const e = "thirty@example.com";
    await row(e, "invitation", 30_000);
    const res = await h.requestCode(e);
    expect(h.json(res).error.code).toBe("code_resend_too_soon");
    expect(h.json(res).error.details.retryAfterSeconds).toBe(30);
  });

  it("a sign-in request cancels no invitation code and leaves its own code usable (R52)", async () => {
    const e = "cancel@example.com";
    const inv = await row(e, "invitation", 120_000);
    expect((await h.requestCode(e)).statusCode).toBe(200);
    const [r] =
      await h.sql`select cancelled_at from login_codes where id = ${inv}`;
    expect(r!.cancelled_at).toBeNull();
  });
});
