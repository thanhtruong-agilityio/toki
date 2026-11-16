# The tokens package design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/tokens-package.md (Thanh Truong)
Ticket: TOKI-009

## Goal
The builder (Thanh and Claude) needs the design values of the prototype in one place before the base components are built. Today `packages/tokens` exports nothing, and the values exist only as CSS variables inside the prototype's HTML file. After this change the package holds the Calm and Focus palettes, the four accents, the two densities, the radii and the shadows, and offers them twice from one source: as CSS variables for the web and as plain objects that React Native can use in phase 3.

## Scope
- In: the content of `packages/tokens`: typed token objects; a function that returns the resolved values for one look, accent and density; a CSS file that defines the same values as CSS variables under attribute selectors; a script that writes that CSS file from the objects; tests for the values, for the CSS file and for the agreement between the two.
- Out (not now):
  - The package folder, its `package.json`, its `tsconfig.json` and the `@toki/tokens` name: they exist already (TOKI-001). This work fills them and adds one `exports` entry.
  - Setting `data-eff`, `data-accent` and `data-density` on the page, following the device's light or dark setting while the app runs, and saving the choice to the account: the Preferences screen and the app shell.
  - Font files and font family names: TOKI-010 holds the fonts. See concern 3.
  - Icons, component CSS, the three layouts and their widths (720 px, 1100 px), font sizes, z-index values and motion: the tickets that build components and the app shell.
  - The colours of the Meet call screen: Meet has its own phase (D-006). See concern 4.
  - `packages/ui-native` and any React Native style sheet: phase 3. This work only makes the values usable there.
  - Loading the CSS file in `apps/web` and showing it on a page: the tickets that build components and the preview page.
  - Changing any colour for contrast. See concern 5.

