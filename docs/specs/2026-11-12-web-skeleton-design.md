# Web app skeleton design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/web-skeleton.md (Thanh Truong)
Ticket: TOKI-006

## Goal
The builder needs a running web app in `apps/web` that later screens are added to. It must have one place for pages and navigation, one place for loading data from the server, and a development connection to the server. Without it, the test harness (TOKI-008) and every later web screen have nothing to build on.

## Scope
- In: the Vite + React app in `apps/web`; TanStack Router with a root route, one index page that shows only the product name and a not-found view; one TanStack Query client and its provider; the dev proxy for `/api/v1`; the `dev` and `build` scripts of `apps/web` and the project's `tsconfig.json` with the options the web app needs (DOM types, `jsx`); the `typecheck` script from TOKI-001 is kept, and the TOKI-001 placeholder `src/index.ts` is removed.
- Out (not now):
  - Monorepo, package folders, shared TypeScript config and the root `pnpm dev` script: TOKI-001. This ticket does not edit the root script.
  - ESLint, Prettier and the boundary lint rules: TOKI-002.
  - The server, `/healthz`, the error format and the `/api/v1` prefix on the server side: TOKI-004.
  - CI and the enforced bundle size limit: TOKI-007.
  - Vitest, Playwright and the sample test: TOKI-008.
  - The list of environment variables, their names and `.env.example`: TOKI-096. This ticket uses the name in that inventory and invents none.
  - Tokens, fonts, icons, base components, overlays, AppShell, preview page: TOKI-009 to TOKI-016.
  - Translations (TOKI-017), the `platform` package (TOKI-018), shared date and time rules (TOKI-094).
  - The API client, WebSocket sync and stores in `client-core`. No ticket in this batch owns them; this spec adds no code there.
  - Any real screen, sign-in, styling, production serving (Caddy) and the WebSocket proxy (see concern 2).
- Plan change: TOKI-006 now also needs TOKI-096 (decision of 2026-11-12); the Blueprint plan must be updated.

## Requirements
- R1. `pnpm --filter ./apps/web dev` starts the Vite dev server on port 5173 and prints `http://localhost:5173/`. The port is fixed (`strictPort`): when 5173 is already in use the command exits non-zero with an error and does not move to another port.
- R2. Opening that URL at `/` returns HTTP 200 and the page shows the text "Toki" in the element with `data-testid="app-root"`. No script error from the app appears in the browser console (`index.html` carries an empty icon link, so no favicon request is made; real icons come with TOKI-011).
- R3. All routes are declared under `apps/web/src/routes/`; the router is created in one file, `apps/web/src/router.tsx`, and no other file creates a router.
- R4. Opening an unknown path (for example `/no-such-page`) shows the not-found view with the text "Page not found", not a blank page or an uncaught error.
- R5. One Query client is created in `apps/web/src/query-client.ts` and provided to the whole app; a search for `new QueryClient(` in `apps/web/src` finds exactly one match.
- R6. In development, a request to `<web dev URL>/api/v1/<path>` is forwarded to the server with the path unchanged; with a server listening on the proxy target, `curl <web dev URL>/api/v1/<path>` shows that server's response.
- R7. The proxy target is read from one environment variable, whose name is the one given in the TOKI-096 inventory, with a default for local development. `vite.config.ts` reads it from the `.env` file at the repository root, the same file the server uses, with Vite's `loadEnv(mode, <repository root>, "")`; the empty prefix is needed because the variable has no `VITE_` prefix, and the value is used only in the dev server config and never reaches browser code. Check: set the variable in the root `.env`, with no such variable in the shell, restart the dev server, and the same `curl` goes to the new target.
- R8. When no server listens on the proxy target, the same `curl` returns a 5xx status and the dev server keeps running.
- R9. `pnpm --filter ./apps/web build` exits 0 and writes `apps/web/dist/index.html`.
- R10. The JavaScript loaded by `apps/web/dist/index.html` on first page load (the entry chunks; lazy-loaded chunks do not count) is under 200 KB measured with gzip, on the build output.
- R11. `pnpm --filter ./apps/web typecheck` exits 0.
- R12. This change adds no file under `packages/client-core` or `packages/ui-web`. A search of `apps/web/src` for each of `Notification`, `localStorage`, `sessionStorage`, `indexedDB`, `navigator.serviceWorker`, `Audio`, `AudioContext` (the globals TOKI-002 bans in `ui-web`) finds no match. Nothing enforces this after the ticket: TOKI-002 applies its rule to `packages/ui-web` only and leaves `apps/web` to review (TOKI-002 concern 5).

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
├─ vite.config.ts       React plugin, TanStack Router plugin, port 5173 with strictPort, dev proxy for /api/v1; loads the repository-root .env
├─ tsconfig.json        extends the base config; adds only jsx, lib (DOM) and types; includes src and vite.config.ts
├─ package.json         scripts: dev, build, typecheck (typecheck from TOKI-001)
└─ src/
   ├─ main.tsx          mounts the app: Query provider, then router
   ├─ router.tsx        creates the router from the routes
   ├─ routeTree.gen.ts  generated by the TanStack Router plugin; committed
   ├─ query-client.ts   creates the one Query client
   └─ routes/
      ├─ __root.tsx     root layout and not-found view
      └─ index.tsx      the index page: the text "Toki"
