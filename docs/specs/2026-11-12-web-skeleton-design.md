# Web app skeleton design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/web-skeleton.md (Thanh Truong)
Ticket: TOKI-006

## Goal
The builder needs a running web app in `apps/web` that later screens are added to. It must have one place for pages and navigation, one place for loading data from the server, and a development connection to the server. Without it, the test harness (TOKI-008) and every later web screen have nothing to build on.

## Scope
- In: the Vite + React app in `apps/web`; TanStack Router with routes defined in code (no router plugin, no generated route file), a root route, one index page that shows only the product name and a not-found view; one TanStack Query client and its provider; the dev proxy for `/api/v1` and `/healthz`, aimed at the local server port; the `dev` and `build` scripts of `apps/web` and the project's `tsconfig.json` with the options the web app needs (DOM types, `jsx`); the `typecheck` script from TOKI-001 is kept, and the TOKI-001 placeholder `src/index.ts` is removed.
- Out (not now):
  - Monorepo, package folders, shared TypeScript config and the root `pnpm dev` script: TOKI-001. This ticket does not edit the root script.
  - ESLint, Prettier and the boundary lint rules: TOKI-002.
  - The server, `/healthz`, the error format and the `/api/v1` prefix on the server side: TOKI-004.
  - CI and the enforced bundle size limit: TOKI-007.
  - Vitest, Playwright, the sample test and the automated tests of the dev proxy and the index page: TOKI-008 (plan change of 2026-11-16, concern 8).
  - The list of environment variables, their names and `.env.example`: TOKI-096. This ticket adds no variable of its own; it reads the server port variable that TOKI-096 names (concern 1).
  - Tokens, fonts, icons, base components, overlays, AppShell, preview page: TOKI-009 to TOKI-016.
  - Translations (TOKI-017), the `platform` package (TOKI-018), shared date and time rules (TOKI-094).
  - The API client, WebSocket sync and stores in `client-core`. No ticket in this batch owns them; this spec adds no code there.
  - Any real screen, sign-in, styling, production serving (Caddy) and the WebSocket proxy for `/ws`, which is added with the gateway in TOKI-038 (concern 2).
- Plan change: TOKI-006 now also needs TOKI-096, for the name of the server port variable (decision of 2026-11-12, narrowed on 2026-11-16); the Blueprint plan must be updated.
- Plan change (2026-11-16): the automated tests of the proxy and the index page move to TOKI-008; TOKI-006 is checked by hand and takes a PR exception (concern 8). The Blueprint plan must be updated.

## Requirements
- R1. `pnpm --filter ./apps/web dev` starts the Vite dev server on port 5173 and prints `http://localhost:5173/`. The port is fixed (`strictPort`): when 5173 is already in use the command exits non-zero with an error and does not move to another port.
- R2. Opening that URL at `/` returns HTTP 200 and the page shows the text "Toki" in the element with `data-testid="app-root"`. No script error from the app appears in the browser console (`index.html` carries an empty icon link, so no favicon request is made; real icons come with TOKI-011).
- R3. Routes are defined in code (not file-based), under `apps/web/src/routes/`; `vite.config.ts` has no TanStack Router plugin and no generated route file exists; the router is created in one file, `apps/web/src/router.tsx`, and no other file creates a router.
- R4. Opening an unknown path (for example `/no-such-page`) shows the not-found view with the text "Page not found", not a blank page or an uncaught error.
- R5. One Query client is created in `apps/web/src/query-client.ts` and provided to the whole app; a search for `new QueryClient(` in `apps/web/src` finds exactly one match.
- R6. In development, a request to `<web dev URL>/api/v1/<path>` is forwarded to `http://127.0.0.1:<server port>` with the path unchanged; with a server listening on that port, `curl <web dev URL>/api/v1/<path>` shows that server's response.
- R7. The proxy target is derived from the server port variable that TOKI-096 names (default server port 3000), so by default `/api` goes to `http://127.0.0.1:3000`. There is no separate proxy target variable. `vite.config.ts` reads the port from the `.env` file at the repository root, the same file the server uses, with Vite's `loadEnv(mode, <repository root>, "")`; the empty prefix is needed because the variable has no `VITE_` prefix, and the value is used only in the dev server config and never reaches browser code. Check: set the server port variable in the root `.env`, with no such variable in the shell, restart the dev server, and the same `curl` goes to the new port.
- R8. When no server listens on the server port, the same `curl` returns a 5xx status and the dev server keeps running.
- R9. `pnpm --filter ./apps/web build` exits 0 and writes `apps/web/dist/index.html`.
- R10. The first-load JavaScript of `apps/web/dist/index.html` is measured on the build output as every script and modulepreload link in that file plus their static imports; dynamic imports are excluded. Each file is compressed with gzip and the sizes are added. The total must be under 200,000 bytes (1 KB = 1000 bytes); a total at or above 200,000 bytes fails. This is the same rule as TOKI-007 R7.
- R11. `pnpm --filter ./apps/web typecheck` exits 0.
- R12. This change adds no file under `packages/client-core` or `packages/ui-web`. A search of `apps/web/src` for each of `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio`, `AudioContext` (the globals TOKI-002 bans in `ui-web`) finds no match. Nothing enforces this after the ticket: TOKI-002 applies its rule to `packages/ui-web` only and leaves `apps/web` to review (TOKI-002 concern 5).
- R13. In development, a request to `<web dev URL>/healthz` is forwarded to `http://127.0.0.1:<server port>/healthz` with the path unchanged, by the same proxy and the same target as R6; with a server listening on that port, `curl <web dev URL>/healthz` shows that server's response. When no server listens, it returns a 5xx status and the dev server keeps running (R8).