## Requirements
- R1. `@toki/tokens` exports the types `Look` (`"calm" | "focus"`), `Accent` (`"teal" | "indigo" | "clay" | "violet"`) and `Density` (`"comfortable" | "compact"`), and the lists `looks`, `accents` and `densities` holding exactly those values in that order.
- R2. `palettes.calm` and `palettes.focus` each hold exactly the 17 base colours and the 4 avatar tint numbers of Table A, with the values of Table A.
- R3. `accentColors[look][accent]` holds, for each of the 2 looks and 4 accents, exactly the four values `accent`, `onAccent`, `accentSoft` and `accentText` of Table B.
- R4. `densityValues.comfortable` and `densityValues.compact` hold the three numbers of Table C. `defaultDensity` is `{ calm: "comfortable", focus: "compact" }`.
- R5. `radii.calm` and `radii.focus` hold the two numbers of Table D.
- R6. `shadows.calm` and `shadows.focus` each hold `shadow` and `pop` as a list of layers `{ x, y, blur, spread, color }` with the values of Table E. "No shadow" is an empty list.
- R7. `getTheme(look, accent, density?)` returns one flat object with exactly 32 keys: the 17 base colours, the 4 accent values, the 4 avatar tint numbers, the 3 density numbers, the 2 radii and the 2 shadows. The accent values are those of the given look and accent. When `density` is left out, the density numbers are those of `defaultDensity[look]`.
- R8. Every value the package exports is usable in React Native as it is: a length is a number of pixels (`16`, not `"16px"`), a colour is a string in `#RRGGBB` or `rgba(r,g,b,a)` form, an avatar tint is a number from 0 to 100, and no value contains `var(`, `calc(` or a unit suffix.
- R9. `packages/tokens/src/tokens.css` exists, and `packages/tokens/package.json` exports it as `"./tokens.css"` beside the existing `"."` entry. An `import "@toki/tokens/tokens.css"` from another workspace project resolves to that file.
- R10. `tokens.css` declares exactly these 32 custom property names, which are the prototype's names, and no other: `--bg`, `--surface`, `--surface-2`, `--ink`, `--ink-2`, `--muted`, `--line`, `--accent`, `--on-accent`, `--accent-soft`, `--accent-text`, `--mention-bg`, `--mention-ink`, `--danger`, `--danger-soft`, `--live`, `--on-live`, `--idea`, `--idea-soft`, `--hover`, `--scrim`, `--av-s`, `--av-l`, `--av-ts`, `--av-tl`, `--av`, `--gap`, `--row`, `--radius`, `--radius-sm`, `--shadow`, `--pop`.
- R11. `tokens.css` has one block with the selector `:root, :root[data-eff="calm"]` and one with `:root[data-eff="focus"]`. Each declares all 32 properties with the values of that look: its Table A values, its teal accent (Table B), its default density (R4), its radii and its shadows. Each also sets `color-scheme`: `light` for Calm, `dark` for Focus.
- R12. `tokens.css` has one block `@media (prefers-color-scheme: dark) { :root:not([data-eff]) { … } }` with the same declarations as the Focus block. So a page that has not set `data-eff` yet shows Focus on a device set to dark and Calm on a device set to light.
- R13. `tokens.css` has six accent blocks with the selector `:root[data-eff="<look>"][data-accent="<accent>"]`, for the two looks and the accents indigo, clay and violet. Each declares exactly `--accent`, `--on-accent`, `--accent-soft` and `--accent-text` with the values of Table B. There is no block for teal: teal is the value in the look blocks, so a page with no `data-accent`, or with `data-accent="teal"`, shows teal.
- R14. `tokens.css` has the blocks `:root[data-density="compact"]` and `:root[data-density="comfortable"]`. Each declares exactly `--av`, `--gap` and `--row` with the values of Table C. Both stand after every look block in the file, so a chosen density wins over the look's default in either look.
- R15. In `tokens.css` a length is written with `px`, an avatar tint with `%`, a shadow as a comma-separated list of `x y blur spread colour` layers in the order of Table E, and an empty shadow as `none`.
- R16. For each of the 24 combinations of look (2), accent (4) and density (comfortable, compact, none chosen), the values that `tokens.css` gives to an element carrying those attributes are the same as `getTheme` returns for that combination, for all 32 properties. A test proves this by reading the file, applying the blocks that match in file order, and comparing with `getTheme` after the conversion of R15.
- R17. `tokens.css` is written by a script from the token objects and by nothing else. `pnpm --filter @toki/tokens generate` rewrites the file. The file starts with a comment saying it is generated and names that command. A test fails, and names the command, when the committed file differs from what the script would write.
- R18. The names `--stage`, `--stage-bar`, `--stage-ink`, `--stage-line`, `--stage-muted` and `--tile` appear nowhere in the package.
- R19. No file under `packages/tokens/src` uses a browser or DOM global or imports another package, and `packages/tokens/package.json` has no `dependencies` entry. The same source runs in Node, in the browser and in React Native.
- R20. `pnpm --filter @toki/tokens test` runs the tests of this package and exits 0, and `pnpm typecheck` at the root exits 0.

## Design
### Source of the values
Every value below is copied from the prototype's style sheet (`docs/blueprint/prototype/index.html` of the Toki Blueprint, the first `:root` blocks, about lines 6 to 56). The prototype states each look twice or more with identical values (`:root`, `:root[data-look="calm"]`, `:root[data-look="focus"]`, `:root[data-theme="dark"]` and a `prefers-color-scheme` block); the tables hold each value once.

Table A. Base colours and avatar tints per look.

