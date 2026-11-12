# Web app skeleton design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/web-skeleton.md (Thanh Truong)
Ticket: TOKI-006

## Goal
The builder needs a running web app in `apps/web` that later screens are added to. It must have one place for pages and navigation, one place for loading data from the server, and a development connection to the server. Without it, the test harness (TOKI-008) and every later web screen have nothing to build on.

## Scope
- In: the Vite + React app in `apps/web`; TanStack Router with a root route, one empty index page and a not-found view; one TanStack Query client and its provider; the dev proxy for `/api/v1`; the `dev`, `build` and `typecheck` scripts of `apps/web`.
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
- R1. `pnpm --filter ./apps/web dev` starts the Vite dev server and prints a local URL.
- R2. Opening that URL at `/` returns HTTP 200 and renders the empty index page, with no error in the browser console.
- R3. All routes are declared under `apps/web/src/routes/`; the router is created in one file, `apps/web/src/router.tsx`, and no other file creates a router.
- R4. Opening an unknown path (for example `/no-such-page`) shows the not-found view with the text "Page not found", not a blank page or an uncaught error.
- R5. One Query client is created in `apps/web/src/query-client.ts` and provided to the whole app; a search for `new QueryClient(` in `apps/web/src` finds exactly one match.
- R6. In development, a request to `<web dev URL>/api/v1/<path>` is forwarded to the server with the path unchanged; with a server listening on the proxy target, `curl <web dev URL>/api/v1/<path>` shows that server's response.
- R7. The proxy target is read from one environment variable, whose name is the one given in the TOKI-096 inventory, with a default for local development; changing the variable and restarting the dev server sends the same `curl` to the new target.
- R8. When no server listens on the proxy target, the same `curl` returns a 5xx status and the dev server keeps running.
- R9. `pnpm --filter ./apps/web build` exits 0 and writes `apps/web/dist/index.html`.
- R10. The JavaScript loaded by `apps/web/dist/index.html` on first page load (the entry chunks; lazy-loaded chunks do not count) is under 200 KB measured with gzip, on the build output.
- R11. `pnpm --filter ./apps/web typecheck` exits 0.
- R12. This change adds no file under `packages/client-core` or `packages/ui-web`, and a search of `apps/web/src` for direct use of the notification, storage, service worker and audio APIs finds nothing.

## Design
### Screens
1. Index page (`/`): empty. It renders the root layout with no content. No text, no styling beyond the browser default.
2. Not-found view (any unknown path): the text "Page not found". Plain text; the designed version comes with the base components.

The root layout renders the current page only. AppShell replaces it in TOKI-015.

### Errors
- Unknown path -> the not-found view (R4).
- Server not running in development -> the proxy answers 5xx; the dev server does not stop (R8).
- An error thrown while a page renders -> the router's default error view. No custom error screen in this ticket.

### Layout
```
apps/web/
├─ index.html           one root element, loads src/main.tsx
├─ vite.config.ts       React plugin, dev proxy for /api/v1
├─ package.json         scripts: dev, build, typecheck
└─ src/
   ├─ main.tsx          mounts the app: Query provider, then router
   ├─ router.tsx        creates the router from the routes
   ├─ query-client.ts   creates the one Query client
   └─ routes/
      ├─ __root.tsx     root layout and not-found view
      └─ index.tsx      the empty page
```
- Assumption: file names follow TanStack Router's file-based convention. The choice between file-based and code-based routes is concern 3.
- Assumption: the dev server uses Vite's default port. The Blueprint states no port.
- The proxy target variable uses exactly the name given in the TOKI-096 inventory, which is done first; this spec invents no name (concern 1). Assumption: its default points at the local server; the server port is still open (concern 1).
- The Query client uses the library defaults. Retry, cache time and error rules are set by the first ticket that loads real data.
- A later screen is added by adding one route under `src/routes/` and uses the Query client from the provider.

