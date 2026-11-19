import { describe, expect, it } from "vitest";
import { translate, type MessageKey } from "../src/translate";

// R8: these lines are checked by `pnpm typecheck`; a line that stops being an error fails it.
describe("MessageKey (R8)", () => {
  it("rejects a key the English catalog does not have", () => {
    // @ts-expect-error nav.nope is not a key
    const text = translate("en", "nav.nope");
    expect(typeof text).toBe("string");
  });

  it("rejects a wrong entry in a map typed with MessageKey", () => {
    const codes: Record<"a" | "b", MessageKey> = {
      a: "nav.home",
      // @ts-expect-error nav.nope is not a key
      b: "nav.nope",
    };
    expect(codes.a).toBe("nav.home");
  });

  it("rejects a group as a key", () => {
    // @ts-expect-error nav is a namespace, not a text
    expect(typeof translate("en", "nav")).toBe("string");
  });
});
