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
  - Setting `data-look`, `data-scheme`, `data-accent` and `data-density` on the page, following the device's light or dark setting while the app runs (the scheme `device`), and saving the choice to the account: the Preferences screen and the app shell. This includes setting `data-look` and `data-scheme` before the first paint for a person whose saved look or scheme differs from the device. See concern 10. (was: `data-eff`, `data-accent` and `data-density`; TOKI-142)
  - Font files and font family names: TOKI-010 holds the fonts. See concern 3.
  - Icons, component CSS, the three layouts and their widths (720 px, 1100 px), font sizes, z-index values and motion: the tickets that build components and the app shell.
  - The colours of the Meet call screen: Meet has its own phase (D-006). See concern 4.
  - `--tabh`, the height of the bottom tab bar on a narrow screen (`calc(62px + env(safe-area-inset-bottom,0px))`, set on `.app` inside the narrow-screen media query). It is a layout size of the app shell, not a value of a look, and it depends on the device's safe area, so it cannot be a plain number. TOKI-015 (AppShell with BottomTabs) defines it.
  - Five other custom properties the prototype defines outside its look blocks. Four are local to one component and are set by that component: `--s` (the size of one avatar, `var(--av)` unless a component overrides it), `--h` (the hue of one person's avatar, set inline), `--bh` and `--i` (the height and index of one bar of a voice clip's waveform, set inline). One is demo-only and never ships (D-145): `--chromeh`, the height of the fake window bar of the prototype's device frame.
  - `packages/ui-native` and any React Native style sheet: phase 3. This work only makes the values usable there.
  - Loading the CSS file in `apps/web` and showing it on a page: the tickets that build components and the preview page.
  - Changing any colour for contrast. See concern 5.

