# TOKI-015 AppShell in three layouts: plan

Ticket: TOKI-015 (issue 42). Branch: `feat/toki-015-app-shell`. Tier: L.
Spec (the source of truth, merged with the decisions of 2026-11-18, PR 141): `docs/specs/2026-11-16-app-shell-design.md`.
Requirements are named `R1` to `R36`, tables `C` to `J`, concerns `1` to `23`, as in the spec; this plan does not copy the tables, the tests type them in from the spec.

## Design

The spec is the design. This plan adds only what the repository and the order of work change.

Build order (the order of concern 13, stop after any step if needed):
`utilities.css`, `app.css`, `applyAppearance`; the wide layouts and the section list; the narrow layout and the bottom bar; the panel overlay, the navigation scroll and the toast places; the tab row, the section page and the side panel frame; the fixture and the browser test.

### Decisions taken in this plan (differences from the spec)

Found by comparing the spec with `main` on 2026-11-18 (after TOKI-013 and TOKI-017 merged).

1. **`index.html` already has a viewport meta** (`width=device-width, initial-scale=1.0`, line 5). The spec (R27, concern 12) says it adds one. Built: the existing meta gets `viewport-fit=cover`; no second tag.
2. **The R1 test of TOKI-012 does not "still pass" unchanged.** `src/components/exports.test.ts` (the "no component export ends in Icon" test) fails for any entry export that is not in `components`. Built: the test is extended to allow the exports of `./shell` and `./appearance`, and keeps its two checks about names ending in `Icon`.
3. **`apps/web` has no dependency on `@toki/i18n` or `@toki/client-core`**, and no test set-up (no jsdom, no Testing Library). Built: `@toki/i18n` is added (R31); the layout route test gets the set-up of `packages/ui-web` (versions pinned as there). `@toki/client-core` is not added: it is `export {}`.
4. **TOKI-023 is not built** (no `useSession`). R36 is built as the spec says for "built first": `AppShellRoute` gives no role, and `visibleSections` shows only rows with no `roles`. TOKI-023 adds the read.
5. **TOKI-010 (fonts) is not on `main`**: there is no `src/fonts/fonts.css`. Decided by Thanh Truong on 2026-11-18: the fixture has no `fonts.css` link (a static link would 404 in dev), the order test checks the imports that exist (as TOKI-012's plan does), and the Table J heights that depend on text are measured against the fallback fonts and re-measured when TOKI-010 lands. Each such number is marked in the test with a comment, and the PR description says so.
6. **`check:no-dev-pages` does not exist and TOKI-016 has not landed**, so this ticket creates it. The spec names `scripts/check-no-dev-pages.mjs`; the plan puts it in `tools/check-no-dev-pages.mjs` (tools holds the other `.mjs` checks, scripts holds only `.sh`), a difference from the spec. It is chained into the `apps/web` build and has a `node --test` file added to the root `test` script, as the bundle-size check has, so "fails and names the file" is a machine check. TOKI-016 reuses it.
7. **i18n catalogs are TypeScript**, `packages/i18n/src/messages/{en,vi}/nav.ts` (13 keys now), not JSON. `nav.mainLabel` is added to both; the count test in `src/translate.test.ts` goes from 13 to 14.
8. Versions of any new dependency are looked up when added and pinned exactly.
9. **`pnpm lint:boundaries` does not exist** (TOKI-002 dropped it). R35 is checked with `pnpm lint` and `pnpm test:lint-rules`, which hold the boundary rules that exist.

### Decisions from grilling round 1 (2026-11-18, Thanh Truong)

- Tables C to G are typed into the tests by hand, as TOKI-012 did; the browser test (R18 to R23) is the independent evidence of behaviour.
- One PR. It opens as a draft after step 3 so CI runs early (the e2e job runs only the existing specs until step 6 adds the fixture and `e2e/app-shell.spec.ts`); the draft is green because the export and CSS tests grow step by step. Later steps go on the same PR, one commit per step.
- The bundle size is measured with `node tools/bundle-size/check.mjs` after steps 2 and 6 and at step 8; the byte count goes into this plan. The limit (200000 bytes) is not raised.
- The browser test runs the full matrix of R33 in parallel and waits for transitions by condition, not by a fixed sleep. It is cut down only if CI proves too slow.
- Until the other tickets land, the real app shows the shell with the Home section only (R10: a row exists only when its route exists); the fixture holds the six sections. The PR description says so.

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :-- | :-- | :-- |
| R1 exports, R34 refs | 1 to 5 | `src/shell/exports.test.ts` (export list, `ref` per component); `exports.test.ts` extended (decision 2) |
| R2 no text, no imports | 2 to 5 | `src/shell/sources.test.ts` (imports scan); render with empty strings, `textContent` empty |
| R3, R4 structure, `derivePane` | 2 | `AppShell.test.tsx` (DOM, order, roles), `derivePane.test.ts` (16 inputs) |
| R5 to R10 navigation, header, card | 2, 3 | `NavSection.test.tsx`, `BottomTabs.test.tsx` (badge 0, -1, NaN, 1, 100; clicks with modifiers); `sections.test.ts` (no phase 2 row) |
| R11 to R15 frames, tab row, pane bodies | 5 | `SidePanel.test.tsx`, `SectionPage.test.tsx`, `TabList.test.tsx` (keyboard table, manual activation) |
| R16, R17 shell.css | 2 to 4 | `shell.css.test.ts`: Tables C to G typed in; fails on `@container`, `!important`, colour literals, unknown `var()` |
| R18 to R22 layouts | 2 to 4, 6 | `e2e/app-shell.spec.ts` against the fixture, both looks, the widths of R33 |
| R23, R24, R25 toasts, `--tabh` | 4 | Vitest render with `useToastAvoid`; browser test of three toasts at seven widths; CSS test for `--tabh` reads |
| R26, R27 utilities.css, app.css | 1 | `utilities.css.test.ts` (Table H), `app.css.test.ts` (Table I), `order.test.ts` extended |
| R28 `applyAppearance` | 1 | `appearance.test.ts` (attributes, cleanup, device) |
| R29 `useNarrow`, focus on pane change | 3 | `useNarrow.test.tsx` (stubbed `matchMedia`, missing), focus test with stubbed `focus` |
| R30, R31, R36 apps/web wiring, texts, roles | 2, 7 | `router.test.ts`, `app-layout.test.tsx` (en, vi, Member, Admin, no role); `pnpm --filter @toki/i18n check` |
| R32, R33 fixture, browser test | 6 | `shell-fixture.html` served in dev; `check:no-dev-pages` fails when the fixture is added to the build input, named in the message |
| R35 commands, bundle size | 8 | `pnpm typecheck`, `lint`, `test:lint-rules`, `format:check`, `test` (the only command that runs the apps/web tests), `--filter @toki/ui-web test`, `--filter ./apps/web build`, `size`, `test:e2e` exit 0 |
| R8 avatar, header; R15 empty-state centring; R27 body 15/14 px; R29 focus at 360 | 6 | named cases in `e2e/app-shell.spec.ts` (R33 lists them) |
| R9 no dialog | 2 | `AppShell.test.tsx`: no `role=dialog` before or after the More press |
| R11 Escape | 5 | `SidePanel.test.tsx`: a stand-in layer stops the event first |
| R25 composer | 4 | Vitest: a region's `bottom` changes when a component calls `useToastAvoid` |
| R27 viewport meta | 1 | `apps/web` test of `index.html`: width, initial scale, `viewport-fit=cover` |
| R17, R24 extra CSS checks | 2 to 4 | `shell.css.test.ts`: font-family lines, no `data-look`/`data-accent`/`data-density` selectors, no hover-only rule hiding content, no `--tabh` read outside `.app` |
| R36 role change re-render | deferred | needs `useSession`; TOKI-023 adds the test (decision 4) |

## Steps

1. **Page-wide.** `src/styles/utilities.css` (Table H), the `exports` entry, `apps/web/src/app.css` (Table I), `src/appearance.ts` and its line in `src/index.ts`, `viewport-fit=cover` in `index.html`, the imports in `main.tsx` in the order of R26 and R27 (`order.test.ts` extended: `./app.css` right after base, `utilities.css` after it, `lastStyle` covering all four; the `applyAppearance` import on one line, after the CSS imports, because the test's regex reads single-line imports only). The `exports.test.ts` change of decision 2 lands here, because this step adds the first non-Icon export. The Table I test sits beside `order.test.ts` in `packages/ui-web/src/styles/` (it already reads `apps/web`). Tests first for each.
2. **Wide layouts and the section list.** `apps/web` test set-up first (`vitest.config.ts` with jsdom and `setupFiles`, `src/test/setup.ts`, pinned dev dependencies as in `packages/ui-web`, `vitest.config.ts` added to the `tsconfig.json` include). Then `src/shell/` with `AppShell` (it renders the `div.toast-anchor` from this step; `ToastProvider` arrives in step 4), `derivePane`, `NavSection`, `WorkspaceHeader`, `SearchBox`, `UserCard`, `shell.css` (Tables C to E for Calm and Focus); `apps/web/src/shell/sections.ts`, `routes/app-layout.tsx`, the new parent of the index route in `router.tsx`; `nav.mainLabel` in both catalogs and the count test. The export list test uses the type-import tuple pattern of `components/exports.test.ts` for `AppShellProps` and `PaneName`, and each step adds its own names; `shell.css.test.ts` grows by table per step and its "no other rule" check closes at step 5.
3. **Narrow layout and bottom bar.** `BottomTabs`, `useNarrow`, Table G rules and `--tabh`, pane switching and focus move (R22, R29).
4. **Panel overlay, navigation scroll, toast places.** Table F rules, the 240 px column floor (concern 1, decided), `ToastProvider` with the anchor on `main` and the bar as an obstacle (R23 to R25).
5. **Frames.** `SidePanel`, `SectionPage`, `TabList` and `Tab` with the keyboard of R14; pane bodies as flex columns (R15).
6. **Fixture and browser test.** `shell-fixture.html`, `src/shell-fixture/main.tsx`, `tools/check-no-dev-pages.mjs` chained into the `apps/web` build, `e2e/app-shell.spec.ts`.
7. **Wiring check.** The layout route renders in `en` and `vi`; `/` shows the shell; the sample test of TOKI-008 keeps passing.
8. **Verify.** All commands of R35; the by-eye comparison table and the screen reader pass are recorded in the PR description (they are not machine checks).

## Out of this plan

The by-eye comparison and the iPhone look (concern 16, before M1 closes) are done by the Dev; the plan only produces the places to look.
