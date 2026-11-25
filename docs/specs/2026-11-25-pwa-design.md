# PWA design

Date: 2026-11-25 · Status: draft for review (concerns 1 and 2 are open for the product owner)
Intent: docs/intents/pwa.md (Thanh Truong)
Ticket: TOKI-077

## Goal
A Member or an Admin must be able to install Toki from a supported browser, to the home screen of a phone or to the desktop, and open it in a window of its own with Toki's name and icon (D-030, F36, AC-046). On an iPhone this install is also what lets Web Push work (D-108). This work gives the web app the manifest, the icons and the page links that make it installable. It adds no service worker and no cache: the service worker is for push only (D-030) and a page is never served stale (NFR-06).

## Scope
- In:
  - `apps/web/public/manifest.webmanifest` and five PNG icons in `apps/web/public/icons/`, with the two SVG masters they are drawn from in `apps/web/assets/icons/`, and the script that draws them (R1 to R7).
  - In `apps/web/index.html`: the manifest link, the favicon (it replaces the empty `data:,` icon TOKI-006 left), the Apple touch icon and the theme colour (R8).
  - The build check `check:pwa`, run at the end of the `build` script of `apps/web` (R10), and its test.
  - One browser test, `e2e/pwa.spec.ts`: Chromium's own installability test, no service worker and no cache (R12, R13).
  - The two new commands in `.claude/rules/web.md` (R14).
- Out (not now):
  - The service worker file, its registration, the push, the card that offers notifications, the iPhone detection and the Preferences text that tells a person to add Toki to the Home Screen (F36 cases): TOKI-074. See "Line with TOKI-074" in Design.
  - An "Install" button or card of Toki's own. F36 and AC-046 name only the browser's install action, so none is built (concern 5).
  - Offline use, a cache of any kind and an update flow for an installed copy (D-030, NFR-06).
  - Cache headers and the content type of the manifest and the icons on the production server: TOKI-084 (Caddyfile), as TOKI-010 did for the fonts (concern 8).
  - A theme colour that follows the account's saved look instead of the device (concern 3).
  - Splash screens for iPhone sizes, shortcuts, screenshots and share targets in the manifest: not in the log, not needed to install.

