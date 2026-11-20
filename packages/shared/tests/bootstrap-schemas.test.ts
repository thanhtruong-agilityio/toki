import { describe, expect, it } from "vitest";
import {
  BootstrapChannelEntry,
  BootstrapConversation,
  BootstrapPerson,
  BootstrapResponse,
  BootstrapUser,
  DirectConversationEntrySchema,
} from "../src/index.js";

const id = (n: number) =>
  `01930b7e-7a53-7c2e-9f1a-${String(n).padStart(12, "0")}`;

const user = {
  id: id(1),
  email: "sam@example.com",
  displayName: "Sam",
  role: "admin",
  language: "en",
};
const person = {
  id: id(1),
  displayName: "Sam",
  role: "admin",
  status: "active",
};
const channel = {
  id: id(10),
  kind: "channel",
  name: "general",
  topic: null,
  isPrivate: false,
  isGeneral: true,
  notificationLevel: "mentions",
  isMuted: false,
  isStarred: false,
  memberIds: null,
};
const dm = {
  id: id(11),
  kind: "dm",
  name: null,
  topic: null,
  isPrivate: true,
  isGeneral: false,
  notificationLevel: "all",
  isMuted: false,
  isStarred: true,
  memberIds: [id(1), id(2)],
};
const group = {
  ...dm,
  id: id(12),
  kind: "group_dm",
  memberIds: [id(1), id(2), id(3)],
};
const body = () => ({
  user: { ...user },
  workspace: { id: id(5), name: "Acme" },
  members: [{ ...person }],
  conversations: [{ ...channel }, { ...dm }, { ...group }],
  eventNumber: 0,
});
const ok = (value: unknown) => BootstrapResponse.safeParse(value).success;

describe("BootstrapResponse (R2, R17)", () => {
  it("takes a valid body", () => {
    expect(ok(body())).toBe(true);
  });

  it("rejects a missing key, at the top and inside", () => {
    for (const key of [
      "user",
      "workspace",
      "members",
      "conversations",
      "eventNumber",
    ]) {
      const b = body() as Record<string, unknown>;
      delete b[key];
      expect(ok(b), key).toBe(false);
    }
    const b = body();
    delete (b.members[0] as Record<string, unknown>).status;
    expect(ok(b)).toBe(false);
  });

  it("rejects an added key at every level (R2)", () => {
    const top = { ...body(), extra: 1 };
    expect(ok(top)).toBe(false);
    const inUser = body();
    (inUser.user as Record<string, unknown>).extra = 1;
    expect(ok(inUser)).toBe(false);
    const inWorkspace = body();
    (inWorkspace.workspace as Record<string, unknown>).extra = 1;
    expect(ok(inWorkspace)).toBe(false);
    const inMember = body();
    (inMember.members[0] as Record<string, unknown>).extra = 1;
    expect(ok(inMember)).toBe(false);
    for (const i of [0, 1]) {
      const inEntry = body();
      (inEntry.conversations[i] as Record<string, unknown>).extra = 1;
      expect(ok(inEntry), `entry ${i}`).toBe(false);
    }
  });

  it("rejects an event number that is negative or not an integer", () => {
    expect(ok({ ...body(), eventNumber: -1 })).toBe(false);
    expect(ok({ ...body(), eventNumber: 1.5 })).toBe(false);
    expect(ok({ ...body(), eventNumber: 41 })).toBe(true);
  });

  it("has no cursor or limit key (R9)", () => {
    expect(Object.keys(BootstrapResponse.shape).sort()).toEqual([
      "conversations",
      "eventNumber",
      "members",
      "user",
      "workspace",
    ]);
  });
});

describe("BootstrapUser (R3)", () => {
  it("is the User of sign-in made strict", () => {
    expect(BootstrapUser.safeParse(user).success).toBe(true);
    expect(BootstrapUser.safeParse({ ...user, extra: 1 }).success).toBe(false);
    expect(BootstrapUser.safeParse({ ...user, role: "owner" }).success).toBe(
      false,
    );
  });
});

describe("BootstrapPerson (R5)", () => {
  it("has the four keys and the two enums", () => {
    expect(BootstrapPerson.safeParse(person).success).toBe(true);
    expect(
      BootstrapPerson.safeParse({ ...person, email: "a@b.c" }).success,
    ).toBe(false);
    expect(
      BootstrapPerson.safeParse({ ...person, status: "gone" }).success,
    ).toBe(false);
    expect(
      BootstrapPerson.safeParse({ ...person, role: "guest" }).success,
    ).toBe(false);
  });
});

describe("BootstrapConversation (R7, R17)", () => {
  const parse = (v: unknown) => BootstrapConversation.safeParse(v).success;

  it("takes a channel, a dm and a group", () => {
    expect(parse(channel)).toBe(true);
    expect(parse(dm)).toBe(true);
    expect(parse(group)).toBe(true);
  });

  it("uses the entry of TOKI-030 for a dm, not a copy", () => {
    expect(DirectConversationEntrySchema.safeParse(dm).success).toBe(true);
    expect(parse({ ...dm, memberIds: null })).toBe(false);
  });

  it("rejects a wrong kind and a level that is not one of the three", () => {
    expect(parse({ ...channel, kind: "thread" })).toBe(false);
    expect(parse({ ...channel, notificationLevel: "loud" })).toBe(false);
    expect(parse({ ...dm, notificationLevel: "loud" })).toBe(false);
  });

  it("rejects a memberIds that is a non-UUID text, null for a dm, not null for a channel", () => {
    expect(parse({ ...dm, memberIds: [id(1), "not-an-id"] })).toBe(false);
    expect(parse({ ...group, memberIds: ["x", "y", "z"] })).toBe(false);
    expect(parse({ ...channel, memberIds: [id(1)] })).toBe(false);
    expect(
      BootstrapChannelEntry.safeParse({ ...channel, memberIds: [] }).success,
    ).toBe(false);
  });

  it("rejects a name for a dm and a public dm", () => {
    expect(parse({ ...dm, name: "x" })).toBe(false);
    expect(parse({ ...dm, topic: "x" })).toBe(false);
    expect(parse({ ...dm, isPrivate: false })).toBe(false);
    expect(parse({ ...group, isPrivate: false })).toBe(false);
    expect(parse({ ...dm, isGeneral: true })).toBe(false);
  });

  it("needs a name for a channel, and a topic that is text or null", () => {
    expect(parse({ ...channel, name: null })).toBe(false);
    expect(parse({ ...channel, topic: "Plans" })).toBe(true);
    expect(parse({ ...channel, topic: 3 })).toBe(false);
  });
});
