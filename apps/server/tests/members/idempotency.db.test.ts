import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { insertMemberRequest } from "../test-rows.js";
import { createMemberHarness, type MemberHarness } from "./setup.js";

// The repeat rule (R13, D-111): the batch and the resend are answered once
// for each person and key.

let h: MemberHarness;
let lan: Awaited<ReturnType<MemberHarness["admin"]>>;
let n = 0;
const mail = (name: string) => `${name}-${(n += 1)}@example.com`;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

beforeAll(async () => {
  h = await createMemberHarness();
});
afterAll(async () => {
  await h?.close();
});
beforeEach(async () => {
  await h.sql`truncate admin_actions, invitations, member_requests, login_codes, devices, sessions, users cascade`;
  h.mail.calls.length = 0;
  h.mail.failFor.clear();
  lan = await h.admin(mail("lan"));
});

const requests = () =>
  h.sql`select * from member_requests order by created_at, id`;

describe("the header", () => {
  it("is needed on the batch and on the resend: missing or malformed is validation_failed", async () => {
    const a = mail("a");
    for (const key of [null, "", "a".repeat(65), "a b", "ké"]) {
      const res = await h.invite(lan, [a], { key });
      expect(res.statusCode, String(key)).toBe(400);
      expect(h.body(res).error.code).toBe("validation_failed");
    }
    expect(await h.invitationsOf(a)).toHaveLength(0);
    const ok = await h.invite(lan, [a], { key: "a".repeat(64) });
    expect(ok.statusCode).toBe(200);
    const id = h.body(ok).results[0]!.invitation!.id;
    const resend = await h.post(lan, `/invitations/${id}/resend`);
    expect(resend.statusCode).toBe(400);
    expect(h.body(resend).error.code).toBe("validation_failed");
  });
});

describe("a repeat (R13)", () => {
  it("answers the first response and creates no row, mail or record", async () => {
    const a = mail("a");
    const key = h.key();
    const first = await h.invite(lan, [a], { key });
    const second = await h.invite(lan, [a], { key });
    expect(second.statusCode).toBe(200);
    expect(h.body(second)).toEqual(h.body(first));
    expect(h.body(second).results[0]!.result).toBe("invited");
    expect(await h.invitationsOf(a)).toHaveLength(1);
    expect(h.invitationMails()).toHaveLength(1);
    expect(await h.actions()).toHaveLength(1);
    const [row] = await requests();
    expect(row).toMatchObject({
      user_id: lan.id,
      request_key: key,
      action: "invite",
      state: "done",
      response_status: 200,
    });
    expect(row!.response_body).toEqual(h.body(first));
  });

  it("returns the stored body even after the invitation it describes was revoked", async () => {
    const a = mail("a");
    const key = h.key();
    const first = await h.invite(lan, [a], { key });
    const id = h.body(first).results[0]!.invitation!.id;
    await h.post(lan, `/invitations/${id}/revoke`);
    const replay = await h.invite(lan, [a], { key });
    expect(h.body(replay)).toEqual(h.body(first));
    expect(await h.invitationsOf(a)).toHaveLength(1);
  });

  it("treats the same addresses with the default role and with role member as the same request", async () => {
    const a = mail("a");
    const key = h.key();
    await h.invite(lan, [a], { key });
    const again = await h.invite(lan, [a], { key, role: "member" });
    expect(again.statusCode).toBe(200);
  });

  it("refuses another body under the same key with idempotency_key_reused", async () => {
    const a = mail("a");
    const key = h.key();
    await h.invite(lan, [a], { key });
    for (const [emails, role] of [
      [[mail("b")], undefined],
      [[a], "admin"],
    ] as const) {
      const res = await h.invite(lan, emails, { key, role });
      expect(res.statusCode).toBe(409);
      expect(h.body(res).error.code).toBe("idempotency_key_reused");
    }
    expect(await h.sql`select id from invitations`).toHaveLength(1);
  });

  it("lets two Admins use the same key", async () => {
    const an = await h.admin(mail("an"));
    const key = h.key();
    const x = await h.invite(lan, [mail("a")], { key });
    const y = await h.invite(an, [mail("b")], { key });
    expect([x.statusCode, y.statusCode]).toEqual([200, 200]);
    expect(await requests()).toHaveLength(2);
  });

  it("keeps the key of a batch and of a resend apart by the request, not by the route alone", async () => {
    const a = mail("a");
    const key = h.key();
    const first = await h.invite(lan, [a], { key });
    const id = h.body(first).results[0]!.invitation!.id;
    const res = await h.post(lan, `/invitations/${id}/resend`, undefined, {
      headers: { "idempotency-key": key },
    });
    expect(res.statusCode).toBe(409);
    expect(h.body(res).error.code).toBe("idempotency_key_reused");
  });
});

