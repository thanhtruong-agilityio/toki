import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// The component preview page (TOKI-016). "The page" is /preview.html on the
// development server that `pnpm test:e2e` starts.

// Deferred checks name what they wait for, once each (plan, decision 1).
export const PENDING_TOKI_010 = "waits for TOKI-010 (fonts are not on main)";

const root = (page: import("@playwright/test").Page) => page.locator("html");

test.describe("page and controls (R1, R4)", () => {
  test("R1: the page opens, has the root element, the title and the viewport meta", async ({
    page,
  }) => {
    const response = await page.goto("/preview.html");
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("preview-root")).toBeVisible();
    await expect(page).toHaveTitle("Toki component preview");
    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      "width=device-width, initial-scale=1, viewport-fit=cover",
    );
  });

  test("R1: the app at / still opens", async ({ page }) => {
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("app-root")).toHaveText("Toki");
  });

  test("R4: no address gives calm, teal and the look's own density", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    await expect(root(page)).toHaveAttribute("data-eff", "calm");
    await expect(root(page)).toHaveAttribute("data-accent", "teal");
    await expect(root(page)).not.toHaveAttribute("data-density", /.*/);
  });

  test("R4: an address with the three values applies them", async ({
    page,
  }) => {
    await page.goto("/preview.html?look=focus&accent=clay&density=compact");
    await expect(root(page)).toHaveAttribute("data-eff", "focus");
    await expect(root(page)).toHaveAttribute("data-accent", "clay");
    await expect(root(page)).toHaveAttribute("data-density", "compact");
    await expect(page.locator('[data-control="look"]')).toHaveValue("focus");
  });

  test("R4: an unknown value gives the default of that control", async ({
    page,
  }) => {
    await page.goto("/preview.html?look=sepia&accent=indigo&density=huge");
    await expect(root(page)).toHaveAttribute("data-eff", "calm");
    await expect(root(page)).toHaveAttribute("data-accent", "indigo");
    await expect(root(page)).not.toHaveAttribute("data-density", /.*/);
  });

  test("R4: each control changes the attributes and the address at once, and the page stores nothing", async ({
    page,
    context,
  }) => {
    await page.goto("/preview.html");
    const [look, accent, density] = ["look", "accent", "density"].map((name) =>
      page.locator(`[data-control="${name}"]`),
    );
    await expect(look.locator("option")).toHaveText(["calm", "focus"]);
    await expect(accent.locator("option")).toHaveText([
      "teal",
      "indigo",
      "clay",
      "violet",
    ]);
    await expect(density.locator("option")).toHaveCount(3);

    await look.selectOption("focus");
    await expect(root(page)).toHaveAttribute("data-eff", "focus");
    await accent.selectOption("violet");
    await expect(root(page)).toHaveAttribute("data-accent", "violet");
    await density.selectOption("comfortable");
    await expect(root(page)).toHaveAttribute("data-density", "comfortable");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/preview.html");
    expect(url.searchParams.get("look")).toBe("focus");
    expect(url.searchParams.get("accent")).toBe("violet");
    expect(url.searchParams.get("density")).toBe("comfortable");

    await density.selectOption("own");
    await expect(root(page)).not.toHaveAttribute("data-density", /.*/);

    const stored = await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookie: document.cookie,
    }));
    expect(stored).toEqual({ local: 0, session: 0, cookie: "" });
    expect(await context.cookies()).toEqual([]);
  });

  test("R4: the device's dark setting does not decide the look", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/preview.html?look=calm");
    await expect(root(page)).toHaveAttribute("data-eff", "calm");
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      "rgb(242, 244, 239)",
    );
  });
});