## Design
### Screens
1. Index page (`/`): the product name "Toki" as plain text in one element marked `data-testid="app-root"`, and nothing else. No styling beyond the browser default. Assumption: the Blueprint says "an empty page"; the one word is added so that a rendered page can be told from a blank or broken one, and so the sample Playwright test of TOKI-008 has a text to check.
2. Not-found view (any unknown path): the text "Page not found". Plain text; the designed version comes with the base components.

The root layout renders the current page only. `index.html` links an empty icon (`<link rel="icon" href="data:,">`) so the browser makes no `/favicon.ico` request; real icons come with TOKI-011. AppShell replaces it in TOKI-015.

### Errors
- Unknown path -> the not-found view (R4).
- Server not running in development -> the proxy answers 5xx; the dev server does not stop (R8).
- An error thrown while a page renders -> the router's default error view. No custom error screen in this ticket.

### Layout
```
apps/web/
├─ index.html           one root element, an empty icon link, loads src/main.tsx
├─ vite.config.ts       React plugin, port 5173 with strictPort, dev proxy for /api/v1 to the local server port; loads the repository-root .env
├─ tsconfig.json        extends the base config; adds only jsx, lib (DOM) and types; includes src and vite.config.ts
├─ package.json         scripts: dev, build, typecheck (typecheck from TOKI-001)
└─ src/
   ├─ main.tsx          mounts the app: Query provider, then router
   ├─ router.tsx        creates the router from the routes defined in code
   ├─ query-client.ts   creates the one Query client
   └─ routes/
      ├─ __root.tsx     root layout and not-found view
      └─ index.tsx      the index page: the text "Toki"
(src/index.ts from TOKI-001 is deleted.)
```
- Routes are defined in code with TanStack Router's code-based API, so there is no router plugin and no generated route file. `router.tsx` imports the route objects from `src/routes/` directly, so a plain `tsc --noEmit` on a clean clone resolves everything. Decided by Thanh (concern 3). TOKI-002 needs no ignore-list entry for a generated route file.
- `tsconfig.json` extends `tsconfig.base.json` and sets only `jsx` (`react-jsx`), `lib` (`ES2022`, `DOM`, `DOM.Iterable`) and `types` (`vite/client`, `node`, the latter for `vite.config.ts`, with `@types/node` as a dev dependency). It sets none of `strict`, `target`, `module` and `moduleResolution`, which TOKI-001 R5 reserves for the base config. TOKI-001 says options that differ by project are added by the ticket that first needs them.
- The dev server uses port 5173, Vite's default, with `strictPort`. TOKI-008 starts `apps/web` and waits on a URL; a fixed port means a stale or second process fails the start loudly instead of the tests running against the wrong server. The port is a constant in `vite.config.ts`, not an environment variable. Confirmed by Thanh on 2026-11-16: the web dev port stays fixed at 5173 with `strictPort`.
- `@toki/shared` and the other workspace packages are consumed from source through their `exports` entry (TOKI-001 concern 2), so Vite resolves and bundles them with no package build step (concern 8).
- The proxy target is derived from the server port variable, whose name comes from the TOKI-096 inventory (done first); this spec invents no name and adds no proxy variable. The default server port is 3000, so the proxy goes to `http://127.0.0.1:3000` (concern 1). The "Web dev server: proxy target" category is not needed in TOKI-096 (that spec is on another branch and is not edited here).
- `/healthz` sits outside the `/api/v1` prefix, so the proxy has two entries, `/api/v1` and `/healthz`, with one target (concern 2). The `/ws` entry is not added here; TOKI-038 adds it with the gateway.
- The Query client lives in `apps/web/src/query-client.ts` and stays there. `client-core` holds only DOM-free code and exposes plain functions and stores; moving the Query client later is a decision for the ticket that adds code to `client-core` (concern 6).
- React, Vite and the TanStack libraries are the current stable release of each at build time; `pnpm-lock.yaml` pins them and `package.json` records the resolved version with a caret (concern 7).
- The Query client uses the library defaults. Retry, cache time and error rules are set by the first ticket that loads real data.
- A later screen is added by adding one route under `src/routes/` and uses the Query client from the provider.

