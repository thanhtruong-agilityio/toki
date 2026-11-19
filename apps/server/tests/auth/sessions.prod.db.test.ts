import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

// Its own file: the module keeps the clock and the environment of the app that
// was built last, so two harnesses must not live in one file.
let prod: Harness;
beforeAll(async () => {
  prod = await createHarness({ development: false });
});
afterAll(async () => {
  await prod?.close();
});

describe("production cookie (R21, R26)", () => {
  it("sets Secure, the __Host- name and no Domain in production (R21)", async () => {
    await prod.addUser("p@example.com");
    const { res } = await prod.signIn("p@example.com");
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/^__Host-toki_session=/);
    expect(cookie).toContain("; Secure");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).not.toContain("Domain");
  });

  it("reads only the __Host- cookie and ignores the development name (R21)", async () => {
    await prod.addUser("q@example.com");
    const { secret } = await prod.signIn("q@example.com");
    const asked = (name: string) =>
      prod.call({
        method: "GET",
        url: "/api/v1/protected",
        headers: { cookie: `${name}=${secret}` },
      });
    expect((await asked("__Host-toki_session")).statusCode).toBe(200);
    expect((await asked("toki_session")).statusCode).toBe(401);
  });
});