test.describe("not in the build (R2)", () => {
  test("a build holds index.html only, and the check fails when a page leaks", async () => {
    test.setTimeout(120_000);
    const out = mkdtempSync(join(tmpdir(), "toki-web-build-"));
    try {
      execFileSync(
        "pnpm",
        [
          "--filter",
          "@toki/web",
          "exec",
          "vite",
          "build",
          "--outDir",
          out,
          "--emptyOutDir",
        ],
        { stdio: "pipe" },
      );
      const clean = spawnSync(
        "pnpm",
        [
          "--filter",
          "@toki/web",
          "run",
          "check:no-dev-pages",
          "--",
          "--dist",
          out,
        ],
        { encoding: "utf8" },
      );
      expect(clean.status, clean.stderr).toBe(0);

      writeFileSync(
        join(out, "preview.html"),
        '<div data-testid="preview-root">',
      );
      const leaked = spawnSync(
        "pnpm",
        [
          "--filter",
          "@toki/web",
          "run",
          "check:no-dev-pages",
          "--",
          "--dist",
          out,
        ],
        { encoding: "utf8" },
      );
      expect(leaked.status).not.toBe(0);
      expect(leaked.stderr).toContain("preview.html");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

const LOOKS = ["calm", "focus"] as const;

// The entries that must be on the page, in order (TOKI-012, TOKI-013,
// TOKI-014). A later ticket may add an entry to componentExamples: the checks
// below ask for these, in this order, and accept more after them.
const COMPONENTS = [
  "Button",
  "IconButton",
  "Chip",
  "Switch",
  "Field",
  "Select",
  "Tag",
  "Badge",
  "Avatar",
  "PresenceDot",
  "EmptyState",
  "Toast",
  "Menu",
  "Modal",
  "Sheet",
];

test.describe("component sections and figures (R5, R6, R7)", () => {
  for (const look of LOOKS) {
    test(`R5: one section per entry, in order (${look})`, async ({ page }) => {
      await page.goto(`/preview.html?look=${look}`);
      const names = await page
        .locator("section[data-component]")
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-component")),
        );
      expect(names.slice(0, COMPONENTS.length)).toEqual(COMPONENTS);
      const headings = await page
        .locator("section[data-component] > h2")
        .allTextContents();
      expect(headings).toEqual(names);
    });

    test(`R6: figures per entry equal data-count, with a caption and a surface panel (${look})`, async ({
      page,
    }) => {
      await page.goto(`/preview.html?look=${look}`);
      const sections = page.locator("section[data-component]");
      const count = await sections.count();
      expect(count).toBeGreaterThanOrEqual(COMPONENTS.length);
      for (let i = 0; i < count; i++) {
        const section = sections.nth(i);
        const name = await section.getAttribute("data-component");
        const declared = Number(await section.getAttribute("data-count"));
        expect(declared, name ?? "").toBeGreaterThan(0);
        await expect(section.locator("figure"), name ?? "").toHaveCount(
          declared,
        );
        await expect(section.locator("figure > figcaption")).toHaveCount(
          declared,
        );
        const ids = await section
          .locator("figure")
          .evaluateAll((nodes) =>
            nodes.map((node) => node.getAttribute("data-example")),
          );
        for (const id of ids) expect(id).toMatch(new RegExp(`^${name}/.+`));
      }
      const surface =
        look === "calm" ? "rgb(255, 255, 255)" : "rgb(22, 27, 30)";
      const panels = page.locator("figure > .pv-panel");
      for (let i = 0; i < (await panels.count()); i++) {
        await expect(panels.nth(i)).toHaveCSS("background-color", surface);
      }
    });

    test(`R7: no figure failed (${look})`, async ({ page }) => {
      await page.goto(`/preview.html?look=${look}`);
      await expect(page.locator("figure").first()).toBeVisible();
      await expect(page.locator("[data-failed]")).toHaveCount(0);
    });
  }
});

// Table A2: the 13 overlay examples. The figure holds the opener; the layer is
// in body, so its selectors exist only once it is open (R23). `selectors` must
// all match; `without` must match nothing.
type Overlay = {
  entry: "Menu" | "Modal" | "Sheet";
  id: string;
  selectors: string[];
  without?: string;
};
const TABLE_A2: Overlay[] = [
  { entry: "Menu", id: "default", selectors: ['.menu[role="menu"]'] },
  { entry: "Menu", id: "start", selectors: ['.menu[role="menu"]'] },
  { entry: "Menu", id: "groups", selectors: [".menu .mt", ".menu hr"] },
  { entry: "Menu", id: "danger", selectors: [".menu button.dng"] },
  {
    entry: "Menu",
    id: "disabled",
    selectors: ['.menu button[aria-disabled="true"]'],
  },
  { entry: "Menu", id: "icon", selectors: [".menu button .ic"] },
  {
    entry: "Modal",
    id: "with-footer",
    selectors: ['.scrim .modal[role="dialog"] .mft'],
  },
  { entry: "Modal", id: "no-footer", selectors: [".scrim .modal .mbd"] },
  {
    entry: "Modal",
    id: "label-only",
    selectors: [".scrim .modal[aria-label]"],
  },
  { entry: "Modal", id: "opaque", selectors: [".scrim.opaque"] },
  {
    entry: "Modal",
    id: "no-close",
    selectors: [".scrim .modal"],
    without: ".scrim .modal .mhd button",
  },
  { entry: "Sheet", id: "rows", selectors: [".scrim.sheet .modal"] },
  { entry: "Sheet", id: "long-body", selectors: [".scrim.sheet .modal"] },
];

// Table B1: what the specs oblige the examples to draw. Each selector is read
// inside a figure. A selector written as a function needs more than CSS.
type Check = string | { name: string; run: (page: Page) => Promise<number> };

const inFigure = (selector: string) => `figure ${selector}`;

const TABLE_B1: Record<string, Check[]> = {
  Button: [
    ".btn",
    ".btn.primary",
    ".btn.danger",
    ".btn.ghost",
    ".btn.sm",
    ".btn[disabled]",
    ".linkbtn",
  ],
  IconButton: [
    ".ib",
    ".ib.sm",
    ".ib.on",
    '.ib[aria-pressed="false"]',
    ".ib[disabled]",
  ],
  Chip: [
    ".chips",
    ".chip",
    ".chip.sm",
    '.chip[aria-pressed="true"]',
    '.chip[aria-pressed="false"]',
    ".chip[disabled]",
  ],
  Switch: [
    '.sw[aria-checked="true"]',
    '.sw[aria-checked="false"]',
    ".sw[disabled]",
  ],
  Field: [
    "label.lbl + input.inp",
    ".inp.code",
    "textarea.inp",
    {
      name: ".inp:not(.code) with no label.lbl before it",
      run: (page) =>
        page.evaluate(
          () =>
            [
              ...document.querySelectorAll(
                'figure[data-example^="Field/"] input.inp:not(.code)',
              ),
            ].filter(
              (node) =>
                !node.closest("label.field") &&
                !node.previousElementSibling?.matches("label.lbl"),
            ).length,
        ),
    },
    "label.field .ic",
    "label.field:not(:has(.ic))",
    ".inp.invalid",
    ".inp[readonly]",
    ".inp[disabled]",
    '.gerr[role="alert"]',
  ],
  Select: [".sel", ".sel.invalid", ".sel[disabled]"],
  Tag: [".tag"],
  Badge: [".cnt", ".cnt.mute", ".cnt.mn"],
  Avatar: [".av", '.av[style*="--s"]', ".pdw .av"],
  PresenceDot: [
    ".pd",
    ".pd.away",
    ".pd.dnd",
    '.pd[role="img"]',
    '.pd[aria-hidden="true"]',
  ],
  EmptyState: [
    ".empty .eic .ic",
    ".empty:has(button)",
    ".empty:not(:has(button))",
  ],
  Toast: [".toast", ".toast button"],
};

// Table B2: not obliged by the specs; reported, not failed (concern 6 (g)).
const TABLE_B2: Record<string, string[]> = {
  Button: [".btn.wide", ".btn .ic", ".linkbtn[disabled]"],
  Select: [".sel.wide", ".lbl + .sel"],
  Badge: [".cnt .sr"],
  Field: [".field.invalid", ".field.readonly", ".field.disabled"],
};

async function count(page: Page, check: Check) {
  if (typeof check !== "string") return check.run(page);
  return page.locator(inFigure(check)).count();
}

test.describe("Table B1 and B2 (R8)", () => {
  for (const look of LOOKS) {
    test(`every selector of Table B1 matches inside a figure (${look})`, async ({
      page,
    }) => {
      await page.goto(`/preview.html?look=${look}`);
      await expect(page.locator("figure").first()).toBeVisible();
      const missing: string[] = [];
      for (const [component, checks] of Object.entries(TABLE_B1)) {
        for (const check of checks) {
          const name = typeof check === "string" ? check : check.name;
          if ((await count(page, check)) === 0) {
            missing.push(`${component}: ${name}`);
          }
        }
      }
      expect(missing, "selectors that match nothing").toEqual([]);
    });

    test(`Table B2 is reported, not failed (${look})`, async ({ page }) => {
      await page.goto(`/preview.html?look=${look}`);
      await expect(page.locator("figure").first()).toBeVisible();
      for (const [component, selectors] of Object.entries(TABLE_B2)) {
        for (const selector of selectors) {
          const found = await page.locator(inFigure(selector)).count();
          if (found === 0) {
            test.info().annotations.push({
              type: "table-b2-unmatched",
              description: `${component}: ${selector}`,
            });
          }
        }
      }
    });
  }

  test("the entries that exist each have a figure", async ({ page }) => {
    await page.goto("/preview.html");
    for (const component of COMPONENTS) {
      await expect(
        page.locator(`figure[data-example^="${component}/"]`).first(),
        component,
      ).toBeAttached();
    }
  });

  test("Menu, Modal and Sheet have an entry whose ids include the 13 of Table A2", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    for (const component of ["Menu", "Modal", "Sheet"]) {
      const ids = await page
        .locator(`figure[data-example^="${component}/"]`)
        .evaluateAll((nodes) =>
          nodes.map((node) => node.getAttribute("data-example")),
        );
      expect(ids.length, component).toBeGreaterThan(0);
      const wanted = TABLE_A2.filter((row) => row.entry === component).map(
        (row) => `${row.entry}/${row.id}`,
      );
      for (const id of wanted) expect(ids, component).toContain(id);
    }
    expect(TABLE_A2).toHaveLength(13);
  });
});

// The 32 custom properties of TOKI-009 R10, in the order the page lists them.
const TOKEN_NAMES = [
  "--bg",
  "--surface",
  "--surface-2",
  "--ink",
  "--ink-2",
  "--muted",
  "--line",
  "--mention-bg",
  "--mention-ink",
  "--danger",
  "--danger-soft",
  "--live",
  "--on-live",
  "--idea",
  "--idea-soft",
  "--hover",
  "--scrim",
  "--accent",
  "--on-accent",
  "--accent-soft",
  "--accent-text",
  "--av-s",
  "--av-l",
  "--av-ts",
  "--av-tl",
  "--av",
  "--gap",
  "--row",
  "--radius",
  "--radius-sm",
  "--shadow",
  "--pop",
];

test.describe("section order, icons, tokens (R5, R9, R11)", () => {
  test("R5: the sections come in order (fonts are not drawn yet)", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const order = await page
      .locator("section[data-section]")
      .evaluateAll((nodes) =>
        nodes.map(
          (node) =>
            node.getAttribute("data-component") ??
            node.getAttribute("data-section"),
        ),
      );
    expect(order.slice(0, 2)).toEqual(["tokens", "icons"]);
    expect(order.slice(2, 2 + COMPONENTS.length)).toEqual(COMPONENTS);
    expect(order.at(-1)).toBe("live-toasts");
    for (const heading of await page
      .locator("section[data-section] > h2")
      .all()) {
      await expect(heading).not.toBeEmpty();
    }
  });

  test.fixme(`R5, R10: the fonts section comes between tokens and icons, with seven rows and seven loaded faces (${PENDING_TOKI_010})`, async () => {});

  test("R9: 43 icon cells, each captioned with its name, and a row of four sizes", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const section = page.locator('section[data-section="icons"]');
    const cells = section.locator("[data-icon]");
    await expect(cells).toHaveCount(43);
    await expect(section).toHaveAttribute("data-count", "43");
    const names = await cells.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-icon")),
    );
    expect(new Set(names).size).toBe(43);
    for (let i = 0; i < 43; i++) {
      const cell = cells.nth(i);
      await expect(cell.locator("svg.ic")).toHaveCount(1);
      await expect(cell.locator("figcaption, .pv-icon-name")).toHaveText(
        names[i]!,
      );
    }
    const sizes = section.locator("[data-icon-size]");
    await expect(sizes).toHaveCount(4);
    for (const size of [12, 18, 24, 30]) {
      await expect(
        section.locator(`[data-icon-size="${size}"] svg`),
      ).toHaveAttribute("width", String(size));
    }
  });

  test("R11: 32 token rows with a value, and the values follow the controls", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const rows = page.locator('section[data-section="tokens"] [data-token]');
    await expect(rows).toHaveCount(32);
    const names = await rows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-token")),
    );
    expect(names).toEqual(TOKEN_NAMES);
    const value = (name: string) =>
      page.locator(`[data-token="${name}"] [data-token-value]`);
    for (const name of TOKEN_NAMES) await expect(value(name)).not.toBeEmpty();

    await expect(value("--accent")).toHaveText("#0F766E");
    await page.locator('[data-control="accent"]').selectOption("indigo");
    await expect(value("--accent")).toHaveText("#4F46E5");
    await page.locator('[data-control="look"]').selectOption("focus");
    await expect(value("--accent")).toHaveText("#A5B4FC");
    await page.locator('[data-control="look"]').selectOption("calm");
    await page.locator('[data-control="accent"]').selectOption("teal");
    await expect(value("--bg")).toHaveText("#F2F4EF");
    await expect(value("--av")).toHaveText("36px");
    await page.locator('[data-control="density"]').selectOption("compact");
    await expect(value("--av")).toHaveText("30px");
  });

  test("R11: a colour token shows a swatch, and a length does not", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const swatch = (name: string) =>
      page.locator(`[data-token="${name}"] [data-swatch]`);
    await expect(swatch("--bg")).toHaveCount(1);
    await expect(swatch("--hover")).toHaveCount(1);
    await expect(swatch("--bg")).toHaveCSS(
      "background-color",
      "rgb(242, 244, 239)",
    );
    await expect(swatch("--radius")).toHaveCount(0);
    await expect(swatch("--shadow")).toHaveCount(0);
  });
});

