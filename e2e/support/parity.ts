import type { Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { LIMITS } from "../parity/limits";
import type { Row } from "./parity-reporter";
import { openPrototype, type Look, type Width } from "./prototype";

// The screen check of the UI parity check (TOKI-109 R5 to R13): declared screens, the capture of
// both sides, the comparison and the row that goes into the report.

export const LOOKS: Look[] = ["calm", "focus"];
export const WIDTH_NAMES: Width[] = ["wide", "mid", "narrow"];

export type Step =
  | { click: string }
  | { press: string }
  | { fill: [selector: string, text: string] };

// R5: a ticket that builds a screen exports one or more of these from
// `e2e/parity/screens/<name>.ts`.
export interface ScreenDecl {
  id: string;
  // A key of the prototype's HASH: home, activity, later, files, mail, calendar, meet, tasks,
  // people, admin or prefs.
  section: string;
  prototypeSteps?: Step[];
  appRoute: string;
  appSteps?: Step[];
  // Selectors masked on both sides, besides the running counts `[data-timer]`.
  mask?: string[];
  looks?: Look[];
  widths?: Width[];
  // A screen that needs the seeded database is listed and not run here (R12).
  seed?: boolean;
  // Stubs and the like, before the app opens.
  setup?: (page: Page) => Promise<void>;
}

export interface ScreenEntry {
  decl: ScreenDecl;
  look: Look;
  width: Width;
  // The name is the same on every run: it is the row name in the report.
  name: string;
  run: boolean;
}

export function expandScreens(decls: ScreenDecl[]): ScreenEntry[] {
  return decls.flatMap((decl) =>
    (decl.looks ?? LOOKS).flatMap((look) =>
      (decl.widths ?? WIDTH_NAMES).map((width) => ({
        decl,
        look,
        width,
        name: `${decl.id}/${look}/${width}`,
        run: !decl.seed,
      })),
    ),
  );
}

export interface Comparison {
  sameSize: boolean;
  sizes: [string, string];
  // The ratio of different pixels to all pixels; 1 when the sizes differ.
  ratio: number;
  // [left, top, right, bottom] of the box around the different pixels.
  box: [number, number, number, number] | null;
  // A PNG of the difference, or null.
  diff: Buffer | null;
}

// R9: a pixel is different by the rule of LIMITS (pixelmatch threshold and includeAA).
export function compareImages(a: Buffer, b: Buffer): Comparison {
  const first = PNG.sync.read(a);
  const second = PNG.sync.read(b);
  const sizes: [string, string] = [
    `${first.width}x${first.height}`,
    `${second.width}x${second.height}`,
  ];
  if (first.width !== second.width || first.height !== second.height) {
    return { sameSize: false, sizes, ratio: 1, box: null, diff: null };
  }
  const { width, height } = first;
  const out = new PNG({ width, height });
  const count = pixelmatch(first.data, second.data, out.data, width, height, {
    threshold: LIMITS.threshold,
    includeAA: LIMITS.includeAA,
  });
  let box: Comparison["box"] = null;
  if (count > 0) {
    let [left, top, right, bottom] = [width, height, -1, -1];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        // pixelmatch paints a different pixel in its diff colour, red by default.
        if (
          out.data[i] === 255 &&
          out.data[i + 1] === 0 &&
          out.data[i + 2] === 0
        ) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    }
    box = [left, top, right, bottom];
  }
  return {
    sameSize: true,
    sizes,
    ratio: count / (width * height),
    box,
    diff: PNG.sync.write(out),
  };
}

// R11: the row of one screen, look and width.
export function screenRow(
  name: string,
  result: Comparison,
  limit: number,
  images: string[],
): Row {
  if (!result.sameSize) {
    return {
      kind: "screen",
      name,
      status: "differs",
      detail: {
        sizes: `sizes differ: ${result.sizes[0]} and ${result.sizes[1]}`,
      },
      images,
    };
  }
  return {
    kind: "screen",
    name,
    status: result.ratio <= limit ? "match" : "differs",
    detail: {
      ratio: Number(result.ratio.toFixed(4)),
      limit,
      box: result.box,
    },
    images,
  };
}

// R13: a step that cannot be done names the screen, the step and the selector, and the run stops.
export async function runSteps(
  page: Page,
  id: string,
  steps: Step[],
): Promise<void> {
  for (const [index, step] of steps.entries()) {
    const n = index + 1;
    if ("press" in step) {
      await page.keyboard.press(step.press);
      continue;
    }
    const selector = "click" in step ? step.click : step.fill[0];
    const target = page.locator(selector).first();
    if ((await page.locator(selector).count()) === 0) {
      throw new Error(`screen ${id}: step ${n} selector ${selector} not found`);
    }
    if ("click" in step) await target.click();
    else await target.fill(step.fill[1]);
  }
}

// R7: only the element that holds the app is captured, with the fonts ready, every pane at its top,
// no animation, no caret, and the running counts masked.
export async function captureElement(
  page: Page,
  selector: string,
  mask: string[],
): Promise<Buffer> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    for (const pane of document.querySelectorAll(".scroll")) pane.scrollTop = 0;
  });
  return page.locator(selector).screenshot({
    animations: "disabled",
    caret: "hide",
    scale: "css",
    mask: ["[data-timer]", ...mask].map((m) => page.locator(m)),
  });
}

// The image of the prototype for one screen, look and width: the reference (R8) and the first half
// of every comparison.
export async function captureReference(
  page: Page,
  decl: ScreenDecl,
  look: Look,
  width: Width,
): Promise<Buffer> {
  await openPrototype(page, { look, width, hash: decl.section });
  await runSteps(page, decl.id, decl.prototypeSteps ?? []);
  return captureElement(page, "#app", decl.mask ?? []);
}
