import { describe, expect, it } from "vitest";
import {
  AddMembersBodySchema,
  BrowseChannelsQuerySchema,
  CHANNEL_BROWSE_PAGE_DEFAULT,
  CHANNEL_BROWSE_PAGE_MAX,
  CHANNEL_MEMBERS_ADD_MAX,
  ChannelDetailSchema,
  ChannelIdSchema,
  ChannelMembersQuerySchema,
  ChannelResponseSchema,
  ChannelSummarySchema,
  CreateChannelBodySchema,
  EditChannelBodySchema,
  JoinChannelBodySchema,
  UpdateSettingsBodySchema,
  UpdateSettingsResponseSchema,
} from "../../src/channels/index.js";

const v7 = "01930b7e-7a53-7c2e-9f1a-0123456789ab";
const v4 = "7d1c3b2a-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const person = (n: number) =>
  `01930b7e-7a53-7c2e-9f1a-${String(n).padStart(12, "0")}`;

describe("limits (R17)", () => {
  it("holds the numbers of the spec", () => {
    expect(CHANNEL_BROWSE_PAGE_DEFAULT).toBe(50);
    expect(CHANNEL_BROWSE_PAGE_MAX).toBe(100);
    expect(CHANNEL_MEMBERS_ADD_MAX).toBe(200);
  });
});

