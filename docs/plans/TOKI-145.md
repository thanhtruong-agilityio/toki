# Calm two column frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From 720 px the look Calm has the rail and, on Home, the conversation column of Focus, and stays Calm in colour, radius, cards and list rows.

**Architecture:** A style change. The frame rules of `shell.css` that name Focus and Classic also name Calm, Calm's own sidebar rules are removed, and the field `calmHidden` goes away. The prototype gets the same change, and the Calm reference images are made again from it.

**Tech Stack:** CSS, React, Vitest, Playwright, the parity container (Docker, `linux/arm64`).

**Spec:** `docs/specs/2026-11-27-calm-two-column-frame-design.md` (R1 to R11). Read it with this plan.

## AC -> step -> test

| AC | Step | Test |
| :---- | :---- | :---- |
| R1 Home: rail 68, column to 356, main from 356 | Task 2 | `app-shell.spec.ts` "R18 R8 calm layout at <width>" |
| R2 Other sections: rail only, main from 68 | Task 2 | `app-shell.spec.ts` "R18 calm section activity at <width>" |
| R3 The rail holds and draws what Focus does | Task 2 | `app-shell.spec.ts` "R18 R8 calm layout", "R20 calm", "TOKI-145 R3 R4"; `shell.css.test.ts` tables |
| R4 Calm stays Calm | Task 2 | `app-shell.spec.ts` "TOKI-145 R3 R4"; row height: `conversation-list.spec.ts` "the list in calm" (32 at 1100); `conversation-list.css.test.ts` unchanged |
| R5 Preferences on the rail, field removed, menu entry kept | Tasks 1, 2 | `sections.test.ts`, `AppShell.test.tsx`; `account-menu.spec.ts` "the rail's Preferences button" |
| R6 Short windows | Task 2 | `app-shell.spec.ts` "R20 calm 1100 by <height>"; `shell.css.test.ts` (no `--shell-convs-min`) |
| R7 Panel and toasts | Task 2 | `app-shell.spec.ts` "R19 calm panel", "R23 calm" |
| R8 Focus, Classic and narrow unchanged | Tasks 2, 4 | every Focus number and every narrow test unchanged; `classic-frame.spec.ts`; Focus, Classic and narrow reference images unchanged |
| R9 The prototype draws the frame | Task 3 | `e2e/parity/prototype.spec.ts` "calm draws the rail" |
| Dev decision 2026-11-27: the prototype shows the conversation search field in Calm | Task 3 | the same test, "the search field is visible" |
| R10 Calm references made again | Task 4 | `pnpm test:e2e:parity` with no missing reference |
| R11 Earlier specs | Task 5 | the search of Task 5, step 3 |

## Design

Approved by Thanh Truong on 2026-11-27.

- **Approach.** The frame rules name the three looks, as the spec's Design says. Rejected: dropping the look prefix because all looks now share the frame; it changes selector specificity and is not what the spec decided.
- **Style sheet.** Calm keeps only its rules for `.main`, `.side` and `.toast-anchor`, plus one new rule that removes the right line of its conversation column. `--shell-convs-min` is removed. The side panel's border, `.sechead`, `.secbody` and `.toolbar` stay Focus and Classic only. The Classic block and the narrow block do not change.
- **Components.** `calmHidden` and `data-calm-hidden` are removed from `NavSection`, `sections.ts`, `app-layout.tsx` and the shell fixture.
- **Prototype.** The rail and column rules also name Calm; the 272 px sidebar rules, the hidden Preferences rule and the rule that hides the conversation search field are removed. The last one is the Dev's decision of 2026-11-27: the app shows the field (conversation list spec, concern 1), so the prototype now does too. The list row, card, phone and guest rules stay.
- **Test change the spec did not name.** `look-selectors.test.ts` allows Focus only in the pair `focus, classic`; it also allows the three-look list.

## Global Constraints

- Focus and Classic look and behave as before; so does every look under 720 px.
- The default look stays Calm; no new rail section.
- Reference images are made from the prototype, never from the app.
- Every colour in a style sheet is a variable; no literal colour in a rule that names a look.
- Node 22: prefix commands with `export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"` and call `corepack pnpm`.
- Ports 3000 and 5173 are held by a running preview from another checkout. Do not stop it. Browser tests run with the temporary config of Task 2, step 1.
- Do not edit the checkout `../toki-main`. Do not read `.env`.
- Conventional Commits, lowercase subject, `(TOKI-145)`.

