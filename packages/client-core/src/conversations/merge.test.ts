import { describe, expect, it } from "vitest";
import { bootstrapBody, detailBody, id, summaryBody } from "../api/fixtures";
import { contradicted, entryFromChannel, isActiveMember } from "./merge";

describe("entryFromChannel (R13)", () => {
  const held = {
    ...bootstrapBody().conversations[1]!,
    notificationLevel: "all" as const,
    isMuted: true,
    isStarred: true,
  };

  it("takes the name, topic and flags from the detail and the three values from the held entry", () => {
    const entry = entryFromChannel(
      { ...detailBody(11), topic: "New topic" },
      held,
    );
    expect(entry).toEqual({
      id: id(11),
      kind: "channel",
      name: "project-launch",
      topic: "New topic",
      isPrivate: false,
      isGeneral: false,
      notificationLevel: "all",
      isMuted: true,
      isStarred: true,
      memberIds: null,
    });
  });

  it("uses mentions, false, false for an id the store does not hold", () => {
    const entry = entryFromChannel(detailBody(77), undefined);
    expect([entry.notificationLevel, entry.isMuted, entry.isStarred]).toEqual([
      "mentions",
      false,
      false,
    ]);
  });

  it("holds no description, creator, date, archived or member count", () => {
    const entry = entryFromChannel(detailBody(11), held);
    expect(Object.keys(entry).sort()).toEqual(
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
  });

  it("lets given values win over the held ones, key by key", () => {
    const entry = entryFromChannel(detailBody(11), held, { isMuted: false });
    expect([entry.notificationLevel, entry.isMuted, entry.isStarred]).toEqual([
      "all",
      false,
      true,
    ]);
  });
});

describe("contradicted (R14)", () => {
  const member = detailBody(11);
  const archived = { ...detailBody(11), archived: true };
  const stranger = summaryBody(11);
  const notMember = { ...summaryBody(11), isMember: false };

  it("an active member detail is contradicted only when the answer does not list the id", () => {
    expect(isActiveMember(member)).toBe(true);
    expect(contradicted(member, true)).toBe(false);
    expect(contradicted(member, false)).toBe(true);
  });

  it("an archived or not-joined detail is contradicted only when the answer lists the id as joined", () => {
    for (const detail of [
      archived,
      notMember,
      { ...stranger, isMember: false },
    ]) {
      expect(contradicted(detail, false)).toBe(false);
      expect(contradicted(detail, true)).toBe(true);
    }
  });
});
