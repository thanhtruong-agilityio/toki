import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

describe("a failing query does not put the address in the log (R37)", () => {
  it("answers 500 and logs the kind of error only", async () => {
    await h.addUser("leak@example.com");
    await h.sql`drop table login_codes cascade`;
    const res = await h.requestCode("leak@example.com");
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("leak@example.com");
    const log = h.logText();
    expect(log).toContain("unexpected error");
    expect(log).not.toContain("leak@example.com");
  });
});