## What can break

Two rounds of the risk loop, written by the author of the plan.

| Risk | Where it shows | What to do |
| :---- | :---- | :---- |
| The Calm main area at 720 px is 352 px, 12 px narrower than any wide layout so far: a header, the composer or the Admin table may overflow | the full `test:e2e` run, Task 6 | Fix only a failure this change causes. A fix that changes what a person sees is a business question: stop |
| Prettier wraps a long `:is(...)` list inside the parentheses, so the selector text differs from the test's | `shell.css.test.ts` after formatting | Keep the list on one line in the CSS (`/* prettier-ignore */` is not used; check `format:check` and the test together) |
| A Calm rule and a shared rule have equal specificity, so order decides | the column keeps its right line | The Calm border rule comes after the shared `.convs` rule |
| Adding Calm to the prototype's rail rules, which sit outside the wide block, changes its phone layout | a narrow Calm reference image differs (Task 4) | Stop and compare; the narrow images must not change |
| `ui:reference --all` rewrites an image that should not change | `git status` in Task 4 | Only `*-calm-mid-*` and `*-calm-wide-*` may change; otherwise stop |
| A browser test that ran in Calm looked for the workspace name or the account name, which the rail hides | the full `test:e2e` run | Change the test to reach it the new way (spec, Testing) |
| `main` moves under `shell.css` or the prototype | `dev-state drift`, before the PR | Re-read the changed files; the plan needs a new approval if a requirement changed |

Riskiest step: Task 4, because the images are binary and only the file list and the parity report show a mistake.

---

### Task 1: Remove `calmHidden` (R5)

**Files:**
- Test: `apps/web/tests/layout/sections.test.ts`, `packages/ui-web/tests/layout/AppShell.test.tsx`
- Modify: `packages/ui-web/src/layout/NavSection.tsx`, `apps/web/src/layout/sections.ts`, `apps/web/src/routes/app-layout.tsx`, `apps/web/scripts/shell-fixture/Fixture.tsx`

- [ ] **Step 1: Change the tests**

In `sections.test.ts`, delete the line `expect(admin.calmHidden).toBeUndefined();` and replace `expect(row.calmHidden).toBe(true);` with:

```ts
    // TOKI-145 R5: Calm shows the row on its rail, so no row says it is hidden.
    expect(row).not.toHaveProperty("calmHidden");
```

In `AppShell.test.tsx`, replace the line `    calmHidden: true,` of the `prefs` section with:

```ts
    // A field the type no longer has (TOKI-145 R5): the item writes no attribute for it.
    ...{ calmHidden: true },
```

and replace the two `data-calm-hidden` expectations with:

```ts
    for (const a of items) expect(a).not.toHaveAttribute("data-calm-hidden");
```

- [ ] **Step 2: See them fail**

Run: `corepack pnpm vitest run apps/web/tests/layout/sections.test.ts packages/ui-web/tests/layout/AppShell.test.tsx`
Expected: FAIL, `not.toHaveProperty("calmHidden")` and `not.toHaveAttribute("data-calm-hidden")`.

- [ ] **Step 3: Remove the field**

- `NavSection.tsx`: delete the comment `// Hidden in the Calm sidebar from 720 px; the Focus rail keeps it.`, the line `calmHidden?: boolean;` and the attribute line `data-calm-hidden={section.calmHidden ? "" : undefined}`.
- `sections.ts`: delete `calmHidden?: boolean;` and `calmHidden: true,`; replace the first comment line above the `preferences` row with:

```ts
  // Preferences (TOKI-099 R21): the rail, the More sheet and the account menu reach it. Rows that
  // come later (people, admin) are inserted above this one: the prototype's order is home, people,
  // admin, preferences (line 1199).
```

- `app-layout.tsx`: delete `calmHidden: row.calmHidden,`.
- `Fixture.tsx`: change the row to `{ ...row("preferences", "settings"), more: true },` and delete `calmHidden: item.calmHidden,`.

