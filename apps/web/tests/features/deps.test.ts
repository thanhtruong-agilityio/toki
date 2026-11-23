import { describe, expect, test } from "vitest";
import { ownSources } from "./support";

// TOKI-034 R2: `deps.ts` is the only file of this change that imports the
// client package or the client.
describe("the seam (R2)", () => {
  test("the scan sees an import of the client (negative control)", () => {
    expect(hasClientImport('import { api } from "../client";')).toBe(true);
    expect(hasClientImport('import x from "@toki/client-core";')).toBe(true);
    expect(hasClientImport('import x from "./deps";')).toBe(false);
  });

  test("no own file but deps.ts imports @toki/client-core or the client", () => {
    for (const file of ownSources()) {
      if (file.name === "deps.ts") continue;
      expect(hasClientImport(file.text), file.name).toBe(false);
    }
  });

  test("deps.ts exists and exports the names of Table N", async () => {
    const deps = (await import("../../src/features/deps")) as Record<
      string,
      unknown
    >;
    for (const name of [
      "api",
      "conversations",
      "ApiError",
      "useConversationSelector",
      "personHue",
      "useRegisterListActions",
      "usePeople",
      "useCurrentUserId",
    ]) {
      expect(deps, name).toHaveProperty(name);
    }
  });
});

function hasClientImport(text: string): boolean {
  return /from\s+["'](?:@toki\/client-core|(?:\.\.?\/)+client)["']/.test(text);
}