test.describe("live toasts (R12)", () => {
  test("one polite live region on the page", async ({ page }) => {
    await page.goto("/preview.html");
    await expect(page.locator('[aria-live="polite"]')).toHaveCount(1);
  });

  test("R12: a plain toast shows in the region and is gone within 4 s", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const region = page.locator('[aria-live="polite"]');
    await page
      .getByRole("button", { name: "Show a toast", exact: true })
      .click();
    await expect(region.locator(".toast")).toHaveCount(1);
    await expect(region.locator(".toast button")).toHaveCount(0);
    await expect(region.locator(".toast")).toHaveCount(0, { timeout: 4000 });
  });

  test("R12: a toast with an action is gone within 7 s, or at once when pressed", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const region = page.locator('[aria-live="polite"]');
    const counter = page.locator("[data-toast-counter]");
    await expect(counter).toContainText("0");
    await page
      .getByRole("button", { name: "Show a toast with an action" })
      .click();
    await expect(region.locator(".toast")).toHaveCount(1);
    await region.locator(".toast button").click();
    await expect(region.locator(".toast")).toHaveCount(0);
    await expect(counter).toContainText("1");

    await page
      .getByRole("button", { name: "Show a toast with an action" })
      .click();
    await expect(region.locator(".toast")).toHaveCount(1);
    await expect(region.locator(".toast")).toHaveCount(0, { timeout: 7000 });
    await expect(counter).toContainText("1");
  });

  test("R12: three toasts in a row appear in the order shown", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const region = page.locator('[aria-live="polite"]');
    await page.getByRole("button", { name: "Show three toasts" }).click();
    await expect(region.locator(".toast")).toHaveCount(3);
    await expect(region.locator(".toast span")).toHaveText([
      "First toast",
      "Second toast",
      "Third toast",
    ]);
  });
});

