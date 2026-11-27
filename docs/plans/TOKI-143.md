# TOKI-143 Make the app follow the look and scheme model: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The app carries a look (`data-look`: calm, focus, classic) and a scheme (`data-scheme`: light, dark) as two attributes, with the six colour states of the prototype, and no code reads `data-eff`.

**Architecture:** `@toki/tokens` holds the values keyed by look and scheme and writes `tokens.css` with six pair blocks; `applyAppearance` sets the two attributes (the scheme `device` resolves to light or dark and follows the device); the style sheets that named `data-eff` name `data-look` (and the toast button names `data-scheme`); the preview, the shell fixture and the e2e helpers follow.

**Tech stack:** TypeScript, CSS, Vitest (root `pnpm vitest run <path>`), Playwright (`pnpm test:e2e`, `pnpm test:e2e:parity` in a container).

**Spec:** `docs/specs/2026-11-27-look-and-scheme-in-the-app-design.md` (R1 to R14, Table A). Model: `docs/specs/2026-11-26-look-and-scheme-model-design.md`. Intent: `docs/intents/look-and-scheme-in-the-app.md`.

## Global constraints
- The tokens package imports nothing from the UI packages and has no dependency entry (TOKI-009 R19).
- Calm light and Focus dark keep every value; a screen in those states has the same computed styles (R14).
- A value of a new state is taken from the prototype (`e2e/prototype/index.html`, hash in `e2e/parity/prototype.sha256`); none is invented (Table A).
- No `data-eff` anywhere outside `docs/` when the ticket ends (R8).
- One ticket, branch `feat/toki-143-look-and-scheme-in-the-app`, small commits, one commit per task. Never merge, never force-push.
- Fake data only; no network in tests.

## Design