- [ ] **Step 4: See them pass**

Run the command of step 2, then `corepack pnpm typecheck`. Expected: PASS, exit 0.

- [ ] **Step 5: Commit** `feat(web): show preferences in every look's navigation (TOKI-145)`

### Task 2: The Calm frame in the app (R1 to R8)

**Files:**
- Test: `packages/ui-web/tests/layout/shell.css.test.ts`, `packages/ui-web/tests/styles/look-selectors.test.ts`, `e2e/app-shell.spec.ts`, `e2e/account-menu.spec.ts`
- Modify: `packages/ui-web/src/layout/shell.css`

- [ ] **Step 1: The temporary browser config (never committed)**

Create `playwright.local.config.ts` in the repository root:

```ts
import base from "./playwright.config";
import { defineConfig } from "@playwright/test";

// Local only: the usual ports are held by another checkout's preview.
const WEB_PORT = 5193;
const SERVER_PORT = 3093;
const [server, web] = [base.webServer].flat().map((entry) => entry!);

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://127.0.0.1:${WEB_PORT}` },
  webServer: [
    {
      ...server!,
      url: `http://127.0.0.1:${SERVER_PORT}/healthz`,
      env: {
        ...server!.env,
        SERVER_PORT: String(SERVER_PORT),
        APP_ORIGIN: `http://127.0.0.1:${WEB_PORT}`,
      },
    },
    {
      ...web!,
      command: `pnpm --filter @toki/web exec vite --host 127.0.0.1 --port ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      env: { SERVER_PORT: String(SERVER_PORT) },
    },
  ],
});
```

Check the ports are free: `lsof -nP -iTCP:5193 -iTCP:3093 -sTCP:LISTEN` prints nothing.

- [ ] **Step 2: Change the browser tests** (`e2e/app-shell.spec.ts`)

In "R18 R8", replace the whole `if (look === "calm") { ... } else { ... }` block inside `width >= 720` with:

```ts
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
```

Replace the body of "R18 ... section activity" after `const main = ...` with:

```ts
      const sidebar = await box(page, ".sidebar");
      expectNear(sidebar.x, 0, "rail x");
      expectNear(sidebar.right, 68, "rail ends at");
      expect((await box(page, ".convs")).display).toBe("none");
      expectNear(main.x, 68, "main x");
      expectNear(main.right, look === "calm" ? width - 12 : width, "main right");
```

and its comment with `// In the section activity each look has the rail only (x 0 to 68); Calm keeps its card margin.`

Add after that loop:

```ts
// TOKI-145 R3 and R4: Calm takes the rail's line, keeps its cards and draws no line on the column.
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
```

In `MAIN_WIDTH`, replace the `calm` rows with:

```ts
  calm: {
    720: [352, 352],
    800: [432, 432],
    1099: [731, 731],
    1100: [732, 360],
    1400: [1032, 660],
  },
```

and replace its comment's Calm formula with `Calm: the window less the 356 px column, the 12 px margin and, with a panel, its 360 px and 12 px margin`.

Replace `ANCHOR_WITH_PANEL.calm` with `{ 720: 352, 800: 432, 956: 228, 1099: 371, 1100: 360 }`.

R20: replace the `content` field's type and values and the three constant tables with:

```ts
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
```

and in the test body use `const expectedBox = NAV_ITEMS_BOX[height]!;`, `scenario.content` in both places, `expectNear(row.height, 50, ".ni height")`, and delete the final `if (look === "calm") { ... }` block.

In `e2e/account-menu.spec.ts`, add inside `test.describe`, before the width loop:

```ts
    test("the rail's Preferences button opens the page and the menu keeps its entry", async ({
      page,
      context,
    }) => {
      await stub(context);
      await look(page, name);
      await page.setViewportSize({ width: 1100, height: 800 });
      await page.goto("/");
      await page.getByTestId("shell").waitFor();
      await page
        .getByRole("navigation")
        .getByRole("link", { name: "Preferences" })
        .click();
      await expect(page).toHaveURL(/\/prefs$/);
      await page.getByRole("button", { name: "Your account menu" }).click();
      await expect(
        page.getByRole("menuitem", { name: "Preferences" }),
      ).toBeVisible();
    });
```

- [ ] **Step 3: Change the style tests**

`shell.css.test.ts`: delete `--shell-convs-min` from the `.app` row (it becomes `"--shell-panel:360px"`) and from the `own` set (and say "two own properties" in that test's name). Add after `MONO`:

```ts
// The selector lists of the looks that share the frame (TOKI-145) and of the two dense looks.
const FRAME =
  ':is([data-look="calm"], [data-look="focus"], [data-look="classic"])';
const DENSE = ':is([data-look="focus"], [data-look="classic"])';
```

In `tables`, delete every `// Table E (Calm)` row except `.main`, `.side` and `.toast-anchor`. In the `// Table F` rows, write each selector from `.sidebar` to `.convs` with `` `${FRAME} ...` `` (the `.srch .t, ... .srch .kbd` row uses it twice), add after the `.convs` row:

```ts
  D('[data-look="calm"] .convs', "border-right:0"),
```

and write the `.side`, `.sechead`, `.secbody` and `.toolbar` rows with `` `${DENSE} ...` ``. The declarations of every row stay as they are.

`look-selectors.test.ts`: add above the tests inside `describe`:

```ts
  // The list of the three looks that share the frame (TOKI-145).
  const frame =
    ':is([data-look="calm"], [data-look="focus"], [data-look="classic"])';
```

In the Focus test, strip `frame` before `pair`: `expect(r.selector.split(frame).join("").split(pair).join(""), r.selector).not.toMatch(/"focus"/);` and change its comment to say Focus is named in a shared list. In the Classic test, build `own` from `r.selector.split(frame).join("").split(pair).join("")`.

- [ ] **Step 4: See them fail**

Run: `corepack pnpm vitest run packages/ui-web/tests` (expected: FAIL in `shell.css.test.ts`).
Run: `corepack pnpm exec playwright test -c playwright.local.config.ts e2e/app-shell.spec.ts e2e/account-menu.spec.ts` (expected: the Calm tests FAIL on 272 px and the missing link; every Focus test passes).

- [ ] **Step 5: Change `shell.css`**

1. In the `.app` custom property rule delete `--shell-convs-min: 240px;`.
2. Replace the whole block under `/* Table E: Calm. */` with:

```css
/* Table E: Calm draws the main area and the side panel as cards (TOKI-145: its frame is the
   frame of Table F). */
@media (min-width: 720px) {
  [data-look="calm"] .main {
    margin: 12px 12px 12px 0;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
  }
  [data-look="calm"] .side {
    margin: 12px 12px 12px 0;
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    overflow: hidden;
  }
  [data-look="calm"] .toast-anchor {
    margin: 12px 12px 12px 0;
  }
}
```

3. Change the comment of Table F to `/* Table F: the rail and, on Home, the conversation column, in every look. */`. In the rules from `.sidebar` to `.convs`, replace `:is([data-look="focus"], [data-look="classic"])` with `:is([data-look="calm"], [data-look="focus"], [data-look="classic"])`.
4. After the shared `.convs` rule add:

```css
  /* Calm's main card is set off by its shadow, so its column draws no line (TOKI-145 R4). */
  [data-look="calm"] .convs {
    border-right: 0;
  }
```

5. Leave `.side`, `.sechead`, `.secbody`, `.toolbar`, Table K, the overlay, the toast anchor block and Table G as they are.

- [ ] **Step 6: See them pass**

Run both commands of step 4, then `corepack pnpm exec playwright test -c playwright.local.config.ts e2e/classic-frame.spec.ts e2e/conversation-list.spec.ts` and `corepack pnpm format:check`. Expected: PASS.

- [ ] **Step 7: Commit** `feat(ui-web): give calm the rail and the conversation column (TOKI-145)`

### Task 3: The prototype (R9 and the search field)

**Files:**
- Test: `e2e/parity/prototype.spec.ts`
- Modify: `e2e/prototype/index.html`

- [ ] **Step 1: Write the test** (append to `prototype.spec.ts`)

```ts
// TOKI-145 R9: Calm has the rail and the conversation column; the chat stays a card.
for (const width of ["wide", "mid"] as Width[]) {
  test(`calm draws the rail, the column and the main card at the ${width} width`, async ({
    page,
  }) => {
    await openPrototype(page, { look: "calm", width, hash: "home" });
    const app = (await page.locator("#app").boundingBox())!;
    const nav = (await page.locator("#app .nav").boundingBox())!;
    const convs = (await page.locator("#app .convs").boundingBox())!;
    const main = (await page.locator("#app .main").boundingBox())!;
    expect(nav.x - app.x).toBeCloseTo(0, 0);
    expect(nav.width).toBeCloseTo(68, 0);
    expect(convs.x - app.x).toBeCloseTo(68, 0);
    expect(convs.width).toBeCloseTo(288, 0);
    expect(main.x - app.x).toBeCloseTo(356, 0);
    expect(app.x + app.width - (main.x + main.width)).toBeCloseTo(12, 0);
    await expect(page.locator('#app .ni[data-id="prefs"]')).toBeVisible();
    // The Dev's decision of 2026-11-27: the search field shows, as in the app.
    await expect(page.locator("#app .cfilter .field")).toBeVisible();
    const style = await page.evaluate(() => {
      const of = (selector: string) =>
        getComputedStyle(document.querySelector(selector)!);
      return {
        rail: of("#app .nav").borderRightWidth,
        column: of("#app .convs").borderRightWidth,
        radius: of("#app .main").borderTopLeftRadius,
      };
    });
    expect(style).toEqual({ rail: "1px", column: "0px", radius: "16px" });
  });
}
```

- [ ] **Step 2: See it fail**

Run: `corepack pnpm test:e2e:parity prototype.spec.ts`
Expected: the two new tests FAIL (the nav has no box under `display:contents`); the others pass.

- [ ] **Step 3: Edit the prototype** (line numbers are those of `0c74825`)

First widen the selectors, while the line numbers still hold:

```bash
perl -pi -e 's/:is\(\[data-look="focus"\],\[data-look="classic"\]\)/:is([data-look="calm"],[data-look="focus"],[data-look="classic"])/g if ($. >= 184 && $. <= 200) || $. == 618 || $. == 619 || ($. >= 650 && $. <= 652) || $. == 818 || $. == 819' e2e/prototype/index.html
```

Then, by their text:
- after the widened `.convs{border-right:1px solid var(--line);background:var(--bg)}` line, add the line `[data-look="calm"] .convs{border-right:0}`;
- delete the block `@container app (min-width:721px){` that holds only `[data-look="calm"] .ni{height:32px}`, `[data-look="calm"] .ni[data-id="prefs"]{display:none}` and `[data-look="calm"] .cfilter .field{display:none}`, with its closing brace;
- delete the Calm lines for `.navtop`, `.ws`, `.srch`, `.ni`, `.ni .ic` and `.usercard` in the later wide block; keep `.ch`, `.cfilter`, `.cr` and `.sec`.

- [ ] **Step 4: Read the diff** with `git diff e2e/prototype/index.html`. No line for `.side{border-left`, `.sechead`, `.secbody`, `.toolbar`, `.ch`, `.mh`, `.composer`, `.hint` or a guest rule changed.

- [ ] **Step 5: Record the hash and see the test pass**

```bash
shasum -a 256 e2e/prototype/index.html | cut -d' ' -f1 > e2e/parity/prototype.sha256
```

Run the command of step 2. Expected: PASS.

- [ ] **Step 6: Commit** `test(e2e): draw the calm frame in the prototype (TOKI-145)`

### Task 4: The Calm reference images (R10)

**Files:** `e2e/parity/reference/*-calm-*.png`

- [ ] **Step 1:** `corepack pnpm ui:reference --all --update`
- [ ] **Step 2:** `git status --short e2e/parity/reference`. Expected: only files named `*-calm-mid-*` or `*-calm-wide-*`. A changed Focus, Classic or narrow image stops the task: look at it, find the rule, and fix the prototype.
- [ ] **Step 3:** Look at each changed image: rail, column on Home only, card, search field.
- [ ] **Step 4:** `corepack pnpm test:e2e:parity`. Expected: no missing reference. Keep the counts and the Calm rows of `e2e/assets/parity/report.md` for the pull request.
- [ ] **Step 5: Commit** `test(e2e): make the calm reference images again (TOKI-145)`

### Task 5: The earlier specs (R11)

**Files:** the specs below. Change each statement in place and keep the old value as `(was: ...; TOKI-145)`, as TOKI-142 did. History in a "Decided" sentence stays; add what replaced it.

| File (`docs/specs/`) | Lines at `0c74825` | New statement |
| :---- | :---- | :---- |
| `2026-11-16-app-shell-design.md` | 77 (R5) | no `calmHidden`; every look draws every section on its rail |
| same | 93 (R17) | the own properties are `--tabh` and `--shell-panel` |
| same | 96 (R18), 97 (R19) | Calm: rail 68, column to 356, card main; 1100: 360 and 732; `.ws` 51 wide; card 64 |
| same | 98 (R20), 180 ("The sidebar scrolls") | Calm's rail items scroll as Focus's do; no 240 px floor |
| same | 110, 116 | no `calmHidden`; a Member sees Preferences on the rail in every look |
| same | 141 to 154 ("The three layouts") | Calm has the rail and column of Focus and keeps its card |
| same | 250, 267 to 275 (Table E) | only `.main`, `.side`, `.toast-anchor` stay |
| same | the Table F note and rows | the rows from `.sidebar` to `.convs` name the three looks; add the Calm `.convs` row |
| same | 386 to 406 (Table J) | the Calm numbers of Task 2 |
| same | 505 (concern 1), 511 (concern 7) | replaced by TOKI-145 |
| `2026-11-26-look-and-scheme-model-design.md` | 21 (R5), 70 | Calm has the frame of Focus |
| `2026-11-17-conversation-list-design.md` | 69 (R24 a), 267, 289 | Calm shows the column on Home only; no 240 px floor; the prototype no longer hides the field |
| `2026-11-17-account-menu-devices-design.md` | 61 (R21), 178 | no `calmHidden`; both looks show the row, the menu keeps its entry |
| `2026-11-26-preferences-screen-design.md` | 130 | the row is reached from the rail in every look |
| `2026-11-16-component-preview-design.md` | 213 | Calm is an icon rail and, on Home, a conversation column, with cards |
| `2026-11-25-app-shell-qa-design.md` | 46 (R18), 48 (R20) | the new numbers |
| `2026-11-17-admin-page-design.md` | 33 | drop `calmHidden` from the sentence |
| `2026-11-26-narrow-entry-points-design.md` | 29 | drop `calmHidden` from the field list |
| `2026-11-26-people-screen-design.md` | 30 | drop `calmHidden` |
| `2026-11-23-composer-design.md` | 100 | the Calm main area at 720 is 352 px |
| `2026-11-26-accessibility-pass-design.md` | 79 | "Calm and Focus column" |

`2026-11-16-base-components-2-design.md:79` describes a test page with a column of 272 px, not Calm's layout: it stays, and the pull request says so.

- [ ] **Step 1:** Edit the lines.
- [ ] **Step 2:** `for f in docs/specs/*.md; do bash .github/scripts/spec-ready.sh "$f" >/dev/null || echo "$f"; done` prints the same list before and after the edit.
- [ ] **Step 3:** `grep -nE 'calmHidden|calm-hidden|272 ?px|shell-convs-min|Calm sidebar|240 px' docs/specs/*.md | grep -v calm-two-column | grep -vE 'TOKI-145' | cut -c1-200` leaves only lines that are not about the Calm sidebar (list them in the pull request).
- [ ] **Step 4: Commit** `docs: describe the calm rail in the earlier specs (TOKI-145)`

### Task 6: The whole check

- [ ] `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check`, `corepack pnpm build`, `corepack pnpm size`: exit 0.
- [ ] `corepack pnpm vitest run --project='!server-db'`, then the `node --test` list of the root `test` script and `corepack pnpm run test:lint-rules`. The database tests are left to CI: locally they would use the shared development database.
- [ ] `corepack pnpm exec playwright test -c playwright.local.config.ts` (the whole e2e set).
- [ ] `corepack pnpm test:e2e:parity` ran in Task 4 after the last prototype change.
- [ ] Delete `playwright.local.config.ts`; `git status` is clean.
