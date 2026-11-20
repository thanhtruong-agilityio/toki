import { describe, expect, it } from "vitest";
import {
  DIRECT_CONVERSATION_MAX_OTHERS,
  DirectConversationEntrySchema,
  ErrorCodes,
  GROUP_DM_MAX_PEOPLE,
  OpenDirectBodySchema,
  OpenDirectResponseSchema,
  type DirectConversationEntry,
} from "../src/index.js";

const id = (n: number) =>
  `01930b7e-7a53-7c2e-9f1a-${String(n).padStart(12, "0")}`;

describe("DIRECT_CONVERSATION_MAX_OTHERS (R17)", () => {
  it("is the group size minus the caller", () => {
    expect(DIRECT_CONVERSATION_MAX_OTHERS).toBe(GROUP_DM_MAX_PEOPLE - 1);
    expect(DIRECT_CONVERSATION_MAX_OTHERS).toBe(7);
  });
});

describe("OpenDirectBodySchema (R2)", () => {
  const ok = (userIds: unknown) =>
    OpenDirectBodySchema.safeParse({ userIds }).success;

  it("takes 1 and 7 ids, and more: the size rule is the route's (R5)", () => {
    expect(ok([id(1)])).toBe(true);
    expect(ok(Array.from({ length: 7 }, (_, i) => id(i + 1)))).toBe(true);
    expect(ok(Array.from({ length: 8 }, (_, i) => id(i + 1)))).toBe(true);
  });

  it("takes up to 200 ids so the size rule can answer, and refuses more", () => {
    expect(ok(Array.from({ length: 200 }, (_, i) => id(i + 1)))).toBe(true);
    expect(ok(Array.from({ length: 201 }, (_, i) => id(i + 1)))).toBe(false);
  });

  it("takes an id in any letter case", () => {
    expect(ok([id(1).toUpperCase()])).toBe(true);
  });

  it.each([
    ["no key", {}],
    ["an empty list", { userIds: [] }],
    ["a string", { userIds: "x" }],
    ["a number in the list", { userIds: [1] }],
    ["a value that is not a uuid", { userIds: ["nope"] }],
    ["the same id twice", { userIds: [id(1), id(1)] }],
    [
      "the same id in upper and lower case",
      { userIds: [id(1), id(1).toUpperCase()] },
    ],
    ["another key", { userIds: [id(1)], x: 1 }],
  ])("refuses %s", (_label, body) => {
    expect(OpenDirectBodySchema.safeParse(body).success).toBe(false);
  });
});

describe("DirectConversationEntrySchema (R17, R18)", () => {
  const entry: DirectConversationEntry = {
    id: id(1),
    kind: "dm",
    name: null,
    topic: null,
    isPrivate: true,
    isGeneral: false,
    notificationLevel: "all",
    isMuted: false,
    isStarred: false,
    memberIds: [id(2), id(3)],
  };
  const ok = (value: unknown) =>
    DirectConversationEntrySchema.safeParse(value).success;

  it("has exactly the ten keys of the bootstrap entry", () => {
    expect(Object.keys(DirectConversationEntrySchema.shape).sort()).toEqual(
      [
        "id",
        "isGeneral",
        "isMuted",
        "isPrivate",
        "isStarred",
        "kind",
        "memberIds",
        "name",
        "notificationLevel",
        "topic",
      ].sort(),
    );
    expect(ok(entry)).toBe(true);
    expect(ok({ ...entry, kind: "group_dm" })).toBe(true);
  });

  it("refuses an added key, a missing key, a channel, a name, a public entry and a level of loud", () => {
    expect(ok({ ...entry, createdBy: id(2) })).toBe(false);
    const missing: Partial<DirectConversationEntry> = { ...entry };
    delete missing.memberIds;
    expect(ok(missing)).toBe(false);
    expect(ok({ ...entry, kind: "channel" })).toBe(false);
    expect(ok({ ...entry, name: "x" })).toBe(false);
    expect(ok({ ...entry, topic: "x" })).toBe(false);
    expect(ok({ ...entry, isPrivate: false })).toBe(false);
    expect(ok({ ...entry, isGeneral: true })).toBe(false);
    expect(ok({ ...entry, notificationLevel: "loud" })).toBe(false);
  });

  it("is wrapped in the response", () => {
    expect(
      OpenDirectResponseSchema.safeParse({ conversation: entry }).success,
    ).toBe(true);
    expect(OpenDirectResponseSchema.safeParse(entry).success).toBe(false);
  });
});

describe("error registry (R19)", () => {
  it("has the three codes of the direct conversation API", () => {
    expect(ErrorCodes.directWithSelf).toBe("direct_with_self");
    expect(ErrorCodes.groupTooLarge).toBe("group_too_large");
    expect(ErrorCodes.personDeactivated).toBe("person_deactivated");
    const values = Object.values(ErrorCodes);
    expect(new Set(values).size).toBe(values.length);
  });
});
