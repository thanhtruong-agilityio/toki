# QA record: TOKI-006
Ticket: TOKI-006
Spec: docs/specs/2026-11-12-web-skeleton-design.md
Version: cd855ee
Environment: a temporary worktree of the Version under Node 22 (`~/.nvm`), pnpm through corepack, macOS; the Vite dev server on port 5173 (free when the rows ran) with throwaway ports for the stub server; headless Chromium cached by Playwright, driven by `@playwright/test` 1.65.1 installed with npm into a temporary folder; the repository itself is not changed

Role: Dev is Thanh Truong with Claude (the ticket was built before this record). QA is Thanh Truong. Claude drafts the rows; the QA approves them before any row is run. Claude runs the command rows.

Each row runs `V=cd855ee bash docs/qa/TOKI-006.checks.sh <ID>` (called `checks` below) and compares its one output line with Expected. The output goes in `docs/qa/TOKI-006.evidence.txt`. `cd855ee` is the merge commit of PR #111, decided in concern 1 of the spec of this record. The processes the script starts get only the variables given on the command line; no `.env` is read or created. The spec of TOKI-006 checks R7 by setting the server port in the root `.env`; the rows give it through the process environment, which Vite's `loadEnv` also reads, and show the `.env` mechanism by reading the config (`loadEnv(mode, <root>, "")`); the result notes say what that does not exercise.

## Test matrix
| ID | Requirement | Layer | Steps | Expected | Evidence | Priority | Approved | Result | Run |
|---|---|---|---|---|---|---|---|---|---|
| T1 | R1 | command | `checks T1` | `T1 1 1 1 1`: the dev command prints `http://localhost:5173/`; the port bound is 5173; with 5173 taken by another listener the command exits non-zero; no other port (5174) is opened |  | P1 |  |  |  |
| T2 | R2 | command | `checks T2` | `T2 200 Toki 0 0`: `/` returns 200; the text of `[data-testid="app-root"]` is `Toki`; no console error or page error; no failed request (no favicon request) |  | P1 |  |  |  |
| T3 | R3 | command | `checks T3` | `T3 2 0 0 1 router.tsx`: two route files under `apps/web/src/routes/`; no TanStack Router plugin reference in `vite.config.ts` or `package.json`; no generated route file; one file calls `createRouter(`, `router.tsx` |  | P1 |  |  |  |
| T4 | R4 | command | `checks T4` | `T4 2 0`: two unknown paths (`/no-such-page`, `/a/b/c`) show exactly `Page not found` and raise no page error |  | P1 |  |  |  |
| T5 | R5 | command | `checks T5` | `T5 1 query-client.ts 1`: `new QueryClient(` appears once in `apps/web/src`, in `query-client.ts`, and `main.tsx` provides that client to the app |  | P1 |  |  |  |
| T6 | R6 | command | `checks T6` | `T6 1 1`: a request to `<web>/api/v1/<path>?<query>` returns the stub's body and the stub received the same path and query |  | P1 |  |  |  |
| T7 | R7 | command | `checks T7` | `T7 2 1 0 0`: with no server port variable `/api/v1` and `/healthz` both reach a stub on 3000; the config reads the port with `loadEnv(mode, <root>, "")`; no separate proxy target variable; the server port does not appear in the browser build |  | P1 |  |  |  |
| T8 | R8 | command | `checks T8` | `T8 1 200`: with no server listening the same request returns a 5xx, and the dev server still answers `/` with 200 afterwards |  | P1 |  |  |  |
| T9 | R9 | command | `checks T9` | `T9 0 1`: `pnpm --filter ./apps/web build` exits 0 and `apps/web/dist/index.html` exists |  | P1 |  |  |  |
| T10 | R10 | command | `checks T10` | `T10 N B 1`, N at least 1 and B below 200000: the number of first-load JavaScript files, their gzip total in bytes, and whether the total is under 200,000 bytes |  | P1 |  |  |  |
| T11 | R11 | command | `checks T11` | `T11 0`: `pnpm --filter ./apps/web typecheck` exits 0 |  | P2 |  |  |  |
| T12 | R12 | command | `checks T12` | `T12 0 0`: files added under `packages/client-core` or `packages/ui-web` by the delivering pull request; matches of the seven banned names in `apps/web/src` |  | P2 |  |  |  |
| T13 | R13 | command | `checks T13` | `T13 1 1 1`: `/healthz` reaches the stub with the path unchanged; with no server it returns a 5xx; the dev server keeps running |  | P1 |  |  |  |

## Not covered
- None: every requirement R1 to R13 of the spec has a row.
