import { expect, test, type Page } from "@playwright/test";

// The browser checks of the app shell (TOKI-015 R33): R8, R15, R18 to R23, R27
// and R29, in Chromium, in both looks, against the development fixture
// (`apps/web/shell-fixture.html`, R32). The numbers are those of Table J of the
// spec and of the requirements; a value off by more than 1 px fails. The file
// reads rectangles and computed styles and writes nothing.
//
// The fixture links no `fonts.css` (TOKI-010 is not on main yet), so a height
// that depends on text is measured against the fallback fonts. The number of
// Table J that depends on text (the account card, 64) matched the spec with the
// fallback fonts: it comes from a line height set as a number or from a fixed
// height, not from a font's own metrics. It is marked `fallback fonts,
// re-measure with TOKI-010` where it is asserted.

const LOOKS = ["calm", "focus"] as const;
type Look = (typeof LOOKS)[number];

const TOL = 1;
// A window of 360 by 560 is the smallest one of R21; the others are tall enough
// not to matter, except for R20, which sets its own heights.
const TALL = 800;
const heightFor = (width: number) => (width === 360 ? 560 : TALL);

function expectNear(actual: number, expected: number, label: string) {
  expect(
    Math.abs(actual - expected),
    `${label}: expected ${expected}, got ${actual}`,
  ).toBeLessThanOrEqual(TOL);
}

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  display: string;
  visibility: string;
  zIndex: string;
};

// A rectangle is `getBoundingClientRect()`; the shell root is fixed at the
// window's corner, so it is also the rectangle relative to the shell root.
async function boxes(page: Page, selector: string): Promise<Box[]> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        right: r.right,
        bottom: r.bottom,
        display: s.display,
        visibility: s.visibility,
        zIndex: s.zIndex,
      };
    });
  }, selector);
}

async function box(page: Page, selector: string): Promise<Box> {
  const found = await boxes(page, selector);
  expect(found.length, `${selector} is in the page`).toBeGreaterThan(0);
  return found[0]!;
}

// Open the fixture in a window of the given size and wait until it has settled:
// the shell is drawn and no transition or animation is running.
async function open(
  page: Page,
  look: Look,
  width: number,
  height: number,
  query: Record<string, string | number> = {},
) {
  await page.setViewportSize({ width, height });
  const params = new URLSearchParams({ look });
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }
  await page.goto(`/shell-fixture.html?${params}`);
  await expect(page.getByTestId("shell")).toBeVisible();
  await settle(page);
}

// Waits for a condition, not for a fixed time: no animation or transition of
// the document is running.
async function settle(page: Page) {
  await page.waitForFunction(() => document.getAnimations().length === 0);
}

const intersects = (a: Box, b: Box) =>
  a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

const overlapsHorizontally = (a: Box, b: Box) => a.x < b.right && b.x < a.right;

// ---------------------------------------------------------------------------
// R8, R18: the three layouts and the workspace header.
// ---------------------------------------------------------------------------

const WIDTHS = [360, 719, 720, 800, 956, 1099, 1100, 1400];

