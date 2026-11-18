import { describe, expect, it } from "vitest";
import * as shared from "../index.js";

describe("@toki/shared", () => {
  it("exports every function of the date and time module", () => {
    for (const name of [
      "formatTime",
      "formatDate",
      "formatDay",
      "formatDateTime",
      "formatCountdown",
      "zonedParts",
      "utcOffsetMinutes",
      "isValidTimeZone",
      "atLocalTime",
      "validateDateTime",
      "validateFutureInstant",
      "validateDateNotPast",
      "quickTimeChoices",
    ]) {
      expect(typeof (shared as Record<string, unknown>)[name], name).toBe(
        "function",
      );
    }
  });
});
