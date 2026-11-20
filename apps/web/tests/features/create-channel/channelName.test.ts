import { CHANNEL_NAME_PATTERN } from "@toki/shared";
import { describe, expect, test } from "vitest";
import {
  normalizeChannelName,
  validateChannelName,
  validateChannelTopic,
} from "../../../src/features/create-channel/channelName";

describe("normalizeChannelName (R6)", () => {
  test.each([
    ["Q A", "q-a"],
    ["  ", "--"],
    ["a\tb", "a-b"],
    ["a b", "a-b"],
    ["ÉCOLE", "école"],
    ["a&b", "a&b"],
    ["", ""],
    ["qa-team ", "qa-team-"],
  ])("%j gives %j", (text, expected) => {
    expect(normalizeChannelName(text)).toBe(expected);
  });
});

describe("validateChannelName (R7)", () => {
  const names: Array<[string, "invalid" | "tooLong" | null | "ok"]> = [
    ["qa-team", "ok"],
    ["a".repeat(80), "ok"],
    ["a".repeat(81), "tooLong"],
    ["q&a-team!", "invalid"],
    ["qa_team", "invalid"],
    ["-", "ok"],
    ["0", "ok"],
    ["école", "invalid"],
    ["😀", "invalid"],
    ["", null],
    // too long and with a bad character: the character is what the person fixes first
    ["&" + "a".repeat(90), "invalid"],
  ];
  test.each(names)("%j", (name, expected) => {
    const verdict = validateChannelName(name);
    expect(verdict.valid).toBe(CHANNEL_NAME_PATTERN.test(name));
    if (expected === "ok") expect(verdict).toEqual({ valid: true });
    else expect(verdict).toEqual({ valid: false, message: expected });
  });
});

describe("validateChannelTopic (R8)", () => {
  test("empty and white space alone are valid and send no topic", () => {
    expect(validateChannelTopic("")).toEqual({ valid: true, topic: null });
    expect(validateChannelTopic("   \n ")).toEqual({
      valid: true,
      topic: null,
    });
  });
  test("is trimmed", () => {
    expect(validateChannelTopic("  hi  ")).toEqual({
      valid: true,
      topic: "hi",
    });
  });
  test("250 characters and 250 emoji are valid, 251 are not", () => {
    expect(validateChannelTopic("a".repeat(250)).valid).toBe(true);
    expect(validateChannelTopic("😀".repeat(250)).valid).toBe(true);
    expect(validateChannelTopic("a".repeat(251))).toEqual({ valid: false });
    expect(validateChannelTopic("😀".repeat(251))).toEqual({ valid: false });
  });
});