### Decisions
1. **Values.** `tokens.ts` keeps one copy of each colour set and builds the pairs from them, so a diff shows what moved: `lightColours` (today's Calm colours), `darkColours` (today's Focus colours) and the named overrides of Table A (`calmDark`, `focusLight`). `palettes[look][scheme]` is the colours of the pair plus the avatar tints of the look. Classic is Focus (`classic.light === focus.light`, `classic.dark === focus.dark`, by reference to the same constants, not by copy). `accentColors[look][scheme][accent]`: a light scheme takes today's Calm accents, a dark scheme today's Focus accents, for all three looks. `radii[look]`, `lookDensity[look]` (classic compact), `shadows[look][scheme]`.
2. **Cascade, a finding.** The six pair blocks have the specificity of three (`:root` + two attributes) and each declares `--av`, `--gap` and `--row`. The density blocks `:root[data-density="..."]` have two, so a chosen density would lose to the pair block (today they tie and the later block wins). The density blocks therefore use `:root:root[data-density="compact"]` and `:root:root[data-density="comfortable"]` (three, after every look block in the file). The accent blocks keep four. This changes the selector text that TOKI-009 R14 names, so the tokens spec R14 gets the new selector with "(was ...)" in this pull request; the requirement (a chosen density wins in every look) is unchanged. The cascade test (`resolve` in `tokens.test.ts`) counts `:root` twice, so it reads the new selector without a change to its rule.
3. **The test of the cascade** is the existing hand-written resolver of `tokens.test.ts` over the parsed `tokens.css`, not a browser (the spec says "the browser engine"; the resolver is what the package has and it implements the specificity and order rules the file uses). The computed colour of the toast button (R9) is read in a real browser (Playwright).
4. **R13 form, a deviation.** The spec says `e2e/parity/tokens.spec.ts` becomes an assertion. TOKI-109 decided that the parity check reports a difference and never fails a run (CLAUDE.md). So `tokens.spec.ts` stays a reporting check, extended to the six states (72 combinations); and a new unit test `e2e/support/tokens-prototype.test.ts` does the asserting: it reads the prototype's CSS blocks and fails when any of the 32 values of the 24 states (six pairs, four accents) differs from `getTheme`, after one normal form (shadows and colours written the same way). The test runs under `pnpm test`, so the values cannot drift.
5. **`applyAppearance`** takes `{ look, scheme, accent?, density? }`. It sets `data-look` (unknown value: `calm`), `data-scheme` (`light`, `dark`, or for `device` the device's scheme now, with a listener on `matchMedia("(prefers-color-scheme: dark)")` that sets it again on a change; unknown value: `device`), `data-accent` and `data-density` as today, in one synchronous call so no page has one of look and scheme without the other. It removes no attribute but density. It returns the function that stops the listener; a second call stops the first listener (as today).
6. **R7** `apps/web/src/main.tsx` calls `applyAppearance({ look: "calm", scheme: "device" })`.
7. **Style sheets.** A mechanical rename: `[data-eff="calm"]` becomes `[data-look="calm"]`; `[data-eff="focus"]` becomes `:is([data-look="focus"], [data-look="classic"])`; the toast button's second rule becomes `[data-scheme="dark"] .toast button`. The tests that list selectors (`D(...)`, `C(...)`) take the same new strings.
8. **Preview and fixture.** `controls.ts` gets `scheme` (`light`/`dark`, default `light`) and `look` gets `classic`; `applyControls` sets `data-look` and `data-scheme`. The fixture reads `?look=` (calm, focus, classic) and `?scheme=` (light, dark, device) and calls `applyAppearance`.
9. **e2e `setLook(page, look, scheme?)`**: `page.emulateMedia({ colorScheme: scheme })` and `page.addInitScript` with a `MutationObserver` on `document.documentElement` that keeps `data-look` and `data-scheme` at the asked values (set at once if the element exists, else on `DOMContentLoaded`), because the app's call sets Calm and `device`. Default scheme: light for Calm, dark for Focus and Classic.
10. **The check of "no `data-eff`"** is a unit test `tools/no-data-eff.test.mjs`-style (a Vitest file under `e2e/support/`, because the root `vitest` runs it and `e2e/support` already holds repository-level tests) that lists tracked files with `git ls-files`, skips `docs/`, and fails on the text built as `"data-" + "eff"`.

### What can break, and the riskiest step
- **Riskiest: the CSS cascade** (decision 2). A pair block with specificity three over a density block with two would make a chosen density do nothing in every look, and no old test would show it, because the old model tied them. The test of R5 covers density in all six pairs, and is written first.
- **Dropped rules:** the `:is()` form must keep each selector's other parts (`.app[data-section="home"] .sidebar`, `.app:not(...)`). The shell tests list every selector with its declarations, so a mangled selector fails a test; run them after the rename, not before.
- **The first paint:** a page without `data-scheme` takes the dark media block (Calm dark). The test of R5 (b) covers it; the bare `:root` is Calm light, so a light device needs no media block.
- **`setLook` and timing:** the init script runs before the app, and the app's own call then sets the attributes; the observer sets them back. If the app's call ran later than the observer's first run, the observer still wins on every change. The e2e check after a load reads the final attributes.
- **Specs that emulate the device themselves** (`account-menu.spec.ts:100`, `app-shell.spec.ts` Focus branch) are moved to `setLook`; if one is missed it silently runs Calm. The list of the six specs in R12 is the check.
- **The prototype's number formats** differ from the tokens' (`0 1px 2px rgba(22,32,29,.06)` against `0px 1px 2px 0px rgba(22,32,29,0.06)`); the normal form of decision 4 is the part most likely to hide a difference, so its own test feeds it two spellings of one value and a changed value.

## AC to step to test

| AC | Step | Test |
| :---- | :---- | :---- |
| R1 types and lists | Task 1 | `tokens.test.ts` "R1 names and lists" (types by `expectTypeOf`, lists by value) |
| R2 values of six states | Task 1 | `tokens.test.ts` "R2 palettes" per state; "R3 accent colours" per pair; Table A rows; `e2e/support/tokens-prototype.test.ts` |
| R3 `getTheme` | Task 1 | `tokens.test.ts` "R7 getTheme" six states, chosen density, isolation of shadow layers |
| R4 `tokens.css` blocks | Task 2 | `tokens.test.ts` "R11", "R12", "R13", "R14", order test, "equals what the script would write" |
| R5 78 states | Task 2 | `tokens.test.ts` "R16a" (72), "R16b" (6), and a test that the density wins in every pair |
| R6 `applyAppearance` | Task 3 | `packages/ui-web/tests/appearance.test.ts` six states, device follow, returned function, unknown values, both attributes together |
| R7 default | Task 3 | `apps/web/tests/...` source test of `main.tsx`'s call; R5 (b) |
| R8 style sheets | Task 4 | the five css tests and `shell.css.test.ts` (new selector lists); the repository scan (Task 6) |
| R9 toast button | Task 4 | `Toast.test.tsx`, `sources-group2.test.ts`, a no-literal-colour test, and `e2e/component-preview.spec.ts` computed colour in six states |
| R10 preview | Task 5 | `apps/web/tests/preview/preview.test.ts`, `e2e/component-preview.spec.ts` |
| R11 fixture | Task 5 | `apps/web/tests/shell-fixture/main.test.ts` |
| R12 e2e helpers | Task 6 | `e2e/support/tokens.test.ts`, a test of `setLook` (Focus gives `focus` and `dark`; Calm `calm` and `light`; Classic `classic` and `dark`), the six specs in `pnpm test:e2e` |
| R13 parity values | Task 6 | `e2e/parity/tokens.spec.ts` (reporting, 72 combinations), `e2e/support/tokens-prototype.test.ts` (asserting, with a changed value failing) |
| R14 no other change | Task 7 | existing screenshot and parity runs; `pnpm test:e2e:parity` for Calm light and Focus dark |

## Tasks

### Task 1: the values and `getTheme` (R1, R2, R3)
**Files:** `packages/tokens/src/tokens.ts`, `theme.ts`, `index.ts`; test `packages/tokens/tests/tokens.test.ts` (sections R1 to R8).
- [ ] Rewrite the expected values in the test first: the six palettes (Table A), the accent values by pair, `lookDensity` with classic compact, radii for three looks, shadows by pair. Run `pnpm vitest run packages/tokens`: it fails for the missing types and keys.
- [ ] `tokens.ts`: add `Scheme`, `schemes`, `classic` in `Look` and `looks`; build `palettes`, `accentColors`, `shadows` keyed by look then scheme (decision 1); keep every value of Calm light and Focus dark byte for byte.
- [ ] `theme.ts`: `getTheme(look, scheme, accent, density?)`; remove the old signature. `index.ts`: export `Scheme`, `schemes`.
- [ ] Run the tokens tests: the sections for R1 to R8 pass; `tokens.css` sections still fail until Task 2. Commit `feat(tokens): key the values by look and scheme (TOKI-143)`.

### Task 2: `tokens.css` (R4, R5)
**Files:** `packages/tokens/src/css.ts`, `tokens.css` (generated), `tokens.test.ts` (sections R10 to R17, R16), `docs/specs/2026-11-16-tokens-package-design.md` (R14 selector).
- [ ] Tests first: the order of blocks (six pair blocks, the device media block, eighteen accent blocks, two density blocks `:root:root[...]`), the selectors, the 78-state cascade (72 with attributes by `getTheme`; 6 without attributes: Calm in the device's scheme, with each density), and "a chosen density wins in each of the six pairs". See them fail.
- [ ] `css.ts`: write the blocks from the objects in that order; the first block is `:root, :root[data-look="calm"][data-scheme="light"]`; `color-scheme` from the scheme; the device block holds the values of Calm dark.
- [ ] `pnpm --filter @toki/tokens generate`; run the tokens tests, all green.
- [ ] Edit the tokens spec R14 selector with "(was `:root[data-density=...]`; TOKI-143)". Commit `feat(tokens): write the six look and scheme blocks (TOKI-143)`.

### Task 3: `applyAppearance` and the default (R6, R7)
**Files:** `packages/ui-web/src/appearance.ts`, `apps/web/src/main.tsx`; tests `packages/ui-web/tests/appearance.test.ts`, a source test for `main.tsx` beside the web tests.
- [ ] Tests first: each look and scheme sets the two attributes; `device` follows a change of `matchMedia`; the returned function stops it; a second call stops the first; unknown look gives `calm`, unknown scheme `device`; the two attributes are never set apart (the test reads them after each call); no `data-eff`.
- [ ] Implement decision 5; `main.tsx` calls `applyAppearance({ look: "calm", scheme: "device" })`.
- [ ] Run `pnpm vitest run packages/ui-web/tests/appearance.test.ts` and the main test. Commit `feat(ui-web): set data-look and data-scheme (TOKI-143)`.

### Task 4: style sheets and the toast button (R8, R9)
**Files:** `packages/ui-web/src/layout/shell.css`, `conversation-list/conversation-list.css`, `components/Toast/Toast.css`, `apps/web/src/conversation/conversation.css`, `channel-archive/archive.css`; tests `shell.css.test.ts`, `conversation-list.css.test.ts`, `Toast.test.tsx`, `sources-group2.test.ts`, `apps/web/tests/{conversation/css,channel-archive/css,features/rows.css,conversation/membership/sources}.test.ts`.
- [ ] Update the selector strings in the tests first (decision 7); the negative assertions drop `data-eff` from their patterns and keep `data-look`. Add the test that no rule with `[data-look` in the five files sets a literal colour. See them fail.
- [ ] Rename the selectors in the five files (decision 7); the toast button's second rule is `[data-scheme="dark"] .toast button { color: var(--accent) }`.
- [ ] Run the css tests and `pnpm vitest run packages/ui-web apps/web/tests`. Commit `refactor(ui-web): name data-look and data-scheme in the style sheets (TOKI-143)`.

### Task 5: preview and fixture (R10, R11)
**Files:** `apps/web/src/preview/controls.ts` (and the page that draws the controls), `apps/web/scripts/shell-fixture/main.tsx`; tests `apps/web/tests/preview/preview.test.ts`, `apps/web/tests/shell-fixture/main.test.ts`.
- [ ] Tests first: `readControls` with `look=classic`, `scheme`, defaults `calm`/`light`/`teal`/`own`, an unknown value gives the default; `applyControls` sets both attributes and removes density for `own`; `writeAddress` writes `scheme`; the fixture's entry reads `?look` and `?scheme` and calls `applyAppearance` with them (default Calm and `device`).
- [ ] Implement; add the scheme control (a select with `data-control="scheme"`) where the look control is drawn. Commit `feat(web): look and scheme controls in the preview and the fixture (TOKI-143)`.

### Task 6: e2e helpers, specs, parity (R12, R13) and the repository scan (R8)
**Files:** `e2e/support/tokens.ts`, `tokens.test.ts`, `sign-in.ts`, `e2e/component-preview.spec.ts`, `e2e/account-menu.spec.ts`, `e2e/app-shell.spec.ts`, `e2e/parity/tokens.spec.ts`, new `e2e/support/tokens-prototype.test.ts`, new `e2e/support/no-data-eff.test.ts`.
- [ ] `tokens.ts` reads the property names from `:root, :root[data-look="calm"][data-scheme="light"]` (update its test).
- [ ] `sign-in.ts`: `setLook(page, look, scheme?)` (decision 9); a test of it. `account-menu.spec.ts` and `app-shell.spec.ts` call `setLook`; the specs that read `data-eff` read `data-look` and `data-scheme`; the Focus cases of `component-preview.spec.ts` that read colours add `scheme=dark`; add the browser test of the toast button colour in the six states.
- [ ] `tokens.spec.ts`: loop look (3) by scheme (2) by accent (4) by density (3); `openPrototype` and the preview get the same scheme.
- [ ] `tokens-prototype.test.ts` (decision 4) with its own test of the normal form; `no-data-eff.test.ts` (decision 10).
- [ ] Run `pnpm vitest run e2e/support`, then `pnpm test:e2e` (the specs that use `setLook`, the preview spec) and `pnpm test:e2e:parity` if Docker is there. Commit `test(e2e): choose the look and the scheme in the helpers (TOKI-143)`.

### Task 7: the whole check (R14)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; `pnpm test:e2e:parity` where Docker runs. Paste the results in the pull request. Check that the two parity rows for Calm light and Focus dark have no new difference against the report on `main`.
- [ ] `dev-state diff-file`, the verifier, `/code-review`, the pull request (`cl-dev:submit-pr`).

## Files each task touches (for the overlap check)
Task 1: `packages/tokens/src/{tokens,theme,index}.ts`, its test. Task 2: `packages/tokens/src/{css.ts,tokens.css}`, its test, one spec. Task 3: `packages/ui-web/src/appearance.ts`, `apps/web/src/main.tsx`, two tests. Task 4: the five style sheets, nine tests. Task 5: `apps/web/src/preview/*`, `apps/web/scripts/shell-fixture/main.tsx`, two tests. Task 6: `e2e/**`. No two tasks edit the same file.

## How This Plan Was Created
1. Spec provided: the spec of TOKI-143 above, merged in PR #445.
2. Code read: `packages/tokens/src`, `packages/ui-web/src/appearance.ts`, the five style sheets, the preview and fixture, the e2e helpers and the files that name `data-eff` (`git grep`).
3. Recommended execution: `cl-dev:executing-plans`, Manual mode, one task at a time.