## Testing
- TOKI-008 owns the test harness, so this ticket adds no test framework and no automated test. The automated tests of the proxy (R6 to R8 and R13) and of the index page (R2) move to TOKI-008 (Playwright e2e); TOKI-008 owns them. Decided by Thanh on 2026-11-16 (concern 8).
- TOKI-006 is checked by hand: each requirement by the command or search it names, plus the browser check for R2 and R4. The PR for this ticket records an exception to the definition of done "A test covers the change", pointing at TOKI-008.
- R1 (port) is checked by starting a second process on 5173 and seeing the command fail. R6, R7, R8 and R13 are checked by hand with a small local stub server on the server port that answers one fixed response under `/api/v1`. This works before TOKI-004 exists. Fake data only; the stub is not committed.
- R10 is checked by hand: gzip each script and modulepreload file of `dist/index.html` and its static imports, add the sizes and compare with 200,000 bytes.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Scope given by the Blueprint: router, Query, an empty page, dev proxy to the server | R2 to R8; Scope "In" lists only these four |
| Agreed web stack: React, Vite, TanStack Router and Query | R1, R3, R5; Layout. No other framework or data library is added |
| The web app lives in `apps/web` in the one monorepo (phase 1) | Layout; every file of this change is under `apps/web` |
| Boundary rules apply: `client-core` touches no DOM or browser API, and components reach platform features only through `platform` | R12: this change adds nothing to `client-core` or `ui-web` and uses none of the banned globals in `apps/web`, checked by search. TOKI-002 enforces the rule in `ui-web` only (its concern 5) |
| Phase 1 acceptance criterion: initial JavaScript under 200 KB compressed | R10: under 200,000 bytes with gzip on the first-load set (concern 4, decided). The enforced limit in CI is TOKI-007 R7 and uses the same rule |
| The server API is versioned under `/api/v1` | R6: the proxy forwards `/api/v1` with the path unchanged |
| Milestone: M1 Foundation and design system; exit check `pnpm dev` runs, CI is green, preview page matches the prototype | R1 gives the web part of `pnpm dev`. The root `pnpm dev` script is created by TOKI-001 and runs the `apps/web` `dev` script (concern 5, decided). CI is TOKI-007; the preview page is TOKI-016 |
| Size: S (about half a working session with Claude) | Planning fact; no design impact. Scope is kept to four parts and two plain views |
| Needs: TOKI-001 (pnpm monorepo and TypeScript) | Planning fact. The design uses the `apps/web` folder and shared TypeScript config from TOKI-001. Plan change: it now also needs TOKI-096 for the server port variable name (decision of 2026-11-12, narrowed on 2026-11-16). It needs no server ticket (stub server in Testing) |
| Needed by: TOKI-008 (test harness), TOKI-010 (self-hosted fonts) and TOKI-011 (icon set) | R1, R2 and R9 give them a running app, a page to load and a build. No design impact beyond that |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; no design impact. Scope "Out" names the sibling tickets |

## Open questions from the intent
- The intent says "None." No question to answer.
- The Clarify step found gaps that the intent does not answer. Concerns 1 to 9 are answered. Concern 9 is answered from TOKI-001. No concern is open.