## Requirements
- R1. `apps/web/public/manifest.webmanifest` is valid JSON and holds exactly these keys: `id`, `name`, `short_name`, `start_url`, `scope`, `display`, `background_color`, `theme_color`, `icons`.
- R2. Their values are: `id` `"/"`, `name` `"Toki"`, `short_name` `"Toki"`, `start_url` `"/"`, `scope` `"/"`, `display` `"standalone"`. No other text is in the manifest, so no translated text is needed (concern 4).
- R3. `background_color` and `theme_color` are both `#F2F4EF`, the value of `--bg` in the light block of `packages/tokens/src/tokens.css`. The check reads that file and compares, so a change of the token fails the check.
- R4. `icons` holds exactly three entries, each with `src`, `sizes`, `type` `"image/png"` and `purpose`: `/icons/icon-192.png`, `192x192`, `any`; `/icons/icon-512.png`, `512x512`, `any`; `/icons/icon-maskable-512.png`, `512x512`, `maskable`.
- R5. `apps/web/public/icons/` holds exactly five PNG files: the three of R4, `apple-touch-icon.png` and `favicon-32.png`. The width and height read from each file are 192, 512, 512, 180 and 32 pixels (square).
- R6. The artwork. `apps/web/assets/icons/icon.svg` draws a square tile of the accent colour `#0F766E` with rounded corners (radius 29% of the side, the proportion of the logo mark of the sign-in card, 10 of 34 pixels) and, centred on it, the `bolt` shape of the icon set (`packages/ui-web/src/icons/paths.ts`) in `#FFFFFF`, 56% of the side high. `apps/web/assets/icons/icon-maskable.svg` draws the same shape on a tile with square corners that fills the whole image. The PNGs are drawn from them: `icon-192.png`, `icon-512.png` and `favicon-32.png` from `icon.svg`; `icon-maskable-512.png` and `apple-touch-icon.png` from `icon-maskable.svg`. The check reads the pixels and proves: in the files from `icon.svg`, the corner pixel is fully transparent and the centre pixel is the accent colour or white; in `icon-maskable-512.png` and `apple-touch-icon.png`, no pixel is transparent, the corner pixel is the accent colour, and every pixel that is not the accent colour (within a difference of 8 on each channel) lies inside the circle of radius 40% of the side around the centre, the safe zone that a maskable icon needs. The artwork itself is a proposal (concern 1).
- R7. `apps/web/scripts/make-icons.mjs`, run by `pnpm --filter ./apps/web icons:build`, draws the five PNGs from the two SVGs with `sharp`, a devDependency of `apps/web` at one exact version (the newest published at least two weeks before the build, as TOKI-064 R1 and TOKI-060 R13 do). Running it twice gives files with the same pixels. It is the only way the PNGs are made; nobody edits one by hand.
- R8. `apps/web/index.html` holds exactly one each of: `<link rel="manifest" href="/manifest.webmanifest">`; `<link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png">` (the `data:,` icon is gone); `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">`; `<meta name="theme-color" content="#F2F4EF" media="(prefers-color-scheme: light)">` and `<meta name="theme-color" content="#0E1214" media="(prefers-color-scheme: dark)">`. `#0E1214` is `--bg` in the dark block of `tokens.css`; the check compares both values with that file.
- R9. After `pnpm --filter ./apps/web build`, `apps/web/dist` holds `manifest.webmanifest` and the five icons at the same paths, with the same bytes as in `public/`, and with unhashed names (the manifest and the icons are addressed by fixed paths). Every `src` in the built manifest and every `href` of the five links of R8 in `dist/index.html` names a file that exists in `dist`. The Vite `base` stays `/`.
- R10. `pnpm --filter ./apps/web check:pwa` checks R1 to R6, R8 and R9 and exits 0 only when all hold. When one fails it exits non-zero and names the file and the requirement; when `dist/index.html` does not exist it names the build command. The `build` script of `apps/web` ends with it. The script imports what it needs from `node:` modules and from `sharp`, and passes `pnpm lint` and `pnpm format:check`.
- R11. No file of this change adds a service worker, registers one, calls `navigator.serviceWorker`, or uses Cache Storage or any other cache. The web app stays installable without one (concern 7).
- R12. In the browser, with the app open and signed out at `/login` (Chromium, the dev server of the test harness): `navigator.serviceWorker.getRegistrations()` gives an empty list while TOKI-074 is not built, and `caches.keys()` gives an empty list at all times (after TOKI-074 too, because its worker is for push only). With the network cut off by the test, a reload does not show the page: the navigation fails. No stale page is served.
- R13. In the same setting, the Chrome DevTools Protocol call `Page.getInstallabilityErrors` returns an empty list: Chromium finds the page installable with the manifest, the icons and no service worker. When the Chromium of the test harness lists an error, the builder reports it and the spec is reopened (concern 7); no service worker is added to make it pass.
- R14. The two commands, `check:pwa` and `icons:build`, are added to `.claude/rules/web.md`, the rule file of the area (`.claude/rules/ticket.md`, "Process"). No root script is added.
- R15. The change touches only `apps/web` (`public/`, `assets/icons/`, `scripts/`, `index.html`, `package.json`), `e2e/pwa.spec.ts`, `.claude/rules/web.md`, the lock file and the list of root tests that runs the node test of the check (R10). It adds no file under `packages/`, no text to `packages/i18n` and no request to the server.

