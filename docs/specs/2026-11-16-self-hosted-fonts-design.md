# Self-hosted fonts design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/self-hosted-fonts.md (Thanh Truong)
Ticket: TOKI-010

## Goal
The builder (Thanh and Claude) needs the prototype's three fonts inside the web app before components and screens are built, so that text looks as it does in the prototype. The font files come from Toki's own address, not from a font service, and hold only the Latin and Vietnamese characters, so that every Vietnamese letter is drawn in the right font and the first visit stays fast. The main font is fetched early.

## Scope
- In: seven WOFF2 font files in `apps/web`; one CSS file with their seven `@font-face` rules and the `font-family` of `body`; the preload link for the main font in `apps/web/index.html`; a record of where each file came from, how it was cut, and the licence text of each font; a check script, `check:fonts`, that proves the files, the CSS, the preload and the build output, and runs at the end of the `build` script of `apps/web`.
- Out (not now):
  - The app itself, `index.html`, `main.tsx`, the `build` script and the 200 KB rule for the initial JavaScript: they exist already (TOKI-006). This work adds one link to `index.html` and one import to `main.tsx`.
  - Font names as design tokens. Decided in this spec: the three font names are not tokens in phase 1, and `packages/tokens` (TOKI-009) stays without fonts; this answers the question TOKI-009 left open. This ticket owns the font files, the `@font-face` rules and the three family names. The reason is in Design, "Ownership of the font names".
  - Every other use of the fonts: the `font-family` lines for titles, times, counters, keys and code, and all font sizes, line heights and letter spacing. They are part of the component CSS carried over from the prototype by the tickets that build each component (TOKI-012 to TOKI-015). This ticket sets `font-family` on `body` only.
  - The other text rules of `body` (`font-size:14px`, `line-height:1.45`, font smoothing) and the form-control rule `button,input,select,textarea{font:inherit;color:inherit}`: TOKI-012, the first ticket that carries over component CSS (it builds Button, Field and Select). Decided in this spec. Plan change: TOKI-012 now also needs TOKI-010, so that the font family of `body` is declared once, here, before TOKI-012 writes its CSS; the Blueprint plan must be updated.
  - Italic font files and a JetBrains Mono file at weight 600: the prototype loads neither. See concern 3.
  - Fonts for the phone app (React Native loads font files in its own way): phase 3.
  - Cache headers for the font files on the production server: TOKI-084 (Caddyfile). This work gives each built file a name that changes with its content, so a long cache time is safe.
  - A CI step or a root script for `check:fonts`. Decided in this spec: TOKI-010 owns the check, and it runs inside the build check, not as a sixth check. The `build` script of `apps/web` ends with `pnpm run check:fonts`, so every build proves the fonts, and TOKI-007's build check (its R6, which runs the root `build`) fails when the fonts are wrong. TOKI-007 adds nothing for fonts: its workflow, its five checks (R8) and its root scripts (R10) stay as they are, and no file outside `apps/web` changes. Plan change: none for TOKI-007; the owner of `check:fonts` is TOKI-010.
  - A component preview of the fonts: TOKI-016.
  - Emoji: drawn by the device's own emoji font, as in the prototype.

