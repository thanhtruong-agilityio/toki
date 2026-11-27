import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGE_KINDS, MESSAGE_TEXT_MAX } from "../../src/index.js";

describe("the shared values of a message (TOKI-036 R22)", () => {
  it("exports the text limit of D-042 and the two kinds", () => {
    expect(MESSAGE_TEXT_MAX).toBe(10_000);
    expect(MESSAGE_KINDS).toEqual(["user", "system"]);
  });

  it("has no file src/messages.ts beside the folder", () => {
    const file = new URL("../../src/messages.ts", import.meta.url);
    expect(existsSync(file)).toBe(false);
  });
});
