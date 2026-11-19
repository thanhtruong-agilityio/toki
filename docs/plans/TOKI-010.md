# TOKI-010 Self-hosted fonts: plan

Ticket: TOKI-010 (issue 26). Branch: `feat/toki-010-self-hosted-fonts`. Tier: M.
Spec (the source of truth, accepted in #132): `docs/specs/2026-11-16-self-hosted-fonts-design.md`.
Requirements are named `R1` to `R18`, tables `A` to `D`, as in the spec; this plan does not copy the tables, the script and the tests type them in from the spec.

**Goal:** the web app draws text in the prototype's three fonts from seven WOFF2 files served from its own address, and every build proves it with `check:fonts`.

**Tech stack:** Node 22, pnpm 12.21.0, Vite 8, Vitest 5.1.0, `fontkit` 2.0.4 (new, dev only). Outside the repository, once: Python 3 with `fonttools` and `brotli`.

Local commands: prefix with `export PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"` and call pnpm as `corepack pnpm`. The remote is `github`.

## Global constraints

- No file outside `apps/web` changes, apart from `pnpm-lock.yaml` and the two files of this plan under `docs/plans/` (R18).
- Exactly seven font files, the names of Table A, WOFF2, static, upright (R1, R3).
- Each file at most 51,200 bytes; the seven together at most 307,200 bytes (R6). A correctly cut file over the limit is reported with its size; no required character is removed (concern 5).
- A Vietnamese letter missing from an upstream font stops the work until the product owner says yes in the pull request (Table D, R4). The builder adds nothing to Table D.
- The text `fonts.googleapis.com` or `fonts.gstatic.com` appears nowhere in `apps/web/index.html`, `apps/web/src` or `apps/web/dist` (R11). The script and its test live in `scripts/` and `tests/`, outside that rule.
- Commits: Conventional Commits, lowercase subject, ending with `(TOKI-010)`.

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :-- | :-- | :-- |
| R1 seven files, no other font file | 1, 2 | `check-fonts.test.ts` "R1": a missing file, an extra tracked `.ttf`, a wrong name; then `check:fonts` on the real tree |
| R2 seven `@font-face` rules | 1, 3 | `check-fonts.test.ts` "R2": a wrong `font-weight`, a `local()`, a `unicode-range`, an eighth rule, a missing `format("woff2")` |
| R3 static, upright, stored weight | 1, 2 | `check-fonts.test.ts` "R3" on font facts (an axis, italic, weight 500 in the 600 file); "the real files" block reads the seven committed files |
| R4 Table B coverage, Table D, true record | 1, 2 | `check-fonts.test.ts` "R4": a missing letter not in Table D, a missing sign not recorded, a recorded code point the file holds |
| R5 nothing outside Table C | 1, 2 | `check-fonts.test.ts` "R5": a code point U+0400 |
| R6 sizes | 1, 2 | `check-fonts.test.ts` "R6": 51,201 bytes; a total of 307,201 bytes |
| R7 `body` rule, single importer | 1, 3 | `check-fonts.test.ts` "R7": a second rule, a second declaration, another family list, a second importer under `src`, reformatted white space still passes |
| R8 one preload link | 1, 3 | `check-fonts.test.ts` "R8": no link, two links, no `crossorigin`, a wrong `type`, a wrong file |
| R9 seven hashed files in `dist`, own address, no `data:font` | 1, 3 | `check-fonts.test.ts` "R9": six files, an `https://` url, a `data:font` text, a name with no hash; then the real build |
| R10 preload `href` equals the built CSS url | 1, 3 | `check-fonts.test.ts` "R10": an unrewritten `/src/fonts/...` href, a file that is not in `dist`; then the real build |
| R11 no font service named | 1, 3 | `check-fonts.test.ts` "R11": the text in a `src` file and in a `dist` file |
| R12 one font request on `/no-such-page` | 5 | By hand in Chromium on `vite preview`: network list filtered to fonts, `document.fonts` after `document.fonts.ready`; recorded in the pull request |
| R13 Vietnamese sample line in each family | 5 | By hand in Chromium (the builder) and in Safari (the Dev), with a page that is not committed; recorded in the pull request |
| R14 `sources.json` entries, SHA-256 | 1, 2 | `check-fonts.test.ts` "R14": a missing entry, a missing field, a changed SHA-256, a recorded code point outside R4 (a) and (b) |
| R15 licence files | 1, 2 | `check-fonts.test.ts` "R15": a missing licence file, an entry that names none |
| R16 the command, its messages, its exit code | 1, 4 | `check-fonts.test.ts` "main": no `dist/index.html` names the build command; each problem line names a file and a requirement. Step 4 repeats the six failures of the spec's Testing on the real tree |
| R17 build, typecheck, size | 4 | `corepack pnpm --filter ./apps/web build`, `... typecheck`, `corepack pnpm size` |
| R18 nothing outside `apps/web` | 6 | `git diff --name-only github/main...HEAD` |

## Design

The spec is the design. This section adds only what the repository and the order of work change. Approved by the Dev on 2026-11-19; reviewed once by the advisor.

1. **Scope.** Only the files the spec lists, all under `apps/web`. Other tickets left work that waits for this one: the `fonts.css` link in `apps/web/preview.html` and `apps/web/shell-fixture.html`, the `test.todo` in `apps/web/tests/preview/preview.test.ts`, the `test.fixme` entries of `e2e/component-preview.spec.ts` and the "fallback fonts, re-measure" heights of `e2e/app-shell.spec.ts`. None of it is done here: linking the fonts there changes heights asserted under `e2e/`, which R18 puts out of reach. It belongs to TOKI-015 and TOKI-016, after this ticket is merged.
2. **The check script** is built like `apps/web/scripts/check-no-dev-pages.mjs`: Tables A to D as data, pure exported functions that return problems, and a `main` that prints them and sets the exit code. `git ls-files`, the file reads and the reading of `dist` are done in `main` and passed in, so the tests need no git repository.
3. **One new devDependency:** `fontkit` pinned to `2.0.4` (3.0.0 was published on 2026-11-11, too recent to pin). It reads a WOFF2 file's variation axes, `OS/2` weight, italic flag and character set.
4. **No parsing library.** The script has a small tokenizer for CSS (comments removed; at-rules, rules, declarations) and for `<link>` tags with their attributes. It must read both the Prettier-formatted source and Vite's minified output, where a `url()` may have double quotes, single quotes or none.
5. **Tests** are one Vitest file, `apps/web/tests/fonts/check-fonts.test.ts`, picked up by the root `vitest.config.ts` (`projects: ["apps/*", ...]`), so the root `package.json` is not touched. `apps/web/scripts/check-fonts.d.mts` gives the types; `scripts/` is not in the `include` of `apps/web/tsconfig.json`, so `fontkit`'s missing types never reach `tsc`. The by-hand list of the spec's Testing for R16 is automated here and repeated once on the real tree.
6. **Build script:** `vite build && pnpm run check:no-dev-pages && pnpm run check:fonts`. The spec says `build` ends with `check:fonts`.
7. **`main.tsx`** imports `./fonts/fonts.css` first, before `@toki/tokens/tokens.css`; `packages/ui-web/tests/styles/order.test.ts` already expects that order.
8. **Cutting the fonts** happens once, outside the repository, in a Python virtual environment in the session's scratch folder.
   - Sources: JetBrains Mono release `v2.304` (`JetBrainsMono-2.304.zip`, the static `JetBrainsMono-Medium.ttf`); Be Vietnam Pro at commit `804e62d81abb` of `bettergui/BeVietnamPro` (`fonts/ttf`, Regular, Medium, SemiBold, Bold); Bricolage Grotesque at commit `84745e5b9626` of `ateliertriay/bricolage` (`fonts/variable`). The two repositories without a release are pinned by commit; `sources.json` records the full SHA as the version, with the version string stored in the font.
   - Bricolage Grotesque: `fonttools varLib.instancer` first, with `wght` at 600 or 700 and `opsz` and `wdth` pinned to their default values, then the subset. After it the file has no `fvar` table and `OS/2.usWeightClass` is 600 or 700; `--update-name-table` is used and the weight is set by hand if the instancer leaves it wrong.
   - Subset: `pyftsubset <file> --unicodes=<Table C ranges> --flavor=woff2 --output-file=<Table A name>`, with pyftsubset's default layout features. That keeps kerning, mark placement and the ligatures Google Fonts serves to the prototype, and drops the stylistic sets nobody selects. The exact command of each file goes into `sources.json`.
   - The licence file of each family is its `OFL.txt` as it is in the pinned source, saved as `licenses/be-vietnam-pro-OFL.txt`, `licenses/bricolage-grotesque-OFL.txt`, `licenses/jetbrains-mono-OFL.txt`. The builder reads each before cutting and stops if one reserves the font name or forbids the subset (concern 1).
9. **Checks by hand** (R12, R13, the Bricolage comparison) are done by the builder in Chromium on `vite preview`. The page for R13 is temporary and is never committed. Safari (R13) and the side-by-side comparison of a Bricolage title with the prototype are the Dev's; the pull request lists them as open until they are done.

## File structure

| File | Step | What it holds |
| :-- | :-- | :-- |
| `apps/web/scripts/check-fonts.mjs` (new) | 1 | Tables A to D, the tokenizers, the checks, `main` |
| `apps/web/scripts/check-fonts.d.mts` (new) | 1 | Types of the exported functions |
| `apps/web/tests/fonts/check-fonts.test.ts` (new) | 1, 2 | The tests of the table above |
| `apps/web/package.json`, `pnpm-lock.yaml` | 1, 3 | `fontkit` 2.0.4; the script `check:fonts`; the end of `build` |
| `apps/web/src/fonts/*.woff2` (seven, new) | 2 | Table A |
| `apps/web/src/fonts/sources.json` (new) | 2 | R14 |
| `apps/web/src/fonts/licenses/*.txt` (three, new) | 2 | R15 |
| `apps/web/src/fonts/fonts.css` (new) | 3 | R2, R7 |
| `apps/web/src/main.tsx` | 3 | The first import |
| `apps/web/index.html` | 3 | The preload link |

### Interfaces of `check-fonts.mjs`

A problem is `{ file: string, requirement: string, message: string }`. Every check returns `Problem[]`; an empty list means the requirement holds.

- `TABLE_A`: seven `{ family, weight, file }`. `REQUIRED`: the 241 code points of Table B. `isAllowed(codePoint)`: Table C. `TABLE_D`: `{ [family]: number[] }`, all empty.
- `parseCss(text)` returns `{ fontFaces: Declarations[], rules: { selector, declarations }[] }`, where `Declarations` is `{ [property]: string }` with white space collapsed.
- `parseLinks(html)` returns one `{ [attribute]: string | true }` per `<link>` tag.
- `readFont(path)` returns `FontFacts`: `{ file, bytes, isWoff2, axes: string[], italic, weight, codePoints: Set<number>, sha256 }`. It is the only function that uses `fontkit`.
- `checkFileSet({ present, tracked })`: R1. `present` is the names in `src/fonts`, `tracked` the font files git tracks under `apps/web`.
- `checkFonts({ fonts, sources })`: R3, R4, R5, R6.
- `checkCss({ css, importers })`: R2, R7. `importers` is the files under `src` whose text names `fonts.css`.
- `checkPreload({ html })`: R8.
- `checkDist({ html, cssFiles, fileNames, textFiles })`: R9, R10. `checkNoFontService({ files })`: R11.
- `checkSources({ sources, fonts, licenceFiles })`: R14, R15.
- `formatProblem(problem)` returns `check:fonts: <file>: <requirement>: <message>`. `main(webDir)` returns the exit code.

## Steps

### Step 1: the check script and its tests

Files: `apps/web/scripts/check-fonts.mjs`, `apps/web/scripts/check-fonts.d.mts`, `apps/web/tests/fonts/check-fonts.test.ts`, `apps/web/package.json`, `pnpm-lock.yaml`.

- [ ] `corepack pnpm install`, then `corepack pnpm --filter ./apps/web add -D -E fontkit@2.0.4`.
- [ ] Write `check-fonts.test.ts` with one `describe` per row of the table above (R1 to R11, R14, R15, `main`). Each block has one passing case built from a correct fixture (a correct `fonts.css` text, correct font facts for the seven rows, a correct `dist` listing) and the failing cases named in the table; each failing case asserts the `file` and the `requirement` of the problem. The count of `REQUIRED` is asserted to be 241, and Table C is asserted on its edges (U+00FF allowed, U+0100 not, U+0329 allowed, U+032A not, U+1EF9 allowed, U+1EFA not).
- [ ] Run `corepack pnpm vitest run apps/web/tests/fonts` and see it fail because `check-fonts.mjs` does not exist.
- [ ] Write `check-fonts.mjs` and `check-fonts.d.mts` until the tests pass. Imports come from `node:` modules only, plus `fontkit` (R16).
- [ ] Add `"check:fonts": "node scripts/check-fonts.mjs"` to `apps/web/package.json`. Run `corepack pnpm --filter ./apps/web check:fonts` and see it exit non-zero and name the build command (no `dist`), then after a build see it name the seven missing files and R1.
- [ ] `corepack pnpm lint`, `corepack pnpm format:check`, `corepack pnpm --filter ./apps/web typecheck`.
- [ ] Commit: `test(web): add the font check and its tests (TOKI-010)`.

### Step 2: the seven files, their record and their licences

Files: `apps/web/src/fonts/*.woff2`, `apps/web/src/fonts/sources.json`, `apps/web/src/fonts/licenses/*.txt`, `apps/web/tests/fonts/check-fonts.test.ts`.

- [ ] In the scratch folder: `python3 -m venv venv`, `venv/bin/pip install fonttools brotli`; record the two versions.
- [ ] Download the three pinned sources (Design 8) into their own empty folders. Read each `OFL.txt`; stop if one reserves the name or forbids the subset.
- [ ] With `fonttools ttx -t cmap` or a short script, list for each upstream file the code points of Table B it lacks. A Vietnamese letter missing: stop and ask the Dev. A sign or a combining mark missing: note it for `sources.json`.
- [ ] Instance Bricolage Grotesque at 600 and 700, cut the seven files (Design 8), and copy them into `apps/web/src/fonts/` with the names of Table A.
- [ ] Add to the test file the block "the real files": `readFont` on each of the seven gives WOFF2, no axis, upright, the weight of its row; `checkFonts` and `checkSources` on the real folder return no problem. See it fail before `sources.json` exists.
- [ ] Write `sources.json` (one entry per file with every field of R14, the SHA-256 from `shasum -a 256`) and the three licence files. Tests pass.
- [ ] A file over 51,200 bytes or a total over 307,200: stop and report the sizes to the Dev (concern 5).
- [ ] Commit: `feat(web): add the seven font files with their sources and licences (TOKI-010)`.

### Step 3: the CSS, the import, the preload, the build

Files: `apps/web/src/fonts/fonts.css`, `apps/web/src/main.tsx`, `apps/web/index.html`, `apps/web/package.json`.

- [ ] Write `fonts.css`: seven `@font-face` rules in the order of Table A, each with `font-family`, `font-style: normal`, `font-weight`, `font-display: swap` and `src: url("./<file>") format("woff2")`; then `body { font-family: "Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }`.
- [ ] `main.tsx`: add `import "./fonts/fonts.css";` as the first line.
- [ ] `index.html`: add `<link rel="preload" as="font" type="font/woff2" crossorigin href="/src/fonts/be-vietnam-pro-400.woff2" />` in `head`.
- [ ] `package.json`: `"build": "vite build && pnpm run check:no-dev-pages && pnpm run check:fonts"`.
- [ ] `corepack pnpm --filter ./apps/web build` exits 0 and prints the OK line of `check:fonts`. If Vite leaves the preload `href` unrewritten, R10 fails here: then the fix is in how the link names the file, not in the check.
- [ ] `corepack pnpm format` on the new files, then build again (R7: reformatting must not break the check).
- [ ] Commit: `feat(web): load the fonts and preload the main one (TOKI-010)`.

### Step 4: the failures on the real tree, and every gate

- [ ] One at a time, undoing each: remove one font file; replace one file by the uncut upstream font; change one `font-weight` in `fonts.css`; add a second preload link; change one character of a SHA-256 in `sources.json`; delete `dist`. Each time `check:fonts` exits non-zero and names the file and the requirement, or the build command. `git status` is clean afterwards.
- [ ] `corepack pnpm lint`, `format:check`, `typecheck`, `test`, `build`, `size`, `test:e2e`. Output is kept as a summary and the last 30 lines of any failure.
- [ ] A test under `e2e/` or under `packages/` that fails because the real fonts are now loaded: stop and ask the Dev; it is not fixed here (R18).

### Step 5: the checks in a browser

- [ ] `corepack pnpm --filter ./apps/web exec vite preview`, open `/no-such-page` in Chromium: one font request, the Be Vietnam Pro 400 file, once, same host; `document.fonts` shows that face loaded and no other (R12).
- [ ] R13: a temporary page with the sample line of the spec in each family; every character is drawn by that family in Chromium. Remove the page; `git status` is clean.
- [ ] Record both results, and the two checks left to the Dev (Safari for R13, the Bricolage title beside the prototype), in the pull request.

### Step 6: the file list

- [ ] `git diff --name-only github/main...HEAD`: every path is under `apps/web`, or is `pnpm-lock.yaml`, `docs/plans/TOKI-010.md` or `docs/plans/TOKI-010.state.json` (R18).

## What can break

Grilling, round 1 (2026-11-19). The riskiest step is step 2.

1. **A file is over the size limit.** JetBrains Mono carries a large set of code ligatures and Bricolage Grotesque is heavy. Default layout features keep the ligatures the prototype shows. If a file is over 51,200 bytes the builder stops and reports the size; the limit is then the Dev's to change (concern 5). Features are not dropped silently to fit.
2. **Bricolage Grotesque is not really static, or stores the wrong weight.** R3 reads the file, so a leftover axis or a weight of 400 fails the check, not the review.
3. **A font lacks a combining mark.** Expected for some of U+0300 to U+0323; recorded in `sources.json` under R4 (a). A missing Vietnamese letter stops the work.
4. **Vite does not rewrite the preload `href`.** R10 fails the build. The fallback is to name the file in a way Vite does rewrite; the requirement does not change.
5. **The tokenizer misreads minified CSS.** The tests feed it both forms, and step 3 runs it on the real build output.
6. **The real fonts change a browser test outside `apps/web`.** The shell fixture and the preview page do not import `main.tsx`, so their measured heights stay; `sample.spec.ts` fails only on console errors, and an unused preload is a warning. Step 4 runs the whole suite, and a failure outside `apps/web` stops the work.
7. **The record drifts from the files.** R14 compares the SHA-256 on every build.
8. **Safari is not checked by the builder.** It stays open in the pull request until the Dev has done it.

Decided by the Dev in this round (2026-11-19):

- A file over the size limit with the default layout features: stop and report the size; the ligatures are not dropped to fit.
- A test outside `apps/web` that fails because of the real fonts: stop and ask; it is not fixed in this pull request.
- The version of a font with no release is the full commit SHA of its repository, with the version string stored in the font file; JetBrains Mono uses the tag `v2.304`.
- Safari for R13 and the Bricolage comparison are done by the Dev after the pull request is opened, and are listed there as open until then.
