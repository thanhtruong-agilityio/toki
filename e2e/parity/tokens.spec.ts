import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { attachRow } from "../support/parity-reporter";
import {
  openPrototype,
  type Accent,
  type Density,
  type Look,
} from "../support/prototype";
import { diffTokens, parseTokenNames, readTokens } from "../support/tokens";

// R3, R4: for each of the 24 combinations, every design value of the app (the preview page of
// TOKI-016, with its own controls) is compared with the same value of the prototype. A difference
// is a row of the report, not a failed test; the test fails only when it could not read a value.
const names = parseTokenNames(
  readFileSync("packages/tokens/src/tokens.css", "utf8"),
);

const looks: Look[] = ["calm", "focus"];
const accents: Accent[] = ["teal", "indigo", "clay", "violet"];
const densities: Density[] = ["own", "comfortable", "compact"];

for (const look of looks) {
  for (const accent of accents) {
    for (const density of densities) {
      const combination = `${look}/${accent}/${density}`;
      test(`tokens ${combination}`, async ({ page, context }, info) => {
        await openPrototype(page, { look, accent, density });
        const prototype = await readTokens(page, names);

        const appPage = await context.newPage();
        await appPage.goto(
          `/preview.html?look=${look}&accent=${accent}&density=${density}`,
        );
        await expect(appPage.getByTestId("preview-root")).toBeVisible();
        const app = await readTokens(appPage, names);

        // Both pages were read: a page that did not load would give only empty values.
        expect(Object.values(prototype).some((value) => value !== "")).toBe(
          true,
        );
        expect(Object.values(app).some((value) => value !== "")).toBe(true);

        const differences = diffTokens(prototype, app);
        if (differences.length === 0) {
          await attachRow(info, {
            kind: "token",
            name: `tokens ${combination}`,
            status: "match",
            detail: { properties: names.length },
          });
        }
        for (const difference of differences) {
          await attachRow(info, {
            kind: "token",
            name: `${difference.property} ${combination}`,
            status: "differs",
            detail: {
              prototype: difference.prototype,
              app: difference.app,
            },
          });
        }
      });
    }
  }
}
