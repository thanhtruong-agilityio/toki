import { describe, expect, it } from "vitest";
import { createHarness, type Harness } from "./test-harness.js";

// Its own file: the module keeps the clock of the app built last (see
// sessions.prod.db.test.ts), so each harness here is closed before the next.
const noop = {
  sendInvitationMail: async () => ({ ok: true as const }),
  sendInvitationCode: async () => ({ ok: true as const }),
};

describe("mail after the answer (R8)", () => {
  it("answers although the mail layer fails or never answers, without a log line of ours", async () => {
    const layers = [
      { ...noop, sendSignInMail: () => Promise.reject(new Error("smtp down")) },
      { ...noop, sendSignInMail: () => new Promise<never>(() => {}) },
    ];
    for (const mail of layers) {
      const x: Harness = await createHarness({ mail });
      try {
        await x.addUser("a@example.com");
        const res = await x.requestCode("a@example.com");
        expect(res.statusCode).toBe(200);
        expect(Object.keys(x.json(res)).sort()).toEqual([
          "expiresInSeconds",
          "requestId",
          "resendAfterSeconds",
        ]);
        await x.flush();
        expect(x.logText()).not.toContain("a@example.com");
      } finally {
        await x.close();
      }
    }
  });
});
