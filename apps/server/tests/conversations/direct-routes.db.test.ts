import { ErrorResponseSchema, OpenDirectResponseSchema } from "@toki/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHarness, type Harness } from "../auth/test-harness.js";
import {
  bystander,
  jsonOf,
  person,
  send,
  type Person,
} from "./channel-helpers.js";

const URL_PATH = "/api/v1/direct-conversations";
let h: Harness;
let admin: Person;
let member: Person;
const used: string[] = [];
beforeAll(async () => {
  h = await createHarness();
  admin = await person(h, "r-admin", "admin");
  member = await person(h, "r-member");
});
afterAll(async () => {
  await h?.close();
});

const post = (who: Person, body?: unknown) =>
  send(h, who, "POST", URL_PATH, body);
const tables = async () => ({
  conversations: await h.sql`select * from conversations order by id`,
  members:
    await h.sql`select * from conversation_members order by conversation_id, user_id`,
});
// The row count of every table other than the two the route writes.
const otherCounts = async () => {
  const names = await h.sql<{ table_name: string }[]>`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name not in ('conversations', 'conversation_members')
    order by table_name`;
  const out: Record<string, number> = {};
  for (const { table_name } of names) {
    const [r] = await h.sql.unsafe<{ n: number }[]>(
      `select count(*)::int as n from "${table_name}"`,
    );
    out[table_name] = r!.n;
  }
  return out;
};
const errorOf = (res: { body: string }) => {
  const parsed = ErrorResponseSchema.safeParse(JSON.parse(res.body));
  expect(parsed.success, res.body).toBe(true);
  return jsonOf(res).error;
};
const okBody = (res: { body: string }) => {
  const parsed = OpenDirectResponseSchema.safeParse(JSON.parse(res.body));
  expect(parsed.success, res.body).toBe(true);
  return jsonOf(res).conversation;
};

describe("the route (R1)", () => {
  it("is registered once, as one POST path, in the app built by buildApp", () => {
    expect(h.app.hasRoute({ method: "POST", url: URL_PATH })).toBe(true);
    const printed = h.app.printRoutes({ commonPrefix: false });
    expect(printed.match(/direct-conversations/g)).toHaveLength(1);
  });

  it("answers 401 without a session, with an unknown secret and with an ended session, and writes nothing", async () => {
    const before = await tables();
    const body = { userIds: [member.id] };
    const none = await h.call({ method: "POST", url: URL_PATH, payload: body });
    expect(none.statusCode).toBe(401);
    expect(errorOf(none).code).toBe("unauthenticated");
    const wrong = await h.call({
      method: "POST",
      url: URL_PATH,
      payload: body,
      headers: h.withCookie("x".repeat(40)),
    });
    expect(wrong.statusCode).toBe(401);
    const ended = await person(h, "r-ended");
    await h.sql`update sessions set ended_at = now(), ended_reason = 'signed_out' where user_id = ${ended.id}`;
    const res = await post(ended, body);
    expect(res.statusCode).toBe(401);
    expect(errorOf(res).code).toBe("session_ended");
    expect(await tables()).toEqual(before);
  });

  it("a deactivated account is 401 account_deactivated", async () => {
    const gone = await person(h, "r-gone");
    await h.sql`update users set status = 'deactivated' where id = ${gone.id}`;
    const res = await post(gone, { userIds: [member.id] });
    expect(res.statusCode).toBe(401);
    expect(errorOf(res).code).toBe("account_deactivated");
  });

  it("takes the id and role of the signed-in account: the caller is in the key, whoever the body names", async () => {
    const other = await bystander(h, "r-other");
    used.push(other);
    const res = await post(admin, { userIds: [other] });
    expect(res.statusCode).toBe(201);
    const c = okBody(res);
    expect(c.memberIds.sort()).toEqual([admin.id, other].sort());
  });
});

