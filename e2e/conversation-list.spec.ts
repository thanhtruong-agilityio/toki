import { expect, test, type Page } from "@playwright/test";
import { stubBootstrap } from "./support/bootstrap";
import {
  fiveHundred,
  forty,
  GENERAL,
  twelve,
  uuid,
  type Workspace,
} from "./support/fixtures";
import { stubSignedIn } from "./support/session";
import { setLook, type Look } from "./support/sign-in";

// TOKI-033 R30: the real app in Chromium, the network answers stubbed with `page.route`. The
// fixtures are in e2e/support/fixtures.ts; a unit test of apps/web parses them with the schema of
// packages/shared.

const DESIGN = uuid(101);
const LOOKS: Look[] = ["calm", "focus"];
const SIZES = [
  [360, 560],
  [719, 800],
  [720, 800],
  [1100, 800],
  [1400, 900],
] as const;

async function open(
  page: Page,
  workspace: Workspace,
  options: { width?: number; height?: number; look?: Look; path?: string } = {},
) {
  await stubSignedIn(page);
  await stubBootstrap(page, workspace);
  await setLook(page, options.look ?? "calm");
  await page.setViewportSize({
    width: options.width ?? 1100,
    height: options.height ?? 800,
  });
  await page.goto(options.path ?? "/");
  await page.getByTestId("shell").waitFor();
}

const row = (page: Page, name: string) =>
  page.locator(".cr", { has: page.locator(`.nm:text-is("${name}")`) });

// What the app's store holds, reached through the module the page itself loaded.
async function inStore(page: Page, run: string): Promise<void> {
  await page.evaluate(
    async ([url, code]) => {
      const mod = (await import(/* @vite-ignore */ url!)) as {
        conversations: Record<string, (...args: unknown[]) => unknown>;
      };
      new Function("store", code!)(mod.conversations);
    },
    ["/src/client.ts", run],
  );
}

