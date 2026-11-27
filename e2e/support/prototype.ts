import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

// The fixed copy of the prototype and the way the UI parity check opens it (TOKI-109 R1, R2, R6,
// R7, R17).

export type Look = "calm" | "focus" | "classic";
export type Scheme = "light" | "dark";
export type Accent = "teal" | "indigo" | "clay" | "violet";
export type Density = "own" | "comfortable" | "compact";
export type Width = "wide" | "mid" | "narrow";

// One width in each band of D-068: 1100 and over, 720 to 1099, under 720 (R6).
export const WIDTHS: Record<Width, { width: number; height: number }> = {
  wide: { width: 1280, height: 800 },
  mid: { width: 900, height: 800 },
  narrow: { width: 390, height: 844 },
};

const here = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

// The location of the copy is set here and nowhere else (R1).
export const PROTOTYPE_FILE = here("../prototype/index.html");
const HASH_FILE = here("../parity/prototype.sha256");
const FONTS_DIR = here("../../apps/web/assets/fonts/");

// The page is served from this made-up address by `page.route`; no request reaches the network.
export const PROTOTYPE_ORIGIN = "https://prototype.test";

// Tuesday 10 November 2026, 10:42 in Ho Chi Minh City: where the prototype's own clock starts.
export const FIXED_TIME = new Date("2026-11-10T10:42:00+07:00");

export const sha256 = (data: Buffer): string =>
  createHash("sha256").update(data).digest("hex");

// R17: the references are made from this file, so a changed file stops the run.
export function checkHash(file: Buffer, recorded: string): string | null {
  return sha256(file) === recorded.trim()
    ? null
    : "the prototype changed: make the references again and record the new hash";
}

// R1: the prototype loads three fonts from Google Fonts. Drop those links and give the page the
// seven faces of TOKI-010 as data URIs, so that the page needs no other host and draws the same
// fonts as the app.
export function prepareHtml(
  html: string,
  fontsCss: string,
  readFont: (name: string) => Buffer,
): string {
  const inlined = fontsCss.replace(
    /url\("\.\/([^"]+)"\)/g,
    (_match, name: string) =>
      `url("data:font/woff2;base64,${readFont(name).toString("base64")}")`,
  );
  // The prototype draws a demo bar (`.protobar`) above the app and a fake window bar (`.chrome`, with
  // `--chromeh` 32 px or 40 px) inside it. Neither is part of the app. Hide both, so that #app, which
  // is what is captured, fills the window (R6, R7).
  const style = `<style>${inlined}\n.protobar,.chrome{display:none!important}.device{--chromeh:0px!important}</style>`;
  const withoutLinks = html.replace(
    /<link[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/g,
    "",
  );
  return withoutLinks.includes("<head>")
    ? withoutLinks.replace("<head>", () => `<head>${style}`)
    : withoutLinks.replace(/<!doctype html>/i, (m) => `${m}${style}`);
}

// R17: reads the copy and stops with the message when its hash is not the recorded one. Every run
// calls it (the global setup of the parity config), and so does `openPrototype`.
export function verifyPrototype(): Buffer {
  const file = readFileSync(PROTOTYPE_FILE);
  const message = checkHash(file, readFileSync(HASH_FILE, "utf8"));
  if (message) throw new Error(message);
  return file;
}

export interface PrototypeState {
  look: Look;
  // The scheme of the page. Left out, Calm is light and Focus and Classic are dark: the states the
  // parity check draws (TOKI-142 R5).
  scheme?: Scheme;
  accent?: Accent;
  density?: Density;
  width?: Width;
  // One of the keys of the prototype's HASH (home, admin, prefs, ...).
  hash?: string;
}

const prepared = new WeakSet<Page>();

// Opens the prototype in the given state. Look, accent and density are set the way the prototype
// sets them itself (`applyLook`), from its own state object: `data-look`, `data-scheme`, `data-accent`
// and `data-density` on the root element.
export async function openPrototype(
  page: Page,
  state: PrototypeState,
): Promise<void> {
  const file = verifyPrototype();
  const {
    look,
    scheme = look === "calm" ? "light" : "dark",
    accent = "teal",
    density = "own",
    width = "wide",
    hash,
  } = state;

  if (!prepared.has(page)) {
    prepared.add(page);
    const html = prepareHtml(
      file.toString("utf8"),
      readFileSync(`${FONTS_DIR}fonts.css`, "utf8"),
      (name) => readFileSync(`${FONTS_DIR}${name}`),
    );
    await page.route(`${PROTOTYPE_ORIGIN}/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: html,
      }),
    );
    // The date stays fixed and the timers keep running (R7).
    await page.clock.install({ time: FIXED_TIME });
    await page.clock.setFixedTime(FIXED_TIME);
  }
  await page.setViewportSize(WIDTHS[width]);
  await page.emulateMedia({
    colorScheme: scheme,
    reducedMotion: "reduce",
  });
  await page.goto("about:blank");
  await page.goto(`${PROTOTYPE_ORIGIN}/index.html${hash ? `#${hash}` : ""}`);

  // `S` and `applyLook` are globals of the prototype's own script.
  await page.evaluate(
    `(() => {
      S.look = ${JSON.stringify(look)};
      S.scheme = ${JSON.stringify(scheme)};
      S.prefs.accent = ${JSON.stringify(accent)};
      S.prefs.density = ${JSON.stringify(density === "own" ? null : density)};
      applyLook();
    })()`,
  );
  // A face is loaded only when text uses it; load all seven so that every run draws the same.
  await page.evaluate(async () => {
    await Promise.all([...document.fonts].map((face) => face.load()));
    await document.fonts.ready;
  });
}
