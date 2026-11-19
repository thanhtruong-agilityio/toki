import { describe, expect, it } from "vitest";
import { toConversationFacts } from "../../src/modules/conversations/facts.js";

const base = { isGeneral: false, archivedAt: null, isMember: false } as const;

describe("toConversationFacts (R18 mapping table)", () => {
  it("maps a public channel", () => {
    expect(
      toConversationFacts({ ...base, kind: "channel", isPrivate: false }),
    ).toEqual({
      kind: "public_channel",
      isGeneral: false,
      archived: false,
      isMember: false,
    });
  });
  it("maps a private channel", () => {
    expect(
      toConversationFacts({ ...base, kind: "channel", isPrivate: true }).kind,
    ).toBe("private_channel");
  });
  it("maps a DM and a group (always private)", () => {
    expect(
      toConversationFacts({ ...base, kind: "dm", isPrivate: true }).kind,
    ).toBe("dm");
    expect(
      toConversationFacts({ ...base, kind: "group_dm", isPrivate: true }).kind,
    ).toBe("group_dm");
  });
  it("maps #general, an archived channel and membership", () => {
    const general = toConversationFacts({
      ...base,
      kind: "channel",
      isPrivate: false,
      isGeneral: true,
      isMember: true,
    });
    expect(general).toEqual({
      kind: "public_channel",
      isGeneral: true,
      archived: false,
      isMember: true,
    });
    const archived = toConversationFacts({
      ...base,
      kind: "channel",
      isPrivate: true,
      archivedAt: new Date(),
    });
    expect(archived.archived).toBe(true);
  });
  it("refuses a kind it cannot name", () => {
    expect(() =>
      toConversationFacts({ ...base, kind: "other", isPrivate: false }),
    ).toThrow(/unknown kind/);
  });
});
