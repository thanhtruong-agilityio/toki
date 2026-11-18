# TOKI-006 Web app skeleton

Spec: docs/specs/2026-11-12-web-skeleton-design.md
Intent: docs/intents/web-skeleton.md

## Design
Approved by Thanh, 2026-11-17. Technical design only; the requirements stay in the spec (R1 to R13).

### Dependencies
Current stable release at build time, pinned by `pnpm-lock.yaml`, caret in `package.json` (concern 7):
- Runtime: `react`, `react-dom`, `@tanstack/react-router`, `@tanstack/react-query`.
- Dev: `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom`, `@types/node`.

### Files (all under `apps/web`)
- `package.json`: scripts `dev` (`vite`), `build` (`vite build`), `typecheck` kept. The root `dev` script picks `dev` up; the root is not edited.
- `index.html`: one `#root`, an empty icon link, loads `src/main.tsx`.
- `vite.config.ts`: React plugin; port 5173 with `strictPort`; `loadEnv(mode, <repo root>, "")` reads `SERVER_PORT` (default 3000); proxy `/api/v1` and `/healthz` to `http://127.0.0.1:<port>`, path unchanged. The port never reaches browser code.
- `tsconfig.json`: extends the base; adds only `jsx`, `lib` and `types`; includes `src` and `vite.config.ts`.
- `src/query-client.ts`: the one `new QueryClient()`, library defaults.
- `src/routes/__root.tsx`: code-based root route, `Outlet`, not-found view "Page not found".
- `src/routes/index.tsx`: index route, "Toki" in `data-testid="app-root"`.
- `src/router.tsx`: the only `createRouter`; route tree from the route objects; `Register` declaration for types.
- `src/main.tsx`: `StrictMode`, Query provider, router provider.
- `src/index.ts` (TOKI-001 placeholder): deleted.

### Testing
No automated test (spec, concern 8; TOKI-008 owns them). Root `typecheck`, `lint`, `format:check`, `build`, `size`; by hand R1 to R13 against a stub server on the server port (not committed). R7 needs `SERVER_PORT` in the root `.env`, which the builder sets. The PR records the exception to "A test covers the change", pointing at TOKI-008.

### Risks
- Once `apps/web` has a `build` script, `pnpm size` and the CI `bundle size` job measure it for real; the first-load total is about 100,670 bytes against 200,000.
- ESLint had not run on `.tsx` in `apps/web` before; it passes with `--max-warnings 0`.