describe("a request still running (R13)", () => {
  const pending = async (key: string, emails: string[], age: number) => {
    // The claim of a request that has not finished, made `age` ms ago, with
    // the hash the server makes for this body.
    const probe = await h.invite(lan, emails, { key });
    expect(probe.statusCode).toBe(200);
    await h.sql`delete from invitations`;
    const at = new Date(h.clock.now() - age);
    await h.sql`update member_requests
      set state = 'pending', response_status = null, response_body = null,
          completed_at = null, claimed_at = ${at}, created_at = ${at}
      where request_key = ${key}`;
    h.mail.calls.length = 0;
    return (await requests())[0]!.claim_id as string;
  };

  it("answers request_in_progress while the first is 4 minutes 59 seconds old", async () => {
    const a = mail("a");
    const key = h.key();
    await pending(key, [a], 5 * MINUTE - 1000);
    const res = await h.invite(lan, [a], { key });
    expect(res.statusCode).toBe(409);
    expect(h.body(res).error.code).toBe("request_in_progress");
    expect(await h.invitationsOf(a)).toHaveLength(0);
  });

  it("takes the key over when the first is 5 minutes old, with a new claim", async () => {
    const a = mail("a");
    const key = h.key();
    const dead = await pending(key, [a], 5 * MINUTE);
    const res = await h.invite(lan, [a], { key });
    expect(res.statusCode).toBe(200);
    expect(h.body(res).results[0]!.result).toBe("invited");
    const [row] = await requests();
    expect(row!.state).toBe("done");
    expect(row!.claim_id).not.toBe(dead);
    expect((row!.claimed_at as Date).getTime()).toBe(h.clock.now());
  });

  it("answers request_in_progress to the second of two at the same moment, and makes one result", async () => {
    const a = mail("a");
    const key = h.key();
    const [x, y] = await Promise.all([
      h.invite(lan, [a], { key }),
      h.invite(lan, [a], { key }),
    ]);
    const codes = [x, y].map((r) =>
      r.statusCode === 200 ? "ok" : h.body(r).error.code,
    );
    // Either the second met the claim, or it came after the first had finished.
    expect(
      codes.sort().join(",") === "ok,request_in_progress" ||
        codes.join(",") === "ok,ok",
    ).toBe(true);
    expect(await h.invitationsOf(a)).toHaveLength(1);
    expect(h.invitationMails()).toHaveLength(1);
  });
});

describe("the fence (R13)", () => {
  it("a first request that finishes after a takeover stores nothing, and the stored answer is the new owner's", async () => {
    const { completeRequest } =
      await import("../../src/modules/members/idempotency.js");
    const a = mail("a");
    const key = h.key();
    const res = await h.invite(lan, [a], { key });
    const [row] = await requests();
    const stored = row!.response_body;
    // The first owner's claim id is no longer the row's.
    const lost = crypto.randomUUID();
    const done = await completeRequest(h.db, {
      claimId: lost,
      status: 200,
      body: { results: [] },
      now: new Date(h.clock.now()),
    });
    expect(done).toBe(false);
    expect((await requests())[0]!.response_body).toEqual(stored);
    expect(h.body(res)).toEqual(stored);
  });
});

describe("only a 200 is stored (R13)", () => {
  it("deletes the claim of a request that fails, so the same request is processed again", async () => {
    const a = mail("a");
    const key = h.key();
    await h.sql.unsafe(
      `alter table invitations add constraint fail_in_test check (email <> '${a}') not valid`,
    );
    try {
      const res = await h.invite(lan, [a], { key });
      expect(res.statusCode).toBe(500);
      expect(await requests()).toHaveLength(0);
    } finally {
      await h.sql`alter table invitations drop constraint fail_in_test`;
    }
    const again = await h.invite(lan, [a], { key });
    expect(again.statusCode).toBe(200);
    expect(h.body(again).results[0]!.result).toBe("invited");
  });

  it("does not store a refusal: a batch too large under a key leaves the key free", async () => {
    const key = h.key();
    const many = Array.from({ length: 51 }, () => mail("p"));
    await h.invite(lan, many, { key });
    expect(await requests()).toHaveLength(0);
  });
});

describe("housekeeping that fails (R13)", () => {
  it("does not turn a finished batch into an error: the 200 is answered and stored", async () => {
    const other = await h.admin(mail("other"));
    // An old row for the batch to prune, and a trigger that refuses its delete.
    await insertMemberRequest(h.sql, {
      workspace_id: h.workspaceId,
      user_id: other.id,
      created_at: new Date(h.clock.now() - 2 * 24 * HOUR),
      claimed_at: new Date(h.clock.now() - 2 * 24 * HOUR),
    });
    await h.sql
      .unsafe(`create function refuse_prune() returns trigger language plpgsql as $$
      begin raise exception 'the delete is refused in this test'; end $$`);
    await h.sql`create trigger refuse_prune_trg before delete on member_requests
      for each row execute function refuse_prune()`;
    const a = mail("a");
    const key = h.key();
    try {
      const res = await h.invite(lan, [a], { key });
      expect(res.statusCode).toBe(200);
      expect(h.body(res).results[0]!.result).toBe("invited");
    } finally {
      await h.sql`drop trigger refuse_prune_trg on member_requests`;
      await h.sql`drop function refuse_prune()`;
    }
    const [row] =
      await h.sql`select state from member_requests where request_key = ${key}`;
    expect(row!.state).toBe("done");
    // The retry is answered from the stored response: no second invitation.
    const again = await h.invite(lan, [a], { key });
    expect(h.body(again).results[0]!.result).toBe("invited");
    expect(h.invitationMails()).toHaveLength(1);
  });
});

describe("old answers (R13)", () => {
  it("removes a stored answer 24 hours old at the next batch and keeps a younger one", async () => {
    await h.invite(lan, [mail("a")], { key: "old" });
    h.clock.advance(HOUR);
    await h.invite(lan, [mail("b")], { key: "young" });
    h.clock.advance(23 * HOUR);
    await h.invite(lan, [mail("c")], { key: "now" });
    expect((await requests()).map((r) => r.request_key).sort()).toEqual([
      "now",
      "young",
    ]);
  });

  it("removes a stored answer 24 hours old at the next resend", async () => {
    const first = await h.invite(lan, [mail("a")], { key: "old" });
    const id = h.body(first).results[0]!.invitation!.id;
    h.clock.advance(24 * HOUR);
    await h.post(lan, `/invitations/${id}/resend`, undefined, {
      headers: { "idempotency-key": "resend-1" },
    });
    expect((await requests()).map((r) => r.request_key)).toEqual(["resend-1"]);
  });
});
