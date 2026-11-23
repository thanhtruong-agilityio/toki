import { describe, expect, test } from "vitest";
import { browseRowAction } from "../../../src/features/channels/browseRows";

const channel = (over: Record<string, unknown>) =>
  ({
    id: "c1",
    name: "design",
    topic: null,
    isPrivate: false,
    isGeneral: false,
    archived: false,
    memberCount: 3,
    isMember: false,
    ...over,
  }) as Parameters<typeof browseRowAction>[0];

describe("browseRowAction (TOKI-034 R7)", () => {
  test.each([
    // isMember, archived, isPrivate -> action
    [true, false, false, "open"],
    [true, false, true, "open"],
    [true, true, false, "open"],
    [false, false, false, "join"],
    [false, true, false, "none"],
    // a private channel the person is not in never reaches the client; the rule still holds
    [false, true, true, "none"],
  ] as const)(
    "isMember %s, archived %s, isPrivate %s gives %s",
    (isMember, archived, isPrivate, action) => {
      expect(browseRowAction(channel({ isMember, archived, isPrivate }))).toBe(
        action,
      );
    },
  );
});
