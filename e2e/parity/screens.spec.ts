import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";
import {
  captureElement,
  compareImages,
  expandScreens,
  runSteps,
  screenRow,
  type ScreenDecl,
} from "../support/parity";
import { attachRow } from "../support/parity-reporter";
import { FIXED_TIME, WIDTHS } from "../support/prototype";
import { LIMITS } from "./limits";

// The screen check (R5, R9 to R13): each declared screen, look and width is the app compared with
// the reference image that was made from the prototype. A difference is a row of the report, not a
// failed test; the test fails only when no result can be given: no reference image, or a step that
// cannot be done.
const here = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));
const SCREENS_DIR = here("./screens/");
const REFERENCE_DIR = process.env.PARITY_REFERENCE_DIR ?? here("./reference");
const OUT = process.env.PARITY_OUT ?? "e2e/assets/parity";

// R5: a file added under `screens/` is picked up with no other edit.
const files = existsSync(SCREENS_DIR)
  ? readdirSync(SCREENS_DIR)
      .filter((file) => file.endsWith(".ts"))
      .sort()
  : [];
const modules = await Promise.all(
  files.map((file) => import(`./screens/${file}`)),
);
const decls = modules.flatMap(
  (module) => Object.values(module) as ScreenDecl[],
);

for (const { decl, look, width, name, run } of expandScreens(decls)) {
  test(`screen ${name}`, async ({ page }, info) => {
    // R12: a screen that needs the seeded database is listed and not run here.
    if (!run) {
      await attachRow(info, {
        kind: "screen",
        name,
        status: "not-run",
        detail: { reason: "needs seeded data" },
      });
      return;
    }

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
    await runSteps(page, decl.id, decl.appSteps ?? []);
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
    await attachRow(info, screenRow(name, result, LIMITS.ratio, images));
  });
}
