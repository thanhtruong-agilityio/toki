import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

// The component preview page (TOKI-016). "The page" is /preview.html on the
// development server that `pnpm test:e2e` starts.

// Deferred checks name what they wait for, once each (plan, decision 1).
export const PENDING_TOKI_010 = "waits for TOKI-010 (fonts are not on main)";
export const PENDING_TOKI_014 =
  "waits for TOKI-014 (Menu, Modal and Sheet are not on main)";

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

// The entries that exist on main (TOKI-012 and TOKI-013), in the order of
// componentExamples. Menu, Modal and Sheet follow with TOKI-014.
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
      expect(names).toEqual(COMPONENTS);
      const headings = await page
        .locator("section[data-component] > h2")
        .allTextContents();
      expect(headings).toEqual(COMPONENTS);
    });

    test(`R6: figures per entry equal data-count, with a caption and a surface panel (${look})`, async ({
      page,
    }) => {
      await page.goto(`/preview.html?look=${look}`);
      const sections = page.locator("section[data-component]");
      const count = await sections.count();
      expect(count).toBe(COMPONENTS.length);
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

  test.fixme(`Menu, Modal and Sheet have an entry, and their ids include the 13 of Table A2 (${PENDING_TOKI_014})`, async () => {});
});