describe("ChannelIdSchema", () => {
  it("accepts a lower-case uuid of any version", () => {
    expect(ChannelIdSchema.safeParse(v7).success).toBe(true);
    expect(ChannelIdSchema.safeParse(v4).success).toBe(true);
  });
  it.each(["", "abc", v7.toUpperCase(), `${v7}x`, "a/b"])(
    "refuses %j",
    (value) => {
      expect(ChannelIdSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("CreateChannelBodySchema (R3, R4)", () => {
  const ok = (extra: object = {}) =>
    CreateChannelBodySchema.safeParse({ id: v7, name: "qa-team", ...extra });

  it("accepts the smallest body and keeps the optional keys absent", () => {
    const parsed = ok();
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data).toEqual({ id: v7, name: "qa-team" });
  });
  it("refuses a version-4 id and an upper-case id", () => {
    expect(
      CreateChannelBodySchema.safeParse({ id: v4, name: "a" }).success,
    ).toBe(false);
    expect(
      CreateChannelBodySchema.safeParse({ id: v7.toUpperCase(), name: "a" })
        .success,
    ).toBe(false);
  });
  it.each([
    ["80 characters", "a".repeat(80), true],
    ["81 characters", "a".repeat(81), false],
    ["empty", "", false],
    ["Q&A Team!", "Q&A Team!", false],
    ["QA", "QA", false],
    ["qa team", "qa team", false],
  ])("name %s", (_label, name, accepted) => {
    expect(CreateChannelBodySchema.safeParse({ id: v7, name }).success).toBe(
      accepted,
    );
  });
  it("trims the topic and turns an empty one into null", () => {
    const blank = ok({ topic: "   " });
    const padded = ok({ topic: "  release  " });
    expect(blank.success && blank.data.topic).toBe(null);
    expect(padded.success && padded.data.topic).toBe("release");
    expect(ok({ topic: null }).success).toBe(true);
  });
  it("counts the topic in code points", () => {
    expect(ok({ topic: "a".repeat(250) }).success).toBe(true);
    expect(ok({ topic: "a".repeat(251) }).success).toBe(false);
    expect(ok({ topic: "😀".repeat(250) }).success).toBe(true);
    expect(ok({ topic: "😀".repeat(251) }).success).toBe(false);
  });
  it("takes 0 to 200 lower-case member ids", () => {
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => person(i + 1));
    expect(ok({ memberIds: [] }).success).toBe(true);
    expect(ok({ memberIds: ids(200) }).success).toBe(true);
    expect(ok({ memberIds: ids(201) }).success).toBe(false);
    expect(ok({ memberIds: [v7.toUpperCase()] }).success).toBe(false);
  });
  it("refuses an unknown key and a non-boolean isPrivate", () => {
    expect(ok({ kind: "dm" }).success).toBe(false);
    expect(ok({ isPrivate: "yes" }).success).toBe(false);
    expect(ok({ isPrivate: true }).success).toBe(true);
  });
});

describe("EditChannelBodySchema (R9)", () => {
  it("needs one of topic and description and refuses every other key", () => {
    expect(EditChannelBodySchema.safeParse({}).success).toBe(false);
    expect(EditChannelBodySchema.safeParse({ topic: "x" }).success).toBe(true);
    expect(EditChannelBodySchema.safeParse({ description: null }).success).toBe(
      true,
    );
    for (const key of ["name", "isPrivate", "kind"]) {
      expect(
        EditChannelBodySchema.safeParse({ topic: "x", [key]: "a" }).success,
      ).toBe(false);
    }
  });
  it("trims to null and holds the limits", () => {
    const blank = EditChannelBodySchema.safeParse({
      topic: " ",
      description: "\n",
    });
    expect(blank.success && blank.data).toEqual({
      topic: null,
      description: null,
    });
    expect(
      EditChannelBodySchema.safeParse({ description: "a".repeat(500) }).success,
    ).toBe(true);
    expect(
      EditChannelBodySchema.safeParse({ description: "a".repeat(501) }).success,
    ).toBe(false);
    expect(
      EditChannelBodySchema.safeParse({ topic: "a".repeat(251) }).success,
    ).toBe(false);
  });
});

describe("queries (R6, R8)", () => {
  it("defaults and bounds limit, and bounds search", () => {
    const empty = BrowseChannelsQuerySchema.parse({});
    expect(empty.limit).toBe(50);
    expect(BrowseChannelsQuerySchema.parse({ limit: "1" }).limit).toBe(1);
    expect(BrowseChannelsQuerySchema.parse({ limit: "100" }).limit).toBe(100);
    for (const limit of ["0", "101", "-1", "x", "1.5"]) {
      expect(BrowseChannelsQuerySchema.safeParse({ limit }).success).toBe(
        false,
      );
    }
    expect(
      BrowseChannelsQuerySchema.safeParse({ search: "a".repeat(80) }).success,
    ).toBe(true);
    expect(
      BrowseChannelsQuerySchema.safeParse({ search: "a".repeat(81) }).success,
    ).toBe(false);
    expect(BrowseChannelsQuerySchema.safeParse({ other: "1" }).success).toBe(
      false,
    );
  });
  it("gives the member list the same limit rule and no search", () => {
    expect(ChannelMembersQuerySchema.parse({}).limit).toBe(50);
    expect(ChannelMembersQuerySchema.safeParse({ limit: "101" }).success).toBe(
      false,
    );
    expect(ChannelMembersQuerySchema.safeParse({ search: "a" }).success).toBe(
      false,
    );
  });
});

describe("AddMembersBodySchema (R11)", () => {
  it("takes 1 to 200 lower-case ids", () => {
    const ids = (n: number) =>
      Array.from({ length: n }, (_, i) => person(i + 1));
    expect(AddMembersBodySchema.safeParse({ userIds: [] }).success).toBe(false);
    expect(AddMembersBodySchema.safeParse({ userIds: ids(1) }).success).toBe(
      true,
    );
    expect(AddMembersBodySchema.safeParse({ userIds: ids(200) }).success).toBe(
      true,
    );
    expect(AddMembersBodySchema.safeParse({ userIds: ids(201) }).success).toBe(
      false,
    );
    expect(
      AddMembersBodySchema.safeParse({ userIds: [v7.toUpperCase()] }).success,
    ).toBe(false);
    expect(
      AddMembersBodySchema.safeParse({ userIds: ids(1), x: 1 }).success,
    ).toBe(false);
  });
});

describe("settings (R10, R22)", () => {
  it("accepts a join body with no key, or with settings, and nothing else", () => {
    expect(JoinChannelBodySchema.safeParse({}).success).toBe(true);
    expect(JoinChannelBodySchema.safeParse({ settings: {} }).success).toBe(
      true,
    );
    expect(
      JoinChannelBodySchema.safeParse({
        settings: { notificationLevel: "all", isMuted: true, isStarred: false },
      }).success,
    ).toBe(true);
    expect(JoinChannelBodySchema.safeParse({ x: 1 }).success).toBe(false);
    expect(
      JoinChannelBodySchema.safeParse({ settings: { x: 1 } }).success,
    ).toBe(false);
    expect(
      JoinChannelBodySchema.safeParse({
        settings: { notificationLevel: "loud" },
      }).success,
    ).toBe(false);
  });
  it("needs at least one key on the settings route", () => {
    expect(UpdateSettingsBodySchema.safeParse({}).success).toBe(false);
    expect(
      UpdateSettingsBodySchema.safeParse({ isStarred: true }).success,
    ).toBe(true);
    expect(
      UpdateSettingsBodySchema.safeParse({ notificationLevel: "none" }).success,
    ).toBe(true);
    expect(
      UpdateSettingsBodySchema.safeParse({ notificationLevel: "loud" }).success,
    ).toBe(false);
    expect(UpdateSettingsBodySchema.safeParse({ isMuted: "no" }).success).toBe(
      false,
    );
    expect(
      UpdateSettingsBodySchema.safeParse({ isMuted: true, x: 1 }).success,
    ).toBe(false);
  });
  it("answers with the three values and changed", () => {
    expect(
      UpdateSettingsResponseSchema.safeParse({
        settings: {
          notificationLevel: "mentions",
          isMuted: false,
          isStarred: false,
        },
        changed: false,
      }).success,
    ).toBe(true);
  });
});

describe("responses (R7)", () => {
  const summary = {
    id: v7,
    name: "qa-team",
    topic: null,
    isPrivate: false,
    isGeneral: false,
    archived: false,
    memberCount: 3,
    isMember: true,
  };
  const detail = {
    ...summary,
    description: null,
    createdBy: person(1),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  it("tells a summary from a detail and refuses an added key", () => {
    expect(ChannelSummarySchema.safeParse(summary).success).toBe(true);
    expect(ChannelDetailSchema.safeParse(detail).success).toBe(true);
    expect(ChannelDetailSchema.safeParse(summary).success).toBe(false);
    expect(ChannelSummarySchema.safeParse({ ...summary, x: 1 }).success).toBe(
      false,
    );
    expect(ChannelResponseSchema.safeParse(detail).success).toBe(true);
    expect(ChannelResponseSchema.safeParse(summary).success).toBe(true);
    expect(ChannelResponseSchema.safeParse({ ...detail, x: 1 }).success).toBe(
      false,
    );
  });
});
