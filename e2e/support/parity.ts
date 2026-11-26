import type { Page } from "@playwright/test";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { LIMITS } from "../parity/limits";
import type { Row } from "./parity-reporter";
import { openPrototype, type Look, type Width } from "./prototype";

// The screen check of the UI parity check (TOKI-109 R5 to R13): declared screens, the capture of
// both sides, the comparison and the row that goes into the report.

const LOOKS: Look[] = ["calm", "focus"];
const WIDTH_NAMES: Width[] = ["wide", "mid", "narrow"];

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
  // A selector of the app that is visible once the screen has its content. The check waits for it
  // before it captures; without it the check waits for the network to be idle.
  ready?: string;
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

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function isDeclaration(value: unknown): value is ScreenDecl {
  const decl = value as Partial<ScreenDecl> | null;
  return (
    typeof decl === "object" &&
    decl !== null &&
    typeof decl.id === "string" &&
    typeof decl.section === "string" &&
    typeof decl.appRoute === "string"
  );
}

// R5: each object or array that a declaration file exports is a declaration or a list of them.
// A function, a string or a number exported next to them (a stub, a constant) is not one and is
// left alone. An id is part of file names, so it is lowercase letters, digits and dashes, and no
// two declarations share one.
export function flattenDeclarations(
  modules: { file: string; exports: Record<string, unknown> }[],
): ScreenDecl[] {
  const out: ScreenDecl[] = [];
  const owner = new Map<string, string>();
  for (const { file, exports } of modules) {
    for (const [key, value] of Object.entries(exports)) {
      if (typeof value !== "object" || value === null) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        if (!isDeclaration(item)) {
          throw new Error(
            `${file}: export ${key} is not a screen declaration (it needs id, section and appRoute)`,
          );
        }
        if (!ID_PATTERN.test(item.id)) {
          throw new Error(
            `${file}: screen id "${item.id}" must be lowercase letters, digits and dashes (it is part of file names)`,
          );
        }
        const first = owner.get(item.id);
        if (first) {
          throw new Error(
            `screen id "${item.id}" is declared twice (${first} and ${file})`,
          );
        }
        owner.set(item.id, file);
        out.push(item);
      }
    }
  }
  return out;
}

// R12: a declaration that needs the seeded database counts once as "not run", not once for each
// look and width.
export function seededOnce(entries: ScreenEntry[]): ScreenEntry[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (entry.run || seen.has(entry.decl.id)) return false;
    seen.add(entry.decl.id);
    return true;
  });
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

// TOKI-138: the picture of a difference is read by a person, so it is the image of the app as it is,
// and nothing is painted over it except a frame around each group of different pixels. The colour
// is magenta: it is no token of the app or of the prototype, and shows on the Calm and on the Focus
// background.
const FRAME_COLOUR = [255, 0, 255] as const;
const FRAME_REACH = 6;
const FRAME_WIDTH = 2;

export type Rectangle = [
  left: number,
  top: number,
  right: number,
  bottom: number,
];