describe("the body (R2)", () => {
  it("a request with no body and no content type is 400 validation_failed", async () => {
    const before = await tables();
    const res = await h.call({
      method: "POST",
      url: URL_PATH,
      headers: admin.headers,
    });
    expect(res.statusCode).toBe(400);
    expect(errorOf(res).code).toBe("validation_failed");
    expect(await tables()).toEqual(before);
  });

  it("a form-encoded body is 415 and a foreign Origin is 403", async () => {
    const form = await h.call({
      method: "POST",
      url: URL_PATH,
      headers: {
        ...admin.headers,
        "content-type": "application/x-www-form-urlencoded",
      },
      payload: "userIds=1",
    });
    expect(form.statusCode).toBe(415);
    expect(errorOf(form).code).toBe("unsupported_media_type");
    const foreign = await h.call({
      method: "POST",
      url: URL_PATH,
      headers: { ...admin.headers, origin: "https://evil.example" },
      payload: { userIds: [member.id] },
    });
    expect(foreign.statusCode).toBe(403);
    expect(errorOf(foreign).code).toBe("origin_not_allowed");
  });

  it.each([
    ["{}", {}],
    ["an empty list", { userIds: [] }],
    ["a string", { userIds: "x" }],
    ["a number in the list", { userIds: [1] }],
    ["a value that is not a uuid", { userIds: ["nope"] }],
    [
      "the same id twice",
      {
        userIds: [
          "01930b7e-7a53-7c2e-9f1a-000000000001",
          "01930b7e-7a53-7c2e-9f1a-000000000001",
        ],
      },
    ],
    [
      "the same id in two cases",
      {
        userIds: [
          "01930b7e-7a53-7c2e-9f1a-0000000000aa",
          "01930b7e-7a53-7c2e-9f1a-0000000000AA",
        ],
      },
    ],
  ])(
    "refuses %s with 400 validation_failed and changes nothing",
    async (_l, body) => {
      const before = await tables();
      const res = await post(admin, body);
      expect(res.statusCode).toBe(400);
      expect(errorOf(res).code).toBe("validation_failed");
      expect(res.body).not.toContain("nope");
      expect(await tables()).toEqual(before);
    },
  );

  it("a list of 1 id and a list of 7 ids pass the schema", async () => {
    const p = await person(h, "r-seven");
    const seven = await Promise.all(
      Array.from({ length: 7 }, (_, i) => bystander(h, `r-s${i}`)),
    );
    used.push(...seven);
    expect((await post(p, { userIds: [seven[0]] })).statusCode).toBe(201);
    expect((await post(p, { userIds: seven })).statusCode).toBe(201);
  });
});

describe("the outcomes (R3, R5, R6, R9, R10)", () => {
  it("201 then 200 with the same id and the same shape, and nothing else written", async () => {
    const p = await person(h, "r-pair-a");
    const q = await bystander(h, "r-pair-b");
    used.push(q);
    const others = await otherCounts();
    const first = await post(p, { userIds: [q] });
    const second = await post(p, { userIds: [q.toUpperCase()] });
    expect([first.statusCode, second.statusCode]).toEqual([201, 200]);
    expect(okBody(second).id).toBe(okBody(first).id);
    expect(await otherCounts()).toEqual(others);
  });

  it("400 group_too_large with details, 400 direct_with_self, 404 not_found, 409 person_deactivated with details", async () => {
    const p = await person(h, "r-codes");
    const before = await tables();
    const eight = Array.from({ length: 8 }, () => crypto.randomUUID());
    const big = await post(p, { userIds: eight });
    expect(big.statusCode).toBe(400);
    expect(errorOf(big)).toMatchObject({
      code: "group_too_large",
      details: { max: 8, maxOthers: 7 },
    });
    const self = await post(p, { userIds: [p.id] });
    expect(errorOf(self).code).toBe("direct_with_self");
    expect(self.statusCode).toBe(400);
    const unknown = await post(p, { userIds: [crypto.randomUUID()] });
    expect(unknown.statusCode).toBe(404);
    expect(errorOf(unknown)).toMatchObject({ code: "not_found" });
    expect(errorOf(unknown).details).toBeUndefined();
    const gone = await bystander(h, "r-gone-2", { status: "deactivated" });
    const deactivated = await post(p, { userIds: [gone] });
    expect(deactivated.statusCode).toBe(409);
    expect(errorOf(deactivated)).toMatchObject({
      code: "person_deactivated",
      details: { userIds: [gone] },
    });
    expect(await tables()).toEqual(before);
  });

  it("the order of the checks: 8 ids that do not exist are group_too_large; self with an unknown id is direct_with_self; an existing set with a deactivated person is 200", async () => {
    const p = await person(h, "r-order");
    const b = await bystander(h, "r-order-b");
    await post(p, { userIds: [b] });
    await h.sql`update users set status = 'deactivated' where id = ${b}`;
    const again = await post(p, { userIds: [b] });
    expect(again.statusCode).toBe(200);
    const mixed = await post(p, { userIds: [p.id, crypto.randomUUID()] });
    expect(errorOf(mixed).code).toBe("direct_with_self");
  });
});

describe("no other effect (R20, R21)", () => {
  it("the log holds no id from userIds", () => {
    const log = h.logText();
    expect(log).toContain("request completed");
    for (const id of used) expect(log).not.toContain(id);
  });
});
