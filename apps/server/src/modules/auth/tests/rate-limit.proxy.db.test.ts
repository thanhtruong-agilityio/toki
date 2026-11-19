import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

let h: Harness;
beforeAll(async () => {
  h = await createHarness({ trustedProxy: "10.9.9.9" });
});
afterAll(async () => {
  await h?.close();
});

describe("limit per network address behind a trusted proxy (R56)", () => {
  it("counts the address the proxy reports, and ignores the header from anyone else", async () => {
    for (let i = 0; i < 20; i++) {
      await h.requestCode("bad", {
        remoteAddress: "10.9.9.9",
        headers: { "x-forwarded-for": "198.51.100.1" },
      });
    }
    const limited = await h.requestCode("bad", {
      remoteAddress: "10.9.9.9",
      headers: { "x-forwarded-for": "198.51.100.1" },
    });
    expect(h.json(limited).error.code).toBe("rate_limited");
    const other = await h.requestCode("bad", {
      remoteAddress: "10.9.9.9",
      headers: { "x-forwarded-for": "198.51.100.2" },
    });
    expect(other.statusCode).toBe(400);
    // a client that is not the proxy cannot choose its address
    for (let i = 0; i < 20; i++) {
      await h.requestCode("bad", {
        remoteAddress: "192.0.2.50",
        headers: { "x-forwarded-for": `198.51.100.${i + 10}` },
      });
    }
    const spoof = await h.requestCode("bad", {
      remoteAddress: "192.0.2.50",
      headers: { "x-forwarded-for": "198.51.100.250" },
    });
    expect(h.json(spoof).error.code).toBe("rate_limited");
  });
});