## Testing
- TOKI-008 owns the test harness, so this ticket adds no test framework. Each requirement is checked by the command or search it names.
- R6, R7 and R8 are checked with a small local stub server that answers one fixed response under `/api/v1`. This works before TOKI-004 exists. Fake data only.
- R10 is checked by compressing with gzip the JavaScript files that `dist/index.html` loads on first page load (the entry chunks, not lazy-loaded chunks) and adding their sizes.
- R2 and R4 are checked by hand in the browser now. Assumption: the Playwright sample test in TOKI-008 takes over R2.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Scope given by the Blueprint: router, Query, an empty page, dev proxy to the server | R2 to R8; Scope "In" lists only these four |
| Agreed web stack: React, Vite, TanStack Router and Query | R1, R3, R5; Layout. No other framework or data library is added |
| The web app lives in `apps/web` in the one monorepo (phase 1) | Layout; every file of this change is under `apps/web` |
| Boundary rules apply: `client-core` touches no DOM or browser API, and components reach platform features only through `platform` | R12. The lint rule itself is TOKI-002 |
| Phase 1 acceptance criterion: initial JavaScript under 200 KB compressed | R10: 200 KB with gzip on the entry chunks (concern 4, decided). The enforced limit in CI is TOKI-007 and uses the same rule |
| The server API is versioned under `/api/v1` | R6: the proxy forwards `/api/v1` with the path unchanged |
| Milestone: M1 Foundation and design system; exit check `pnpm dev` runs, CI is green, preview page matches the prototype | R1 gives the web part of `pnpm dev`. The root `pnpm dev` script is created by TOKI-001 and runs the `apps/web` `dev` script (concern 5, decided). CI is TOKI-007; the preview page is TOKI-016 |
| Size: S (about half a working session with Claude) | Planning fact; no design impact. Scope is kept to four parts and two plain views |
| Needs: TOKI-001 (pnpm monorepo and TypeScript) | Planning fact. The design uses the `apps/web` folder and shared TypeScript config from TOKI-001. Plan change: it now also needs TOKI-096 for the proxy target variable name (decision of 2026-11-12). It needs no server ticket (stub server in Testing) |
| Needed by: TOKI-008 (test harness), TOKI-010 (self-hosted fonts) and TOKI-011 (icon set) | R1, R2 and R9 give them a running app, a page to load and a build. No design impact beyond that |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; no design impact. Scope "Out" names the sibling tickets |

## Open questions from the intent
- The intent says "None." No question to answer.
- The Clarify step found gaps that the intent does not answer. Concerns 4 and 5 are answered. Concerns 1 and 2 are answered in part. Concerns 3, 6 and 7 are carried forward as they are.

## Areas of concern
1. The Blueprint states no server port for development and no name for the proxy target variable. TOKI-096 owns the variable inventory and TOKI-004 owns the server, and neither is written yet. Answered in part: the proxy target variable name comes from the TOKI-096 inventory. TOKI-096 is done first and names every phase 1 variable; TOKI-006 uses exactly that name and invents none. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Still open: the server port default. Owner: Thanh Truong.
2. Phase 1 uses WebSocket, but the Blueprint states no WebSocket path. This spec proxies only `/api/v1` over HTTP. It is not decided whether the WebSocket proxy belongs here or to the first realtime ticket, nor whether `/healthz` (outside `/api/v1`) must be reachable through the proxy. Answered in part: the architecture figure shows Caddy routing "/api and /ws", so the WebSocket path is `/ws`, and the WebSocket gateway itself is TOKI-038 (M3). Evidence: Toki Blueprint (claude.ai/artifact/VVRByrWR4d1BYgp3JA5vTE), Technical design tab, High-level architecture figure; Plan tab, ticket TOKI-038. Still open: whether the `/ws` dev proxy is added in this ticket or in TOKI-038, and whether `/healthz` must be reachable through the proxy. Owner: Thanh Truong.
3. The Blueprint names TanStack Router but not file-based or code-based routes. File-based routes add a build plugin and a generated file; code-based routes do not. The layout assumes file-based. Owner: Thanh Truong.
4. "Under 200 KB compressed" does not say gzip or Brotli, nor whether lazy-loaded chunks count. Decided: the limit is 200 KB, measured with gzip, on the JavaScript that `apps/web` loads on first page load (the entry chunks; lazy-loaded chunks do not count). The same rule applies in TOKI-006 and TOKI-007. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
5. The M1 exit check says `pnpm dev` runs. The Blueprint does not say which ticket adds the root `pnpm dev` script or whether it starts the web app, the server or both. Decided: TOKI-001 creates the root `dev` script, which runs the `dev` script of every workspace project that has one. TOKI-006 adds only the `apps/web` `dev` script and does not edit the root script; root `pnpm dev` picks it up. Once TOKI-004 and TOKI-006 are both done it starts the server and the web app. Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
6. The Blueprint places "API client, cache, stores" in `client-core`, and this ticket places the Query client in `apps/web`. It is not stated where the Query client should live once `client-core` has code, since `client-core` must stay free of DOM use for React Native. Owner: Thanh Truong.
7. The Blueprint gives no versions for React, Vite or the TanStack libraries (only Node 22). Assumption: the current stable release of each at build time, pinned in the lockfile. Owner: Thanh Truong.