test.describe("opening the app (R23)", () => {
  test("a wide window ends at #general, and Back from a second conversation returns to the first", async ({
    page,
  }) => {
    await open(page, twelve(), { width: 1100 });
    await expect(page).toHaveURL(new RegExp(`/c/${GENERAL}$`));
    await expect(
      page.getByTestId("conversation-page").getByRole("heading", { level: 1 }),
    ).toHaveText("general");
    await row(page, "design").click();
    await expect(page).toHaveURL(new RegExp(`/c/${DESIGN}$`));
    await expect(row(page, "design")).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/c/${GENERAL}$`));
    await expect(row(page, "general")).toHaveAttribute("aria-current", "page");
  });

  test("a narrow window stays at `/` and shows the list", async ({ page }) => {
    await open(page, twelve(), { width: 360, height: 560 });
    await expect(row(page, "design")).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByTestId("shell")).toHaveAttribute(
      "data-pane",
      "list",
    );
  });

  test("a window that goes from narrow to wide while at `/` redirects then", async ({
    page,
  }) => {
    await open(page, twelve(), { width: 360, height: 560 });
    await page.setViewportSize({ width: 1100, height: 800 });
    await expect(page).toHaveURL(new RegExp(`/c/${GENERAL}$`));
  });
});

test.describe("opening a row (R20)", () => {
  test("at 360 px a press shows the conversation and Back shows the list with its scroll kept", async ({
    page,
  }) => {
    await open(page, forty(), { width: 360, height: 560 });
    const list = page.locator("div.clist");
    await list.evaluate((el) => (el.scrollTop = 300));
    const before = await list.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(0);
    const target = page.locator(".cr:visible").nth(8);
    const name = (await target.locator(".nm").textContent()) ?? "";
    await target.click();
    await expect(page).toHaveURL(/\/c\//);
    await expect(
      page.getByTestId("conversation-page").getByRole("heading", { level: 1 }),
    ).toHaveText(name.trim());
    await page.goBack();
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByTestId("shell")).toHaveAttribute(
      "data-pane",
      "list",
    );
    await expect.poll(() => list.evaluate((el) => el.scrollTop)).toBe(before);
  });
});

for (const look of LOOKS) {
  test.describe(`the list in ${look}`, () => {
    for (const [width, height] of SIZES) {
      test(`R11 empty state, R14 and the search field at ${width} px`, async ({
        page,
      }) => {
        await open(page, forty(), { width, height, look });
        const narrow = width < 720;
        // The search field is shown in both looks, at every width (concern 1).
        const search = page.getByRole("searchbox");
        await expect(search).toBeVisible();

        const rowHeight = await page
          .locator(".cr")
          .first()
          .evaluate((el) => el.getBoundingClientRect().height);
        if (narrow) {
          // R14: every control is at least 40 px tall; a row is 52.
          expect(rowHeight).toBeCloseTo(52, 0);
          const chip = await page
            .locator(".cfilter .chip")
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          expect(chip).toBeGreaterThanOrEqual(40);
          const sec = await page
            .locator("button.sec")
            .first()
            .evaluate((el) => el.getBoundingClientRect().height);
          expect(sec).toBeGreaterThanOrEqual(40);
        } else if (width === 1100) {
          expect(rowHeight).toBeCloseTo(32, 0);
        }

        if (width === 360) {
          // R14: the heading takes the narrow padding in both looks, and nothing scrolls sideways.
          const paddings = await page.evaluate(() => ({
            ch: getComputedStyle(document.querySelector(".ch")!).paddingLeft,
            filter: getComputedStyle(document.querySelector(".cfilter")!)
              .paddingLeft,
          }));
          expect(paddings.filter).toBe("16px");
          expect(paddings.ch).toBe(paddings.filter);
          const clist = await page.locator("div.clist").evaluate((el) => ({
            scroll: el.scrollWidth,
            client: el.clientWidth,
          }));
          expect(clist.scroll).toBeLessThanOrEqual(clist.client);
          // The long name is cut with an ellipsis, not wrapped.
          const name = page
            .locator(".cr .nm")
            .filter({ hasText: "a-channel-with-a-name" });
          const style = await name.evaluate((el) => {
            const css = getComputedStyle(el);
            return {
              overflow: css.textOverflow,
              wrap: css.whiteSpace,
              cut: el.scrollWidth > el.clientWidth,
              lines: el.getBoundingClientRect().height,
            };
          });
          expect(style.overflow).toBe("ellipsis");
          expect(style.wrap).toBe("nowrap");
          expect(style.cut).toBe(true);
          expect(style.lines).toBeLessThan(30);
        }

        // R11: a filter that matches nothing draws the empty state in the space above the end of the list.
        await search.fill("zzzzzz");
        const empty = page.locator("div.clist > .empty");
        await expect(empty).toBeVisible();
        const m = await empty.evaluate((el) => {
          const box = el.getBoundingClientRect();
          const kids = [...el.children].map((c) => c.getBoundingClientRect());
          const top = Math.min(...kids.map((k) => k.top));
          const bottom = Math.max(...kids.map((k) => k.bottom));
          const list = el.parentElement!;
          const lb = list.getBoundingClientRect();
          const pad = Number.parseFloat(getComputedStyle(list).paddingBottom);
          return {
            contentMid: (top + bottom) / 2,
            boxMid: (box.top + box.bottom) / 2,
            bottom: box.bottom,
            // No Browse channels row yet (TOKI-034 registers the opener): the box ends where the list's content ends.
            listEnd: lb.bottom - pad,
          };
        });
        expect(Math.abs(m.contentMid - m.boxMid)).toBeLessThanOrEqual(1);
        expect(Math.abs(m.bottom - m.listEnd)).toBeLessThanOrEqual(1);
      });
    }

    test("a filter that matches nothing clears with its button", async ({
      page,
    }) => {
      await open(page, twelve(), { look });
      await page.getByRole("searchbox").fill("zzzz");
      await page.getByRole("button", { name: "Clear filter" }).click();
      await expect(page.getByRole("searchbox")).toHaveValue("");
      await expect(row(page, "design")).toBeVisible();
    });

    test("R35: 'ngoc' finds 'Ngọc'", async ({ page }) => {
      await open(page, twelve(), { look });
      await expect(row(page, "Ngọc")).toBeVisible();
      await page.getByRole("searchbox").fill("ngoc");
      await expect(row(page, "Ngọc")).toBeVisible();
      await expect(row(page, "design")).toHaveCount(0);
    });

    test("a collapsed group with unread rows shows their total on its heading", async ({
      page,
    }) => {
      await open(page, twelve(), { look });
      await inStore(
        page,
        `store.setUnread("${DESIGN}", { count: 3, mention: false });
         store.setUnread("${uuid(102)}", { count: 2, mention: false });`,
      );
      const channels = page.locator('.cgroup[data-group="channels"]');
      await expect(channels.locator(".sec-count")).toHaveCount(0);
      await channels.locator("button.sec").click();
      // The badge shows 5 and holds the text "5 unread" for a screen reader.
      await expect(channels.locator(".sec-count")).toContainText("5 unread");
      await expect(channels.locator(".cr")).toHaveCount(0);
    });

    test("a refresh leaves the rows on screen", async ({ page }) => {
      await open(page, twelve(), { look });
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      let answers = 0;
      await page.route("**/api/v1/bootstrap", async (route) => {
        answers += 1;
        await gate;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(twelve()),
        });
      });
      await inStore(page, "void store.refresh();");
      await expect.poll(() => answers).toBe(1);
      await expect(row(page, "design")).toBeVisible();
      await expect(page.locator("div.clist")).not.toHaveAttribute(
        "aria-busy",
        "true",
      );
      release();
      await expect(row(page, "design")).toBeVisible();
    });
  });
}

// R13. The opener of the '+' is registered by TOKI-034, so the list draws no '+' yet; the test puts
// the same button in the heading row (class `sec-add`) and reads what the real stylesheet does to it.
const addButton = async (page: Page) => {
  await page.evaluate(() => {
    const head = document.querySelector('.cgroup[data-group="direct"] .sech')!;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sec-add";
    button.setAttribute("aria-label", "Start a direct message");
    button.textContent = "+";
    head.append(button);
  });
  return page.locator(".sec-add");
};
const opacity = (page: Page) =>
  page
    .locator(".sec-add")
    .evaluate((el) => Number(getComputedStyle(el).opacity));

test.describe("the '+' with a mouse (R13)", () => {
  for (const look of LOOKS) {
    test(`is hidden until the heading is hovered or focused (${look})`, async ({
      page,
    }) => {
      await open(page, twelve(), { width: 1100, look });
      await addButton(page);
      await page.mouse.move(2, 2);
      expect(await opacity(page)).toBe(0);
      await page.locator('.cgroup[data-group="direct"] button.sec').hover();
      expect(await opacity(page)).toBe(1);
      await page.mouse.move(2, 2);
      expect(await opacity(page)).toBe(0);
      await page.locator('.cgroup[data-group="direct"] button.sec').focus();
      await page.keyboard.press("Tab");
      await expect(page.locator(".sec-add")).toBeFocused();
      expect(await opacity(page)).toBe(1);
    });
  }
});

test.describe("the '+' with touch (R13)", () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const [width, height] of [
    [1100, 800],
    [360, 560],
  ] as const) {
    test(`is visible with no pointer over it at ${width} px`, async ({
      page,
    }) => {
      await open(page, twelve(), { width, height });
      await addButton(page);
      expect(await opacity(page)).toBe(1);
    });
  }
});

// The measurement of Design, "Where each choice is made": recorded, not asserted (concern 17).
test.describe("500 conversations (measurement, not asserted)", () => {
  for (const [width, height] of [
    [1100, 800],
    [360, 560],
  ] as const) {
    test(`measured at ${width} px`, async ({ page }, info) => {
      const started = Date.now();
      await open(page, fiveHundred(), { width, height });
      await expect(row(page, "channel-013")).toBeAttached();
      const shown = Date.now() - started;
      const result = await page.evaluate(async () => {
        const frame = () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
        const search = document.querySelector<HTMLInputElement>(
          'input[type="search"]',
        )!;
        const set = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )!.set!;
        const timings: number[] = [];
        for (const text of ["c", "ch", "chan", "channel-4", ""]) {
          const t0 = performance.now();
          set.call(search, text);
          search.dispatchEvent(new Event("input", { bubbles: true }));
          await frame();
          timings.push(Math.round(performance.now() - t0));
        }
        return {
          rows: document.querySelectorAll(".cr").length,
          nodes: document.querySelectorAll("*").length,
          keystrokeMs: timings,
        };
      });
      const line = JSON.stringify({ width, shownMs: shown, ...result });
      console.log(`MEASURE 500 ${line}`);
      await info.attach("measurement", {
        body: line,
        contentType: "application/json",
      });
      expect(result.rows).toBeGreaterThan(0);
    });
  }
});