(src/index.ts from TOKI-001 is deleted.)
```
- Assumption: file names follow TanStack Router's file-based convention, which needs the router plugin in `vite.config.ts` and the generated `src/routeTree.gen.ts`. The choice between file-based and code-based routes stays open (concern 3); with code-based routes the plugin and the generated file are dropped and nothing else here changes.
- `routeTree.gen.ts` is committed. Reason: TOKI-001 gives each project a plain `tsc --noEmit` `typecheck` script and the type check of TOKI-007 runs it without a Vite run first, so on a clean clone `router.tsx` can import the route tree only if the file is in the repository. TOKI-002 ignores "generated files" in both ESLint (R1) and Prettier (R2); its list must include this file name, so lint and `format:check` stay green. The plugin rewrites the file whenever `dev` or `build` runs; the committed copy must match the routes (check: after `dev` or `build`, `git status --porcelain` prints nothing).
- `tsconfig.json` extends `tsconfig.base.json` and sets only `jsx` (`react-jsx`), `lib` (`ES2022`, `DOM`, `DOM.Iterable`) and `types` (`vite/client`, `node`, the latter for `vite.config.ts`, with `@types/node` as a dev dependency). It sets none of `strict`, `target`, `module` and `moduleResolution`, which TOKI-001 R5 reserves for the base config. TOKI-001 says options that differ by project are added by the ticket that first needs them.
- The dev server uses port 5173, Vite's default, with `strictPort`. TOKI-008 starts `apps/web` and waits on a URL; a fixed port means a stale or second process fails the start loudly instead of the tests running against the wrong server. The port is a constant in `vite.config.ts`, not an environment variable.
- `@toki/shared` and the other workspace packages are consumed from source through their `exports` entry (TOKI-001 concern 2), so Vite resolves and bundles them with no package build step (concern 8).
- The proxy target variable uses exactly the name given in the TOKI-096 inventory, which is done first; this spec invents no name (concern 1). Assumption: its default points at the local server; the server port is still open (concern 1).
- The Query client uses the library defaults. Retry, cache time and error rules are set by the first ticket that loads real data.
- A later screen is added by adding one route under `src/routes/` and uses the Query client from the provider.

## Testing
- TOKI-008 owns the test harness, so this ticket adds no test framework. Each requirement is checked by the command or search it names.
- R1 (port) is checked by starting a second process on 5173 and seeing the command fail. R6, R7 and R8 are checked with a small local stub server that answers one fixed response under `/api/v1`. This works before TOKI-004 exists. Fake data only.
- R10 is checked by compressing with gzip the JavaScript files that `dist/index.html` loads on first page load (the entry chunks, not lazy-loaded chunks) and adding their sizes.
- R2 and R4 are checked by hand in the browser now. The Playwright sample test in TOKI-008 takes over R2: it asserts the text "Toki" in `data-testid="app-root"`.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Scope given by the Blueprint: router, Query, an empty page, dev proxy to the server | R2 to R8; Scope "In" lists only these four |
| Agreed web stack: React, Vite, TanStack Router and Query | R1, R3, R5; Layout. No other framework or data library is added |
| The web app lives in `apps/web` in the one monorepo (phase 1) | Layout; every file of this change is under `apps/web` |
| Boundary rules apply: `client-core` touches no DOM or browser API, and components reach platform features only through `platform` | R12: this change adds nothing to `client-core` or `ui-web` and uses none of the banned globals in `apps/web`, checked by search. TOKI-002 enforces the rule in `ui-web` only (its concern 5) |
| Phase 1 acceptance criterion: initial JavaScript under 200 KB compressed | R10: 200 KB with gzip on the entry chunks (concern 4, decided). The enforced limit in CI is TOKI-007 and uses the same rule |
| The server API is versioned under `/api/v1` | R6: the proxy forwards `/api/v1` with the path unchanged |
| Milestone: M1 Foundation and design system; exit check `pnpm dev` runs, CI is green, preview page matches the prototype | R1 gives the web part of `pnpm dev`. The root `pnpm dev` script is created by TOKI-001 and runs the `apps/web` `dev` script (concern 5, decided). CI is TOKI-007; the preview page is TOKI-016 |
| Size: S (about half a working session with Claude) | Planning fact; no design impact. Scope is kept to four parts and two plain views |
| Needs: TOKI-001 (pnpm monorepo and TypeScript) | Planning fact. The design uses the `apps/web` folder and shared TypeScript config from TOKI-001. Plan change: it now also needs TOKI-096 for the proxy target variable name (decision of 2026-11-12). It needs no server ticket (stub server in Testing) |
| Needed by: TOKI-008 (test harness), TOKI-010 (self-hosted fonts) and TOKI-011 (icon set) | R1, R2 and R9 give them a running app, a page to load and a build. No design impact beyond that |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; no design impact. Scope "Out" names the sibling tickets |

## Open questions from the intent
- The intent says "None." No question to answer.
- The Clarify step found gaps that the intent does not answer. Concerns 4 and 5 are answered. Concerns 1 and 2 are answered in part. Concern 9 is answered from TOKI-001. Concerns 3, 6, 7 and 8 are open.

## Areas of concern
1. The Blueprint states no server port for development and no name for the proxy target variable. TOKI-096 owns the variable inventory and TOKI-004 owns the server, and neither is written yet. Answered in part: the proxy target variable name comes from the TOKI-096 inventory. TOKI-096 is done first and names every phase 1 variable; TOKI-006 uses exactly that name and invents none. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Evidence for the name: the TOKI-096 spec (branch `spec/environment-config`, Categories to cover) lists "Web dev server: the proxy target for `/api/v1` (TOKI-006 R7)" as its own row, and its R10 requires every variable TOKI-006 reads to be named, so the category exists. Still open: the server port default, which TOKI-096 concern 12 also leaves open, and whether the proxy target is a separate variable or derived from the server port variable. A separate variable can drift from the server port and leave the web app proxying to a dead port (R8 shows as 5xx). Not decided in the decision log of 2026-11-12. Owner: BA (Thanh Truong as lead).
2. Phase 1 uses WebSocket, but the Blueprint states no WebSocket path. This spec proxies only `/api/v1` over HTTP. It is not decided whether the WebSocket proxy belongs here or to the first realtime ticket, nor whether `/healthz` (outside `/api/v1`) must be reachable through the proxy. Answered in part: the architecture figure shows Caddy routing "/api and /ws", so the WebSocket path is `/ws`, and the WebSocket gateway itself is TOKI-038 (M3). Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Technical design tab, High-level architecture figure; Plan tab, ticket TOKI-038. Still open: whether the `/ws` dev proxy is added in this ticket or in TOKI-038, and whether `/healthz` must be reachable through the proxy. Owner: Thanh Truong.
3. The Blueprint names TanStack Router but not file-based or code-based routes. File-based routes add a build plugin and a generated file; code-based routes do not. The layout assumes file-based and now lists the plugin and the committed `routeTree.gen.ts` (Layout). Answered in part: if file-based stays, the generated file is committed (reason in Layout). Still open: file-based or code-based. Owner: Thanh Truong.
4. "Under 200 KB compressed" does not say gzip or Brotli, nor whether lazy-loaded chunks count. Decided: the limit is 200 KB, measured with gzip, on the JavaScript that `apps/web` loads on first page load (the entry chunks; lazy-loaded chunks do not count). The same rule applies in TOKI-006 and TOKI-007. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
5. The M1 exit check says `pnpm dev` runs. The Blueprint does not say which ticket adds the root `pnpm dev` script or whether it starts the web app, the server or both. Decided: TOKI-001 creates the root `dev` script, which runs the `dev` script of every workspace project that has one. TOKI-006 adds only the `apps/web` `dev` script and does not edit the root script; root `pnpm dev` picks it up. Once TOKI-004 and TOKI-006 are both done it starts the server and the web app. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
6. The Blueprint places "API client, cache, stores" in `client-core`, and this ticket places the Query client in `apps/web`. It is not stated where the Query client should live once `client-core` has code, since `client-core` must stay free of DOM use for React Native. Owner: Thanh Truong.
7. The Blueprint gives no versions for React, Vite or the TanStack libraries (only Node 22). Assumption: the current stable release of each at build time, pinned in the lockfile. Owner: Thanh Truong.
8. Review of 2026-11-16: `docs/definition-of-done.md` says "A test covers the change", but this ticket adds no automated test: R1 to R12 are checked by hand or by command, and TOKI-008 later covers R2 only (its R11). The proxy (R6 to R8) has no later test. TOKI-004 had the same ordering problem and the lead decided a minimal Vitest setup (server-skeleton concern 6, decided 2026-11-12). The decision log does not decide it for TOKI-006. Options, none chosen: a minimal Vitest setup in `apps/web` with a test of the proxy config; accept hand checks until TOKI-008 and record the exception in the PR; move the proxy tests into TOKI-008. Owner: BA (Thanh Truong as lead).
9. TOKI-001 concern 2 (module format; packages built or consumed from source) says TOKI-006 needs the answer before it adds a build. Answered: every project is an ES module and packages are consumed from source through `exports` (`./src/index.ts`), with no package build step; the web build is left to TOKI-006. This spec builds `apps/web` with Vite and bundles `@toki/shared` from source. Evidence: TOKI-001 spec (branch `spec/monorepo-typescript-setup`), Areas of concern 2 and R4, R5, R10. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Owner: Thanh Truong.
