import { describe, expect, it } from "vitest";
import { makeInvitation, resend } from "./join-support.js";
import { createMemberHarness } from "./setup.js";

// Its own file, for the same reason as join-resend-mail: one clock per process in the auth module.
describe("a pool of two (advisor finding 1)", () => {
  it("6 resends and 6 sign-in requests for one address at the same time all finish", async () => {
    const tiny = await createMemberHarness({ maxConnections: 2 });
    try {
      const boss = await tiny.admin("boss@example.com");
      const made = await makeInvitation(tiny, boss, "pool@example.com");
      await tiny.addUser("pool@example.com");
      tiny.clock.advance(61_000);
      const all = await Promise.race([
        Promise.all([
          ...Array.from({ length: 6 }, () => resend(tiny, made.token)),
          ...Array.from({ length: 6 }, () =>
            tiny.requestCode("pool@example.com"),
          ),
        ]),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("the requests hung")), 15_000),
        ),
      ]);
      for (const res of all) expect([200, 429]).toContain(res.statusCode);
      // one acceptance for the address in that second: the rest are refused
      expect(all.filter((r) => r.statusCode === 200)).toHaveLength(1);
    } finally {
      await tiny.close();
    }
  }, 30_000);
});
