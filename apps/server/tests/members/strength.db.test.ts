import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  findInvitationByToken,
  onMemberChanged,
  type MemberChange,
} from "../../src/modules/members/index.js";
import { insertConversation, insertConversationMember } from "../test-rows.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// Cases the first tests did not pin: what a rolled-back or refused request
// publishes (R40), what the age rule keeps (R33), what a deactivation keeps
// (BR-29), and what a reactivation does to the Join link (R30).

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;
const changes: MemberChange[] = [];
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  h = await createMemberHarness();
  onMemberChanged((e) => changes.push(e));
});
afterAll(async () => {
  await h?.close();
});
beforeEach(async () => {
  await h.sql`truncate admin_actions, invitations, member_requests, login_codes, devices, sessions, conversation_members, conversations, users cascade`;
  h.mail.calls.length = 0;
  changes.length = 0;
  lan = await h.admin(mail("lan"));
});

const staleCodes = async (count: number, ageDays: number, tag: string) => {
  const rows = Array.from({ length: count }, (_, i) => ({
    id: crypto.randomUUID(),
    workspace_id: h.workspaceId,
    created_at: new Date(h.clock.now() - ageDays * DAY),
    purpose: "invitation",
    email: `${tag}${i}@example.com`,
    user_id: null,
    request_hash: `${tag}${i}`.padEnd(64, "a").replace(/[^0-9a-f]/g, "a"),
    code_hash: `${tag}${i}`.padEnd(64, "b").replace(/[^0-9a-f]/g, "b"),
    expires_at: new Date(h.clock.now() - (ageDays - 1) * DAY),
  }));
  await h.sql`insert into login_codes ${h.sql(rows)}`;
};
const left = async (tag: string) =>
  (
    await h.sql`select count(*)::int as n from login_codes where purpose = 'invitation' and email like ${tag + "%"}`
  )[0]!.n as number;

describe("what a request that does not change anything publishes (R40)", () => {
  it("publishes nothing for a refusal, and nothing for a change that rolled back", async () => {
    const minh = await h.person(mail("minh"));
    // A refusal: the only Admin cannot demote themselves.
    const refused = await h.post(lan, `/members/${lan.id}/role`, {
      role: "member",
    });
    expect(refused.statusCode).toBe(409);
    // A refusal for a Member.
    const forbidden = await h.post(minh, `/members/${lan.id}/deactivate`);
    expect(forbidden.statusCode).toBe(403);
    // A change that rolls back: ending the sessions fails.
    await h.sql
      .unsafe(`create function fail_end() returns trigger language plpgsql as $$
      begin
        if new.user_id = '${minh.id}'::uuid and new.ended_at is not null then
          raise exception 'refused in this test';
        end if;
        return new;
      end $$`);
    await h.sql`create trigger fail_end_trg before update on sessions
      for each row execute function fail_end()`;
    try {
      const failed = await h.post(lan, `/members/${minh.id}/deactivate`);
      expect(failed.statusCode).toBe(500);
    } finally {
      await h.sql`drop trigger fail_end_trg on sessions`;
      await h.sql`drop function fail_end()`;
    }
    expect(changes).toEqual([]);
    // Once it succeeds, exactly one event.
    await h.post(lan, `/members/${minh.id}/deactivate`);
    expect(changes).toHaveLength(1);
  });

  it("answers 200 when a listener throws, and still calls the next one", async () => {
    const minh = await h.person(mail("minh"));
    const stopThrowing = onMemberChanged(() => {
      throw new Error("listener failed");
    });
    try {
      const res = await h.post(lan, `/members/${minh.id}/role`, {
        role: "admin",
      });
      expect(res.statusCode).toBe(200);
      expect(h.body(res).member.role).toBe("admin");
    } finally {
      stopThrowing();
    }
    expect(changes).toHaveLength(1);
  });
});

describe("the age rule keeps what is younger (R33)", () => {
  it("a batch deletes 100 codes older than 8 days at most, and keeps a code 7 days old", async () => {
    await staleCodes(130, 10, "old");
    await staleCodes(5, 7, "young");
    await h.invite(lan, [mail("a")]);
    expect(await left("old")).toBe(30);
    expect(await left("young")).toBe(5);
    await h.invite(lan, [mail("b")]);
    expect(await left("old")).toBe(0);
    expect(await left("young")).toBe(5);
  });

  it("a code just over 8 days old goes and one just under stays", async () => {
    await staleCodes(1, 8 + 1 / 1440, "over");
    await staleCodes(1, 8 - 1 / 1440, "under");
    await h.invite(lan, [mail("a")]);
    expect(await left("over")).toBe(0);
    expect(await left("under")).toBe(1);
  });

  it("a resend keeps younger codes too", async () => {
    const made = await h.invite(lan, [mail("a")]);
    const id = h.body(made).results[0]!.invitation!.id;
    await staleCodes(3, 10, "old");
    await staleCodes(3, 7, "young");
    await h.post(lan, `/invitations/${id}/resend`, undefined, {
      headers: { "idempotency-key": h.key() },
    });
    expect(await left("old")).toBe(0);
    expect(await left("young")).toBe(3);
  });
});

describe("a deactivation deletes nothing (BR-29)", () => {
  it("keeps the member rows of every conversation, and the person's own rows", async () => {
    const minh = await h.person(mail("minh"));
    const channel = await insertConversation(h.sql, {
      workspace_id: h.workspaceId,
      created_by: lan.id,
    });
    for (const user_id of [lan.id, minh.id]) {
      await insertConversationMember(h.sql, {
        conversation_id: channel,
        user_id,
        workspace_id: h.workspaceId,
      });
    }
    const members = () =>
      h.sql`select user_id from conversation_members order by user_id`;
    const before = await members();
    expect(before).toHaveLength(2);
    await h.post(lan, `/members/${minh.id}/deactivate`);
    expect(await members()).toEqual(before);
    expect((await h.user(minh.id)).email).toBe(minh.email);
  });
});

describe("a reactivation and the Join link (R30)", () => {
  it("leaves the link finding the invitation as used", async () => {
    const email = mail("old");
    const old = await h.addUser(email, { status: "deactivated" });
    await h.invite(lan, [email], { role: "admin" });
    const token = h.tokenOf(h.invitationMails().at(-1)!);
    expect(
      (await findInvitationByToken(h.db, token, new Date(h.clock.now())))!
        .state,
    ).toBe("pending");
    await h.post(lan, `/members/${old}/reactivate`);
    expect(
      (await findInvitationByToken(h.db, token, new Date(h.clock.now())))!
        .state,
    ).toBe("used");
  });
});
