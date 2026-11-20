import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { printLink, useLink } from "./emergency-fixtures.js";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h?.close();
});

const from = (remoteAddress: string) => ({ remoteAddress });

describe("the limit per network address (TOKI-026 R49)", () => {
  it("answers the 20th request by its own rule and the 21st with 429, using no link up", async () => {
    const id = await h.addUser("limit@example.com");
    const { token } = await printLink(h, id);
    const address = "203.0.113.7";
    for (let i = 0; i < 20; i += 1) {
      const res = await useLink(h, "q".repeat(43), from(address));
      expect(res.statusCode, `request ${i + 1}`).toBe(400);
    }
    const logBefore = h.logText().split("emergency_link_").length;
    const limited = await useLink(h, token, from(address));
    expect(limited.statusCode).toBe(429);
    const body = h.json(limited);
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.details).toEqual({
      retryAfterSeconds: expect.any(Number),
    });
    expect(limited.headers["retry-after"]).toBeDefined();
    // The link was not read, so it is unused, and no line of R35 was written for the 21st.
    const [row] =
      await h.sql`select used_at from emergency_links where user_id = ${id}`;
    expect(row!.used_at).toBeNull();
    expect(h.logText().split("emergency_link_").length).toBe(logBefore);
    expect(
      await h.sql`select id from sessions where user_id = ${id}`,
    ).toHaveLength(0);

    // After the 15 minutes of the window the same token signs in.
    h.clock.advance(15 * 60 * 1000 + 1000);
    // The link itself has expired by then: print a new one.
    const fresh = await printLink(h, id);
    expect((await useLink(h, fresh.token, from(address))).statusCode).toBe(200);
  });

  it("keeps a count of its own: requests to POST /auth/codes do not use it up, and another address is free", async () => {
    const id = await h.addUser("own@example.com");
    const { token } = await printLink(h, id);
    const address = "203.0.113.8";
    for (let i = 0; i < 20; i += 1) {
      await h.call({
        method: "POST",
        url: "/api/v1/auth/codes",
        payload: { email: "nobody@example.com" },
        ...from(address),
      });
    }
    // 20 requests to /auth/codes from this address did not touch the count of this route.
    expect((await useLink(h, token, from(address))).statusCode).toBe(200);
    const other = await h.addUser("other@example.com");
    const second = await printLink(h, other);
    expect(
      (await useLink(h, second.token, from("203.0.113.9"))).statusCode,
    ).toBe(200);
  });
});