test.describe("console and requests (R20)", () => {
  for (const look of LOOKS) {
    test(`loading the page logs no error or warning and asks only its own address (${look})`, async ({
      page,
      baseURL,
    }) => {
      const logged: string[] = [];
      const foreign: string[] = [];
      page.on("console", (message) => {
        if (["error", "warning"].includes(message.type())) {
          logged.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) =>
        logged.push(`pageerror: ${error.message}`),
      );
      page.on("request", (request) => {
        if (!request.url().startsWith(`${baseURL}/`)) {
          foreign.push(request.url());
        }
      });
      await page.goto(`/preview.html?look=${look}`);
      await expect(page.locator("figure").first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      expect(logged).toEqual([]);
      expect(foreign).toEqual([]);
    });
  }
});

// Table C (R14): what the browser must draw, in each look, with teal and no
// density chosen. "X" of the spec is :not([disabled]), added to every row so
// that the dimmed look of a disabled control is not read.
const X = ":not([disabled])";

// A hexadecimal colour as the browser writes it from a computed style.
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${n >> 16}, ${(n >> 8) & 255}, ${n & 255})`;
}

type Pair = { calm: string; focus: string };
type Row = {
  name: string;
  selector: string;
  props: Array<{ property: string; value: Pair }>;
  focus?: Array<{ property: string; value: Pair }>;
};

const btn = `.btn:not(.primary):not(.danger):not(.ghost):not(.sm):not(.wide)${X}`;
const inp = `.inp:not(.code):not(.invalid):not([readonly])${X}`;

const colour = (calm: string, focus: string): Pair => ({
  calm: rgb(calm),
  focus: rgb(focus),
});

const TABLE_C: Row[] = [
  {
    name: "1 Button radius",
    selector: btn,
    props: [
      { property: "border-radius", value: { calm: "10px", focus: "8px" } },
    ],
  },
  {
    name: "2 Button colours",
    selector: btn,
    props: [
      { property: "background-color", value: colour("#FFFFFF", "#161B1E") },
      { property: "color", value: colour("#16201D", "#E8EDEB") },
      { property: "border-top-color", value: colour("#E0E5DF", "#283035") },
    ],
  },
  {
    name: "3 Button primary",
    selector: `.btn.primary${X}`,
    props: [
      { property: "background-color", value: colour("#0F766E", "#5EEAD4") },
      { property: "color", value: colour("#FFFFFF", "#04201C") },
    ],
  },
  {
    name: "4 Button danger",
    selector: `.btn.danger${X}`,
    props: [
      { property: "background-color", value: colour("#B42318", "#F97066") },
      { property: "color", value: colour("#FFFFFF", "#161B1E") },
    ],
  },
  {
    name: "5 IconButton",
    selector: `.ib:not(.on):not(.sm)${X}`,
    props: [{ property: "color", value: colour("#3A4541", "#C9D1CE") }],
  },
  {
    name: "6 IconButton pressed",
    selector: `.ib.on${X}`,
    props: [
      { property: "background-color", value: colour("#DCEFEA", "#123B36") },
      { property: "color", value: colour("#0B5D56", "#7EF0DE") },
    ],
  },
  {
    name: "7 Chip pressed",
    selector: `.chip[aria-pressed="true"]${X}`,
    props: [
      { property: "background-color", value: colour("#DCEFEA", "#123B36") },
      { property: "color", value: colour("#0B5D56", "#7EF0DE") },
    ],
  },
  {
    name: "8a Switch off",
    selector: `.sw[aria-checked="false"]${X}`,
    props: [
      { property: "background-color", value: colour("#E0E5DF", "#283035") },
    ],
  },
  {
    name: "8b Switch on",
    selector: `.sw[aria-checked="true"]${X}`,
    props: [
      { property: "background-color", value: colour("#0F766E", "#5EEAD4") },
    ],
  },
  {
    name: "9 Field",
    selector: inp,
    props: [
      { property: "border-top-color", value: colour("#E0E5DF", "#283035") },
    ],
    focus: [
      { property: "border-top-color", value: colour("#0F766E", "#5EEAD4") },
      {
        property: "box-shadow",
        value: {
          calm: `${rgb("#DCEFEA")} 0px 0px 0px 3px`,
          focus: `${rgb("#123B36")} 0px 0px 0px 3px`,
        },
      },
    ],
  },
  {
    name: "10 Field error box",
    selector: '.gerr[role="alert"]',
    props: [
      { property: "background-color", value: colour("#FCE8E6", "#3A1614") },
      { property: "color", value: colour("#B42318", "#F97066") },
    ],
  },
  {
    name: "11 Badge",
    selector: ".cnt:not(.mute):not(.mn)",
    props: [
      { property: "background-color", value: colour("#0F766E", "#5EEAD4") },
      { property: "color", value: colour("#FFFFFF", "#04201C") },
    ],
  },
  {
    name: "12 Badge mention",
    selector: ".cnt.mn",
    props: [
      { property: "background-color", value: colour("#B42318", "#F97066") },
      { property: "color", value: colour("#FFFFFF", "#161B1E") },
    ],
  },
  {
    name: "13 Tag",
    selector: ".tag",
    props: [
      {
        property: "background-color",
        value: {
          calm: "rgba(22, 32, 29, 0.055)",
          focus: "rgba(232, 237, 235, 0.07)",
        },
      },
      { property: "color", value: colour("#3A4541", "#C9D1CE") },
    ],
  },
];

test.describe("Table C (R14)", () => {
  for (const look of LOOKS) {
    test(`the 13 rows hold in ${look}`, async ({ page }) => {
      await page.goto(`/preview.html?look=${look}&accent=teal`);
      await expect(page.locator("figure").first()).toBeVisible();
      for (const row of TABLE_C) {
        const element = page.locator(`figure ${row.selector}`).first();
        await expect(element, row.name).toBeAttached();
        for (const { property, value } of row.props) {
          await expect(element, `${row.name} ${property}`).toHaveCSS(
            property,
            value[look],
          );
        }
        if (row.focus) {
          await element.focus();
          for (const { property, value } of row.focus) {
            await expect(element, `${row.name} focused ${property}`).toHaveCSS(
              property,
              value[look],
            );
          }
        }
      }
    });
  }
});

test.describe("accent and density reach the components (R15)", () => {
  test("Calm and indigo", async ({ page }) => {
    await page.goto("/preview.html?look=calm&accent=indigo");
    const primary = page.locator(`figure .btn.primary${X}`).first();
    await expect(primary).toHaveCSS("background-color", rgb("#4F46E5"));
    const chip = page.locator('figure .chip[aria-pressed="true"]').first();
    await expect(chip).toHaveCSS("background-color", rgb("#E3E5FB"));
    await expect(chip).toHaveCSS("color", rgb("#3730A3"));
  });

  test("Focus and indigo", async ({ page }) => {
    await page.goto("/preview.html?look=focus&accent=indigo");
    const primary = page.locator(`figure .btn.primary${X}`).first();
    await expect(primary).toHaveCSS("background-color", rgb("#A5B4FC"));
    await expect(primary).toHaveCSS("color", rgb("#1E1B4B"));
    const chip = page.locator('figure .chip[aria-pressed="true"]').first();
    await expect(chip).toHaveCSS("background-color", rgb("#25285A"));
    await expect(chip).toHaveCSS("color", rgb("#C7D2FE"));
  });

  const sizes: Array<[string, string, string, string]> = [
    ["calm", "", "36px", "the look's own"],
    ["focus", "", "30px", "the look's own"],
    ["calm", "compact", "30px", "compact"],
    ["focus", "comfortable", "36px", "comfortable"],
  ];
  for (const [look, density, width, label] of sizes) {
    test(`the default avatar is ${width} wide in ${look} with ${label}`, async ({
      page,
    }) => {
      const query = density ? `&density=${density}` : "";
      await page.goto(`/preview.html?look=${look}${query}`);
      const av = page.locator('figure .av:not([style*="--s"])').first();
      await expect(av).toHaveCSS("width", width);
    });
  }

  test("an avatar with a size keeps it, whatever the density", async ({
    page,
  }) => {
    for (const density of ["comfortable", "compact"]) {
      await page.goto(`/preview.html?look=calm&density=${density}`);
      const sized = page.locator('figure .av[style*="--s"]');
      await expect(sized.first()).toBeAttached();
      const bad = await sized.evaluateAll((nodes) =>
        nodes
          .filter(
            (node) =>
              getComputedStyle(node).width !==
              getComputedStyle(node).getPropertyValue("--s").trim(),
          )
          .map((node) => node.getAttribute("style")),
      );
      expect(bad).toEqual([]);
    }
  });
});

test.describe("layouts (R16)", () => {
  const WINDOWS: Array<[number, number]> = [
    [360, 560],
    [719, 900],
    [720, 900],
    [1099, 900],
    [1100, 900],
    [1400, 900],
  ];
  for (const look of LOOKS) {
    for (const [width, height] of WINDOWS) {
      test(`no sideways scroll and no wide figure at ${width} px (${look})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height });
        await page.goto(`/preview.html?look=${look}`);
        await expect(page.locator("figure").first()).toBeVisible();
        const measured = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          inner: window.innerWidth,
          wide: [...document.querySelectorAll("figure")]
            .filter(
              (node) => node.getBoundingClientRect().width > window.innerWidth,
            )
            .map((node) => node.getAttribute("data-example")),
        }));
        expect(measured.scroll).toBeLessThanOrEqual(measured.inner);
        expect(measured.wide).toEqual([]);
      });
    }
  }

  test("at 719 px every control is at least 40 px tall, except .linkbtn and .sw", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 719, height: 900 });
    await page.goto("/preview.html");
    await expect(page.locator("figure").first()).toBeVisible();
    const short = await page.evaluate(() => {
      const selector =
        ".btn:not(.linkbtn), .ib, .chip, .inp, .sel, .field, .toast button";
      return [...document.querySelectorAll(selector)]
        .map((node) => ({
          selector: node.className,
          tag: node.tagName,
          height: node.getBoundingClientRect().height,
        }))
        .filter((item) => item.height < 40);
    });
    expect(short).toEqual([]);
  });

  test("at 720 px the sizes drop to 34, 28, 34 and 28 px", async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto("/preview.html");
    await expect(page.locator("figure").first()).toBeVisible();
    const heightOf = (selector: string) =>
      page.locator(`figure ${selector}`).first();
    await expect(heightOf(".btn:not(.sm):not(.wide):not(.linkbtn)")).toHaveCSS(
      "height",
      "34px",
    );
    await expect(heightOf(".btn.sm")).toHaveCSS("height", "28px");
    await expect(heightOf(".ib:not(.sm)")).toHaveCSS("height", "34px");
    await expect(heightOf(".chip:not(.sm)")).toHaveCSS("height", "28px");
  });
});

