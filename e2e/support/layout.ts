import { expect, type Page } from "@playwright/test";

// The layout checks of e2e/sign-in.spec.ts (TOKI-023 R29), shared with e2e/join.spec.ts (TOKI-097 R40).
// R29: nothing clipped, no sideways scrolling, every control reachable, and under 720 px every control
// at least 40 px tall.
export async function expectFits(
  page: Page,
  label: string,
  scope = "#root",
  options: { noControls?: boolean } = {},
): Promise<void> {
  const width = page.viewportSize()!.width;
  const report = await page.evaluate((scope) => {
    const doc = document.scrollingElement!;
    const vw = document.documentElement.clientWidth;
    const clipped: string[] = [];
    const controls: { name: string; height: number; covered: boolean }[] = [];
    const root = document.querySelector(scope) ?? document.body;
    for (const el of root.querySelectorAll<HTMLElement>("*")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const tag = `${el.tagName.toLowerCase()}.${el.className}`;
      if (rect.left < -0.5 || rect.right > vw + 0.5) clipped.push(`${tag} off`);
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        const overflow = getComputedStyle(el).overflowX;
        if (overflow !== "visible" || el.tagName !== "BUTTON")
          clipped.push(`${tag} text ${el.scrollWidth}>${el.clientWidth}`);
      }
      if (el.matches("button, input, a[href]")) {
        el.scrollIntoView({ block: "nearest" });
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.left + r.width / 2,
          r.top + r.height / 2,
        );
        controls.push({
          name: `${tag} "${el.textContent || el.getAttribute("aria-label") || ""}"`,
          height: r.height,
          covered: !(hit === el || el.contains(hit)),
        });
      }
    }
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      clipped,
      controls,
    };
  }, scope);
  expect(report.scrollWidth, `${label}: sideways scroll`).toBeLessThanOrEqual(
    report.clientWidth,
  );
  expect(report.clipped, `${label}: clipped`).toEqual([]);
  if (!options.noControls) {
    expect(report.controls.length, `${label}: controls`).toBeGreaterThan(0);
  }
  for (const c of report.controls) {
    expect(c.covered, `${label}: ${c.name} is reachable`).toBe(false);
    if (width < 720)
      expect(c.height, `${label}: ${c.name} height`).toBeGreaterThanOrEqual(40);
  }
}

// The card of a step with no message must fit the height of 360 × 560 without scrolling (Design:
// Layout at the three widths).
export async function expectNoVerticalScroll(page: Page, label: string) {
  const [scroll, client] = await page.evaluate(() => [
    document.scrollingElement!.scrollHeight,
    document.scrollingElement!.clientHeight,
  ]);
  expect(scroll, `${label}: fits the height`).toBeLessThanOrEqual(client);
}