| CSS variable | Object key | Calm | Focus |
| :---- | :---- | :---- | :---- |
| `--bg` | `bg` | `#F2F4EF` | `#0E1214` |
| `--surface` | `surface` | `#FFFFFF` | `#161B1E` |
| `--surface-2` | `surface2` | `#F7F8F5` | `#1D2327` |
| `--ink` | `ink` | `#16201D` | `#E8EDEB` |
| `--ink-2` | `ink2` | `#3A4541` | `#C9D1CE` |
| `--muted` | `muted` | `#5A6662` | `#96A29D` |
| `--line` | `line` | `#E0E5DF` | `#283035` |
| `--mention-bg` | `mentionBg` | `#FDF0C4` | `rgba(250,204,21,0.12)` |
| `--mention-ink` | `mentionInk` | `#5C4400` | `#FDE68A` |
| `--danger` | `danger` | `#B42318` | `#F97066` |
| `--danger-soft` | `dangerSoft` | `#FCE8E6` | `#3A1614` |
| `--live` | `live` | `#C2410C` | `#FB923C` |
| `--on-live` | `onLive` | `#FFFFFF` | `#1A0B02` |
| `--idea` | `idea` | `#6D4AC7` | `#B9A2F5` |
| `--idea-soft` | `ideaSoft` | `#ECE6FA` | `#2A2145` |
| `--hover` | `hover` | `rgba(22,32,29,0.055)` | `rgba(232,237,235,0.07)` |
| `--scrim` | `scrim` | `rgba(22,32,29,0.38)` | `rgba(0,0,0,0.55)` |
| `--av-s` | `avatarBgSaturation` | 45 | 35 |
| `--av-l` | `avatarBgLightness` | 88 | 24 |
| `--av-ts` | `avatarTextSaturation` | 55 | 70 |
| `--av-tl` | `avatarTextLightness` | 28 | 86 |

The four avatar tints are percentages. The prototype colours an avatar as `hsl(<hue of the person> <saturation> <lightness>)`: the background from `--av-s` and `--av-l`, the initials from `--av-ts` and `--av-tl`.

Table B. Accent values per look and accent.

| Look | Accent | `--accent` | `--on-accent` | `--accent-soft` | `--accent-text` |
| :---- | :---- | :---- | :---- | :---- | :---- |
| Calm | teal | `#0F766E` | `#FFFFFF` | `#DCEFEA` | `#0B5D56` |
| Calm | indigo | `#4F46E5` | `#FFFFFF` | `#E3E5FB` | `#3730A3` |
| Calm | clay | `#B4532A` | `#FFFFFF` | `#F6E3DA` | `#8A3A17` |
| Calm | violet | `#7C3AED` | `#FFFFFF` | `#EBE3FB` | `#5B21B6` |
| Focus | teal | `#5EEAD4` | `#04201C` | `#123B36` | `#7EF0DE` |
| Focus | indigo | `#A5B4FC` | `#1E1B4B` | `#25285A` | `#C7D2FE` |
| Focus | clay | `#FDBA8C` | `#3B1405` | `#4A2415` | `#FED7BF` |
| Focus | violet | `#C4B5FD` | `#2E1065` | `#34205E` | `#DDD6FE` |

The object keys are `accent`, `onAccent`, `accentSoft` and `accentText`. In Calm the prototype's accent blocks do not restate `--on-accent`; it stays `#FFFFFF` for all four.

Table C. Density (pixels).

| Density | `--av` (`avatarSize`) | `--gap` (`messageGap`) | `--row` (`rowHeight`) |
| :---- | :---- | :---- | :---- |
| Comfortable | 36 | 14 | 36 |
| Compact | 30 | 8 | 32 |

With no density chosen, the prototype gives Calm the Comfortable numbers and Focus the Compact numbers; `defaultDensity` records that (R4).

Table D. Radii (pixels).

| Look | `--radius` (`radius`) | `--radius-sm` (`radiusSm`) |
| :---- | :---- | :---- |
| Calm | 16 | 10 |
| Focus | 10 | 8 |

Table E. Shadows, as layers `x y blur spread colour` (pixels).

| Look | `--shadow` (`shadow`) | `--pop` (`pop`) |
| :---- | :---- | :---- |
| Calm | `0 1 2 0 rgba(22,32,29,0.06)`, then `0 8 24 0 rgba(22,32,29,0.06)` | `0 4 8 0 rgba(22,32,29,0.08)`, then `0 16 40 0 rgba(22,32,29,0.16)` |
| Focus | none | `0 0 0 1 #283035`, then `0 16 40 0 rgba(0,0,0,0.5)` |

The prototype writes alpha values without the leading zero (`.06`); the package writes `0.06`. The colour is the same.

