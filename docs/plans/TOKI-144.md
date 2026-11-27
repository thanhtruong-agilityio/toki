# TOKI-144 Draw the frame of the Classic sidebar: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** With the look Classic the rail and the conversation column are dark in both schemes, with six new sidebar properties in the tokens, and the Browse channels link is seen between the groups.

**Architecture:** `@toki/tokens` gets six properties in the two Classic blocks. In `shell.css` and `conversation-list.css`, new rules for `[data-look="classic"]` on a window of 720 px or more colour the rail and the column; inside them the custom properties `--ink`, `--ink-2`, `--muted`, `--line`, `--hover` and `--surface` are given the side values, so every component in the sidebar (rows, chips, field, badges, presence dots) is drawn dark without a rule for each. No component and no markup changes.

**Tech stack:** TypeScript, CSS, Vitest (`pnpm vitest run <path>`), Playwright (`pnpm test:e2e`, `pnpm test:e2e:parity`).

**Spec:** `docs/specs/2026-11-27-classic-sidebar-frame-design.md` (R1 to R12, Table A). Intent: `docs/intents/classic-sidebar-frame.md`.

## Global constraints
- Calm and Focus: no rule that applies to them changes (R10). The new selectors name `[data-look="classic"]` alone.
- Sizes do not change: rail 68, column 288, 356 on Home; the narrow layout (719 and below) is not touched (R9).
- No colour literal in `shell.css` and `conversation-list.css`: only `var(--…)` of the 32 properties, the six `--side-*`, or `transparent` (R11).
- The six values are those of the prototype (Table A); none is invented.
- One ticket, branch `feat/toki-144-classic-sidebar-frame`, one commit per task. Never merge, never force-push.

## Design

### Decisions
1. **Tokens.** `tokens.ts` gets `SideColours` and `sideColours: Record<Scheme, SideColours>` (Table A); `theme.ts` exports `getSideColours(scheme)` (a copy); `getTheme` is unchanged (32 keys). `css.ts` writes `--side-rail`, `--side-bg`, `--side-ink`, `--side-muted`, `--side-line`, `--side-hover` at the end of the two Classic pair blocks only. The tokens test R10 ("exactly 32 names") becomes "the 32, and the six in the two Classic blocks and nowhere else".
2. **A scoped remap instead of a rule for each element.** In Classic, on a window of 720 px or more:
   - `.nav`: `background: var(--side-rail); border-right: 1px solid var(--side-line);` and the custom properties `--surface: var(--side-rail); --ink: var(--side-ink); --ink-2: var(--side-muted); --muted: var(--side-muted); --line: var(--side-line); --hover: var(--side-hover);`
   - `.convs`: the same with `--side-bg` for the background and `--surface`.
   - Then `.ni`, `.sec`, `.cr`, `.ch h2`, the badges, the presence dot's ring and the field's text already use these names, so they are drawn in the side colours. R3 is met by the computed colours (the browser test reads them), not by a rule for each class.
   - Explicit rules for the few things that are not a plain name: the pressed item of the rail (`.ni[aria-current="page"]`: `--side-hover` background, `--side-ink` text), the open row (`.cr[aria-current="page"]`: `--accent` background, `--on-accent` text and glyph), the chips (background `--side-hover`, the pressed chip keeps `--accent-soft` and `--accent-text`) and the search field (background `--side-hover`).