// TOKI-138 R2: the rectangles of the groups of different pixels. Two pixels whose x and y each
// differ by 6 or less are in one group, and so are the pixels that a chain of such pairs joins. A
// rectangle is the box of the pixels of a group, grown by 6 on each side and clipped to the image.
// The groups are in the order of their first pixel in reading order. The pixels are put in cells of
// 7 by 7, so that two pixels 6 apart are in the same cell or in two cells that touch, and only those
// are compared.
export function groupDifferences(
  different: Uint8Array,
  width: number,
  height: number,
): Rectangle[] {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (different[y * width + x]) {
        xs.push(x);
        ys.push(y);
      }
    }
  }
  const n = xs.length;
  if (n === 0) return [];

  const parent = Int32Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    while (parent[i] !== root) {
      const next = parent[i]!;
      parent[i] = root;
      i = next;
    }
    return root;
  };

  const cell = FRAME_REACH + 1;
  const columns = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const cells: number[][] = Array.from({ length: columns * rows }, () => []);
  for (let i = 0; i < n; i++) {
    cells[
      Math.floor(ys[i]! / cell) * columns + Math.floor(xs[i]! / cell)
    ]!.push(i);
  }
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(xs[i]! / cell);
    const cy = Math.floor(ys[i]! / cell);
    for (let ny = Math.max(0, cy - 1); ny <= Math.min(rows - 1, cy + 1); ny++) {
      for (
        let nx = Math.max(0, cx - 1);
        nx <= Math.min(columns - 1, cx + 1);
        nx++
      ) {
        for (const j of cells[ny * columns + nx]!) {
          if (
            j > i &&
            Math.abs(xs[j]! - xs[i]!) <= FRAME_REACH &&
            Math.abs(ys[j]! - ys[i]!) <= FRAME_REACH
          ) {
            parent[find(j)] = find(i);
          }
        }
      }
    }
  }

  const order = new Map<number, number>();
  const boxes: Rectangle[] = [];
  for (let i = 0; i < n; i++) {
    const root = find(i);
    let index = order.get(root);
    if (index === undefined) {
      index = boxes.length;
      order.set(root, index);
      boxes.push([width, height, -1, -1]);
    }
    const box = boxes[index]!;
    box[0] = Math.min(box[0], xs[i]!);
    box[1] = Math.min(box[1], ys[i]!);
    box[2] = Math.max(box[2], xs[i]!);
    box[3] = Math.max(box[3], ys[i]!);
  }
  return boxes.map(([left, top, right, bottom]) => [
    Math.max(0, left - FRAME_REACH),
    Math.max(0, top - FRAME_REACH),
    Math.min(width - 1, right + FRAME_REACH),
    Math.min(height - 1, bottom + FRAME_REACH),
  ]);
}

// TOKI-138 R1, R3: a copy of the image of the app with a 2-pixel frame, inside the rectangle of
// each group. A later frame is drawn over an earlier one.
export function frameDifferences(image: PNG, different: Uint8Array): PNG {
  const { width, height } = image;
  const out = new PNG({ width, height });
  out.data.set(image.data);
  const paint = (x: number, y: number): void => {
    out.data.set([...FRAME_COLOUR, 255], (y * width + x) * 4);
  };
  for (const [left, top, right, bottom] of groupDifferences(
    different,
    width,
    height,
  )) {
    for (let t = 0; t < FRAME_WIDTH; t++) {
      for (let x = left; x <= right; x++) {
        paint(x, top + t);
        paint(x, bottom - t);
      }
      for (let y = top; y <= bottom; y++) {
        paint(left + t, y);
        paint(right - t, y);
      }
    }
  }
  return out;
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
  const different = new Uint8Array(width * height);
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
          different[y * width + x] = 1;
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
    diff: PNG.sync.write(frameDifferences(second, different)),
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
// An element that renders a moment after the page loads is waited for, up to `timeout`.
export async function runSteps(
  page: Page,
  id: string,
  steps: Step[],
  timeout = 5000,
): Promise<void> {
  for (const [index, step] of steps.entries()) {
    const n = index + 1;
    if ("press" in step) {
      await page.keyboard.press(step.press);
      continue;
    }
    const selector = "click" in step ? step.click : step.fill[0];
    const target = page.locator(selector).first();
    try {
      await target.waitFor({ state: "attached", timeout });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          `screen ${id}: step ${n} selector ${selector} not found`,
          { cause: error },
        );
      }
      throw error;
    }
    if ("click" in step) await target.click();
    else await target.fill(step.fill[1]);
  }
}

// The app is captured when its content is there: the `ready` selector of the declaration is
// visible, or, without one, the network is idle.
export async function waitUntilReady(
  page: Page,
  id: string,
  ready?: string,
  timeout = 10_000,
): Promise<void> {
  try {
    if (ready) {
      await page.locator(ready).first().waitFor({ state: "visible", timeout });
    } else {
      await page.waitForLoadState("networkidle", { timeout });
    }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(
        ready
          ? `screen ${id}: the ready selector ${ready} did not become visible`
          : `screen ${id}: the network did not become idle`,
        { cause: error },
      );
    }
    throw error;
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