## Areas of concern
1. The Blueprint states no server port for development and no name for the proxy target. Decided: the proxy target is derived from the server port variable, whose name comes from the TOKI-096 inventory; the default server port is 3000, so the web dev server proxies `/api` to `http://127.0.0.1:<server port>`. No new proxy variable is added, and the "Web dev server: proxy target" category is not needed in TOKI-096 (noted here; the other branch is not edited). A separate variable could drift from the server port and leave the web app proxying to a dead port (R8 shows as 5xx); deriving the target removes that. Decided by Thanh (lead, as product owner) on 2026-11-16. Earlier: the name rule was decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: none, answered.
2. Phase 1 uses WebSocket, but the Blueprint states no WebSocket path. This spec proxies only `/api/v1` over HTTP. It is not decided whether the WebSocket proxy belongs here or to the first realtime ticket, nor whether `/healthz` (outside `/api/v1`) must be reachable through the proxy. Answered: the architecture figure shows Caddy routing "/api and /ws", so the WebSocket path is `/ws`, and the WebSocket gateway itself is TOKI-038 (M3). Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Technical design tab, High-level architecture figure; Plan tab, ticket TOKI-038. Decided: the `/ws` dev proxy is added in TOKI-038, with the gateway it points to, not in this ticket; and `/healthz` is reachable through the proxy (R13). Decided by Thanh (lead, as product owner) on 2026-11-17. Owner: none, answered.
3. The Blueprint names TanStack Router but not file-based or code-based routes. Decided: routes are defined in code. The router plugin and the committed generated `routeTree.gen.ts` are dropped from Scope and Layout, and TOKI-002 needs no ignore-list entry for it. Decided by Thanh (lead, as product owner) on 2026-11-16. Owner: none, answered.
4. "Under 200 KB compressed" does not say gzip or Brotli, nor whether lazy-loaded chunks count. Decided: gzip, on the first-load set, which is every script and modulepreload link in `dist/index.html` plus their static imports; dynamic imports are excluded; the limit is 200,000 bytes (1 KB = 1000 bytes) and a total at or above it fails. Same rule as TOKI-007 R7 (R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-12; wording aligned with TOKI-007 R7 and confirmed by Thanh on 2026-11-16. Owner: none, answered.
5. The M1 exit check says `pnpm dev` runs. The Blueprint does not say which ticket adds the root `pnpm dev` script or whether it starts the web app, the server or both. Decided: TOKI-001 creates the root `dev` script, which runs the `dev` script of every workspace project that has one. TOKI-006 adds only the `apps/web` `dev` script and does not edit the root script; root `pnpm dev` picks it up. Once TOKI-004 and TOKI-006 are both done it starts the server and the web app. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
6. The Blueprint places "API client, cache, stores" in `client-core`, and this ticket places the Query client in `apps/web`. It is not stated where the Query client should live once `client-core` has code, since `client-core` must stay free of DOM use for React Native. Decided: the Query client stays in `apps/web/src/query-client.ts` (R5); `client-core` holds only DOM-free code. Moving it is left to the ticket that adds code to `client-core`. Decided by Thanh (lead, as product owner) on 2026-11-17. Owner: none, answered.
7. The Blueprint gives no versions for React, Vite or the TanStack libraries (only Node 22). Decided: the current stable release of each at build time, pinned in the lockfile, with the resolved version and a caret in `package.json`. Decided by Thanh (lead, as product owner) on 2026-11-17. Owner: none, answered.
8. Review of 2026-11-16: `docs/definition-of-done.md` says "A test covers the change", but this ticket adds no automated test. Decided: the proxy and index-page tests move to TOKI-008 (Playwright e2e), which owns the automated test. TOKI-006 itself gets a hand check (Testing) and a PR exception for "A test covers the change". Decided by Thanh (lead, as product owner) on 2026-11-16. Owner: none, answered.
9. TOKI-001 concern 2 (module format; packages built or consumed from source) says TOKI-006 needs the answer before it adds a build. Answered: every project is an ES module and packages are consumed from source through `exports` (`./src/index.ts`), with no package build step; the web build is left to TOKI-006. This spec builds `apps/web` with Vite and bundles `@toki/shared` from source. Evidence: TOKI-001 spec (branch `spec/monorepo-typescript-setup`), Areas of concern 2 and R4, R5, R10. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Owner: Thanh Truong.