## Requirements
- R1. `@toki/tokens` exports the types `Look` (`"calm" | "focus"`), `Accent` (`"teal" | "indigo" | "clay" | "violet"`) and `Density` (`"comfortable" | "compact"`), and the lists `looks`, `accents` and `densities` holding exactly those values in that order.
- R2. `palettes.calm` and `palettes.focus` each hold exactly the 17 base colours and the 4 avatar tint numbers of Table A, with the values of Table A.
- R3. `accentColors[look][accent]` holds, for each of the 2 looks and 4 accents, exactly the four values `accent`, `onAccent`, `accentSoft` and `accentText` of Table B.
- R4. `densityValues.comfortable` and `densityValues.compact` hold the three numbers of Table C. `lookDensity` is `{ calm: "comfortable", focus: "compact" }`: the density each look shows while no density is chosen. It is not the density a new account starts with; that is not decided (concern 1).
- R5. `radii.calm` and `radii.focus` hold the two numbers of Table D.
- R6. `shadows.calm` and `shadows.focus` each hold `shadow` and `pop` as a list of layers `{ x, y, blur, spread, color }` with the values of Table E. "No shadow" is an empty list.
- R7. `getTheme(look, accent, density?)` returns one flat object with exactly 32 keys: the 17 base colours, the 4 accent values, the 4 avatar tint numbers, the 3 density numbers, the 2 radii and the 2 shadows. The accent values are those of the given look and accent. When `density` is left out, the density numbers are those of `lookDensity[look]`; this is the object-side form of a page with no `data-density`.
- R8. Every value the package exports is usable in React Native as it is: a length is a number of pixels (`16`, not `"16px"`), a colour is a string in `#RRGGBB` or `rgba(r,g,b,a)` form, an avatar tint is a number from 0 to 100, and no value contains `var(`, `calc(` or a unit suffix.
- R9. `packages/tokens/src/tokens.css` exists, and the `exports` of `packages/tokens/package.json` holds exactly two entries: the existing `".": "./src/index.ts"` and the new `"./tokens.css": "./src/tokens.css"`. With that entry an `import "@toki/tokens/tokens.css"` from another workspace project resolves to the file, in the same way `"."` resolves today (TOKI-001 R10). A test in the package checks the two entries and that the file each one names exists.
- R10. `tokens.css` declares exactly these 32 custom property names, which are the prototype's names, and no other: `--bg`, `--surface`, `--surface-2`, `--ink`, `--ink-2`, `--muted`, `--line`, `--accent`, `--on-accent`, `--accent-soft`, `--accent-text`, `--mention-bg`, `--mention-ink`, `--danger`, `--danger-soft`, `--live`, `--on-live`, `--idea`, `--idea-soft`, `--hover`, `--scrim`, `--av-s`, `--av-l`, `--av-ts`, `--av-tl`, `--av`, `--gap`, `--row`, `--radius`, `--radius-sm`, `--shadow`, `--pop`.
- R11. `tokens.css` has six blocks, one for each pair of a look and a scheme, with the selector `:root[data-look="<look>"][data-scheme="<scheme>"]`, for the looks `calm`, `focus` and `classic` and the schemes `light` and `dark`. The block of Calm light has the selector `:root, :root[data-look="calm"][data-scheme="light"]`: the bare `:root` is Calm light. Each block declares all 32 properties with the values of that pair: its colours, its teal accent (Table B), the density of `lookDensity` for that look (R4), its radii and its shadows. Each also sets `color-scheme` to its scheme (`light` or `dark`). The values of Calm light and of Focus dark are the values that Calm and Focus have today (Tables A to E); the values of the other four (Calm dark, Focus light, Classic light, Classic dark) are new and come from the prototype (TOKI-142 R2), so this ticket depends on the prototype ticket for them. `data-scheme` selects the colours and `color-scheme`; `data-look` selects the layout and the sizes. (was: one block for `data-eff="calm"` with `color-scheme: light` and one for `data-eff="focus"` with `color-scheme: dark`; TOKI-142)
- R12. `tokens.css` has one block `@media (prefers-color-scheme: dark) { :root:not([data-scheme]) { … } }` with the dark values of the look Calm, a set that the prototype ticket draws (it is the block of Calm dark, R11), including `color-scheme: dark`. So a page that has not set `data-scheme` yet shows the look Calm in the scheme of the device: dark on a device set to dark and light (the bare `:root`) on a device set to light. The look is never chosen by the device. A test compares the device block with the block of Calm dark, and R16 covers the values a page without `data-scheme` gets. (was: `:root:not([data-eff])` with the declarations of the Focus block, so the device chose Focus or Calm; TOKI-142)
- R13. `tokens.css` has eighteen accent blocks with the selector `:root[data-look="<look>"][data-scheme="<scheme>"][data-accent="<accent>"]`, for the six pairs of a look and a scheme and the accents indigo, clay and violet. Each declares exactly `--accent`, `--on-accent`, `--accent-soft` and `--accent-text` with the values of Table B for that pair. There is no block for teal: teal is the value in the six blocks of R11, so a page with no `data-accent`, or with `data-accent="teal"`, shows teal. (was: six accent blocks `:root[data-eff="<look>"][data-accent="<accent>"]`; TOKI-142)
- R14. `tokens.css` has the blocks `:root[data-density="compact"]` and `:root[data-density="comfortable"]`. Each declares exactly `--av`, `--gap` and `--row` with the values of Table C. Both stand after every look block in the file, so a chosen density wins over the look's default in either look.
- R15. In `tokens.css` each value has one text form: (a) A length is the number followed by `px`, zero included: `16px`, `0px`. (b) An avatar tint is the number followed by `%`: `45%`. (c) A colour is the string of the object, character for character: `#0F766E`, `rgba(22,32,29,0.06)` (upper-case hex digits, no space inside `rgba()`, the leading zero kept). (d) A shadow is its layers in the order of Table E, joined by a comma and one space. Each layer is `x y blur spread colour` separated by single spaces, with all four lengths written, a zero spread included. An empty shadow is `none`. (e) Worked examples, exactly as the file holds them. Calm `--shadow`: `0px 1px 2px 0px rgba(22,32,29,0.06), 0px 8px 24px 0px rgba(22,32,29,0.06)`. Focus `--pop`: `0px 0px 0px 1px #283035, 0px 16px 40px 0px rgba(0,0,0,0.5)`. Focus `--shadow`: `none`. Calm `--radius`: `16px`. Calm `--av-s`: `45%`.
- R16. The values that `tokens.css` gives to the root element are the same as `getTheme` returns, for all 32 properties, in each of these 78 states: (a) The 72 states with `data-look` and `data-scheme` set: look (3) by scheme (2) by accent (4) by density (comfortable, compact, none chosen). The expected values are the values of that look, scheme, accent and density (`getTheme(look, accent, density)` for Calm light and Focus dark, as today; the new pairs take theirs from the prototype, R11). The device's light or dark setting makes no difference in these states. (b) The 6 states with no `data-look`, no `data-scheme` and no `data-accent`: device set to light or to dark, by density (comfortable, compact, none chosen). The expected values are those of Calm light, teal, on a light device and those of Calm dark, teal, on a dark device. (c) A test proves this by reading the file, taking for each state the blocks whose selector and media condition match, applying them by specificity and then file order, and comparing with the expected values after the conversion of R15. (d) A test of the six blocks of R11 fails when a block lacks one of the 32 properties, when a value is neither a literal nor a `var()` of the same block (no `filter`, no `color-mix` of another block), or when two blocks have the same set of values (TOKI-142 R2, R7). (was: 30 states, 24 with `data-eff` and 6 without it, with the device choosing Calm or Focus; TOKI-142)
- R17. The committed `tokens.css` is, character for character, the text that `toCss()` builds from the token objects. `pnpm --filter @toki/tokens generate` rewrites the file with that text. The file starts with a comment saying it is generated and names that command. A test fails, and names the command, when the committed file differs from what the script would write.
- R18. The names `--stage`, `--stage-bar`, `--stage-ink`, `--stage-line`, `--stage-muted` and `--tile` appear nowhere in the package, except in the test that checks this.
- R19. No source file under `packages/tokens/src` (test files excepted, as in TOKI-002 R5 and its Design rule 1) uses a browser or DOM global, a Node API or an import from another package, and `packages/tokens/package.json` has no `dependencies` entry. The test file may import Vitest and Node's file and path APIs. The reason: the same source must run in Node, in the browser and in React Native.
- R20. `pnpm --filter @toki/tokens test` runs the tests of this package and exits 0, and `pnpm typecheck` at the root exits 0. The type check of `packages/tokens` covers `src/` (the test file included) and `scripts/`.

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

