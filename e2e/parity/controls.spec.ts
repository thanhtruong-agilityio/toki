import { expect, test } from "@playwright/test";
import {
  captureElement,
  compareImages,
  expandScreens,
  runSteps,
  screenRow,
} from "../support/parity";
import { openPrototype } from "../support/prototype";
import { LIMITS } from "./limits";

// The control tests of the screen check (R7, R9, R11, R13). They use the prototype alone, so they
// prove the capture and the comparison before any screen of the app is declared (deviation 3).

const every = expandScreens([
  { id: "control", section: "admin", appRoute: "/" },
]);

for (const { look, width, name } of every) {
  // R7: with the clock fixed, animations off and the fonts ready, two captures of the same state
  // are the same, pixel for pixel.
  test(`the prototype twice is identical: ${name}`, async ({ page }, info) => {
    await openPrototype(page, { look, width, hash: "admin" });
    const first = await captureElement(page, "#app", []);
    await openPrototype(page, { look, width, hash: "admin" });
    const second = await captureElement(page, "#app", []);
    await info.attach(`prototype-admin-${look}-${width}`, {
      body: first,
      contentType: "image/png",
    });
    const result = compareImages(first, second);
    expect(result.sameSize).toBe(true);
    expect(result.ratio).toBe(0);
  });
}

// R9, R11: a change that repaints most of the capture is above the limit, has a box, and gives a
// row that says where.
test("a changed surface colour gives a difference row", async ({ page }) => {
  await openPrototype(page, { look: "calm", width: "wide", hash: "admin" });
  const before = await captureElement(page, "#app", []);
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--surface", "#ff0000"),
  );
  const after = await captureElement(page, "#app", []);
  const result = compareImages(before, after);
  expect(result.ratio).toBeGreaterThan(LIMITS.ratio);
  expect(result.box).not.toBeNull();
  const row = screenRow("control/calm/wide", result, LIMITS.ratio, [
    "images/control-reference.png",
    "images/control-app.png",
    "images/control-diff.png",
  ]);
  expect(row.status).toBe("differs");
  expect(row.name).toBe("control/calm/wide");
  expect(row.detail).toMatchObject({ limit: LIMITS.ratio });
  expect(row.images).toHaveLength(3);
});

// R13: a step that cannot be done fails and names the screen, the step and the selector.
test("a wrong selector fails with the screen, the step and the selector", async ({
  page,
}) => {
  await openPrototype(page, { look: "calm", width: "wide", hash: "admin" });
  await expect(
    runSteps(page, "demo", [{ press: "Tab" }, { click: "#nope" }]),
  ).rejects.toThrow(/screen demo: step 2 selector #nope not found/);
});
