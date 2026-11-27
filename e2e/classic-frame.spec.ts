import { expect, test, type Page } from "@playwright/test";
import { stubBootstrap } from "./support/bootstrap";
import { twelve, uuid } from "./support/fixtures";
import { stubSignedIn } from "./support/session";
import { setLook, type Look, type Scheme } from "./support/sign-in";

// TOKI-144 R2 to R4 and R6 to R10: the Classic sidebar frame in the real app in Chromium, the
// network answers stubbed with `page.route`, in Classic light and Classic dark. The expected
// values are Table A of the spec and the accents of the design system, typed here.

const SIDE = {
  light: {
    rail: "#0F1719",
    bg: "#16201D",
    ink: "#E4EBE8",
    muted: "#9AA8A3",
    line: "#26332F",
  },
  dark: {
    rail: "#0A0E0F",
    bg: "#12181A",
    ink: "#E8EDEB",
    muted: "#96A29D",
    line: "#232C30",
  },
} as const;
const HOVER = "rgba(255, 255, 255, 0.07)";

// The accents: a light scheme has Calm's, a dark scheme Focus's.
const ACCENT = {
  light: {
    teal: {
      accent: "#0F766E",
      on: "#FFFFFF",
      soft: "#DCEFEA",
      text: "#0B5D56",
    },
    indigo: {
      accent: "#4F46E5",
      on: "#FFFFFF",
      soft: "#E3E5FB",
      text: "#3730A3",
    },
  },
  dark: {
    teal: {
      accent: "#5EEAD4",
      on: "#04201C",
      soft: "#123B36",
      text: "#7EF0DE",
    },
    indigo: {
      accent: "#A5B4FC",
      on: "#1E1B4B",
      soft: "#25285A",
      text: "#C7D2FE",
    },
  },
} as const;
const SURFACE = { light: "#FFFFFF", dark: "#161B1E" } as const;

const rgb = (hex: string) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

async function open(
  page: Page,
  look: Look,
  scheme: Scheme,
  width = 1100,
  height = 800,
) {
  await stubSignedIn(page);
  await stubBootstrap(page, twelve());
  await setLook(page, look, scheme);
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.getByTestId("shell").waitFor();
  await expect(page.locator(".cr").first()).toBeVisible();
}

// Two channels get unread messages, through the module the page itself loaded (as
// conversation-list.spec.ts does).
async function withUnread(page: Page): Promise<void> {
  await page.evaluate(
    async ([url, a, b]) => {
      const mod = (await import(/* @vite-ignore */ url!)) as {
        conversations: {
          setUnread: (
            id: string,
            value: { count: number; mention: boolean },
          ) => void;
        };
      };
      mod.conversations.setUnread(a!, { count: 3, mention: false });
      mod.conversations.setUnread(b!, { count: 2, mention: false });
    },
    ["/src/client.ts", uuid(101), uuid(102)],
  );
  await expect(page.locator(".convs .cr.un").first()).toBeVisible();
}

const box = async (page: Page, selector: string) => {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, selector).not.toBeNull();
  return b!;
};

