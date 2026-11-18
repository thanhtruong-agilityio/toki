import { describe, expect, test } from "vitest";
import { derivePane } from "../../src/shell/derivePane";

// R4: all 16 inputs.
describe("derivePane (R4)", () => {
  const bools = [false, true];
  const cases = bools.flatMap((home) =>
    bools.flatMap((chatOpen) =>
      bools.flatMap((panelOpen) =>
        bools.map((hasList) => ({ home, chatOpen, panelOpen, hasList })),
      ),
    ),
  );
  test.each(cases)(
    "home=$home chatOpen=$chatOpen panelOpen=$panelOpen hasList=$hasList",
    ({ home, chatOpen, panelOpen, hasList }) => {
      const expected = panelOpen
        ? "side"
        : home && !chatOpen && hasList
          ? "list"
          : "main";
      expect(
        derivePane({
          section: home ? "home" : "activity",
          chatOpen,
          panelOpen,
          hasList,
        }),
      ).toBe(expected);
    },
  );
  test("there are 16 inputs", () => expect(cases).toHaveLength(16));
});