With no density chosen, the prototype gives Calm the Comfortable numbers and Focus the Compact numbers; `lookDensity` records that (R4).

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

The prototype writes alpha values without the leading zero (`.06`), a zero length without a unit and no spread when it is zero (`0 1px 2px rgba(22,32,29,.06)`); the package writes `0.06`, and `tokens.css` writes every length with `px` and all four lengths of a layer (R15). The rendered shadow is the same.

### Layout
```
packages/tokens/
├─ package.json          adds exports "./tokens.css", scripts generate and test, devDependencies
├─ tsconfig.json         adds scripts/ to the type check and Node's types (see below)
├─ scripts/
│  └─ generate-css.ts    writes src/tokens.css from toCss()
└─ src/
   ├─ index.ts           the public exports of R1 to R7
   ├─ tokens.ts          the token objects (Tables A to E) and their types
   ├─ theme.ts           getTheme
   ├─ css.ts             toCss(): builds the text of tokens.css from the objects; pure, no file access
   ├─ tokens.css         generated and committed
   └─ tokens.test.ts     the tests (a test file: outside the boundary rule, R19)
```
- The TypeScript objects are the only place a value is typed in. `tokens.css` is built from them, so the two cannot differ (R16, R17).
- Decided in this spec: `tokens.css` is generated and committed, not built when the app starts. TOKI-001 fixed that packages are consumed from source with no build step, so a consumer must find a ready file. The test of R17 catches a file that was not regenerated.
- Decided in this spec: the CSS variables keep the prototype's names (R10). The technical design carries the prototype's CSS over almost intact, and that CSS refers to these names.
- Decided in this spec: the look is selected by the attribute `data-look` on the root element, with the values `calm`, `focus` and `classic`, and the colour scheme by `data-scheme`, with the values `light` and `dark` (TOKI-142 R1). `data-scheme` selects the colours and `color-scheme`; `data-look` selects the layout and the sizes, so the component CSS selects on `[data-look="calm"]` and `[data-look="focus"]` for the differences in layout and takes its colours from the variables. "Match my device" is the value `device` of the scheme and never a look (TOKI-142 R3). The prototype has its own `data-look` (the person's raw choice, which can be empty for "Match my device") and `data-theme` (the prototype's own code only reads it and never sets it): those are words about the prototype, and the package uses neither. (was: one attribute `data-eff` with the values `calm` and `focus` for both the colours and the layout; TOKI-142)
- Decided in this spec: the block of R12 exists so that the first paint, before any script has set `data-scheme`, already follows the device's light or dark setting. Once `data-scheme` is set, only the attribute counts. The cost: the block knows the device, not the account. A person who saved the scheme light (the look and the scheme are saved to the account, D-175, TOKI-142 R6) and opens Toki on a dark device gets Calm dark for the first paint and their own once `data-look` and `data-scheme` are set. Removing that flash is left to the app shell, see concern 10. (was: the block made the first paint Focus on a dark device and Calm on a light one, by the rule of AC-120 that "Match my device" chose the look, and the flash was one of looks; TOKI-142)
- Decided in this spec: a shadow is a list of layers, not a CSS string, because React Native cannot be relied on to read a CSS `box-shadow` string. `toCss()` joins the layers into the CSS form (R15).
- Decided in this spec: lengths are numbers of pixels in the objects and get `px` only in the CSS file (R8, R15), because React Native takes numbers.
- Decided in this spec: the object keys are camelCase forms of the variable names, except for the density and avatar values, whose variable names (`--av`, `--row`, `--av-ts`) say too little on their own; the tables give each key.
- Decided in this spec: `getTheme` is the object-side counterpart of the CSS cascade. A React Native screen calls it with the person's look, accent and density and gets every value resolved; nothing else in the package resolves anything.
- The order of the blocks in the file is fixed: Calm light, the device block (R12), the other five look and scheme blocks, the eighteen accent blocks, the two density blocks. The density blocks have the same specificity as the look and scheme blocks and win by coming later (R14); the accent blocks carry one attribute more and win by specificity. (was: Calm, the device block, Focus, six accent blocks, two density blocks; TOKI-142)
- An accent block needs `data-look` and `data-scheme` to match. Before they are set, the page shows teal in the look Calm and the scheme of the device. Accepted: the choice of accent is known only after the account has loaded. (was: an accent block needed `data-eff`; TOKI-142)
- The test runner is Vitest, the script is run with `tsx`, and the test file and the script need Node's types (`@types/node`). All three go into the `devDependencies` of `packages/tokens`, each pinned to one exact version: for Vitest and `tsx` the stable release in use when this work is built, for `@types/node` the latest release of the Node major version that the root `engines` field names (TOKI-001). If the root or any other workspace project already has Vitest, `tsx` or `@types/node` when this work is built, the package uses the same exact version (or the root's copy, when it is installed at the root). Decided in this spec: the builder may run the script another way (for example Node's own type stripping) as long as R17 holds; `tsx` is then not added.
- Decided in this spec: `packages/tokens/tsconfig.json` changes in two ways, both allowed by TOKI-001 ("compiler options that differ by project are added by the ticket that first needs them, in that project's `tsconfig.json`"). Its `include` covers `src` and `scripts`, and `compilerOptions.types` is `["node"]`. It still extends `tsconfig.base.json` and sets none of `strict`, `target`, `module` or `moduleResolution` (TOKI-001 R5). One configuration is used for the whole package, so the type checker would also accept a Node API in a source file; that is kept out by R19, checked by the lint rule of TOKI-002 and, until that exists, by `grep`. A second `tsconfig` for the tests and the script was not chosen: it would add a file and a second `tsc` run for one test file and one script.
- `tokens.css` is a generated file. The lint and format work (TOKI-002) leaves generated files out of Prettier; whichever of the two is built second adds `packages/tokens/src/tokens.css` to `.prettierignore`. See concern 6.
- `scripts/generate-css.ts` uses Node's file API. It sits outside `src/`, so the boundary rule for the source files of `packages/tokens/src` still holds (R19). `tokens.test.ts` reads `tokens.css` and `package.json` with the same API; it is a test file, which the rule leaves out (TOKI-002, Design rule 1 and concern 12).

### Errors
- `tokens.css` differs from what the script writes -> the test of R17 fails and names `pnpm --filter @toki/tokens generate`.
- A value in the objects differs from Tables A to E -> the value tests fail and name the look and the key (R2 to R6).
- `getTheme` is called with a look, accent or density outside R1 -> a type error at `pnpm typecheck`; there is no check while running.

## Testing
- Tests live in `packages/tokens/src/tokens.test.ts` and run with `pnpm --filter @toki/tokens test`. They are written first and seen to fail on the empty package.
- R1 to R6: the tests hold their own copy of Tables A to E, typed in from this spec, and compare each exported value with it. A changed value fails and names the look and the key.
- R7: `getTheme` is called for all 8 pairs of look and accent, with each density and with none (24 calls); each result has exactly the 32 keys and the values of the tables.
- R8: a test walks every exported value and checks the form of each: number, `#RRGGBB` or `rgba(...)` string, or a list of layers; no `var(`, `calc(` or unit suffix.
- R10 to R14: a test reads `tokens.css`, splits it into blocks, and checks the selectors, their order, the property names in each block and the `color-scheme` lines. For R12 it also checks that the device block and the block of Calm dark hold the same declarations with the same values. For R11 it fails on a block with a missing property among the 32, on a value that is not a literal or a `var()` of the same block (no filter, no `color-mix` of another block), and on two blocks with the same set of values (was: the device block compared with the Focus block; TOKI-142).
- R15: a test compares the five worked examples of R15 with the text in the file, and checks that every length in the file ends in `px`, every avatar tint in `%`, and that no shadow layer has fewer than four lengths.
- R16: the same test takes the matching blocks for each of the 78 states (72 with `data-look` and `data-scheme`, 6 without them on a light and on a dark device), applies them by specificity and then file order, and compares the 32 results with the expected values. (was: 30 states, 24 with `data-eff` and 6 without it, compared with `getTheme`; TOKI-142)
- R17: a test compares `toCss()` with the committed file. Checked once by hand as well: change one colour in `tokens.ts`, see the test fail, run `generate`, see it pass, then undo both.
- R9: a test reads `packages/tokens/package.json`, checks that `exports` holds exactly the two entries of R9, and checks that the file each entry names exists. It runs on every test run, so a later edit of `exports` is caught. No hand check in another project: resolution across workspace projects through `exports` was shown by TOKI-001 R10 and does not depend on the entry.
- R18: a test reads every file under `packages/tokens/src` and `packages/tokens/scripts` except the test file itself and fails when one of the six names appears.
- R19: a test reads `package.json` and fails when it has a `dependencies` entry. The source files are checked by `pnpm lint` (TOKI-002 rule 1, which covers `packages/tokens` and leaves test files out) once those rules exist. If they do not exist when this is built, the check is `grep` over the source files under `src` (the test file left out) for `import` lines that name anything but a relative path, and for `window`, `document`, `navigator`, `localStorage`, `process` and `require`.
- R20: run both commands on a clean clone and read the exit codes. Checked once by hand that the type check covers the script: add `const x: number = "a";` to `scripts/generate-css.ts`, see `pnpm typecheck` fail and name the file, then remove the line.
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
| The values come from the prototype; none is invented (derived from I02) | "Source of the values" and Tables A to E; the value tests fail on any other value (R2 to R6). |
| Phase 1 builds both looks, Calm and Focus (D-018, NFR-05) | The three looks are complete in light and dark: every one of the 32 values exists for each of the six states (R7, R11; was both looks). |
| The accents are teal, indigo, clay and violet; the densities are Comfortable and Compact; each applies at once (FR-43, AC-122) and without a reload (TS-195) | R1, R3, R4. Changing one attribute on the root element changes the values through CSS alone, with no reload (R13, R14, R16). |
| The look and the scheme change without a reload; "Match my device" shows the dark scheme when the device is dark and the light scheme when it is light (AC-120, D-175) | Changing `data-look` or `data-scheme` changes the values through CSS alone (R11, R16). R12 covers the page before `data-scheme` is set. After that, the code that sets `data-scheme` applies the rule; that code is outside this work (Scope, Out). (was: changing `data-eff`; "Match my device" showed Focus on a dark device and Calm on a light one; TOKI-142) |
| The web styling is the prototype's CSS on CSS variables; no Tailwind and no runtime styling library | R9, R10 and R19: a plain CSS file with the prototype's names, and no `dependencies` entry. |
| The `tokens` package is shared by the web app, the phone app and the desktop app | R8 and R19: values in a form React Native takes, and source with no DOM. |
| M1 exit check: the component preview page matches the prototype in Calm and Focus at all three layouts | This work supplies the values (R2 to R6, R16). The layouts and the preview page are other tickets. |

## Open questions from the intent
- Which density does a new account start with? Not answered. The decision log does not say (D-175 decides only that density is saved to the account). The package works either way: with no density chosen the density of the look applies (`lookDensity`, R4, R11), and a chosen density wins (R14). Carried forward as concern 1.
- Which accent does a new account start with? Not answered. The decision log does not say; the prototype starts with teal. In the package teal is the accent of the look blocks (R11, R13). Carried forward as concern 2.
- Do the three font families become tokens, and in which ticket? Not answered. This work adds none. Carried forward as concern 3.
- Do the Meet call screen colours belong in the package now? Answered for this work: no (R18). Decided in this spec; see concern 4.
- Are the prototype's colours taken as they are, with no contrast target? Answered for this work: yes, taken as they are, because the intent says no value is invented. Whether a target is wanted is not decided. Carried forward as concern 5.
- Clarify gap: which attribute selects the look? Answered: `data-look` for the look and `data-scheme` for the colour scheme. Decided in this spec (Design, Layout). (was: `data-eff`; TOKI-142)
- Clarify gap: how does a package with no build step offer a CSS file? Answered: the file is generated and committed (R17). Decided in this spec.
- Clarify gap: in what form does React Native get a shadow and a length? Answered: a list of layers and a number of pixels (R6, R8). Decided in this spec.
- Clarify gap: does the package contain a spacing scale, as the technical design's word "spacing" suggests? Answered: the prototype defines no spacing scale. The only sizes that change with a person's choice are the three density values, which are included (Table C). The prototype defines six more custom properties that hold a size, a hue or an index (`--tabh`, `--s`, `--h`, `--bh`, `--i`, `--chromeh`); they belong to one component, to the app shell or to the demo frame, and are left out with a reason each (Scope, Out). Other distances are written directly in the prototype's component CSS and stay there. Decided in this spec.
- Clarify gap: does the package contain the pill radius (`99px`) and the round radius (`50%`) that the prototype's component CSS uses? Answered: no. The prototype has two radius variables only; the other radii are literals in component CSS and stay there. Decided in this spec.

## Areas of concern
1. The default density of a new account is not decided. The prototype starts with no density chosen, so Calm shows the Comfortable sizes and Focus the Compact sizes, and its Preferences screen marks the matching button. FR-43 and AC-122 offer only "Comfortable or Compact". Proposal, not a decision: keep "none chosen" as the starting state, as the prototype does. The package supports both outcomes, so this does not block the work; it blocks the Preferences screen. Decided in this spec, about the package only: `lookDensity` and the optional `density` argument of `getTheme` stay whatever the answer is, because the state "no `data-density` on the page" exists in any case (the first paint, before the account has loaded) and the CSS must give it values. The name `lookDensity` was chosen so that it does not read as the account default. If a new account is decided to store a density, callers simply always pass one. Owner: Thanh Truong.
2. The default accent of a new account is not decided in the log. The prototype starts with teal, and the test for AC-122 starts from teal. Proposal, not a decision: teal. The package treats teal as the accent that applies when none is set (R13); if another default is chosen, only the code that sets `data-accent` changes. Owner: Thanh Truong. Decided: teal is the default accent of a new account, as proposed.
3. The technical design describes `tokens` as "colours, fonts, spacing → CSS variables and React Native styles", but the scope of this ticket lists no fonts, and the fonts have their own ticket (TOKI-010). The three family names (Be Vietnam Pro, Bricolage Grotesque, JetBrains Mono) are therefore in no token today. Not decided: whether they become tokens and which ticket adds them. This work leaves them out. Owner: Thanh Truong. Decided: the font families are not tokens in this work; TOKI-010 holds the fonts and decides whether they become tokens, as proposed.
4. Decided in this spec: the six variables `--stage`, `--stage-bar`, `--stage-ink`, `--stage-line`, `--stage-muted` and `--tile` are left out (R18). In the prototype's style sheet they are used only by the Meet call screen and its mini bar, and Meet has its own phase (D-006). The ticket that builds Meet adds them from the prototype. Four variables stay in although part of their use lies outside phase 1: `--live` and `--on-live` also colour "live" and "now" markers outside the call screen, and `--idea` and `--idea-soft` colour the Guest labels as well as the AI notes. Some of these four may turn out unused in phase 1. Owner: Thanh Truong.
5. The decision log holds no colour contrast target, and this work copies the prototype's colours unchanged. If a target is set later (for example for the accessibility pass), a colour may have to change, and then the package no longer equals the prototype. Not decided. Owner: Thanh Truong. Decided: the prototype's colours are taken unchanged, with no contrast target in this work, as proposed. A target set later changes the package in its own ticket.
6. `tokens.css` is generated, so Prettier must not rewrite it, and `.prettierignore` belongs to the lint and format work (TOKI-002), which may be built before or after this one. Decided in this spec: whichever is built second adds the path. Until both exist there is nothing to conflict. Owner: Thanh Truong.
7. Decided in this spec: the tests compare the package with a copy of Tables A to E typed into the test file, not with the prototype file, because the prototype is not in this repository. So the tests prove that the package equals this spec; that this spec equals the prototype rests on the review of the tables against the prototype's first `:root` blocks. Owner: Thanh Truong.
8. This work adds Vitest to `packages/tokens` before the test harness ticket (TOKI-008) sets up testing for the whole repository, because the ticket needs only TOKI-001 and its values must be tested. The Server skeleton (TOKI-004, spec not merged yet) also plans a minimal Vitest in `apps/server`, so two projects could end up on different versions. Decided in this spec: if the root or any workspace project already has Vitest when this work is built, the package uses the same exact version; otherwise it pins its own. The harness work may later move it to the root. Owner: Thanh Truong.
9. Density is "not offered on a narrow screen" (AC-122), but the log does not say which density a narrow screen then shows when the account has Compact or Comfortable saved from a wide screen. The prototype changes no density value on narrow screens. The package makes no difference by width; the question belongs to the Preferences screen and the app shell. Not decided. Owner: Thanh Truong. Decided: the package makes no difference by width, as proposed; the Preferences screen and the app shell decide which density a narrow screen shows.
10. The device block (R12) chooses the first paint from the device alone, but the look is saved to the account (D-175). A person whose saved scheme differs from the device (light saved, device dark, or dark saved, device light) sees the other scheme until a script sets `data-scheme`, and a person whose saved look is not Calm sees Calm until a script sets `data-look`. How to remove the flash is not decided and is not part of this work. Proposal, not a decision: the app shell keeps a local copy of the last look and scheme and sets `data-look` and `data-scheme` from it in a small inline script before the first paint. The package needs no change for that: once `data-scheme` is set, the device block no longer applies. (was: the device block chose the look, and the flash was Calm against Focus; TOKI-142) To be picked up by TOKI-015 (AppShell) or the Preferences ticket. Owner: Thanh Truong. Decided: the app shell keeps a local copy of the last look and scheme and sets `data-look` and `data-scheme` before the first paint, as proposed; the package needs no change. (was: a copy of the look and `data-eff`; TOKI-142)