## Requirements
- R1. `apps/web/src/fonts/` holds exactly seven font files, all in WOFF2 format, one for each row of Table A, with the file names of Table A. No other font file is committed under `apps/web` (this covers `src/`, `public/` and every other committed folder). The build output `apps/web/dist`, which holds copies of the fonts (R9), and `node_modules` are not committed and are not covered by this rule. `check:fonts` scans the files that git tracks under `apps/web`, not those two folders.
- R2. `apps/web/src/fonts/fonts.css` declares exactly seven `@font-face` rules, one for each row of Table A. Each rule has the `font-family` of its row, with the name of Table A; `font-style: normal`; `font-weight` as the single number of its row; `font-display: swap`; and one `src` value, a relative `url()` to the file of its row with `format("woff2")`. No rule has `local()` or `unicode-range`.
- R3. Each font file is a static font (it has no variation axis), is not italic, and the weight stored in the file equals the weight of its row in Table A.
- R4. Each of the seven files has a glyph for every one of the 241 code points of Table B, except a code point that `sources.json` records as missing in the upstream font of that family, which is allowed only for a sign or a combining mark of Table B and never for a Vietnamese letter (Design, "Characters").
- R5. No file has a glyph for a code point outside the ranges of Table C.
- R6. Each file is at most 51,200 bytes (50 KB), and the seven files together are at most 307,200 bytes (300 KB).
- R7. `fonts.css` holds, besides the seven `@font-face` rules, exactly one more rule: its selector is `body` and it has one declaration, `font-family`, whose value is the list `"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`, the family list of the prototype's `body` rule. White space does not matter: `check:fonts` parses the CSS and the HTML (rules, declarations, attributes) and does not compare text, so the Prettier pass of TOKI-002 R2 may reformat `fonts.css`, `index.html` and `sources.json` without breaking it. `apps/web/src/main.tsx` imports `fonts.css`, and no other file under `apps/web/src` does.
- R8. `apps/web/index.html` has exactly one `<link rel="preload">` with `as="font"`. It points at the Be Vietnam Pro weight 400 file and carries `type="font/woff2"` and `crossorigin`.
- R9. After `pnpm --filter ./apps/web build`, `apps/web/dist` holds the seven fonts as seven separate `.woff2` files whose names contain a content hash, with the Vite `base` left at its default `/`. The seven `url()` values of the `@font-face` rules in the built CSS each name one of these files with a path on the app's own address (no scheme and no host). No file in `dist` contains `data:font`.
- R10. In `apps/web/dist/index.html` the `href` of the font preload link is the same URL that the built CSS gives for Be Vietnam Pro weight 400 (with `base` at `/`, both are an absolute path), and the file it names exists in `dist`.
- R11. Neither `apps/web/index.html`, nor any file under `apps/web/src`, nor any file under `apps/web/dist` contains the text `fonts.googleapis.com` or `fonts.gstatic.com`.
- R12. With the built app open at an unknown path (for example `/no-such-page`), the not-found text is drawn in Be Vietnam Pro, exactly one font file is requested, it is the preloaded file, it is requested once, and no request goes to another host.
- R13. A page that shows the Vietnamese sample line of Testing in each of the three families draws every character of the line in that family; the browser's list of rendered fonts for the line names no other font.
- R14. `apps/web/src/fonts/sources.json` has one entry for each of the seven files, with: the file name, the family, the weight, the address of the upstream release it was made from, the version of that release, the name of the licence, the SHA-256 of the committed file, and how it was cut: the subsetting tool, its version, the exact command or option list (including the fixing of Bricolage Grotesque to one weight), the Table B code points given to the tool, and the code points of Table B that the upstream font lacks, if any. The SHA-256 of each file in `apps/web/src/fonts/` equals the one recorded.
- R15. `apps/web/src/fonts/licenses/` holds the licence text of each of the three families as it comes with the upstream release, one file per family, and each `sources.json` entry names the licence file of its family.
- R16. `pnpm --filter ./apps/web check:fonts` checks R1 to R11, R14 and R15, and exits 0 only when all hold. The script `scripts/check-fonts.mjs` itself passes `pnpm lint` and `pnpm format:check` (TOKI-002 R1, R2); it imports what it needs from `node:` modules, so it does not rely on global names such as `process`. When one fails it exits non-zero and names the file and the requirement. When `apps/web/dist/index.html` does not exist it exits non-zero and names the build command.
- R17. `pnpm --filter ./apps/web build` (which now ends with `check:fonts`) and `pnpm --filter ./apps/web typecheck` still exit 0, and the initial JavaScript is still under the limit of TOKI-006 R10.
- R18. This change touches no file outside `apps/web`, apart from the lock file.

## Design
### What the prototype uses
The prototype has one font link: `https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Bricolage+Grotesque:wght@600;700&family=JetBrains+Mono:wght@500&display=swap`. It asks for seven faces, all upright, and for `display=swap`. Table A is that list.

Table A: the seven faces.