// Table D (R17): the prototype lines each section is compared with. Rows for
// sections that are not on the page yet (fonts) are not checked until the
// section exists; PersonChip is TOKI-034's.
const TABLE_D: Record<string, string> = {
  Button: "82-93, 309, 714",
  IconButton: "94-97",
  Chip: "98-101, 185",
  Switch: "338-341",
  Field: "186-189, 345-348, 715, 716",
  Select: "344, 701",
  Tag: "121",
  Badge: "102-104, 586",
  Avatar: "115-120, 529, 599-600",
  PresenceDot: "115-120, 599-600",
  EmptyState: "363-366",
  Toast: "419-423",
  Menu: "410-416, 538, 2103-2112, 2129",
  Modal: "404-409, 560-561, 2134, 2142, 2152, 2196",
  Sheet: "2155 (no CSS rule in the prototype: TOKI-014 Table B, decided)",
  PersonChip: "none",
  tokens:
    "6-56, without the six Meet variables --stage, --stage-bar, --stage-ink, --stage-line, --stage-muted and --tile that TOKI-009 R18 leaves out",
  icons: "the ICONS table at about line 835",
  fonts:
    "the font link of the prototype's head; the families in TOKI-010 Table A",
};

test.describe("prototype references (R17)", () => {
  test("every section shows the lines of Table D", async ({ page }) => {
    await page.goto("/preview.html");
    const sections = page.locator(
      "section[data-component], section[data-section='tokens'], section[data-section='fonts'], section[data-section='icons']",
    );
    const found = await sections.evaluateAll((nodes) =>
      nodes.map((node) => ({
        name:
          node.getAttribute("data-component") ??
          node.getAttribute("data-section"),
        refs: [...node.querySelectorAll("[data-prototype-ref]")].map((ref) =>
          ref.getAttribute("data-prototype-ref"),
        ),
        text: node.querySelector("[data-prototype-ref]")?.textContent ?? "",
      })),
    );
    expect(found.length).toBeGreaterThanOrEqual(2 + COMPONENTS.length);
    for (const { name, refs, text } of found) {
      expect(refs, `${name} has one line`).toHaveLength(1);
      expect(refs[0], name ?? "").not.toBe("No prototype reference recorded");
      expect(refs[0], name ?? "").toBe(TABLE_D[name ?? ""]);
      expect(text, name ?? "").toContain(refs[0]!);
    }
  });

  test("a section whose value is none has a row none in Table D", async ({
    page,
  }) => {
    await page.goto("/preview.html");
    const nones = await page
      .locator('[data-prototype-ref="none"]')
      .evaluateAll((nodes) =>
        nodes.map(
          (node) =>
            node.closest("section")?.getAttribute("data-component") ??
            node.closest("section")?.getAttribute("data-section"),
        ),
      );
    for (const name of nones) expect(TABLE_D[name ?? ""]).toBe("none");
  });

  test.fixme(`the fonts section shows its line (${PENDING_TOKI_010})`, async () => {});
});

