import { afterEach, describe, expect, test, vi } from "vitest";

// The open read through the real client and its hook, which the tests that give
// fake calls cannot see (TOKI-032 R25): the hook reports a 401 as it arrives,
// before `readSessionOnOpen` looks at the result.
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function openWith(code: string, isPublic: boolean) {
  vi.resetModules();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { code, message: "m" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
  const [services, openRead, session] = await Promise.all([
    import("../../src/auth/services"),
    import("../../src/auth/open-read"),
    import("@toki/client-core"),
  ]);
  services.setAuthServices(undefined);
  openRead.resetSessionOnOpen();
  await openRead.readSessionOnOpen(isPublic);
  return session.getSessionState();
}

describe("readSessionOnOpen with the real client", () => {
  test("a 401 account_deactivated on a public route is signed out, with no modal", async () => {
    expect(await openWith("account_deactivated", true)).toEqual({
      status: "signedOut",
    });
  });

  test("a 401 account_deactivated on another route is the deactivated modal", async () => {
    expect(await openWith("account_deactivated", false)).toMatchObject({
      status: "ended",
      reason: "deactivated",
    });
  });

  test("a 401 unauthenticated is signed out on both", async () => {
    expect(await openWith("unauthenticated", true)).toEqual({
      status: "signedOut",
    });
    expect(await openWith("unauthenticated", false)).toEqual({
      status: "signedOut",
    });
  });
});