| Family (the name in `font-family`) | Weight | File | Where the prototype uses it |
| :---- | :---- | :---- | :---- |
| `Be Vietnam Pro` | 400 | `be-vietnam-pro-400.woff2` | `body`: all interface and message text |
| `Be Vietnam Pro` | 500 | `be-vietnam-pro-500.woff2` | Chips, navigation items, tabs, banners, toasts, bottom tabs |
| `Be Vietnam Pro` | 600 | `be-vietnam-pro-600.woff2` | The weight used most: labels, buttons, small headings, table heads |
| `Be Vietnam Pro` | 700 | `be-vietnam-pro-700.woff2` | Conversation headers (`h1`), `<b>` in messages, strong buttons |
| `Bricolage Grotesque` | 600 | `bricolage-grotesque-600.woff2` | Asked for by the prototype's font link. No rule found in the prototype's CSS sets Bricolage Grotesque text to 600 (concern 9) |
| `Bricolage Grotesque` | 700 | `bricolage-grotesque-700.woff2` | Page titles (`.title`), the workspace letter and name (`.wsl`, `.wsn`), the headings `.mread h2`, `.modal .mhd h2` and `.notes h2`, and `.disp` text (profile name, call title) |
| `JetBrains Mono` | 500 | `jetbrains-mono-500.woff2` | `.mono`, `time`, `.kbd`, `[data-timer]`, the counter `.cnt`, `code` in messages, the copy row, the sign-in code field `.inp.code` |

The prototype's family lists, which the later component CSS keeps as they are:
- `body`: `"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`.
- `.disp`: `"Bricolage Grotesque","Be Vietnam Pro",system-ui,sans-serif`; other titles: `"Bricolage Grotesque",sans-serif` or `"Bricolage Grotesque",system-ui,sans-serif`.
- `.mono,time,.kbd,[data-timer]`: `"JetBrains Mono",ui-monospace,"SF Mono",Menlo,monospace`; other code: `"JetBrains Mono",monospace`.
- `.sechead .title .pill.idea`: `"Be Vietnam Pro",system-ui,sans-serif`.
- These are the lists of the 15 `font-family` declarations in the prototype; the carried-over CSS keeps each as it is.

### Characters
Decided in this spec: "Latin and Vietnamese" means the characters below. The Blueprint gives no list, and the lists are the author's choice, not derived from the prototype by a tool. How they were built: Basic Latin for English text (D-018, D-064); the Vietnamese alphabet with its five tone marks in both cases, in precomposed form and as letter plus combining mark; and the non-ASCII signs found by reading every non-ASCII character of the prototype, outside the Vietnamese letters and emoji: middle dot U+00B7 (82 uses), ellipsis U+2026 (8), en dash U+2013 (2), U+203A (1), arrows U+2191 and U+2193 (1 each). The prototype's text uses no U+00A0, so it is not required (it is allowed, in Table C). The list needs the author's confirmation (concern 10). The required list (Table B) is what Vietnamese and English text needs plus four of those signs; the allowed list (Table C) is a little wider, so that a font may keep the common signs it has, and it is the upper bound that proves the file was cut down.

Table B: required code points (241).

| Group | Code points | Count |
| :---- | :---- | :---- |
| Basic Latin | U+0020 to U+007E | 95 |
| Middle dot | U+00B7 | 1 |
| Vietnamese letters in Latin-1 | U+00C0 to U+00C3, U+00C8 to U+00CA, U+00CC, U+00CD, U+00D2 to U+00D5, U+00D9, U+00DA, U+00DD, U+00E0 to U+00E3, U+00E8 to U+00EA, U+00EC, U+00ED, U+00F2 to U+00F5, U+00F9, U+00FA, U+00FD | 32 |
| Ă ă Đ đ Ĩ ĩ Ũ ũ Ơ ơ Ư ư | U+0102, U+0103, U+0110, U+0111, U+0128, U+0129, U+0168, U+0169, U+01A0, U+01A1, U+01AF, U+01B0 | 12 |
| Vietnamese letters with tone marks | U+1EA0 to U+1EF9 | 90 |
| Combining marks, for Vietnamese typed as letter plus mark: the five tone marks (grave, acute, tilde, hook above, dot below) and the three letter marks (circumflex, breve, horn) | U+0300, U+0301, U+0302, U+0303, U+0306, U+0309, U+031B, U+0323 | 8 |
| Signs used in the prototype's text | U+2013 (–), U+2026 (…), U+203A (›) | 3 |

Table C: allowed ranges. A file may hold a glyph only for a code point in: U+0000 to U+00FF; U+0102, U+0103; U+0110, U+0111; U+0128, U+0129; U+0131; U+0152, U+0153; U+0168, U+0169; U+01A0, U+01A1; U+01AF, U+01B0; U+02C6 to U+02DC; U+0300 to U+0329; U+1EA0 to U+1EF9; U+2000 to U+206F; U+20AB, U+20AC; U+2122; U+2190 to U+2193; U+2212; U+2215; U+FEFF; U+FFFD.