### Layout
```
packages/tokens/
├─ package.json          adds exports "./tokens.css", scripts generate and test, devDependencies
├─ tsconfig.json         unchanged
├─ scripts/
│  └─ generate-css.ts    writes src/tokens.css from toCss()
└─ src/
   ├─ index.ts           the public exports of R1 to R7
   ├─ tokens.ts          the token objects (Tables A to E) and their types
   ├─ theme.ts           getTheme
   ├─ css.ts             toCss(): builds the text of tokens.css from the objects; pure, no file access
   ├─ tokens.css         generated and committed
   └─ tokens.test.ts     the tests
```
- The TypeScript objects are the only place a value is typed in. `tokens.css` is built from them, so the two cannot differ (R16, R17).
- Decided in this spec: `tokens.css` is generated and committed, not built when the app starts. TOKI-001 fixed that packages are consumed from source with no build step, so a consumer must find a ready file. The test of R17 catches a file that was not regenerated.
- Decided in this spec: the CSS variables keep the prototype's names (R10). The technical design carries the prototype's CSS over almost intact, and that CSS refers to these names.
- Decided in this spec: the look is selected by the attribute `data-eff` on the root element, with the values `calm` and `focus`. The prototype's component CSS already selects on `[data-eff="calm"]` and `[data-eff="focus"]` for the differences in layout, so one attribute serves both the colours and the layout. The prototype also has `data-look` (the person's raw choice, which can be empty for "Match my device") and `data-theme` (set by the page that hosts the prototype); the package uses neither.
- Decided in this spec: the block of R12 exists so that the first paint, before any script has set `data-eff`, already follows the device. The rule that "Match my device" means Focus on dark and Calm on light is AC-120. Once `data-eff` is set, only the attribute counts.
- Decided in this spec: a shadow is a list of layers, not a CSS string, because React Native cannot be relied on to read a CSS `box-shadow` string. `toCss()` joins the layers into the CSS form (R15).
- Decided in this spec: lengths are numbers of pixels in the objects and get `px` only in the CSS file (R8, R15), because React Native takes numbers.
- Decided in this spec: the object keys are camelCase forms of the variable names, except for the density and avatar values, whose variable names (`--av`, `--row`, `--av-ts`) say too little on their own; the tables give each key.
- Decided in this spec: `getTheme` is the object-side counterpart of the CSS cascade. A React Native screen calls it with the person's look, accent and density and gets every value resolved; nothing else in the package resolves anything.
- The order of the blocks in the file is fixed: Calm, the device block (R12), Focus, the six accent blocks, the two density blocks. The density blocks have the same specificity as the look blocks and win by coming later (R14); the accent blocks carry one attribute more and win by specificity.
- An accent block needs `data-eff` to match. Before `data-eff` is set, the page shows teal in the look the device asks for. Accepted: the choice of accent is known only after the account has loaded.
- The test runner is Vitest, and the script is run with `tsx`; both go into the `devDependencies` of `packages/tokens`, each pinned to one exact version, the stable release in use when this work is built. If Vitest is already installed at the root by then, the package uses that copy. Decided in this spec: the builder may run the script another way (for example Node's own type stripping) as long as R17 holds.
- `tokens.css` is a generated file. The lint and format work (TOKI-002) leaves generated files out of Prettier; whichever of the two is built second adds `packages/tokens/src/tokens.css` to `.prettierignore`. See concern 6.
- `scripts/generate-css.ts` uses Node's file API. It sits outside `src/`, so the "no browser or DOM global" boundary rule for `packages/tokens/src` still holds (R19).

### Errors
- `tokens.css` differs from what the script writes -> the test of R17 fails and names `pnpm --filter @toki/tokens generate`.
- A value in the objects differs from Tables A to E -> the value tests fail and name the look and the key (R2 to R6).
- `getTheme` is called with a look, accent or density outside R1 -> a type error at `pnpm typecheck`; there is no check while running.

## Testing
- Tests live in `packages/tokens/src/tokens.test.ts` and run with `pnpm --filter @toki/tokens test`. They are written first and seen to fail on the empty package.
- R1 to R6: the tests hold their own copy of Tables A to E, typed in from this spec, and compare each exported value with it. A changed value fails and names the look and the key.
- R7: `getTheme` is called for all 8 pairs of look and accent, with each density and with none (24 calls); each result has exactly the 32 keys and the values of the tables.
- R8: a test walks every exported value and checks the form of each: number, `#RRGGBB` or `rgba(...)` string, or a list of layers; no `var(`, `calc(` or unit suffix.
- R10 to R15: a test reads `tokens.css`, splits it into blocks, and checks the selectors, their order, the property names in each block and the `color-scheme` lines.
- R16: the same test applies the matching blocks in file order for each of the 24 combinations and compares the 32 results with `getTheme`.
- R17: a test compares `toCss()` with the committed file. Checked once by hand as well: change one colour in `tokens.ts`, see the test fail, run `generate`, see it pass, then undo both.
- R9: checked once by hand: add `import "@toki/tokens/tokens.css";` to `apps/web/src/index.ts` with `@toki/tokens` declared as a `workspace:*` dependency, confirm that the path resolves (`node -e` with `import.meta.resolve`, or the web bundler if it exists by then), then remove the line and the dependency.
- R18 and R19: checked with `grep` over `packages/tokens` for the six names, and by reading `package.json` for the absence of `dependencies`. If the lint rules exist when this is built, `pnpm lint` also covers R19.
- R20: run both commands on a clean clone and read the exit codes.
- No browser test in this work: nothing renders yet. The comparison by eye with the prototype happens on the component preview page.
- No data is used. The tests hold colours and numbers only.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Design system | Planning fact; no design impact. |
| Belongs to Blueprint intent I02 design-system: every base component matches the prototype in Calm and Focus | The values are the prototype's (Tables A to E, R2 to R6) and reach the components under the prototype's variable names (R10). |
| Milestone: M1, Foundation and design system | Planning fact; no design impact. |
| Size: M, about one working session with Claude | Scope: one package, 32 values per look, one generated file and its tests; no component, no page, no font. |
| Needs: TOKI-001 | The work fills the `packages/tokens` project that already exists and adds one `exports` entry (R9); it creates no package. |
| Needed by: TOKI-012 and TOKI-013 | R9 and R10: the components import one CSS file and use the variable names of the prototype. |
| Agreed scope: Calm and Focus palettes, 4 accents, density, radii, shadows; exported as CSS variables and as objects for React Native | Palettes R2; accents R3; density R4; radii R5; shadows R6; CSS variables R9 to R15; objects R1 to R8. |
| The values come from the prototype; none is invented | "Source of the values" and Tables A to E; the value tests fail on any other value (R2 to R6). |
| Phase 1 builds both looks, Calm and Focus (D-018, NFR-05) | Both looks are complete: every one of the 32 values exists for each (R7, R11). |
| The accents are teal, indigo, clay and violet; the densities are Comfortable and Compact; each applies at once, without a reload (FR-43, AC-122) | R1, R3, R4. Changing one attribute on the root element changes the values through CSS alone, with no reload (R13, R14, R16). |
| "Match my device" shows Focus when the device is dark and Calm when it is light (AC-120, D-175) | R12 covers the page before `data-eff` is set. After that, the code that sets `data-eff` applies the rule; that code is outside this work (Scope, Out). |
| The web styling is the prototype's CSS on CSS variables; no Tailwind and no runtime styling library | R9, R10 and R19: a plain CSS file with the prototype's names, and no dependency. |
| The `tokens` package is shared by the web app, the phone app and the desktop app | R8 and R19: values in a form React Native takes, and source with no DOM. |
| M1 exit check: the component preview page matches the prototype in Calm and Focus at all three layouts | This work supplies the values (R2 to R6, R16). The layouts and the preview page are other tickets. |

## Open questions from the intent
- Which density does a new account start with? Not answered. The decision log does not say (D-175 decides only that density is saved to the account). The package works either way: with no density chosen the look's default applies (R4, R11), and a chosen density wins (R14). Carried forward as concern 1.
- Which accent does a new account start with? Not answered. The decision log does not say; the prototype starts with teal. In the package teal is the accent of the look blocks (R11, R13). Carried forward as concern 2.
- Do the three font families become tokens, and in which ticket? Not answered. This work adds none. Carried forward as concern 3.
- Do the Meet call screen colours belong in the package now? Answered for this work: no (R18). Decided in this spec; see concern 4.
- Are the prototype's colours taken as they are, with no contrast target? Answered for this work: yes, taken as they are, because the intent says no value is invented. Whether a target is wanted is not decided. Carried forward as concern 5.
- Clarify gap: which attribute selects the look? Answered: `data-eff`. Decided in this spec (Design, Layout).
- Clarify gap: how does a package with no build step offer a CSS file? Answered: the file is generated and committed (R17). Decided in this spec.
- Clarify gap: in what form does React Native get a shadow and a length? Answered: a list of layers and a number of pixels (R6, R8). Decided in this spec.
- Clarify gap: does the package contain a spacing scale, as the technical design's word "spacing" suggests? Answered: the prototype defines no spacing scale. Its only spacing variables are the three density values, which are included (Table C). Other distances are written directly in the prototype's component CSS and stay there.
- Clarify gap: does the package contain the pill radius (`99px`) and the round radius (`50%`) that the prototype's component CSS uses? Answered: no. The prototype has two radius variables only; the other radii are literals in component CSS and stay there. Decided in this spec.

## Areas of concern
1. The default density of a new account is not decided. The prototype starts with no density chosen, so Calm shows the Comfortable sizes and Focus the Compact sizes, and its Preferences screen marks the matching button. FR-43 and AC-122 offer only "Comfortable or Compact". Proposal, not a decision: keep "none chosen" as the starting state, as the prototype does. The package supports both outcomes, so this does not block the work; it blocks the Preferences screen. Owner: Thanh Truong.
2. The default accent of a new account is not decided in the log. The prototype starts with teal, and the test for AC-122 starts from teal. Proposal, not a decision: teal. The package treats teal as the accent that applies when none is set (R13); if another default is chosen, only the code that sets `data-accent` changes. Owner: Thanh Truong.
3. The technical design describes `tokens` as "colours, fonts, spacing → CSS variables and React Native styles", but the scope of this ticket lists no fonts, and the fonts have their own ticket (TOKI-010). The three family names (Be Vietnam Pro, Bricolage Grotesque, JetBrains Mono) are therefore in no token today. Not decided: whether they become tokens and which ticket adds them. This work leaves them out. Owner: Thanh Truong.
4. Decided in this spec: the six variables `--stage`, `--stage-bar`, `--stage-ink`, `--stage-line`, `--stage-muted` and `--tile` are left out (R18). In the prototype's style sheet they are used only by the Meet call screen and its mini bar, and Meet has its own phase (D-006). The ticket that builds Meet adds them from the prototype. Four variables stay in although part of their use lies outside phase 1: `--live` and `--on-live` also colour "live" and "now" markers outside the call screen, and `--idea` and `--idea-soft` colour the Guest labels as well as the AI notes. Some of these four may turn out unused in phase 1. Owner: Thanh Truong.
5. The decision log holds no colour contrast target, and this work copies the prototype's colours unchanged. If a target is set later (for example for the accessibility pass), a colour may have to change, and then the package no longer equals the prototype. Not decided. Owner: Thanh Truong.
6. `tokens.css` is generated, so Prettier must not rewrite it, and `.prettierignore` belongs to the lint and format work (TOKI-002), which may be built before or after this one. Decided in this spec: whichever is built second adds the path. Until both exist there is nothing to conflict. Owner: Thanh Truong.
7. Decided in this spec: the tests compare the package with a copy of Tables A to E typed into the test file, not with the prototype file, because the prototype is not in this repository. So the tests prove that the package equals this spec; that this spec equals the prototype rests on the review of the tables against the prototype's first `:root` blocks. Owner: Thanh Truong.
8. This work adds Vitest to `packages/tokens` before the test harness ticket (TOKI-008) sets up testing for the whole repository, because the ticket needs only TOKI-001 and its values must be tested. Decided in this spec: the package pins its own Vitest unless the root already has one; the harness work may later move it to the root. Owner: Thanh Truong.
9. Density is "not offered on a narrow screen" (AC-122), but the log does not say which density a narrow screen then shows when the account has Compact or Comfortable saved from a wide screen. The prototype changes no density value on narrow screens. The package makes no difference by width; the question belongs to the Preferences screen and the app shell. Not decided. Owner: Thanh Truong.