// Placeholders for the checks that cannot run yet, so that each one is listed
// in the report and none is forgotten (plan, decision 1).
test.describe("deferred checks", () => {
  test.fixme(`R20: seven .woff2 responses come from the page's own address (${PENDING_TOKI_010})`, async () => {});
  test.fixme(`R24: the screenshots of the six views match the committed images (${PENDING_TOKI_010}: images made with the wrong fonts would be redone)`, async () => {});
});

// R13: Menu, Modal and Sheet open from the first button of their first figure,
// and Escape closes them with focus back on that button.
test.describe("overlays open and close (R13)", () => {
  const roles = { Menu: "menu", Modal: "dialog", Sheet: "dialog" } as const;
  for (const [entry, role] of Object.entries(roles)) {
    test(`${entry}: the first button opens a ${role}, Escape closes it and focus returns`, async ({
      page,
    }) => {
      await page.goto("/preview.html");
      const figure = page.locator(`figure[data-example^="${entry}/"]`).first();
      const opener = figure.locator("button").first();
      await opener.click();
      await expect(page.getByRole(role as "menu" | "dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole(role as "menu" | "dialog")).toHaveCount(0);
      await expect(opener).toBeFocused();
    });
  }
});

// R23: each of the 13 examples opens and closes, in both looks.
const LAYER = ".menu, .scrim";
test.describe("the 13 overlay examples (R23)", () => {
  for (const look of LOOKS) {
    for (const row of TABLE_A2) {
      test(`${row.entry}/${row.id} opens and closes (${look})`, async ({
        page,
      }) => {
        await page.goto(`/preview.html?look=${look}`);
        const figure = page.locator(
          `figure[data-example="${row.entry}/${row.id}"]`,
        );
        await figure.locator("button").first().click();
        for (const selector of row.selectors) {
          await expect(page.locator(selector).first(), selector).toBeVisible();
        }
        if (row.without) {
          await expect(page.locator(row.without)).toHaveCount(0);
        }
        await page.keyboard.press("Escape");
        if ((await page.locator(LAYER).count()) > 0) {
          // opaque and no-close ignore Escape: use the first button inside
          // .modal that is not in .mhd.
          await page.locator(".modal button:not(.mhd button)").first().click();
        }
        await expect(page.locator(LAYER)).toHaveCount(0);
      });
    }
  }
});

test.describe("the panel stays inside the window (R23)", () => {
  const WINDOWS: Array<[number, number]> = [
    [360, 560],
    [719, 900],
    [720, 900],
    [1099, 900],
    [1100, 900],
  ];
  const OPEN = [
    { entry: "Modal", id: "with-footer", panel: ".modal" },
    { entry: "Sheet", id: "long-body", panel: ".modal" },
    { entry: "Menu", id: "groups", panel: ".menu" },
  ];
  for (const look of LOOKS) {
    for (const [width, height] of WINDOWS) {
      for (const open of OPEN) {
        test(`${open.entry}/${open.id} at ${width} px (${look})`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height });
          await page.goto(`/preview.html?look=${look}`);
          await page
            .locator(`figure[data-example="${open.entry}/${open.id}"] button`)
            .first()
            .click();
          const panel = page.locator(open.panel).first();
          await expect(panel).toBeVisible();
          await expect
            .poll(async () =>
              panel.evaluate((node) => {
                const r = node.getBoundingClientRect();
                return (
                  r.left >= 0 &&
                  r.top >= 0 &&
                  r.right <= window.innerWidth &&
                  r.bottom <= window.innerHeight
                );
              }),
            )
            .toBe(true);
        });
      }
    }
  }
});
