import { describe, expect, test } from "vitest";
import {
  canOfferArchive,
  canOfferRestore,
} from "../../src/channel-archive/access";

const admin = { id: "a", role: "admin" };
const member = { id: "m", role: "member" };

type Channel = Parameters<typeof canOfferArchive>[0]["channel"];
const ch = (over: Partial<Channel> = {}): Channel => ({
  isPrivate: false,
  isGeneral: false,
  archived: false,
  isMember: true,
  ...over,
});

describe("canOfferArchive (R6)", () => {
  test.each<[string, Parameters<typeof canOfferArchive>[0], boolean]>([
    ["Admin member of a public channel", { actor: admin, channel: ch() }, true],
    [
      "Admin member of a private channel",
      { actor: admin, channel: ch({ isPrivate: true }) },
      true,
    ],
    [
      "Admin member of #general",
      { actor: admin, channel: ch({ isGeneral: true }) },
      false,
    ],
    [
      "Admin who is not a member",
      { actor: admin, channel: ch({ isMember: false }) },
      false,
    ],
    ["Member who is a member", { actor: member, channel: ch() }, false],
    [
      "Admin member of an archived channel",
      { actor: admin, channel: ch({ archived: true }) },
      false,
    ],
    [
      "archived undefined (detail not held)",
      { actor: admin, channel: ch({ archived: undefined }) },
      false,
    ],
    ["a missing actor", { actor: null, channel: ch() }, false],
    [
      "a role that is neither admin nor member",
      { actor: { id: "x", role: "guest" }, channel: ch() },
      false,
    ],
  ])("%s -> %s", (_name, input, expected) => {
    expect(canOfferArchive(input)).toBe(expected);
  });
});

describe("canOfferRestore (R7)", () => {
  const arch = (over: Partial<Channel> = {}) => ch({ archived: true, ...over });
  test.each<[string, Parameters<typeof canOfferRestore>[0], boolean]>([
    [
      "Admin member of an archived public channel",
      { actor: admin, channel: arch() },
      true,
    ],
    [
      "Admin member of an archived private channel",
      { actor: admin, channel: arch({ isPrivate: true }) },
      true,
    ],
    [
      "Admin who is not a member of an archived public channel",
      { actor: admin, channel: arch({ isMember: false }) },
      true,
    ],
    ["Member", { actor: member, channel: arch() }, false],
    ["an active channel", { actor: admin, channel: ch() }, false],
    [
      "archived undefined",
      { actor: admin, channel: arch({ archived: undefined }) },
      false,
    ],
    ["a null actor", { actor: null, channel: arch() }, false],
    ["#general", { actor: admin, channel: arch({ isGeneral: true }) }, false],
  ])("%s -> %s", (_name, input, expected) => {
    expect(canOfferRestore(input)).toBe(expected);
  });
});