for (const scheme of ["light", "dark"] as const) {
  const side = SIDE[scheme];

  test.describe(`the Classic frame, ${scheme}`, () => {
    test("R2: the rail and the column are dark, with a side-coloured line", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      await expect(page.locator(".nav")).toHaveCSS(
        "background-color",
        rgb(side.rail),
      );
      await expect(page.locator(".nav")).toHaveCSS(
        "border-right-color",
        rgb(side.line),
      );
      await expect(page.locator(".usercard")).toHaveCSS(
        "background-color",
        rgb(side.rail),
      );
      await expect(page.locator(".convs")).toHaveCSS(
        "background-color",
        rgb(side.bg),
      );
      await expect(page.locator(".convs")).toHaveCSS(
        "border-right-color",
        rgb(side.line),
      );
      // The page keeps the colours of the scheme.
      await expect(page.locator(".main")).toHaveCSS(
        "background-color",
        rgb(SURFACE[scheme]),
      );
    });

    test("R2: a rail item is muted, and the open one is ink on the hover colour", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      const idle = page.locator(".nav .ni:not([aria-current])").first();
      await expect(idle).toHaveCSS("color", rgb(side.muted));
      const current = page.locator(".nav .ni[aria-current='page']").first();
      await expect(current).toHaveCSS("color", rgb(side.ink));
      await expect(current).toHaveCSS("background-color", HOVER);
    });

    test("R3: the heading of a group, a row, the field and the chips are drawn dark", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      await withUnread(page);
      await expect(page.locator(".convs .sec").first()).toHaveCSS(
        "color",
        rgb(side.muted),
      );
      const read = page
        .locator(".convs .cr:not([aria-current]):not(.un):not(.browse)")
        .first();
      await expect(read).toHaveCSS("color", rgb(side.muted));
      const unread = page.locator(".convs .cr.un .nm").first();
      await expect(unread).toHaveCSS("color", rgb(side.ink));
      await expect(unread).toHaveCSS("font-weight", "700");
      await expect(page.locator(".convs .cfilter .field")).toHaveCSS(
        "background-color",
        HOVER,
      );
      const chips = page.locator(".convs .cfilter .chip");
      await expect(chips).toHaveCount(3);
      await expect(chips.nth(1)).toHaveCSS("background-color", HOVER);
      await expect(chips.nth(1)).toHaveCSS("color", rgb(side.muted));
      await expect(page.locator(".convs .ch h2")).toHaveCSS(
        "color",
        rgb(side.muted),
      );
    });

    for (const accent of ["teal", "indigo"] as const) {
      test(`R4: the open row is the accent ${accent} with on-accent text, and the pressed chip keeps its soft colours`, async ({
        page,
      }) => {
        await open(page, "classic", scheme);
        if (accent !== "teal")
          await page.evaluate(
            (a) => document.documentElement.setAttribute("data-accent", a),
            accent,
          );
        const a = ACCENT[scheme][accent];
        const current = page.locator(".convs .cr[aria-current='page']");
        await expect(current).toHaveCSS("background-color", rgb(a.accent));
        await expect(current).toHaveCSS("color", rgb(a.on));
        await expect(current.locator(".gl")).toHaveCSS("color", rgb(a.on));
        const pressed = page.locator(
          ".convs .cfilter .chip[aria-pressed='true']",
        );
        await expect(pressed).toHaveCSS("background-color", rgb(a.soft));
        await expect(pressed).toHaveCSS("color", rgb(a.text));
      });
    }

    test("R4: the count badge of an unread row keeps the accent", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      await withUnread(page);
      const badge = page.locator(".convs .cr .cnt").first();
      await expect(badge).toHaveCSS(
        "background-color",
        rgb(ACCENT[scheme].teal.accent),
      );
      await expect(badge).toHaveCSS("color", rgb(ACCENT[scheme].teal.on));
    });

    test("R6: the chips stay and filter the rows", async ({ page }) => {
      await open(page, "classic", scheme);
      const chips = page.locator(".convs .cfilter .chip");
      await expect(chips).toHaveCount(3);
      const before = await page.locator(".convs .cr:not(.browse)").count();
      await chips.nth(1).click();
      await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
      const after = await page.locator(".convs .cr:not(.browse)").count();
      expect(after).toBeLessThan(before);
      await chips.nth(0).click();
      await expect(page.locator(".convs .cr:not(.browse)")).toHaveCount(before);
    });

    test("R7: the Starred group stays and a group collapses and opens", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      const starred = page.locator('.convs .cgroup[data-group="starred"]');
      await expect(starred).toBeVisible();
      await expect(
        starred.locator(".nm", { hasText: "engineering" }),
      ).toBeVisible();
      const channels = page.locator('.convs .cgroup[data-group="channels"]');
      await channels.locator(".sec").click();
      await expect(channels.locator(".crows")).toBeHidden();
      await channels.locator(".sec").click();
      await expect(channels.locator(".crows")).toBeVisible();
    });

    test("R8: the Browse channels link is seen between Channels and Direct messages", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      const channels = await box(page, '.convs .cgroup[data-group="channels"]');
      const browse = await box(page, ".convs .cr.browse");
      const direct = await box(page, '.convs .cgroup[data-group="direct"]');
      expect(browse.y).toBeGreaterThanOrEqual(channels.y + channels.height - 1);
      expect(browse.y + browse.height).toBeLessThanOrEqual(direct.y + 1);
    });

    test("R3: the '+' of the Direct messages heading is drawn in the side colours", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      const add = page.locator(".convs .sec-add");
      await expect(add).toHaveCount(1);
      await page
        .locator('.convs .cgroup[data-group="direct"] button.sec')
        .hover();
      await expect(add).toHaveCSS("opacity", "1");
      await expect(add).toHaveCSS("color", rgb(side.muted));
    });

    test("R2: the account menu is not drawn in the side colours", async ({
      page,
    }) => {
      await open(page, "classic", scheme);
      await page.getByRole("button", { name: "Your account menu" }).click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      await expect(menu).toHaveCSS("background-color", rgb(SURFACE[scheme]));
    });

    for (const width of [1100, 720]) {
      test(`R9: the rail is 68 px and the column 288 px at ${width} px`, async ({
        page,
      }) => {
        await open(page, "classic", scheme, width);
        expect((await box(page, ".nav")).width).toBeCloseTo(68, 0);
        expect((await box(page, ".convs")).width).toBeCloseTo(288, 0);
        expect((await box(page, ".sidebar")).width).toBeCloseTo(356, 0);
      });
    }

    test("R9: under 720 px there is no Classic colouring (the narrow layout)", async ({
      page,
    }) => {
      await open(page, "classic", scheme, 719, 800);
      await expect(page.locator(".convs")).not.toHaveCSS(
        "background-color",
        rgb(side.bg),
      );
    });
  });
}

// R8, R10: Calm and Focus keep the Browse link last in the list, and their colours.
for (const [look, scheme] of [
  ["calm", "light"],
  ["focus", "dark"],
] as const) {
  test.describe(`${look} is unchanged`, () => {
    test("the Browse channels link is the last row of the list", async ({
      page,
    }) => {
      await open(page, look, scheme);
      const direct = await box(page, '.convs .cgroup[data-group="direct"]');
      const browse = await box(page, ".convs .cr.browse");
      expect(browse.y).toBeGreaterThanOrEqual(direct.y + direct.height - 1);
    });

    test("the rail and the column are not drawn in the side colours", async ({
      page,
    }) => {
      await open(page, look, scheme);
      for (const sideScheme of ["light", "dark"] as const) {
        await expect(page.locator(".nav")).not.toHaveCSS(
          "background-color",
          rgb(SIDE[sideScheme].rail),
        );
        await expect(page.locator(".convs")).not.toHaveCSS(
          "background-color",
          rgb(SIDE[sideScheme].bg),
        );
      }
    });
  });
}
