import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

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
