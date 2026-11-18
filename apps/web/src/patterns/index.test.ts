import { describe, expect, it } from "vitest";
import * as patterns from "./index";

describe("the exports of patterns/ (R1)", () => {
  it.each([
    "actionPatterns",
    "useUndo",
    "useOnlineGate",
    "setConnectionCheck",
    "ConfirmAction",
    "useFormGuard",
    "hasFormContent",
    "GUARD_ESCAPE",
  ])("exports %s", (name) => {
    expect(patterns).toHaveProperty(name);
  });

  it("GUARD_ESCAPE is the proposal of concern 1", () => {
    expect(patterns.GUARD_ESCAPE).toBe("ask");
  });
});
