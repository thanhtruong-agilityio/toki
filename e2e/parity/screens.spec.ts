import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import {
  captureElement,
  compareImages,
  expandScreens,
  runSteps,
  screenRow,
  seededOnce,
  waitUntilReady,
} from "../support/parity";
import { attachRow } from "../support/parity-reporter";
import { FIXED_TIME, WIDTHS } from "../support/prototype";
import { LIMITS } from "./limits";
import { loadScreens } from "./load-screens";

// The screen check (R5, R9 to R13): each declared screen, look and width is the app compared with
// the reference image that was made from the prototype. A difference is a row of the report, not a
// failed test; the test fails only when no result can be given: no reference image, or a step that
// cannot be done.
const here = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));
const REFERENCE_DIR = process.env.PARITY_REFERENCE_DIR ?? here("./reference");
const OUT = process.env.PARITY_OUT ?? "e2e/assets/parity";

const decls = await loadScreens();

const entries = expandScreens(decls);

// R12: a declaration that needs the seeded database is listed once and not run here.
for (const { decl } of seededOnce(entries)) {
  test(`screen ${decl.id} (needs seeded data)`, async () => {
    await attachRow(test.info(), {
      kind: "screen",
      name: decl.id,
      status: "not-run",
      detail: { reason: "needs seeded data" },
    });
  });
}

for (const { decl, look, width, name } of entries.filter((e) => e.run)) {
  test(`screen ${name}`, async ({ page }, info) => {
    // R10: a missing reference image is a failed run, because there is no result to give.
    const referenceFile = `${REFERENCE_DIR}/${decl.id}-${look}-${width}-chromium-linux.png`;
    if (!existsSync(referenceFile)) {
      throw new Error(
        `no reference for ${name}: run pnpm ui:reference ${decl.id}`,
      );
    }
    const reference = readFileSync(referenceFile);

    // The app in the same state: the look comes from the colour scheme (the app reads it at load),
    // the time is fixed, and the API is stubbed by the declaration.
    await decl.setup?.(page);
    await page.emulateMedia({
      colorScheme: look === "focus" ? "dark" : "light",
      reducedMotion: "reduce",
    });
    await page.setViewportSize(WIDTHS[width]);
    await page.clock.install({ time: FIXED_TIME });
    await page.clock.setFixedTime(FIXED_TIME);
    await page.goto(decl.appRoute);
    await waitUntilReady(page, decl.id, decl.ready);
    await runSteps(page, decl.id, decl.appSteps ?? []);
    await waitUntilReady(page, decl.id, decl.ready);
    const app = await captureElement(page, ".app", decl.mask ?? []);

    const result = compareImages(reference, app);
    const base = `images/${decl.id}-${look}-${width}`;
    mkdirSync(`${OUT}/images`, { recursive: true });
    const images = [`${base}-reference.png`, `${base}-app.png`];
    writeFileSync(`${OUT}/${images[0]}`, reference);
    writeFileSync(`${OUT}/${images[1]}`, app);
    if (result.diff) {
      images.push(`${base}-diff.png`);
      writeFileSync(`${OUT}/${images[2]}`, result.diff);
    }
    // R11: the three images are attached to the result, and their paths are in the row.
    for (const image of images) {
      await info.attach(image.replace("images/", ""), {
        path: `${OUT}/${image}`,
        contentType: "image/png",
      });
    }
    await attachRow(info, screenRow(name, result, LIMITS.ratio, images));
  });
}
