import { describe, expectTypeOf, it } from "vitest";
import type { ConversationFacts } from "../index.js";

// expectTypeOf checks nothing at runtime: `pnpm typecheck` (tsc over src, test
// files included) is what fails when the type drifts.
describe("ConversationFacts (TOKI-027 R2)", () => {
  it("has the four facts and the four kinds", () => {
    expectTypeOf<ConversationFacts>().toEqualTypeOf<{
      kind: "public_channel" | "private_channel" | "dm" | "group_dm";
      isGeneral: boolean;
      archived: boolean;
      isMember: boolean;
    }>();
  });
});
