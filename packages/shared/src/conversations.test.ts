import { describe, expect, it } from "vitest";
import {
  CHANNEL_DESCRIPTION_MAX,
  CHANNEL_NAME_MAX,
  CHANNEL_NAME_PATTERN,
  CHANNEL_TOPIC_MAX,
  GROUP_DM_MAX_PEOPLE,
  NOTIFICATION_LEVELS,
  effectiveNotificationLevel,
  isNotificationLevel,
  isValidChannelDescription,
  isValidChannelTopic,
} from "./conversations.js";

describe("values (R15)", () => {
  it("holds the limits and the levels of the spec", () => {
    expect(CHANNEL_NAME_MAX).toBe(80);
    expect(CHANNEL_TOPIC_MAX).toBe(250);
    expect(CHANNEL_DESCRIPTION_MAX).toBe(500);
    expect(GROUP_DM_MAX_PEOPLE).toBe(8);
    expect([...NOTIFICATION_LEVELS]).toEqual(["all", "mentions", "none"]);
  });
});

describe("CHANNEL_NAME_PATTERN (R3)", () => {
  const ok = ["qa-team", "a", "a".repeat(80), "0-9"];
  const bad = ["", "a".repeat(81), "Q&A Team!", "qa team", "QA", "qa_team"];
  it.each(ok)("accepts %j", (name) => {
    expect(CHANNEL_NAME_PATTERN.test(name)).toBe(true);
  });
  it.each(bad)("refuses %j", (name) => {
    expect(CHANNEL_NAME_PATTERN.test(name)).toBe(false);
  });
  it("is not global, so test() keeps no state between calls", () => {
    expect(CHANNEL_NAME_PATTERN.global).toBe(false);
  });
});

describe.each([
  ["isValidChannelTopic", isValidChannelTopic, 250],
  ["isValidChannelDescription", isValidChannelDescription, 500],
] as const)("%s (R6, R7)", (_name, fn, max) => {
  it("accepts null", () => {
    expect(fn(null)).toBe(true);
  });
  it("refuses the empty string", () => {
    expect(fn("")).toBe(false);
  });
  it("counts letters: max accepted, max + 1 refused", () => {
    expect(fn("a".repeat(max))).toBe(true);
    expect(fn("a".repeat(max + 1))).toBe(false);
  });
  it("counts Vietnamese text in code points", () => {
    expect(fn("ệ".repeat(max))).toBe(true);
    expect(fn("ệ".repeat(max + 1))).toBe(false);
  });
  it("counts emoji outside the BMP as one each", () => {
    expect(fn("😀".repeat(max))).toBe(true);
    expect(fn("😀".repeat(max + 1))).toBe(false);
  });
  it("refuses a value that is not a string or null", () => {
    expect(fn(undefined as never)).toBe(false);
    expect(fn(5 as never)).toBe(false);
  });
});

describe("isNotificationLevel", () => {
  it("accepts the three levels and refuses anything else", () => {
    for (const level of NOTIFICATION_LEVELS) {
      expect(isNotificationLevel(level)).toBe(true);
    }
    for (const bad of ["loud", "nothing", "", null, undefined, 1]) {
      expect(isNotificationLevel(bad)).toBe(false);
    }
  });
});

describe("effectiveNotificationLevel (R14)", () => {
  it("defaults to mentions for a channel", () => {
    expect(effectiveNotificationLevel("channel", null)).toBe("mentions");
  });
  it("defaults to all for a DM and a group", () => {
    expect(effectiveNotificationLevel("dm", null)).toBe("all");
    expect(effectiveNotificationLevel("group_dm", null)).toBe("all");
  });
  it("returns the stored level when there is one", () => {
    expect(effectiveNotificationLevel("channel", "none")).toBe("none");
    expect(effectiveNotificationLevel("dm", "mentions")).toBe("mentions");
  });
});