## Design
### What "install" means
- Decided by the log: Toki is an installable PWA and its service worker is for push only (D-030); it installs from a supported browser with the browser's own action and opens in its own window (AC-046, TS-071); on a phone, after Add to Home Screen, it opens like an app of its own (F36). Offline use is not part of it: with the network off no stale page is served (NFR-06).
- Not decided by the log, so decided here (each is a technical choice the Blueprint leaves to the builder): the manifest values of R2 to R4. `display: "standalone"` is the mode that gives a window without the address bar, and Apple's rule for Web Push on an iPhone needs a Home Screen web app whose manifest says `standalone` or `fullscreen`, so it is also what D-108 depends on. `start_url` and `scope` are `/` because every route of the app is under `/` (`/login`, `/c/…`, `/admin`, `/prefs`) and `/` sends a signed-out person to sign-in and a signed-in person to Home. `id` is `/` so the identity of the app does not change if `start_url` changes later. No `orientation` is set (a person may rotate a phone or a tablet), no `lang` or `dir` (the app picks the language itself, D-018).
- The browser needs no service worker to install Toki on the supported browsers; Chromium's own test says so (R13). If that proves wrong in a supported browser, the finding is reported and goes back to the product owner, because a worker with a fetch handler would touch D-030 (concern 7).

### Names and colours
- The home-screen name is `Toki`, the product name that `index.html` already uses as its title. The manifest is a static file and Toki is single-tenant with the workspace name in the database, so the workspace name is not used (concern 4).
- Colours come from tokens, not from new values: the page background `--bg` of the light look, `#F2F4EF`, for the manifest's `theme_color` (the browser bar and the window title bar) and `background_color` (the launch screen); and `#0E1214`, the dark `--bg`, for dark devices through the `media` of the two `theme-color` tags. The bar follows the device's setting, not the account's saved look (concern 3).

### Icons
- Sizes: 192 and 512 are the two sizes a Chromium browser wants for installing and for the app list; the maskable 512 lets Android crop the icon to its own shape; 180 is the size an iPhone uses for the Home Screen (it ignores the manifest icons for that and reads `apple-touch-icon`, and it rounds the corners itself, so that file has none); 32 is the tab icon.
- Artwork: the log decides no logo. The only logo of Toki that exists is the mark of the sign-in card (TOKI-023): the accent tile with a rounded corner, which shows the `bolt` icon while the workspace name is not known. The proposal is to use that mark as the app icon (R6). Whether the product owner wants it is concern 1.
- The maskable icon keeps the bolt inside a circle of 40% radius, the safe zone, so no shape of the phone cuts it.

### Line with TOKI-074
TOKI-074 (Web Push) is written at the same time and its spec was not yet available when this one was written; the lines below are drawn from this side and are to be checked against it (concern 6).

| Piece | Owner |
| :---- | :---- |
| `manifest.webmanifest`, the five icons, the favicon, the manifest link, the Apple touch icon, the theme colour tags, `display: "standalone"` | TOKI-077 (this) |
| The service worker file and its registration (through `platform`, since `ui-web` may not use the service worker API directly, TOKI-002) | TOKI-074 |
| Whether the app runs installed (iPhone detection, the standalone display mode), the rule that push on iPhone is offered only after Add to Home Screen (D-108), the Preferences text that explains it, the card that offers notifications | TOKI-074 |
| What a click on a notification opens | TOKI-074 |
| A fetch handler, a cache or an offline page in the worker | nobody (D-030, NFR-06) |

The two do not collide in files: this work adds `manifest.webmanifest` and `icons/` to `apps/web/public/`; the worker file, wherever TOKI-074 puts it, is another file. The check of R10 looks at neither the worker nor its link. The scope of the worker is its own file's folder; the manifest `scope` of `/` covers the whole app.

### Installed on an iPhone
Safari's Add to Home Screen takes the name from the manifest, the icon from `apple-touch-icon.png` and opens the app without the address bar (R2, R5, R8). The Home Screen copy of a web app on an iPhone keeps its own storage, apart from Safari's, so a person who signed in in Safari will probably have to sign in again in it. The sign-in mail carries a code only and no link (D-157), so the code typed in the installed app works. This is not in the log and is concern 2; the technical design asks for a real iPhone to be tried before the notification work starts (techDeps, FR-18).

### Serving
Vite copies `public/` to the root of `dist` and serves it from the root in development, so the paths of R4 and R8 are the same in both. The files are public and are fetched with no session. TOKI-084's Caddy serves `dist`; the manifest wants the type `application/manifest+json`, and the icons keep their names, so they get a short cache time and not the long one of hashed files (concern 8).

