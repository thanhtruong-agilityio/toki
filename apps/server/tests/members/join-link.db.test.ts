import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { INVITATION_TOKEN_PATTERN } from "@toki/shared";
import { checkInvitationCode } from "../../src/modules/auth/index.js";
import { ORIGIN } from "../auth/test-harness.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;

beforeAll(async () => {
  h = await createMemberHarness();
  lan = await h.admin("lan@example.com");
});
afterAll(async () => {
  await h?.close();
});

describe("the Join link and the code (R11)", () => {
  it("is the origin, /join# and a 43-character token; the code works with the secret <token>:1", async () => {
    await h.invite(lan, ["new@example.com"]);
    const sent = h.invitationMails().at(-1)!;
    expect(sent.joinUrl.startsWith(`${ORIGIN}/join#`)).toBe(true);
    const token = h.tokenOf(sent);
    expect(token).toMatch(INVITATION_TOKEN_PATTERN);
    expect(
      await checkInvitationCode(h.db, {
        secret: `${token}:1`,
        code: sent.code,
      }),
    ).toEqual({ result: "ok" });
  });

  it("stores only the SHA-256 of the token, and no column holds the token or the digits", async () => {
    await h.invite(lan, ["hash@example.com"]);
    const sent = h.invitationMails().at(-1)!;
    const token = h.tokenOf(sent);
    const [row] = await h.invitationsOf("hash@example.com");
    expect(row!.token_hash).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    const everything = JSON.stringify([
      await h.sql`select * from invitations`,
      await h.sql`select * from login_codes`,
      await h.sql`select * from admin_actions`,
      await h.sql`select * from member_requests`,
    ]);
    expect(everything).not.toContain(token);
    expect(everything).not.toContain(`"${sent.code}"`);
  });

  it("makes a different token for every invitation", async () => {
    await h.invite(lan, ["t1@example.com", "t2@example.com"]);
    const [a, b] = h.invitationMails().slice(-2);
    expect(h.tokenOf(a!)).not.toBe(h.tokenOf(b!));
  });

  it("signs nobody in with the token alone (D-149)", async () => {
    await h.invite(lan, ["alone@example.com"]);
    const token = h.tokenOf(h.invitationMails().at(-1)!);
    const before = (await h.sql`select count(*)::int as n from sessions`)[0]!.n;
    for (const headers of [
      { authorization: `Bearer ${token}` },
      h.withCookie(token),
    ]) {
      const res = await h.call({
        method: "GET",
        url: "/api/v1/protected",
        headers,
      });
      expect(res.statusCode).toBe(401);
    }
    expect((await h.sql`select count(*)::int as n from sessions`)[0]!.n).toBe(
      before,
    );
    expect(
      await h.sql`select id from users where email = 'alone@example.com'`,
    ).toEqual([]);
  });
});
