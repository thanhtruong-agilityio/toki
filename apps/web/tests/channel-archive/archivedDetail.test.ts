import { describe, expect, test } from "vitest";
import { isArchivedMember } from "../../src/channel-archive/archivedDetail";

const summary = {
  id: "c1",
  name: "design",
  topic: null,
  isPrivate: false,
  isGeneral: false,
  archived: true,
  memberCount: 3,
  isMember: true,
};
const detail = {
  ...summary,
  description: null,
  createdBy: "u1",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("isArchivedMember (R13)", () => {
  test("a held detail or summary of an archived channel the person belongs to", () => {
    expect(isArchivedMember(detail)).toBe(true);
    expect(isArchivedMember(summary)).toBe(true);
  });
  test.each([
    ["not a member", { ...summary, isMember: false }],
    ["not archived", { ...summary, archived: false }],
    ["nothing held", undefined],
  ])("%s", (_name, value) => {
    expect(isArchivedMember(value)).toBe(false);
  });
});