### Layout
```
apps/web/
├─ public/
│  ├─ manifest.webmanifest
│  └─ icons/  icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png favicon-32.png
├─ assets/icons/  icon.svg icon-maskable.svg
├─ scripts/  make-icons.mjs  check-pwa.mjs  check-pwa.test.mjs
├─ index.html          (links, R8)
└─ package.json        (icons:build, check:pwa, build, sharp)
e2e/pwa.spec.ts
```

## Testing
- R1 to R6, R8, R9: `check-pwa.test.mjs` (run with `node --test` and added to the root test list like `check-no-dev-pages.test.mjs`) calls the pure `findProblems` of the script on small fixtures: a good manifest and folder gives no problem; one fixture for each failure gives a problem that names the requirement: an extra key, `name` changed, `display` `"browser"`, `theme_color` unlike the token, a missing icon entry, a purpose changed, a 193-pixel file, a transparent corner in a maskable file, a glyph pixel outside the circle (a white square at the edge), a second manifest link, a link to a missing file, a `data:,` icon. The pixel fixtures are drawn in the test with `sharp`. Then `pnpm --filter ./apps/web build` runs the script on the real files (R9, R10).
- R7: the test runs `make-icons.mjs` into a temporary folder twice and compares the pixels of the two runs, and compares their sizes with R5.
- R12 and R13: `e2e/pwa.spec.ts` on the dev server of `playwright.config.ts`, Chromium. It opens `/login`, reads `getRegistrations()` and `caches.keys()`, sets the context offline, reloads and expects the navigation to fail, then opens a CDP session and expects `Page.getInstallabilityErrors` to return no error. The test uses no timer.
- R11, R15: by reading the list of changed files of the pull request.
- By hand, in the pull request, before review: (a) Chrome on a desktop: the install action is offered, the installed app opens in its own window with the bar in the colour of R3 (AC-046, TS-071); (b) Android Chrome: Add to Home Screen shows the maskable icon without a cut; (c) a real iPhone: Add to Home Screen shows the name `Toki` and the Apple icon, the app opens without the address bar, and whether the person is signed in is written down (concern 2). The builds are served over a secure address or `localhost`, as browsers require.
- No test needs real data; the files hold no personal data.

## Data safety
- The manifest and the icons are public static files with no personal data and no workspace name. They are fetched without a session and cannot reveal who uses Toki.
- No cache stores any page or answer (R11, R12), so no signed-in content stays on a device after sign-out.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Installable PWA; the service worker is used for push only (D-030, NFR-06) | Manifest, icons and links (R1 to R9) and no service worker or cache code (R11); the line with TOKI-074 |
| With the network off, no stale page is served from a cache (NFR-06) | R11, R12 |
| Installed from a supported browser with the browser's install action, in its own window (AC-046, TS-071) | `display: "standalone"` (R2); Chromium finds it installable (R13); by hand on Chrome (Testing); no button of Toki's own (Scope, concern 5) |
| On a phone, after Add to Home Screen, Toki opens like an app of its own (F36) | `standalone`, the Apple touch icon, the name (R2, R5, R8); by hand on an iPhone and Android (Testing) |
| On iPhone, push works only when Toki is installed to the home screen (D-108, F36) | This work makes the install possible (R2, R5, R8); the rule, the detection and the text belong to TOKI-074 (Line with TOKI-074) |
| Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox (D-108) | Only the standard manifest and link tags are used (R1, R8); Chromium is tested (R12, R13), Safari on an iPhone by hand; Firefox on desktop does not install a web app, which is the browser's own limit and not in the log (not a requirement here) |
| English is the default language and every text goes through i18n (D-018, D-064) | The only text is the product name `Toki`, not translated (R2, concern 4); no text in `ui-web` and no key (R15) |
| Milestone M5; size S; TOKI-074 is written at the same time | Three kinds of file, one script and one check (Scope); the line with TOKI-074 (Design, concern 6); the size is concern 9 |

