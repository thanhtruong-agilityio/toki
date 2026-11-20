import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { json, makeInvitation, resend, type Admin } from "./join-support.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
let boss: Admin;
const original = () => h.mail.layer.sendInvitationCode;
let restore: MemberHarness["mail"]["layer"]["sendInvitationCode"];

beforeAll(async () => {
  h = await createMemberHarness();
  boss = await h.admin("boss@example.com");
  restore = original();
});
afterAll(async () => {
  h.mail.layer.sendInvitationCode = restore;
  await h?.close();
});

describe('"Resend code" with a failing mail layer (R9)', () => {
  for (const mode of ["rejects", "hangs"] as const) {
    it(`leaves the answer unchanged when the mail layer ${mode}, and the code is made all the same`, async () => {
      const made = await makeInvitation(h, boss, `mail-${mode}@example.com`);
      h.mail.layer.sendInvitationCode = (): Promise<{ ok: true }> =>
        mode === "rejects"
          ? Promise.reject(new Error("smtp is down"))
          : new Promise(() => {});
      h.clock.advance(61_000);
      const res = await resend(h, made.token);
      expect(res.statusCode).toBe(200);
      expect(json(res)).toEqual({
        expiresInSeconds: 600,
        resendAfterSeconds: 60,
      });
      await h.flush();
      // the module adds no log line with the address, the token or the code (R9, R24)
      const log = h.logText();
      expect(log).not.toContain(made.email);
      expect(log).not.toContain(made.token);
      // the code exists: after 60 seconds the person presses again and it is accepted
      h.clock.advance(61_000);
      expect((await resend(h, made.token)).statusCode).toBe(200);
      const [{ n }] = (await h.sql`
        select count(*)::int as n from login_codes where email = ${made.email}`) as unknown as [
        { n: number },
      ];
      expect(n).toBe(3);
    });
  }
});