- A character that is allowed but not required (for example ↑ and ↓, which the prototype's text uses and which are left allowed-not-required on purpose, U+00A0, or ₫) is kept when the upstream font has it. When the font does not have it, the browser draws it with the next font of the family list, as it does in the prototype.
- Decided in this spec: if an upstream font lacks a required code point that is a sign or a combining mark (U+00B7, U+2013, U+2026, U+203A, U+03xx), the file is made without it, `sources.json` records the code point as missing for that file, and the browser draws it with the next font of the family list. If an upstream font lacks a Vietnamese letter, the file is not made: the builder stops and reports it. See concern 2.

### How the files are made
- Decided in this spec: one file per face that holds Latin and Vietnamese together, not one file per script with `unicode-range`. Reason: people write Vietnamese names and messages whatever the interface language is (D-018), so nearly every visit needs both; one file means the single preload (R8) covers Vietnamese text too, and there are seven requests at most.
- Decided in this spec: the seven files are made once, by hand, from the upstream release of each font with a subsetting tool, and are committed. No script in the repository makes them. Reason: the tools for cutting fonts are not part of the project's stack, the files change only when a font gets a new release, and `check:fonts` proves the result whatever tool made it. `sources.json` records the release, the SHA-256, the tool, its version, the exact options and the code point list (R14), so a changed file is noticed and the next builder can repeat the cut.
- Bricolage Grotesque is published as a variable font. Its two files are fixed at weights 600 and 700, with every other axis at the value the prototype's link gets. The link asks for the weight only, so the other axes are probably at the font's defaults; this was not verified. The builder confirms it by comparing a title in the prototype and in the app (Testing).
- The subsetting keeps the layout features of the glyphs that stay (kerning, mark placement), so combining marks sit correctly.
- WOFF2 only. All supported browsers read it (D-108), so no second format is added.

### How the app loads them
- `fonts.css` is imported by `main.tsx`, so Vite puts it in the app's CSS and copies the font files into `dist/assets/` with a content hash in each name. Vite inlines only small assets (4 KB by default); the font files are larger, and this work leaves that setting unchanged (R9).
- The Vite `base` stays at its default `/` (R9, R10), so the built CSS and the built `index.html` give the same absolute path for a file.
- `index.html` gets `<link rel="preload" as="font" type="font/woff2" crossorigin href="/src/fonts/be-vietnam-pro-400.woff2">`. Vite rewrites the `href` to the hashed file at build time. R10 checks the result, so a build that fails to rewrite it does not pass. `crossorigin` is needed even for a file on the same address: without it the browser fetches the font twice.
- Decided in this spec: only weight 400 is preloaded. Reason: it is the weight of `body`, so it draws message text and every text that sets no weight; each preload competes with the JavaScript on a slow connection (NFR-13), and the prototype itself preloads nothing. This is not the weight used most: the prototype's CSS sets `font-weight` 600 in 47 declarations, 700 in 21, 500 in 8 and 400 in 8. So text at 600 and 700 (buttons, labels and headings, for example on the sign-in screen, which has no message text) is first drawn in the fallback font and swaps when its file arrives, as the prototype's `display=swap` does. This swap is accepted. Whether to preload 600 too is left to the measurement of the finished app (concern 11).
- A font is fetched only when text uses it. The skeleton's pages use weight 400 only, so they fetch one file (R12).
- The browser's own cache keeps the files between visits. The service worker is for push only (D-030) and does not store them.

### Ownership of the font names
Decided in this spec: the three font names are not design tokens in phase 1.
- The prototype writes the family names directly in 15 CSS rules, with different fallback lists, and never through a CSS variable. The technical design carries that CSS over almost intact. A token would change those 15 rules for no change on screen.
- TOKI-009 fixes that `tokens.css` declares exactly 32 variables and no other, so a font variable cannot be added there without changing that spec.
- The names in the `@font-face` rules of this ticket are exactly the prototype's (`Be Vietnam Pro`, `Bricolage Grotesque`, `JetBrains Mono`), so the carried-over CSS works without a change.
- The phone app needs font names as React Native values. The phase 3 ticket that sets up fonts for the phone app decides then whether they go into `@toki/tokens`.

### Layout
```
apps/web/
├─ index.html                  adds the one font preload link
├─ package.json                adds the script check:fonts, ends the build script with it, and adds one devDependency (a font-reading library)
├─ scripts/
│  └─ check-fonts.mjs          checks R1 to R11, R14, R15
└─ src/
   ├─ main.tsx                 adds: import "./fonts/fonts.css"
   └─ fonts/
      ├─ fonts.css             seven @font-face rules and the body font-family
      ├─ sources.json          where each file came from, licence, SHA-256
      ├─ be-vietnam-pro-400.woff2 … jetbrains-mono-500.woff2   (seven files, Table A)
      └─ licenses/             one licence text per family
```
- `check-fonts.mjs` reads each font file with a font-reading library (the builder's choice, pinned to an exact version in the `devDependencies` of `apps/web`) to get its format, axes, weight and the code points it covers. It parses `fonts.css` and `index.html` (R2, R7, R8, R10) and reads `sources.json` and the files of `dist`. It holds Tables A, B and C as data. It lists the committed font files with `git ls-files` for R1.
- `check:fonts` runs after the Vite build, because R9 to R11 read `dist`: the `build` script of `apps/web` ends with `pnpm run check:fonts` (Scope, "Decided in this spec"). The command can also be run alone after a build.

### Errors
- A font file is missing, extra, in another format, variable, italic or of the wrong weight -> `check:fonts` exits non-zero and names the file and R1 or R3.
- A file lacks a required code point or holds one outside the allowed ranges -> non-zero; names the file, the requirement (R4 or R5) and the first such code point.
- A file or the total is over the size limit -> non-zero; names the file or the total and its size (R6).
- `fonts.css`, the preload link or the build output differs from R2, R7, R8, R9, R10 or R11 -> non-zero; names the file and the requirement.
- A file's SHA-256 differs from `sources.json`, or an entry or licence file is missing -> non-zero; names the file (R14, R15).
- `dist/index.html` does not exist -> non-zero; the message names `pnpm --filter ./apps/web build`.
- A font file fails to load in the browser -> the text stays in the fallback font of the family list; nothing else happens.

## Testing
- `check:fonts` is the automatic test. Write `check-fonts.mjs` first with Tables A, B and C, see it fail on the empty folder, then add the files, the CSS and the link until it exits 0 after a build. It covers R1 to R11, R14 and R15, and R16 is its own behaviour.
- R16, checked once by hand for each kind of failure, undoing each change afterwards: remove one font file; replace one file by the uncut upstream font (fails R5 and R6); change one `font-weight` in `fonts.css`; add a second preload link; change one byte of `sources.json`'s SHA-256; delete `dist`. Each time the command exits non-zero and names the file and the requirement, or the build command.
- R4 is the proof that all seven files cover the characters: it reads the code points the font file holds. R13 is only the visual check of one weight of each family, and R12 checks the load of the one preloaded file; neither proves the other weights. R12 is by hand here; TOKI-008 (the test harness) may take it over as an automated check; that is its spec's decision, not this one's.
- R12, by hand in a supported browser on the built app (`vite preview`): open `/no-such-page`, read the network list filtered to fonts (one request, the Be Vietnam Pro 400 file, same host), and read the rendered font of the not-found text in the browser's inspector.
- R13, by hand: add for the test only a page that shows the sample line three times, once in each family: `Tiếng Việt: à ả ã á ạ ă ằ ẳ ẵ ắ ặ â ầ ẩ ẫ ấ ậ đ è ẻ ẽ é ẹ ê ề ể ễ ế ệ ì ỉ ĩ í ị ò ỏ õ ó ọ ô ồ ổ ỗ ố ộ ơ ờ ở ỡ ớ ợ ù ủ ũ ú ụ ư ừ ử ữ ứ ự ỳ ỷ ỹ ý ỵ ĐƯỜNG NGUYỄN HUỆ`. The line holds only part of the 90 letters with tone marks and no combining mark; the complete coverage is R4. Check the rendered fonts of each line in the inspector, in Chrome and in Safari, then remove the page. The line is test data, not interface text.
- Bricolage Grotesque axes, by hand: put the prototype's page title and the same title in the app side by side at the same size and compare the letter shapes and widths.
- R17: run `build` and `typecheck`, and repeat the size check of TOKI-006 R10.
- R18: read the list of changed files of the branch.
- No test framework is added: TOKI-008 owns the harness and this ticket needs only TOKI-006. The font files, the sample line and `sources.json` hold no personal data.

## Data safety
- After this work the web app makes no request to a font service: every font request goes to the app's own address (R9, R11, R12).
- Each font is shipped with its licence text and a record of its source (R14, R15). See concern 1.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Design system | Planning fact; no design impact |
| Belongs to Blueprint intent I02 design-system (every base component matches the prototype) | The seven faces of the prototype's font link, under the prototype's family names (R1, R2, Table A) |
| Milestone: M1, Foundation and design system | Planning fact; no design impact |
| Size: S, about half a working session with Claude | Seven files, one CSS file, one link, one check script, a source record and licence files; no generation script, no token, no component. Decided in this spec: the work is larger than half a session, because of the check script, the SHA-256 record, the size limits and the licence files; see concern 12 |
| Needs: TOKI-006 | The work adds to `index.html`, `main.tsx` and the `build` script of TOKI-006 (R7, R8, R16, R17) |
| Agreed scope: three fonts subset to Latin and Vietnamese, with the main one preloaded | Three families (R1); subset proven by R4, R5 and R6; Be Vietnam Pro 400 preloaded (R8, R10) |
| The three fonts are Be Vietnam Pro, Bricolage Grotesque and JetBrains Mono, self-hosted | Table A; files served from the app's own address and no font service named anywhere (R9, R11, R12) |
| The fonts, their weights and where each is used come from the prototype; none is invented | Table A is the prototype's font link; no italic and no other weight is added (R1, R3, concern 3) |
| English is the default language and Vietnamese is fully supported | Every Vietnamese letter, tone mark and combining mark is required in all seven files (R4, Table B) and checked on screen for one weight of each family (R13) |
| First load on 4G under 2 seconds; initial JavaScript under 200 KB compressed | Small files with a size limit (R6), one preload (R8), `font-display: swap` (R2), no JavaScript added (R17). Text at weights 600 and 700 is first drawn in the fallback font (Design, concern 11). The 2-second target itself is measured on the finished app, not here |
| Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox | WOFF2 only, which all of them read (R1); R13 is checked in Chrome and Safari |
| The service worker is used for push only, so it does not store the fonts | No service worker code; hashed file names let the browser cache keep the files (R9) |
| The prototype's CSS is carried over almost intact, on CSS variables | Family names are the prototype's and are used directly, not through a new variable (R2, R7, Design "Ownership of the font names"). The other `body` rules and the form-control rule go to TOKI-012 (Scope) |

## Open questions from the intent
- Are the three font names design tokens, and which ticket holds them? Answered: not tokens in phase 1; this ticket owns the files, the `@font-face` rules and the names; `packages/tokens` stays without fonts. Decided in this spec (Design, "Ownership of the font names"). See concern 4.
- Which weight of the main font is preloaded? Answered: Be Vietnam Pro 400 only. Decided in this spec (Design, "How the app loads them").
- Does Toki add font files for italic text and for JetBrains Mono at weight 600? Answered: no, because the prototype loads neither. Carried forward as concern 3 for the look.
- Clarify gap: which characters are "Latin and Vietnamese"? Answered: Tables B and C, an author's list that needs confirmation (concern 10). Decided in this spec.
- Clarify gap: one file per face or one per script? Answered: one per face. Decided in this spec.
- Clarify gap: how large may the files be? Answered: R6. Decided in this spec; see concern 5. Whether the size of this work (guards beyond the check of the build) is wanted is concern 12.
- Clarify gap: may the fonts be copied, cut down and served? Not answered. Carried forward as concern 1.
- Clarify gap: do Bricolage Grotesque and JetBrains Mono hold every required Vietnamese character? Not answered. Carried forward as concern 2. The fallback rule for a missing sign or mark is decided (Design, "Characters").

## Areas of concern
1. The licence of the three fonts was not checked while writing this spec, and the glyph coverage (concern 2), the Bricolage Grotesque axes and the file sizes against R6 (concern 5) are claims until the builder has the upstream files. Proposal: all three are published under the SIL Open Font License 1.1, which allows copying, cutting down and serving a font when the licence text goes with it; some fonts under that licence reserve their name, and a cut-down file may then not keep the name. The builder reads the licence of each upstream release before making the files, records it (R14, R15) and stops if a licence forbids the subset or the name. Owner: Thanh Truong.
2. It was not checked while writing this spec that Bricolage Grotesque and JetBrains Mono each hold all 241 required code points, the combining marks in particular; the upstream fonts were not opened. Be Vietnam Pro is made for Vietnamese. The builder checks the three upstream releases before making the files. A missing sign or mark follows the rule decided in Design, "Characters" (recorded in `sources.json`, drawn by the next font). Not decided: what to do when a Vietnamese letter is missing from a font; the builder stops and reports it, and the choice is then open: accept that the letter falls back to the next font of the list, or use another font. Owner: Thanh Truong.
3. The prototype draws three things in a style it loads no file for, so the browser makes the style itself: italic text (the draft marker `.cr .draft`, the edited marker `.msg .ed`, and `_text_` in a message, all in Be Vietnam Pro), the counter `.cnt` in JetBrains Mono at weight 600, and `code` and `time` at weight 400, which take the 500 file. Decided in this spec: no file is added, so the app looks as the prototype does. Not decided: whether real italic files of Be Vietnam Pro should be added for a better look; that would add files the prototype does not have. Owner: Thanh Truong.
4. The technical design describes `tokens` as "colours, fonts, spacing". This spec decides the opposite for fonts in phase 1 (Design, "Ownership of the font names"), and TOKI-009 leaves the question open as its concern 3. The lead confirms the line, and the description in the technical design is then corrected. Owner: Thanh Truong.
5. The size limits of R6 (50 KB a file, 300 KB in all) are set by this spec; no decision gives a number and no file was measured. They are meant as a guard against an uncut font, not as a target. If a correctly cut file is over the limit, the builder reports the size and the limit is changed; no required character is removed to fit. Owner: Thanh Truong.
6. On a page with no text at all, such as the skeleton's empty index page, the preloaded font is not used and Chrome writes a console warning about an unused preload. It is a warning, not an error, so TOKI-006 R2 still holds, and it goes away with the first screen that shows text. Accepted in this spec. Owner: Thanh Truong.
7. The body rule is split: this ticket sets `font-family` on `body`, and TOKI-012 sets the rest of the prototype's `body` text rule (size, line height, smoothing). Decided in this spec so that the preloaded font is used from the first page with text. The Blueprint names no owner for the base text rules; this spec gives the other `body` rules and the form-control rule (`font:inherit`) to TOKI-012, which now needs TOKI-010 (Scope). Until TOKI-012 is built, a button or input draws in the system font. Owner: Thanh Truong.
8. The Blueprint gives no cache rule for static files. Hashed names make a long cache time safe, but the header is set in the Caddyfile (TOKI-084). Until then the fonts are fetched again as often as the server's default allows. Owner: Thanh Truong.
9. The prototype's font link asks for Bricolage Grotesque at weight 600, but no rule found in its CSS draws text in that family at 600; every use found is 700. Decided in this spec: the 600 file is kept, because the link is the prototype's list of fonts, the intent says the fonts and weights come from the prototype and none is invented, and a file that no text uses is never fetched. This differs from italics (concern 3), whose files the prototype never loads. Not decided: whether to drop it (then six faces, and Table A, R1 to R4 and R6 change). Owner: Thanh Truong.
10. The 241 code points of Table B are an author's choice (Design, "Characters"), not derived from the prototype by a tool: the Basic Latin and Vietnamese parts follow the languages decided in D-018 and D-064, the signs come from a count of the prototype's non-ASCII characters. Not confirmed by the lead. Owner: Thanh Truong.
11. Text at weights 600 and 700 is drawn in the fallback font until its file arrives, because only 400 is preloaded (Design, "How the app loads them"). Accepted in this spec. Proposal, not a decision: if the first visit is too slow or the swap is visible on the sign-in screen when the finished app is measured (TOKI-089), preload weight 600 as well and change R8 and R10. Owner: Thanh Truong.
12. The size of this work: the Blueprint ticket is size S, about half a session, with the scope "three fonts subset to Latin and Vietnamese, with the main one preloaded". This spec adds a check script, SHA-256 records, a cutting record, licence files and size limits (R6, R14 to R16). Licence files and the source record follow from concern 1; the SHA-256 and the size limits are guards a plain build check would not need. Proposal, not a decision: keep them; the alternative is to cut R6 and the hash check in R14. Not decided. Owner: Thanh Truong.
