# TOKI-117 QA of the web app skeleton - implementation plan

**Goal:** TOKI-006 gets a QA record, run on the real repository at the merge commit of the pull request that delivered it, with the results whatever they are.

**Spec:** `docs/specs/2026-11-25-web-skeleton-qa-design.md` (R1 to R10). Tier M. Branch `docs/toki-117-web-qa`. Documents and one bash script (with two small Node helpers it writes into a temporary folder); no existing file changes except `docs/traceability.md` (regenerated). `Version:` is `cd855ee` (PR #111), decided in concern 1.

## Design

Same shape as `docs/qa/TOKI-001.*`, `TOKI-002.*` and `TOKI-004.*`. The three earlier verifier rounds all found checks that covered only part of a requirement, so each row below is written to compare the whole requirement from the start: every part of a sentence of the requirement is a printed number, a row names one requirement, a row that loops prints how many it checked, and a row that depends on a port or a browser prints `Blocked` and never a Pass when it cannot run.

- `docs/qa/TOKI-006.checks.sh` reads files of `V` with `git show`. Rows that run Vite, build or type check use one temporary worktree of `V` (installed once, removed by an `EXIT` trap that also stops every process the script started). Node 22 and `corepack pnpm` as before. `env -i` for the processes it starts, so nothing of the caller's shell reaches them; no `.env` is read or created.
- **Vite rows** start `pnpm --filter ./apps/web dev` in the temporary worktree. The port 5173 is fixed by the spec, so rows that need it run only when 5173 is free (probed first) and are `Blocked` otherwise; the script never stops another process. The row for "5173 already in use" starts its own dummy listener on 5173 and removes it.
- **Proxy target.** `vite.config.ts` reads the server port with `loadEnv(mode, <root>, "")`, which also reads the process environment. The rows give `SERVER_PORT` through the environment of the process they start (throwaway ports); the row for the default (3000) runs only when 3000 is free. The spec's own check of R7 sets the port in the root `.env`; no row creates a `.env`, so that mechanism is shown by reading the config (`loadEnv` with the repository root and an empty prefix) and the behavior by the environment variable. The result notes say so.
- **Stub server.** A small Node server on a free port answers every path with a fixed body and writes the path it received to a temporary file; rows compare the body and the received path (query string included) with what was sent.
- **Browser rows** use `@playwright/test@1.65.1` (the version `main` uses today) installed with npm into a temporary folder outside the worktree (only the npm package) and the Chromium that Playwright already cached on this machine; nothing is downloaded for the browser (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`), and a missing browser makes the row `Blocked`. A small script opens the page headless, records the response status, the text of `[data-testid="app-root"]`, console errors, page errors and failed requests.
- **First-load size (R10)** is computed by a small Node script that parses `dist/index.html` for every `<script src>` and `modulepreload` link, follows static imports in the files (not `import()` calls), gzips each file once and adds the sizes; it prints the number of files, the total in bytes and whether the total is under 200,000.
- Output is counts, exit codes, status codes and words. No value of a variable, no secret.
- Rows are drafted by Claude and approved by the QA before any row is run. I debug the script on a mutated copy first; if I run a real row to debug it, I say so.

### Rows (one per requirement)

| ID | TOKI-006 | Output compared with Expected |
| :-- | :-- | :-- |
| T1 | R1 | `T1 1 1 1 1`: the dev command prints `http://localhost:5173/`; the port bound is 5173; with 5173 taken by another listener the command exits non-zero with an error; and no other port (5174) is opened |
| T2 | R2 | `T2 200 Toki 0 0`: `/` returns 200; the text of `[data-testid="app-root"]` is `Toki`; no console error or page error; no failed request (no favicon request) |
| T3 | R3 | `T3 2 0 0 1 router.tsx`: route files under `apps/web/src/routes/`; TanStack Router plugin references in `vite.config.ts`; generated route files; files that call `createRouter(`, and which |
| T4 | R4 | `T4 2 0`: two unknown paths (`/no-such-page`, `/a/b/c`) show `Page not found` and raise no page error |
| T5 | R5 | `T5 1 query-client.ts 1`: `new QueryClient(` appears once in `apps/web/src`, in `query-client.ts`, and `main.tsx` provides that client to the app |
| T6 | R6 | `T6 1 1`: a request to `<web>/api/v1/<path>?<query>` returns the stub's body and the stub received the same path and query |
| T7 | R7 | `T7 2 1 0 0`: with no server port variable `/api/v1` and `/healthz` both reach a stub on 3000; the config reads the port with `loadEnv(mode, <root>, "")`; no separate proxy target variable; the server port does not appear in the browser build |
| T8 | R8 | `T8 1 200`: with no server listening the same request returns a 5xx, and the dev server still answers `/` with 200 afterwards |
| T9 | R9 | `T9 0 1`: `pnpm --filter ./apps/web build` exits 0 and `apps/web/dist/index.html` exists |
| T10 | R10 | `T10 N B 1`, N at least 1 and B below 200000: the number of first-load files, their gzip total in bytes, and whether the total is under 200,000 bytes |
| T11 | R11 | `T11 0`: `pnpm --filter ./apps/web typecheck` exits 0 |
| T12 | R12 | `T12 0 0`: files added under `packages/client-core` or `packages/ui-web` by the delivering pull request; matches of the seven banned names in `apps/web/src` |
| T13 | R13 | `T13 1 1 1`: `/healthz` reaches the stub with the path unchanged; with no server it returns a 5xx; the dev server keeps running |

## AC -> step -> test

| Req | Step | Test |
| :---- | :---- | :---- |
| R3, R5 | 1. Write `TOKI-006.checks.sh` and the helpers | run on a mutated copy (a second `new QueryClient(`, a `localStorage` use, a plugin in `vite.config.ts`, a changed proxy path, a bigger bundle): the matching rows fail; run twice: identical lines |
| R1, R2 | 2. Draft `docs/qa/TOKI-006.md` (unapproved, unrun) | `qa-ready.sh` reports the true gaps |
| R4, R6 | 3. QA approves rows; I run T1 to T13 | results and evidence in the record |
| R7, R8 | 4. Result notes (what changed since `cd855ee`), `trace.sh` | the TOKI-006 row of the table |
| R9, R10 | 5. Checks | `git diff` shows added files and `traceability.md` only; repository unchanged; no process, port or worktree left |

## What can break (riskiest first)

1. A row that passes because it measured nothing: every part is a printed number and the Expected needs the exact values; the size row needs at least one file.
2. Port 5173 or 3000 busy: those rows are `Blocked`, not guessed, and nothing on the machine is stopped.
3. The browser: a missing Chromium makes T2 and T4 `Blocked`; a console error that comes from the browser and not the app is read before it is recorded.
4. The R7 mechanism: the `.env` file is not written; the notes say what is and is not exercised.
5. Processes and ports left behind: the `EXIT` trap stops them and the final line shows none alive.