for (const look of LOOKS) {
  for (const width of WIDTHS) {
    const height = heightFor(width);
    test(`R18 R8 ${look} layout at ${width}`, async ({ page }) => {
      await open(page, look, width, height);
      if (width >= 720) {
        // R8: the account card's avatar is 36 px wide in both looks (Table J);
        // the card is not drawn under 720 px.
        const avatar = await box(page, ".ucard .av");
        expectNear(avatar.width, 36, "avatar width");
        const card = await box(page, ".usercard");
        const main = await box(page, ".main");
        // TOKI-145 R1 and R3: the three looks share the rail and, on Home, the column.
        expectNear((await box(page, ".nav")).width, 68, "rail width");
        expectNear(
          (await box(page, ".convs")).right,
          356,
          "conversation column ends at",
        );
        expectNear(main.x, 356, "main x");
        // fallback fonts, re-measure with TOKI-010 (the two text lines are 34 px)
        expectNear(card.height, 64, "account card height");
        const ws = await box(page, ".ws");
        expectNear(ws.width, 51, ".ws width");
        // `.wst` is not displayed: it and its children have no box.
        for (const sel of [".wst", ".wsn", ".wss"]) {
          const b = await box(page, sel);
          expect(b.display === "none" || b.width === 0, sel).toBe(true);
          expect(b.width, `${sel} width`).toBe(0);
          expect(b.height, `${sel} height`).toBe(0);
        }
        // R4: Calm draws the main area as a card.
        if (look === "calm") {
          expectNear(main.right, width - 12, "main right");
          expectNear(main.y, 12, "main margin top");
          expectNear(main.bottom, height - 12, "main margin bottom");
        } else {
          expectNear(main.right, width, "main right");
        }
      } else {
        // No sidebar and no rail: the bottom bar is 62 px high and ends at the
        // bottom edge, the list pane fills the rest.
        const bar = await box(page, ".nav");
        expectNear(bar.height, 62, "bottom bar height");
        expectNear(bar.bottom, height, "bottom bar ends at");
        expectNear(bar.x, 0, "bottom bar x");
        expectNear(bar.width, width, "bottom bar width");
        const convs = await box(page, ".convs");
        expectNear(convs.x, 0, "list x");
        expectNear(convs.y, 0, "list y");
        expectNear(convs.right, width, "list right");
        expectNear(convs.bottom, height - 62, "list bottom");
        for (const sel of [".ws", ".srch", ".nav-items", ".usercard"]) {
          expect((await box(page, sel)).display, sel).toBe("none");
        }
      }
    });
  }

  // In the section `activity` each look has the rail only (x 0 to 68); Calm keeps
  // the margin of its card.
  for (const width of [720, 1100]) {
    test(`R18 ${look} section activity at ${width}`, async ({ page }) => {
      await open(page, look, width, TALL, { section: "activity" });
      const main = await box(page, ".main");
      const sidebar = await box(page, ".sidebar");
      expectNear(sidebar.x, 0, "rail x");
      expectNear(sidebar.right, 68, "rail ends at");
      expect((await box(page, ".convs")).display).toBe("none");
      expectNear(main.x, 68, "main x");
      expectNear(
        main.right,
        look === "calm" ? width - 12 : width,
        "main right",
      );
    });
  }
}

// TOKI-145 R3 and R4: Calm takes the rail's line, keeps its cards and draws no line
// on the conversation column.
for (const width of [720, 1100]) {
  test(`TOKI-145 R3 R4 calm lines and cards at ${width}`, async ({ page }) => {
    await open(page, "calm", width, TALL, { panel: 1 });
    const style = (selector: string) =>
      page.locator(selector).evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          line: s.borderRightWidth,
          margin: [s.marginTop, s.marginRight, s.marginBottom, s.marginLeft],
          radius: s.borderTopLeftRadius,
          shadow: s.boxShadow,
        };
      });
    expect((await style(".nav")).line).toBe("1px");
    expect((await style(".usercard")).line).toBe("1px");
    expect((await style(".convs")).line).toBe("0px");
    for (const card of [".main", ".side"]) {
      const s = await style(card);
      expect(s.margin, card).toEqual(["12px", "12px", "12px", "0px"]);
      expect(s.radius, card).toBe("16px");
      expect(s.shadow, card).not.toBe("none");
    }
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Preferences" }),
    ).toBeVisible();
  });
}

// ---------------------------------------------------------------------------
// R19: a side panel from 720 to 1099 px overlays the chat; from 1100 px it is a
// column.
// ---------------------------------------------------------------------------

// Table J: main width with and without a panel. The values for 1400 follow
// from the same arithmetic as 1100 (Calm: the window less the 356 px column, the
// 12 px margin and, with a panel, its 360 px and 12 px margin; Focus: the window
// less the 356 px column and, with a panel, its 360 px).
const MAIN_WIDTH: Record<
  Look,
  Record<number, [none: number, panel: number]>
> = {
  calm: {
    720: [352, 352],
    800: [432, 432],
    1099: [731, 731],
    1100: [732, 360],
    1400: [1032, 660],
  },
  focus: {
    720: [364, 364],
    800: [444, 444],
    1099: [743, 743],
    1100: [744, 384],
    1400: [1044, 684],
  },
};

