# TOKI-016 Component preview page: plan

Ticket: TOKI-016 (issue 37). Branch: `feat/toki-016-component-preview-page`. Tier: M.
Spec (the source of truth, decisions of 2026-11-18 in #139 and #143): `docs/specs/2026-11-16-component-preview-design.md`.
Requirements are named `R1` to `R24`, tables `A` to `E`, as in the spec; this plan does not copy the tables, the tests type them in from the spec.

## Design

The spec is the design. This plan adds only what the repository and the order of work change.

Shape: a second Vite entry `apps/web/preview.html` with `src/preview/` (controls, sections, figure with error boundary, `references.ts`, `preview.css`), served by the dev server only; `scripts/check-no-dev-pages.mjs` keeps it out of the build; the two Playwright files and two Vitest files of the spec check it. No file under `packages/` changes (R19).

Build order (concern 9, stop after any step if needed):
1. entry, build exclusion, controls (R1 to R4);
2. component sections and Table B1 (R5 to R8);
3. icons, fonts, tokens, live toasts (R9 to R12);
4. overlays (R13, R23);
5. colour, accent, density, layout checks (R14 to R16);
6. references, by-eye record, screenshots (R17, R21, R24).

### Decisions taken in this plan (differences from the spec)

1. **TOKI-010 (fonts) and TOKI-014 (overlays) are not on `main`** (checked 2026-11-18). TOKI-010 has no branch yet; TOKI-014 is on `feat/toki-014-overlays`. TOKI-013 is on `main`, so Toast, Avatar and the others of group 2 are in `componentExamples`.
   - Not buildable until TOKI-010 merges: the `fonts.css` link of R3, the `check:fonts` clause of R3 (the script does not exist yet), the `fonts` section (R10), the seven `.woff2` request count of R20. Until then `preview.html` has no font link and the `fonts` section is not rendered.
   - Not buildable until TOKI-014 merges: the Menu, Modal and Sheet entries, R13, R23, Table A2, and the three required entries of R8.
   - Only the missing part is deferred, never a whole test: R8 still checks the 12 entries that exist, and R20 still checks the console and the requests. Deferred checks are `test.fixme` with one shared reason constant (`PENDING_TOKI_010`, `PENDING_TOKI_014`) in the test file, so a later regression is not hidden by "entry missing". The pull request lists them.
   - The ticket is not done until the `fixme` checks run: follow-up commits on this branch after those tickets merge (concern 9 decided one ticket, built in order; no follow-up ticket).
   - R21 (a) and R24 wait for TOKI-010: images made with the wrong fonts would be redone.
2. **Where the shared script lives.** TOKI-015 is not on `main`, so `apps/web/scripts/check-no-dev-pages.mjs` is created here with the page name and marker of this page; TOKI-015 adds its own (R2).
3. **Versions.** `jsdom` `31.0.1`, `@testing-library/react` `16.3.3`, `@testing-library/dom` `10.4.2` are pinned exactly as in `packages/ui-web` (R7). Vitest is picked up by the root `vitest.config.ts`; the builder confirms the glob over `apps/*` on the pinned Vitest.
4. **Screenshot images (R24)** are made last, after the by-eye check of R21 (a); the test is written first and seen to fail with no images.
5. **Screenshots are the riskiest step.** CI runs Playwright on `ubuntu-latest` (`.github/workflows/ci.yml`); images made on macOS are saved as `-darwin` and CI finds none. R24's images are made on Linux (the Playwright Docker image, or CI's `--update-snapshots` run committed back), and the test names the platform it was made on.
6. **Test server.** `playwright.config.ts` starts `pnpm --filter @toki/web exec vite --host 127.0.0.1` on 5173 and the API server too; this does the same as `pnpm --filter ./apps/web dev`. If the API server fails to start, every preview test fails: that is TOKI-008's, not changed here.
7. **Vitest.** The root `vitest.config.ts` lists `apps/*`, which makes `apps/web` a project that loads `apps/web/vite.config.ts` (it reads the root `.env`). This ticket adds `apps/web/vitest.config.ts` (node, `include: src/**/*.test.{ts,tsx}`) so the project does not depend on the dev config. No `*.spec.*` file goes in `apps/web`.
8. **`preview.html` copies the favicon line** `<link rel="icon" href="data:,">` from `index.html`, or the browser asks `/favicon.ico` and R20 fails on the console error.
9. **Build script.** `build` is `vite build && pnpm run check:no-dev-pages` for now; `check:fonts` is added before it by TOKI-010. The check script reads `build.rolldownOptions.input`, `rollupOptions.input` and `build.lib`, but `dist` is the real proof, since the config is a function.
10. **`pnpm lint:boundaries` does not exist** (TOKI-002 dropped it); R22 is read without it.
11. **Setup.** Run `corepack pnpm install` first; the `jsdom`, `@testing-library/react` and `@testing-library/dom` pins go in the same commit as the lockfile.

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :-- | :-- | :-- |
| R1 page, viewport meta | 1 | `e2e/component-preview.spec.ts`: both `/preview.html` and `/` open |
| R2 not in the build | 1 | `check-no-dev-pages.mjs` run on a build; by hand: add `preview.html` to the input, it exits non-zero |
| R3 style order | 1 | `src/preview/preview.test.ts` reads `preview.html` and `main.tsx` (fonts link part skipped, TOKI-010) |
| R4 controls | 1 | `preview.test.ts` `readControls`; browser test of the three attributes and the address |
| R5, R6 sections, figures | 2 | browser test: order, `data-count` per entry |
| R7 error boundary | 2 | `src/preview/ExampleFigure.test.tsx` (jsdom) with a throwing element |
| R8 Table B1, B2, A2 | 2 | browser test; A2 and the three required entries skipped (TOKI-014) |
| R9 icons | 3 | browser test: 43 cells |
| R10 fonts | 3 | browser test (skipped, TOKI-010) |
| R11 tokens | 3 | browser test: 32 rows, three `--accent` values |
| R12 live toasts | 3 | browser test with real timers |
| R13, R23 overlays | 4 | browser test (skipped, TOKI-014) |
| R14 Table C | 5 | browser test, `toHaveCSS`, 13 rows, both looks |
| R15 accent, density | 5 | browser test |
| R16 layouts | 5 | browser test at the six sizes |
| R17 references | 6 | browser test of `data-prototype-ref` against Table D |
| R18, R19 | 1 to 6 | `preview.test.ts` reads imports and selectors; `git diff --stat` shows nothing under `packages/` |
| R20 console, requests | 3 to 6 | browser test |
| R21 by-eye record | 6 | the four tables in the pull request description |
| R2 initial JS limit | 1 | `pnpm size` exits 0 after the build |
| R4 no storage | 1 | browser test: `localStorage`, `sessionStorage`, cookies empty after changing controls |
| R6 panel background | 2 | browser test: figure panel computes `var(--surface)` |
| R16 40 px at 719 | 5 | browser test names the selectors of R16 |
| R17 missing reference | 6 | `preview.test.ts`: an entry with no key reads `No prototype reference recorded` |
| R22 commands | all | `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, `pnpm format:check`, `pnpm --filter ./apps/web build` exit 0 (`lint:boundaries` no longer exists, decision 10) |
| R24 screenshots | 6 | `e2e/component-preview-screenshots.spec.ts` fails with no images, passes with them, fails after one token change |

## Steps

1. **Entry, exclusion, controls.** `apps/web/preview.html`, `src/preview/{main.tsx,controls.ts,preview.css}`, `scripts/check-no-dev-pages.mjs`, the `check:no-dev-pages` script run last by `build`. Tests first: `readControls`, the style-order read, the build check.
2. **Sections and figures.** `ExampleFigure` with its boundary, one section per `componentExamples` entry, `data-count`, Table B1 in the browser test.
3. **Icons, tokens, toasts** (fonts when TOKI-010 merges).
4. **Overlays** (when TOKI-014 merges).
5. **Look checks.** Table C, accent, density, widths.
6. **References and records.** `references.ts` and Table D check, then the by-eye record in the pull request, then the screenshots.
7. **Verify.** Run the commands of R22.

## What can break (riskiest step)

Riskiest step: 6, the screenshots (decision 5): platform-specific images and font dependence on TOKI-010. Next: the deferred checks hiding a failure (decision 1, answered with `test.fixme` and a shared reason, only on the missing part); the Vitest project for `apps/web` loading the dev config (decision 7); the favicon console error (decision 8). Grilled once (tier M) by an Opus review on 2026-11-18; each finding is in decisions 1 and 5 to 11 or the table above.

## Changes made during the build (recorded after verifier round 1)

- The root `test` script also runs `apps/web/scripts/check-no-dev-pages.test.mjs` (six cases for the script of R2); the file and the change to root `package.json` were not named in the steps.
- In `preview.test.ts` the deferred R3 fonts-link check is a `test.todo` (Vitest has no `fixme`); the deferred browser checks are `test.fixme` with `PENDING_TOKI_010` and `PENDING_TOKI_014`. R13, R23, the R20 `.woff2` count and R24 each have a placeholder in `e2e/component-preview.spec.ts`. R21 is by hand and has none.
- The look's own density is the value `own` in the address (`density=own`); the spec is silent. Component sections carry `data-section="component"` and `data-component`. Table B1 selectors match inside any figure, as the spec reads.
- `docs/plans/TOKI-016.state.json` is committed with the work.
- The Table C, R15 and R16 browser tests were written after the page and checked by changing expected values; they did not fail first.
- The branch is behind `main` and is merged with it before the pull request.
- TOKI-014 merged into `main` during the build, so step 4 is built (R13, R23, Table A2 in R8, the overlay lines of R17); only `PENDING_TOKI_010` placeholders remain (fonts section, its R17 line, the R20 `.woff2` count, R24, and the R3 fonts-link `test.todo`). The browser test lists the 15 components in the order of `componentExamples` and does not import from `packages/`.