3. **Browse between the groups (R8):** in Classic, `.clist` is `display: flex; flex-direction: column`; `.cgroup[data-group="starred"]` and `…="channels"` have `order: 0`, `.cr.browse` has `order: 1`, `.cgroup[data-group="direct"]` has `order: 2`. The markup is not changed (the Tab order follows the markup: concern 4, accepted).
4. **Tests.** Tokens test and a contrast test (R5, in `packages/tokens/tests`); the rows of the style-sheet tests (`shell.css.test.ts`, `conversation-list.css.test.ts`) for the new rules and a check that every new selector names `[data-look="classic"]` alone; a new browser spec `e2e/classic-frame.spec.ts` (real app, stubbed bootstrap, `setLook(page, "classic", scheme)`), the same way `conversation-list.spec.ts` opens the app.
5. **Specs edited in the same pull request (R12):** the tokens spec (R10, R11, R16), the shell spec (R17, Tables F and J: the colour rules are Classic's own, the sizes are still shared with Focus), the list spec (R12, Table A, R8). Each edit says what it was.

### What can break, and the riskiest step
- **Riskiest: the remap reaches too far.** The custom properties set on `.nav` and `.convs` are inherited by everything inside, including a modal, a menu or a toast if one is mounted inside the column. Those are portalled to the overlay layer, but a menu rendered in place (the account menu on the user card, the "+" of a group) would be drawn in the side colours. The browser test opens the account menu in Classic and reads its background; if it is dark, the remap is narrowed (to `.nav-items` and the list).
- **Specificity and order.** `:is([data-look="focus"], [data-look="classic"]) .nav` and `[data-look="classic"] .nav` have the same strength; the Classic rule must come later in the file. The style-sheet test pins the order.
- **Contrast.** R5 asks 4.5:1 for `--on-accent` on `--accent` in all four accents and both schemes, and for the side text on both backgrounds; the unit test computes it before any CSS is written, so a value that fails is found first.
- **The chips and the field** have their own backgrounds (`--surface`) and a pressed state in `--accent-soft`; the explicit rules of decision 2 must keep the pressed chip readable on the dark ground (browser test: the pressed chip's text against its background).
- **The Focus tests that read `.cr.browse` last** (`conversation-list.spec.ts`) must still pass: the reorder is Classic only.

## AC to step to test

| AC | Step | Test |
| :---- | :---- | :---- |
| R1 six properties | Task 1 | `tokens.test.ts` (6 values, 38 and 32, `getSideColours`), `e2e/support/tokens-prototype.test.ts` (six compared with the prototype) |
| R2 dark frame | Task 3 | `shell.css.test.ts` rows; `classic-frame.spec.ts` (computed colours of `.nav`, `.convs`, borders, rail items in both schemes) |
| R3 what the column holds | Task 3 | `conversation-list.css.test.ts` rows; `classic-frame.spec.ts` (heading, group heading, row, badge, field, chip, presence ring, "+" button) |
| R4 open row | Task 3 | `classic-frame.spec.ts` (accent and on-accent, indigo accent too) |
| R5 contrast | Task 2 | `packages/tokens/tests/side-contrast.test.ts` |
| R6 chips stay | Task 3 and 4 | `classic-frame.spec.ts` (chips present, filter works) |
| R7 Starred and collapse | Task 4 | `classic-frame.spec.ts` |
| R8 Browse between groups | Task 3 | `conversation-list.css.test.ts` rows; `classic-frame.spec.ts` (vertical order; last in Calm and Focus) |
| R9 sizes | Task 4 | `classic-frame.spec.ts` (68, 288, 356 at 1100 and 720) and the existing `app-shell.spec.ts` for Classic |
| R10 Calm and Focus same | Task 3 and 6 | the selector-names test; existing browser specs pass as they are |
| R11 no literal | Task 3 | the existing `shell.css` names test (list of allowed names gains the six) and its twin for the list |
| R12 specs | Task 5 | the diff |

## Tasks

### Task 1: the six properties (R1)
**Files:** `packages/tokens/src/{tokens,theme,css,index}.ts`, `tokens.css` (generated), `packages/tokens/tests/tokens.test.ts`, `e2e/support/tokens-prototype.test.ts`.
- [ ] Tests first: `sideColours` holds Table A; the two Classic blocks declare 38 properties (the 32 and the six), the four other blocks and the device block 32; `getSideColours(scheme)` returns a copy; the R10 test allows the six only in the Classic blocks; the prototype test reads `--side-*` of `:root[data-look="classic"][data-scheme=...]` and compares. See them fail.
- [ ] Implement decision 1; `pnpm --filter @toki/tokens generate`. Run the tokens tests and `pnpm vitest run e2e/support`.
- [ ] Commit `feat(tokens): add the six sidebar colours to the Classic blocks (TOKI-144)`.

### Task 2: contrast (R5)
**Files:** `packages/tokens/tests/side-contrast.test.ts`.
- [ ] Write the test: the WCAG ratio of `--side-ink` and `--side-muted` on `--side-bg` and `--side-rail` (both schemes) and of `--on-accent` on `--accent` for the four accents in both schemes is at least 4.5. It uses `getSideColours` and `getTheme` (so it passes as soon as Task 1 is in); if a ratio is under 4.5, stop and report which value (a business question: the values are the owner's).
- [ ] Commit `test(tokens): check the contrast of the sidebar colours (TOKI-144)`.

### Task 3: the style sheets (R2, R3, R4, R8, R10, R11)
**Files:** `packages/ui-web/src/layout/shell.css`, `packages/ui-web/src/conversation-list/conversation-list.css`, `packages/ui-web/tests/layout/shell.css.test.ts`, `packages/ui-web/tests/conversation-list/conversation-list.css.test.ts`.
- [ ] Tests first: new rows for the rules of decisions 2 and 3 (Table K of the shell test and a Classic table in the list test, in the media block `(min-width:720px)`); a test that every new selector names `[data-look="classic"]` and no other look; the names test allows the six `--side-*`. See them fail.
- [ ] Add the rules after the shared Focus rules in both files (order matters, decision "Specificity and order").
- [ ] Run `pnpm vitest run packages/ui-web apps/web/tests`. Commit `feat(ui-web): draw the Classic sidebar dark (TOKI-144)`.

### Task 4: the browser test (R2 to R4, R6 to R9)
**Files:** `e2e/classic-frame.spec.ts`.
- [ ] Write the spec: with `twelve()` (a workspace of channels and DMs) and a starred row, in Classic light and dark at 1100 px: computed background and border of `.nav` and `.convs`; colour of a rail item, the column heading, a group heading, a row name; the open row (accent) with the default and the indigo accent; the pressed chip; the field; the presence ring; the Browse row's vertical position between Channels and Direct messages; the account menu is not drawn dark (decision "riskiest"); the sizes 68, 288 and 356 (1100) and 720 px; Calm and Focus: Browse last. Run it with Playwright and fix the CSS (Task 3) where it fails.
- [ ] Commit `test(e2e): check the Classic sidebar frame in the browser (TOKI-144)`.

### Task 5: the specs (R12)
**Files:** `docs/specs/2026-11-16-tokens-package-design.md`, `docs/specs/2026-11-16-app-shell-design.md`, `docs/specs/2026-11-17-conversation-list-design.md`.
- [ ] Edit R10, R11 and R16 of the tokens spec; R17, Tables F and J of the shell spec (Classic's own colour rules; sizes still shared); R12, Table A and R8 of the list spec. Each edited line says what it was.
- [ ] Commit `docs(specs): the Classic sidebar frame (TOKI-144)`.

### Task 6: the whole check
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` (the `*.db.test.ts` files need a test database), `pnpm build`, `pnpm test:e2e`, `pnpm test:e2e:parity` (Docker). The parity report must have no new difference for Calm and Focus.
- [ ] `dev-state diff-file`, the verifier, `/code-review`, the pull request.

## Files each task touches (for the overlap check)
Task 1: `packages/tokens/src/*`, its test, `e2e/support/tokens-prototype.test.ts`. Task 2: one new test. Task 3: the two style sheets and their two tests. Task 4: one new spec. Task 5: three spec files. No two tasks edit the same file.

## How This Plan Was Created
1. Spec provided: the spec of TOKI-144, merged in PR #449.
2. Code read: `shell.css` (the Focus and Classic rules), the list component and its style sheet, the Chip and Field styles, the tokens package, and the way `conversation-list.spec.ts` opens the app.
3. Recommended execution: `cl-dev:executing-plans`, Manual mode, one task at a time.
