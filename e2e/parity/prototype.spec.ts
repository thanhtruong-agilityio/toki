import { expect, test } from "@playwright/test";
import {
  PROTOTYPE_ORIGIN,
  WIDTHS,
  openPrototype,
  type Width,
} from "../support/prototype";

// R1: the copy is opened from a made-up address that `page.route` answers, and needs no other host.
test("no request leaves the machine and the seven faces load", async ({
  page,
}) => {
  const urls: string[] = [];
  page.on("request", (request) => urls.push(request.url()));
  await openPrototype(page, { look: "calm" });
  const outside = urls.filter(
    (url) =>
      !url.startsWith(`${PROTOTYPE_ORIGIN}/`) && !/^(data|blob):/.test(url),
  );
  expect(outside).toEqual([]);
  const loaded = await page.evaluate(
    () => [...document.fonts].filter((face) => face.status === "loaded").length,
  );
  expect(loaded).toBe(7);
});

// R2: the values of the prototype's own lines 6 to 56 (also TOKI-016 R11 and R15).
const accents = [
  ["calm", "teal", "#0F766E"],
  ["focus", "teal", "#5EEAD4"],
  ["calm", "indigo", "#4F46E5"],
  ["focus", "indigo", "#A5B4FC"],
  ["calm", "clay", "#B4532A"],
  ["focus", "clay", "#FDBA8C"],
  ["calm", "violet", "#7C3AED"],
  ["focus", "violet", "#C4B5FD"],
] as const;

for (const [look, accent, value] of accents) {
  test(`--accent is ${value} in ${look} with ${accent}`, async ({ page }) => {
    await openPrototype(page, { look, accent });
    const accentValue = await page.evaluate(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim(),
    );
    expect(accentValue.toUpperCase()).toBe(value);
  });
}

// R6, R7: the demo bar of the prototype sits above #app and takes some of the window, so the window
// is made taller by that much; #app, which is what is captured, is then the size of the width.
for (const width of ["wide", "mid", "narrow"] as Width[]) {
  test(`#app is the size of the ${width} width`, async ({ page }) => {
    await openPrototype(page, { look: "calm", width, hash: "home" });
    const box = await page.locator("#app").boundingBox();
    expect(box?.width).toBe(WIDTHS[width].width);
    expect(box?.height).toBe(WIDTHS[width].height);
  });
}