for (const look of LOOKS) {
  for (const width of [720, 800, 1099, 1100, 1400]) {
    test(`R19 ${look} panel at ${width}`, async ({ page }) => {
      const [none, withPanel] = MAIN_WIDTH[look][width]!;
      await open(page, look, width, TALL);
      const before = await box(page, ".main");
      expectNear(before.width, none, "main width without a panel");

      await open(page, look, width, TALL, { panel: 1 });
      const after = await box(page, ".main");
      expectNear(after.width, withPanel, "main width with a panel");
      const side = await box(page, ".side");
      expectNear(side.width, 360, "panel width");
      expectNear(
        side.right,
        look === "calm" ? width - 12 : width,
        "panel ends at",
      );
      if (width < 1100) {
        // An overlay: .main is unchanged and the panel lies over it.
        for (const key of ["x", "y", "width", "height"] as const) {
          expectNear(after[key], before[key], `main ${key} with a panel`);
        }
        // TOKI-145: where the main area is narrower than the panel (Calm under 728 px,
        // 352 px at 720), the overlay reaches past it by the difference and no more.
        expect(side.x).toBeGreaterThanOrEqual(
          after.x - Math.max(0, 360 - none) - TOL,
        );
        const z = (value: string) => (value === "auto" ? 0 : Number(value));
        expect(z(side.zIndex)).toBeGreaterThan(z(after.zIndex));
      } else {
        // A column: it sits beside .main, not over it.
        expect(side.x).toBeGreaterThanOrEqual(after.right - TOL);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// R20: the sidebar keeps the conversation list and the navigation scrolls.
// ---------------------------------------------------------------------------

type Scenario = {
  name: string;
  query: Record<string, string>;
  // The content height of `.nav-items`.
  content: number;
};

const SCENARIOS: Scenario[] = [
  { name: "an Admin", query: { role: "admin" }, content: 356 },
  { name: "a Member", query: { role: "member" }, content: 305 },
  {
    name: "an Admin with two more rows",
    query: { role: "admin", extra: "2" },
    content: 356 + 2 * 51,
  },
];

// Table J: the navigation box at 560, 480 and 420 (the heights of the window).
const NAV_ITEMS_BOX: Record<number, number> = {
  560: 396,
  480: 316,
  420: 256,
};

for (const look of LOOKS) {
  for (const height of [560, 480, 420]) {
    for (const scenario of SCENARIOS) {
      test(`R20 ${look} 1100 by ${height}, ${scenario.name}`, async ({
        page,
      }) => {
        await open(page, look, 1100, height, scenario.query);
        const items = await page.locator(".nav-items").evaluate((el) => ({
          // The height of the rows: `scrollHeight` is never below the box.
          content: (() => {
            const kids = [...el.children].filter(
              (child) => getComputedStyle(child).display !== "none",
            );
            const first = kids[0]!.getBoundingClientRect();
            const last = kids[kids.length - 1]!.getBoundingClientRect();
            return last.bottom - first.top;
          })(),
          scrolls: el.scrollHeight > el.clientHeight,
          overflowY: getComputedStyle(el).overflowY,
          box: el.getBoundingClientRect().height,
        }));
        expect(items.overflowY).toBe("auto");

        const expectedBox = NAV_ITEMS_BOX[height]!;
        expectNear(items.box, expectedBox, "nav-items box");
        expectNear(items.content, scenario.content, "nav-items content");
        // It scrolls when its content is higher than its box.
        expect(items.scrolls, "scrolls").toBe(
          scenario.content > expectedBox + 0.5,
        );

        // Each visible .ni keeps its height.
        const rows = (await boxes(page, ".ni")).filter(
          (row) => row.display !== "none",
        );
        for (const row of rows) expectNear(row.height, 50, ".ni height");

        // Everything lies inside the window.
        for (const sel of [".ws", ".srch", ".convs", ".usercard"]) {
          const found = (await boxes(page, sel)).filter(
            (b) => b.display !== "none",
          );
          for (const b of found) {
            expect(b.y, `${sel} top`).toBeGreaterThanOrEqual(-TOL);
            expect(b.bottom, `${sel} bottom`).toBeLessThanOrEqual(height + TOL);
          }
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// R21: the smallest window.
// ---------------------------------------------------------------------------

const SECTIONS = [
  "home",
  "activity",
  "later",
  "files",
  "people",
  "admin",
  "preferences",
];

async function expectTouchTargets(page: Page) {
  // Every .nt, .tab, .ib and .btn that the shell draws is at least 40 px tall
  // at 719 px and below.
  const found = await boxes(page, ".nt, .tab, .ib, .btn");
  for (const b of found.filter((item) => item.display !== "none")) {
    expect(b.height, "touch target height").toBeGreaterThanOrEqual(40 - 0.01);
  }
}

for (const look of LOOKS) {
  for (const section of SECTIONS) {
    test(`R21 ${look} 360 by 560, section ${section}`, async ({ page }) => {
      await open(page, look, 360, 560, { section });
      const scroll = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.innerWidth);

      const inside = (b: Box) => {
        expect(b.x).toBeGreaterThanOrEqual(-TOL);
        expect(b.y).toBeGreaterThanOrEqual(-TOL);
        expect(b.right).toBeLessThanOrEqual(360 + TOL);
        expect(b.bottom).toBeLessThanOrEqual(560 + TOL);
      };
      inside(await box(page, ".nav"));
      inside(await box(page, section === "home" ? ".convs" : ".main"));

      // The five tabs (four sections and More) fit side by side, each at least
      // 64 px wide.
      const tabs = await boxes(page, ".nt");
      expect(tabs.length).toBe(5);
      for (const tab of tabs) {
        expect(tab.width).toBeGreaterThanOrEqual(64 - TOL);
      }
      const last = tabs[tabs.length - 1]!;
      expect(last.right).toBeLessThanOrEqual(360 + TOL);
      const tabsScroll = await page.evaluate(() => {
        const el = document.querySelector(".nav-tabs")!;
        return el.scrollWidth <= el.clientWidth;
      });
      expect(tabsScroll, "the five tabs need no sideways scroll").toBe(true);
      await expectTouchTargets(page);
    });
  }

  test(`R21 ${look} 360 by 560, the main pane and the panel`, async ({
    page,
  }) => {
    await open(page, look, 360, 560, { pane: "main" });
    const main = await box(page, ".main");
    expectNear(main.x, 0, "main x");
    expectNear(main.right, 360, "main right");
    expectNear(main.bottom, 560, "main bottom with the bar moved out");
    await expectTouchTargets(page);
    await open(page, look, 360, 560, { pane: "side" });
    const side = await box(page, ".side");
    expectNear(side.width, 360, "panel width");
    expectNear(side.height, 560, "panel height");
    await expectTouchTargets(page);
  });

  test(`R21 ${look} control height at 719`, async ({ page }) => {
    for (const pane of ["list", "main", "side"]) {
      await open(page, look, 719, TALL, { pane });
      await expectTouchTargets(page);
    }
  });

  test(`R21 ${look} a longer label makes the bar scroll sideways`, async ({
    page,
  }) => {
    await open(page, look, 360, 560);
    await page
      .locator(".nt span")
      .first()
      .evaluate((el) => {
        el.textContent = "Averyveryverylonglabelwithoutaspace";
      });
    const state = await page.evaluate(() => {
      const el = document.querySelector(".nav-tabs")!;
      return {
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
      };
    });
    expect(state.overflowX).toBe("auto");
    expect(state.scrollWidth).toBeGreaterThan(state.clientWidth);
  });
}

// ---------------------------------------------------------------------------
// R22: narrow panes.
// ---------------------------------------------------------------------------

type PaneName = "list" | "main" | "side";
const HIDDEN_BY_PANE: Record<PaneName, string[]> = {
  list: [".main", ".side"],
  main: [".convs", ".side", ".nav"],
  side: [".convs", ".main", ".nav"],
};
const SHOWN_BY_PANE: Record<PaneName, string> = {
  list: ".convs",
  main: ".main",
  side: ".side",
};

for (const look of LOOKS) {
  for (const width of [360, 719]) {
    for (const pane of ["list", "main", "side"] as PaneName[]) {
      test(`R22 ${look} ${width} pane ${pane}`, async ({ page }) => {
        const height = heightFor(width);
        await open(page, look, width, height, { pane });
        // Waits for the transition by its end state, not by a fixed time.
        await page.waitForFunction(
          ([hidden, shown]) =>
            hidden!
              .split(",")
              .every(
                (sel) =>
                  !document.querySelector(sel) ||
                  getComputedStyle(document.querySelector(sel)!).visibility ===
                    "hidden",
              ) &&
            getComputedStyle(document.querySelector(shown!)!).visibility ===
              "visible",
          [HIDDEN_BY_PANE[pane].join(","), SHOWN_BY_PANE[pane]] as const,
        );
        await settle(page);

        for (const sel of HIDDEN_BY_PANE[pane]) {
          const b = (await boxes(page, sel))[0];
          if (b) expect(b.visibility, `${sel} visibility`).toBe("hidden");
        }
        expect((await box(page, SHOWN_BY_PANE[pane])).visibility).toBe(
          "visible",
        );
        if (pane === "side") {
          const z = Number((await box(page, ".side")).zIndex);
          expect(z).toBe(6);
        }
        // The bar is moved out of the window when a chat or the panel shows.
        const bar = await box(page, ".nav");
        if (pane === "list") {
          expect(bar.visibility).toBe("visible");
          expectNear(bar.bottom, height, "bar bottom");
        } else {
          expectNear(
            bar.y,
            height,
            "bar moved out: top is the window's bottom",
          );
        }

        // The Tab key never lands on an element of the hidden bar or of a
        // hidden pane: 40 presses from the top of the document.
        const visited = new Set<string>();
        for (let i = 0; i < 40; i++) {
          await page.keyboard.press("Tab");
          const where = await page.evaluate((hidden) => {
            const active = document.activeElement;
            const inside = (sel: string) =>
              !!active && !!document.querySelector(sel)?.contains(active);
            return {
              hidden: hidden.filter((sel) => inside(sel)),
              tag: active?.tagName ?? "",
              inMain: inside(".main"),
              inConvs: inside(".convs"),
              inSide: inside(".side"),
              inNav: inside(".nav"),
            };
          }, HIDDEN_BY_PANE[pane]);
          expect(where.hidden, "focus landed on a hidden element").toEqual([]);
          if (where.inMain) visited.add(".main");
          if (where.inConvs) visited.add(".convs");
          if (where.inSide) visited.add(".side");
          if (where.inNav) visited.add(".nav");
        }
        // The check is not empty: the shown pane did take focus.
        expect(visited.has(SHOWN_BY_PANE[pane])).toBe(true);
      });
    }
  }

  test(`R22 ${look} the transitions last 0.18 s and reduced motion shortens them`, async ({
    page,
  }) => {
    await open(page, look, 360, 560);
    const read = () =>
      page.evaluate(() =>
        [".convs", ".main", ".nav"].map(
          (sel) =>
            getComputedStyle(document.querySelector(sel)!).transitionDuration,
        ),
      );
    for (const duration of await read()) {
      expect(duration.split(",").map((part) => part.trim())).toEqual([
        "0.18s",
        "0.18s",
      ]);
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const duration of await read()) {
      for (const part of duration.split(",")) {
        expect(parseFloat(part)).toBeLessThan(0.001);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// R23, R25: toasts, with a registered composer.
// ---------------------------------------------------------------------------

// Table J: the toast anchor's width with the panel open.
const ANCHOR_WITH_PANEL: Record<Look, Record<number, number>> = {
  calm: { 720: 352, 800: 432, 956: 228, 1099: 371, 1100: 360 },
  focus: { 720: 364, 800: 444, 956: 240, 1099: 383, 1100: 384 },
};

// What each of the checks of R23 needs: the fixture's fake clock keeps the
// three toasts on screen (their 3 to 5 seconds would otherwise run out while
// the machine is busy with the rest of the matrix).
async function openWithToasts(
  page: Page,
  look: Look,
  width: number,
  height: number,
  query: Record<string, string | number>,
) {
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-01-01T00:00:01Z"));
  await open(page, look, width, height, { ...query, toasts: 1 });
  await expect(page.locator(".toast")).toHaveCount(3);
  await settle(page);
}

const TOAST_WIDTHS = [360, 719, 720, 800, 956, 1099, 1100];

for (const look of LOOKS) {
  for (const width of TOAST_WIDTHS) {
    const narrow = width < 720;
    // Narrow: the bar shown (the list pane), the bar moved out by an open chat
    // (`pane=main`), and the panel's own pane. Wide: no panel, and a panel.
    const cases: Array<{ name: string; query: Record<string, string> }> = narrow
      ? [
          { name: "list pane, bar shown", query: { pane: "list" } },
          { name: "chat open, bar hidden", query: { pane: "main" } },
          { name: "panel pane", query: { pane: "side" } },
        ]
      : [
          { name: "no panel", query: {} },
          { name: "panel open", query: { panel: "1" } },
        ];
    for (const item of cases) {
      test(`R23 ${look} ${width}, ${item.name}`, async ({ page }) => {
        const height = heightFor(width);
        await openWithToasts(page, look, width, height, item.query);
        const toasts = await boxes(page, ".toast");
        expect(toasts.length).toBe(3);
        const anchor = await box(page, ".toast-anchor");
        const panelOpen =
          item.query.panel === "1" || item.query.pane === "side";

        // The anchor's box.
        if (narrow) {
          expectNear(anchor.x, 0, "anchor x");
          expectNear(anchor.y, 0, "anchor y");
          expectNear(anchor.width, width, "anchor width: the whole shell");
          expectNear(anchor.height, height, "anchor height: the whole shell");
        } else if (panelOpen) {
          const expected = ANCHOR_WITH_PANEL[look][width];
          if (expected !== undefined) {
            expectNear(anchor.width, expected, "anchor width with the panel");
          }
        } else {
          const main = await box(page, ".main");
          for (const key of ["x", "y", "width", "height"] as const) {
            expectNear(anchor[key], main[key], `anchor ${key} against .main`);
          }
        }

        // The things a toast must not touch.
        const must: Array<[string, Box]> = [];
        const add = async (sel: string) => {
          for (const b of await boxes(page, sel)) {
            if (b.display === "none") continue;
            must.push([sel, b]);
          }
        };
        if (narrow) {
          await add(".nav");
        } else {
          await add(".sidebar");
          await add(".nav");
          await add(".convs");
        }
        await add('[data-testid="composer"]');
        await add('[data-testid="panel-composer"]');
        if (!narrow && panelOpen && width >= 956) await add(".side");

        const windowBox: Box = {
          x: 0,
          y: 0,
          width,
          height,
          right: width,
          bottom: height,
          display: "block",
          visibility: "visible",
          zIndex: "auto",
        };
        for (const [sel, thing] of must) {
          for (const toast of toasts) {
            expect(
              intersects(toast, thing),
              `a toast intersects ${sel} (${JSON.stringify(thing)}; toast ${JSON.stringify(toast)})`,
            ).toBe(false);
          }
        }

        // Each toast ends above the top of a composer and of the bar that is
        // shown and in the window, whenever they share the same columns.
        const above = must.filter(
          ([sel, thing]) =>
            (sel === ".nav" ||
              sel === '[data-testid="composer"]' ||
              sel === '[data-testid="panel-composer"]') &&
            thing.visibility === "visible" &&
            intersects(thing, windowBox),
        );
        for (const [sel, thing] of above) {
          if (!narrow && sel === ".nav") continue; // the rail is a column
          for (const toast of toasts) {
            if (!overlapsHorizontally(toast, thing)) continue;
            expect(
              toast.bottom,
              `a toast ends above the top of ${sel}`,
            ).toBeLessThanOrEqual(thing.y + TOL);
          }
        }

        // R23, the proof of TOKI-013 R29 for the real shell: no ancestor of
        // the region forms a stacking context, and the region is after
        // `div.app`, not inside it.
        const stacking = await page.evaluate(() => {
          const region = document.querySelector(".toasts")!;
          const found: string[] = [];
          for (
            let el: Element | null = region.parentElement;
            el;
            el = el.parentElement
          ) {
            const s = getComputedStyle(el);
            const tag = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
              el.className && typeof el.className === "string"
                ? `.${el.className.split(" ").join(".")}`
                : ""
            }`;
            if (s.position !== "static" && s.zIndex !== "auto") {
              found.push(
                `${tag}: position ${s.position} with z-index ${s.zIndex}`,
              );
            }
            if (s.transform !== "none") found.push(`${tag}: transform`);
            if (s.opacity !== "1") found.push(`${tag}: opacity ${s.opacity}`);
            if (s.filter !== "none") found.push(`${tag}: filter`);
            if (s.isolation === "isolate") found.push(`${tag}: isolation`);
            if (s.contain !== "none")
              found.push(`${tag}: contain ${s.contain}`);
          }
          const app = document.querySelector(".app")!;
          return {
            found,
            afterApp: app.nextElementSibling === region,
            inside: app.contains(region),
          };
        });
        expect(stacking.found).toEqual([]);
        expect(stacking.afterApp, "the region follows div.app").toBe(true);
        expect(stacking.inside, "the region is not inside div.app").toBe(false);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// R15: an EmptyState centres in the free area of its parent.
// ---------------------------------------------------------------------------

const EMPTY_CASES: Array<{
  name: string;
  empty: string;
  parent: string;
  query: Record<string, string | number>;
}> = [
  { name: ".main", empty: "main", parent: ".main", query: {} },
  {
    name: ".secbody",
    empty: "secbody",
    parent: ".secbody",
    query: { section: "activity" },
  },
  { name: ".sb", empty: "sb", parent: ".sb", query: { panel: 1 } },
];

for (const look of LOOKS) {
  for (const width of [360, 720, 1100]) {
    for (const item of EMPTY_CASES) {
      test(`R15 ${look} ${width}, an EmptyState in ${item.name}`, async ({
        page,
      }) => {
        const height = heightFor(width);
        const query: Record<string, string | number> = {
          ...item.query,
          empty: item.empty,
        };
        // Under 720 px the pane that holds the case must be the one shown.
        if (width < 720 && item.empty === "main") query.pane = "main";
        await open(page, look, width, height, query);
        const centres = await page.evaluate((parentSel) => {
          const parent = document.querySelector(parentSel)!;
          const empty = parent.querySelector(":scope > .empty")!;
          const p = parent.getBoundingClientRect();
          const s = getComputedStyle(parent);
          // The free area is the content box of the parent: its padding and
          // border are not part of it.
          const area = {
            left:
              p.left +
              parseFloat(s.borderLeftWidth) +
              parseFloat(s.paddingLeft),
            right:
              p.right -
              parseFloat(s.borderRightWidth) -
              parseFloat(s.paddingRight),
            top:
              p.top + parseFloat(s.borderTopWidth) + parseFloat(s.paddingTop),
            bottom:
              p.bottom -
              parseFloat(s.borderBottomWidth) -
              parseFloat(s.paddingBottom),
          };
          // The content of the block: the icon and the text lines.
          const parts = [...empty.children].map((el) =>
            el.getBoundingClientRect(),
          );
          const content = {
            left: Math.min(...parts.map((r) => r.left)),
            right: Math.max(...parts.map((r) => r.right)),
            top: Math.min(...parts.map((r) => r.top)),
            bottom: Math.max(...parts.map((r) => r.bottom)),
          };
          return {
            parentX: (area.left + area.right) / 2,
            parentY: (area.top + area.bottom) / 2,
            contentX: (content.left + content.right) / 2,
            contentY: (content.top + content.bottom) / 2,
            hasIcon: !!empty.querySelector(".eic"),
          };
        }, item.parent);
        expect(centres.hasIcon).toBe(true);
        expectNear(centres.contentX, centres.parentX, "horizontal centre");
        expectNear(centres.contentY, centres.parentY, "vertical centre");
      });
    }
  }
}

// ---------------------------------------------------------------------------
// R27: the body text is 15 px at 719 and 14 px at 720.
// ---------------------------------------------------------------------------

for (const look of LOOKS) {
  for (const [width, size] of [
    [719, "15px"],
    [720, "14px"],
  ] as const) {
    test(`R27 ${look} body font size at ${width}`, async ({ page }) => {
      await open(page, look, width, TALL);
      const fontSize = await page.evaluate(
        () => getComputedStyle(document.body).fontSize,
      );
      expect(fontSize).toBe(size);
    });
  }
}

// ---------------------------------------------------------------------------
// R29: focus moves to the pane that is shown, on a narrow screen only.
// ---------------------------------------------------------------------------

const activeIs = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return {
      cls: el?.className ?? "",
      tag: el?.tagName ?? "",
    };
  });

for (const look of LOOKS) {
  test(`R29 ${look} 360: focus follows the pane`, async ({ page }) => {
    await open(page, look, 360, 560);
    // From the list to a conversation: focus goes to the main pane.
    await page.locator(".crow").first().click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector(".main"),
    );
    expect((await activeIs(page)).cls).toContain("main");
    // To the panel.
    await page.getByRole("button", { name: "Details" }).click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector(".side"),
    );
    // Back from the panel to the chat, and back to the list.
    await page.locator(".back-side").click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector(".main"),
    );
    await page.getByRole("button", { name: "Back to the list" }).click();
    await page.waitForFunction(
      () => document.activeElement === document.querySelector(".convs"),
    );
  });

  test(`R29 ${look} 720: focus is not moved`, async ({ page }) => {
    await open(page, look, 720, TALL);
    const row = page.locator(".crow").first();
    await row.click();
    await page.getByRole("button", { name: "Details" }).click();
    // The panel opened and the focus stayed on the button that was pressed.
    await expect(page.locator(".side")).toBeVisible();
    const active = await page.evaluate(() => ({
      main: document.activeElement === document.querySelector(".main"),
      side: document.activeElement === document.querySelector(".side"),
      label: document.activeElement?.getAttribute("aria-label"),
    }));
    expect(active.main).toBe(false);
    expect(active.side).toBe(false);
    expect(active.label).toBe("Details");
  });
}

// ---------------------------------------------------------------------------
// R11: which button of the side panel shows. The back button is shown under
// 720 px and the close button from 720 px; the hidden one is `display:none`.
// ---------------------------------------------------------------------------

for (const look of LOOKS) {
  for (const [width, shown, hidden] of [
    [719, ".back-side", ".closex"],
    [720, ".closex", ".back-side"],
  ] as const) {
    test(`R11 ${look} ${width}: ${shown} shows, ${hidden} does not, and the shown one closes the panel`, async ({
      page,
    }) => {
      await open(page, look, width, heightFor(width), {
        [width < 720 ? "pane" : "panel"]: width < 720 ? "side" : "1",
      });
      await expect(page.locator(".side")).toBeVisible();
      expect((await box(page, `.side ${shown}`)).display).not.toBe("none");
      expect((await box(page, `.side ${hidden}`)).display).toBe("none");
      await expect(page.locator(`.side ${shown}`)).toBeVisible();
      await expect(page.locator(`.side ${hidden}`)).toBeHidden();
      await page.locator(`.side ${shown}`).click();
      await expect(page.locator(".side")).toHaveCount(0);
    });
  }
}

// ---------------------------------------------------------------------------
// R23: when `data-chat-open` moves the bar out (narrow, `?pane=main`), the toasts
// come down to 14 px above the composer, or to 20 px from the bottom of the window
// when nothing is registered (TOKI-013 R27, R28 e, `toastPlace.ts`).
// ---------------------------------------------------------------------------

for (const look of LOOKS) {
  test(`R23 ${look} 360: the bar is out, the toasts come down to the composer`, async ({
    page,
  }) => {
    await openWithToasts(page, look, 360, 560, { pane: "main" });
    const nav = await box(page, ".nav");
    expect(nav.y, "the bar is out of the window").toBeGreaterThanOrEqual(560);
    const composer = await box(page, '[data-testid="composer"]');
    const toasts = await boxes(page, ".toast");
    const lowest = Math.max(...toasts.map((t) => t.bottom));
    expectNear(lowest, composer.y - 14, "lowest toast bottom against composer");
    expect(composer.bottom).toBeGreaterThan(560 - 2);
  });

  test(`R23 ${look} 360: the bar is out and no composer, the toasts stand 20 px from the bottom`, async ({
    page,
  }) => {
    await openWithToasts(page, look, 360, 560, {
      pane: "main",
      section: "activity",
    });
    expect((await box(page, ".nav")).y).toBeGreaterThanOrEqual(560);
    await expect(page.locator('[data-testid="composer"]')).toHaveCount(0);
    const toasts = await boxes(page, ".toast");
    const lowest = Math.max(...toasts.map((t) => t.bottom));
    expectNear(lowest, 560 - 20, "lowest toast bottom against the window");
  });
}