## Open questions from the intent
- What does "install" mean in phase 1? Answered: the manifest, the icons and the page links that make the browser's install action available; no offline use, no cache, no service worker in this work (D-030, NFR-06, AC-046). Decided in this spec (Design, "What install means").
- Which name, colours, display mode, start page and icon sizes does the manifest carry? Answered: R2 to R5, from tokens and the product name. Decided in this spec (concerns 3, 4 and 9).
- What does the app icon look like? Not answered. Carried forward as concern 1.
- Does Toki show its own Install button or card? Answered: no; F36 and AC-046 name only the browser's install action. Carried forward as concern 5 for confirmation.
- On an iPhone, is the person signed in when the installed app first opens? Not answered. Carried forward as concern 2.
- Who owns the service worker, the manifest link and the iPhone rule? Answered: Design, "Line with TOKI-074". Carried forward as concern 6 for the check against that spec.

## Areas of concern
1. The app icon artwork. The log decides no logo and the prototype has no app icon (its browser tab has none; the only mark is the accent tile with a letter in the sidebar header and on the sign-in card). Proposal, not a decision: use the sign-in card's mark, the `bolt` on the accent tile (R6). The product owner approves it or supplies the artwork; the builder then replaces the two SVGs and runs `icons:build`, and no requirement other than R6 changes. Owner: Thanh Truong (product owner).
2. Signing in again on an iPhone. AC-046 and TS-071 expect that the installed app opens "signed in". On an iPhone the Home Screen copy of a web app probably has its own storage, so the session of Safari does not carry over and the person signs in once more with a code (D-157), which is the same mail and the same steps as at sign-in. The log does not say whether that is acceptable. Proposal, not a decision: accept one more sign-in on an iPhone, and say so in the Preferences text of TOKI-074; "signed in" in TS-071 then holds for Chrome and Edge, which share storage with the installed app. To be checked on a real iPhone (Testing). Owner: Thanh Truong (product owner).
3. The browser bar colour follows the device's light or dark setting, not the account's saved look (D-175: the look is saved to the account, and only `Match my device` follows the device; TOKI-078 applies it). Decided in this spec: the manifest has one colour and the two `theme-color` tags answer the device's setting, so a person who chose a look that differs from their device sees the bar in the device's colour. Reason: it needs no script and no change of `ui-web`; TOKI-078, which applies the saved look, may update the tag later. Owner: Thanh Truong.
4. The name is `Toki`, not the workspace name and not translated. Decided in this spec. Reason: a manifest is one static file; Toki is single-tenant and the workspace name comes from the database; `Toki` is the name `index.html` and the product already use. A translated name would need a manifest made by the server. Owner: Thanh Truong.
5. No Install button or card. Decided in this spec from AC-046 and TS-071 ("use the browser's install action") and F36, which names only Add to Home Screen. The card of F36 offers notifications, not installation. Owner: Thanh Truong.
6. The line with TOKI-074. Decided in this spec from this side (Design, "Line with TOKI-074"): TOKI-077 owns the manifest, icons and links; TOKI-074 owns the worker file, its registration, iPhone detection, the D-108 rule and its text. The spec of TOKI-074 was not available when this was written; its authors check the table and report a difference. Owner: Thanh Truong.
7. Installing without a service worker. Decided in this spec: no worker is added here, because D-030 limits the worker to push and NFR-06 forbids a stale page. Current Chromium and Safari install a page with a manifest and no worker, and R13 tests it with the browser's own error list; the Blueprint does not say. If a supported browser needs a fetch handler to install, the finding goes to the product owner before anything is added. Owner: Thanh Truong.
8. Headers on the production server. Decided in this spec: the content type `application/manifest+json` for the manifest and a short cache time for the manifest and the icons (their names do not change with their content) belong to TOKI-084; the Blueprint gives no rule, and a missing header does not stop the install in the supported browsers. Owner: Thanh Truong.
9. Size S. Decided in this spec: the work is one manifest, five small images, four tags, one generation script and one check, a little more than the plan's one line "Manifest, icons, install to the home screen" because of the check and the browser test; it is kept at S by leaving out the Install button, the worker, splash screens and the header work. Owner: Thanh Truong.
