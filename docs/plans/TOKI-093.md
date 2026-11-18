# TOKI-093 Destructive-action and unsaved-form patterns: plan

Ticket: TOKI-093 (issue 57). Branch: `feat/toki-093-destructive-patterns`. Tier: M.
Spec (the source of truth): `docs/specs/2026-11-16-destructive-patterns-design.md`.
Requirements are named `R1` to `R24`, concerns `1` to `14`, Tables A to C, as in the spec; this plan does not copy them, the tests type their values in from the spec.

## Design

The spec is the design (ConfirmDialog, Table A, the Undo helper, the form guard, Texts). This plan adds only what the repository and the order of work change.

- Needs: TOKI-014 (`Modal`) and TOKI-017 (`@toki/i18n`) are not on `main` yet (PR #145 for TOKI-014 is open). This branch holds `main` plus a merge of `feat/toki-014-overlays` and `feat/toki-017-i18n-package`. The pull request is opened only against a base that has both, or after both are merged; the merges are then no-ops.
- TOKI-016 (preview page) is not here, so `apps/web/src/preview/references.ts` does not exist. The `ConfirmDialog` key of R9 is not added; it is left for TOKI-016, which the spec allows ("whichever lands second").
- `common` namespace: it does not exist in `packages/i18n` yet, so this ticket creates it with the ten keys (R24).
- `apps/web` has no `test` script, no Vitest, no jsdom and no `@toki/i18n` dependency (R2). Versions of the testing devDependencies are copied from `packages/ui-web`. `apps/web/vitest.config.ts` and `src/test/setup.ts` mirror those of `ui-web`; the root `test.projects` glob (`apps/*`) already picks them up.
- Rules already in force that shape the code: `ui-web` sources import no `@toki/*` package (so no i18n in `ConfirmDialog`); `ConfirmDialog.css` is checked by `sources.test.ts` (no colour literal, only known tokens, no `font-family`, no `opacity:0`); `Modal` spreads `...rest` and `className` onto its panel, so `className="cfm"` and `aria-describedby` are ordinary props; `Modal` never closes itself.
- Build order of concern 14: 1 table and texts, 2 `ConfirmDialog` and `ConfirmAction`, 3 `useUndo` with the gate, 4 the guard. Each step ends green.

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :---- | :---- | :---- |
| R2 | 1 | `pnpm --filter @toki/web test` runs a smoke test under jsdom; the commands of R2 on the finished branch |
| R10 | 1 | `actions.test.ts`: copy of Table A (18 rows) compared with `actionPatterns`; `owner` matches `^TOKI-\d{3}$` |
| R11 (a), (b) | 1 | `actions.test.ts`: the three sets are disjoint and cover `ActionId`; `// @ts-expect-error` on a confirm id to `run` and an undo id to `ConfirmAction` (written in steps 2 and 3, where the helpers exist) |
| R24 | 1 | `common.test.ts` in `packages/i18n`: ten keys and both texts compared with a copy of Table B; `pnpm i18n:check` |
| R1, R3, R8 | 2 | `ConfirmDialog` exports test; import and empty-text scan (`textContent` with empty props and a one-character target); CSS test against Table C with `readCss` |
| R4, R5 | 2 | `ConfirmDialog.test.tsx`: markup (class `cfm`, `aria-describedby`, one `.mbd` and one `.mft`, footer a sibling of the body, no close button, button order, `danger` and `primary`); target cases (`An` with `Any member can ...`, title holding the target, blank and white-space throw in test, `vi.stubEnv` DEV false gives nothing and `console.error`) |
| R6, R7 | 2 | first focus on Cancel; Esc, outside press and Cancel give `escape`, `outside`, `cancel`; confirm once; `busy`: both disabled, Esc and outside ignored, `aria-busy`, focus on the panel |
| R9 | 2 | the examples tests of TOKI-012 R26 and R31 with the new folder; a test renders each of the five examples and presses its button |
| R11 (c), (d) | 2, 3 | cast the id: `ConfirmAction` throws in render, `run` throws synchronously with no promise, message holds id and pattern; source scan of `apps/web/src` outside `patterns/` for a `ConfirmDialog` import from `@toki/ui-web` |
| R17, R18 | 3 | `setConnectionCheck` with `true`, `false`, a throwing function and `null` (default with `navigator.onLine` stubbed); `ensureOnline()` and `ensureOnline("undo")` show their own texts; `ConfirmAction` offline: no `onConfirm`, dialog open, toast shown; online: `onConfirm` once; every `ConfirmActionId` shows its target |
| R12 to R16 | 3 | `useUndo.test.tsx` with fake timers, as listed in the spec's Testing section: order of `perform` and `show`; failing `perform`; offline `"blocked"`; Undo calls `undo` once; offline Undo; failing `undo`; 4999 and 5000 ms; `key` dismisses the earlier toast; 60 keys leave at most 50 entries; `run` keeps its identity; unmount keeps Undo working; source scan finds no timer call in `useUndo.ts` |
| R19 | 4 | `formContent.test.ts`: the table of values of the spec |
| R20 to R23 | 4 | `useFormGuard.test.tsx` with a form `Modal` holding an input: no content closes at once for each reason; with content an outside press does nothing, Esc and close ask, Cancel asks; `GUARD_ESCAPE` `"ignore"` through `vi.mock`; Keep editing returns focus to the last focused field, also when `body` has focus; Discard calls `onClose("discard")` once; first Esc closes the question only; unmount leaves no extra child and no `inert` |
| R1 | 4 | `patterns/index.test.ts`: every name of R1 is exported |

## Steps

1. `apps/web`: add devDependencies and `@toki/i18n`, `test` script, `vitest.config.ts`, `src/test/setup.ts`, `tsconfig` include; `pnpm install`. Create `common` in both languages and list it in both `index.ts`. Write `patterns/actions.ts` with its test.
2. `ConfirmDialog` folder (tsx, css, tests, examples, index), one line in `components/index.ts`, one entry in `examples.ts`, add the names to the exports tests. Then `patterns/ConfirmAction.tsx` and `patterns/online.ts` with `useOnlineGate.ts` (the gate is needed by the action first).
3. `patterns/useUndo.ts` on `useToasts` and the gate; `key` map in a `ref`.
4. `patterns/formContent.ts`, `patterns/useFormGuard.tsx` (uses `ConfirmDialog` through `ConfirmAction`-free path: the discard question is a `ConfirmDialog` rendered inside `patterns/`, which R11 (d) allows), `patterns/index.ts`.
5. Run `pnpm --filter @toki/web test`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check`, `pnpm i18n:check`. By eye on 360 px: needs the preview page (TOKI-016); recorded in the PR as not checked if it is not there.

## What can break, and the riskiest step

- Riskiest step: 4, the guard. Focus return when `body` has focus (the Safari case) is not reproducible in jsdom by a real mouse press; the test sets `document.activeElement` to `body` by hand. The `trackFocus` handler uses `onFocusCapture` on the fields wrapper, so a `focusin` that bubbles from a nested field is recorded; the test focuses a field, blurs to `body`, closes, and checks the field regains focus through `returnFocusRef`.
- Step 2: the `busy` focus move happens "in the commit in which `busy` turns `true`" (R7); an effect keyed on `busy` that focuses the panel through the `Modal` ref does this, a test with `rerender` checks `document.activeElement`. If `Modal`'s trap pulls focus back to the disabled button first, order matters; the test will show it.
- Step 2: `target` blank throws only when `import.meta.env.DEV` is true; `vi.stubEnv("DEV", false)` must reach the module (the value is read at render, not at import).
- Step 3: `run` must throw synchronously for a wrong id, so it cannot be an `async` function; it checks the id, then returns a promise from an inner async function. A test checks that nothing was returned when it throws.
- Step 3: the Toast gives no callback on expiry (R15), so the `key` map keeps dead entries; the cap of 50 is the only bound.
- `ui-web` rule: `sources.test.ts` forbids `title=` and `tabindex` attributes and `@toki/*` imports in `ui-web` sources; `ConfirmDialog` uses none.
- Two Esc layers: the discard `ConfirmDialog` opens over the form `Modal`; TOKI-014's layer stack makes the first Esc close only the top one. If the stack test of TOKI-014 does not hold for a `ConfirmDialog` rendered beside the form (not inside it), R22 fails; the spec says to render it beside.
- Lockfile: `pnpm-lock.yaml` changes with the new devDependencies and conflicts with TOKI-014 and TOKI-017 branches are possible on rebase; resolve by `pnpm install`, not by hand.
- Roll back: delete the new folders, the `common` files and the `apps/web` test set-up; nothing else imports them.

## Grilling (M, one round)

- "Can the dialog and its helpers be built before TOKI-014 and TOKI-017 are on `main`?" Yes, on a branch that holds both; the PR waits for them. Decided with the Dev at the start of this work.
- "Is the `ConfirmDialog` key of `references.ts` required for a green build here?" No: the file belongs to TOKI-016, which is not in this tree. Left out and named in the PR.
- "Does the discard dialog break R11 (d), which forbids `ConfirmDialog` outside `patterns/`?" No: the guard lives in `patterns/`.
- "Are the Vietnamese texts final?" No, proposals (concern 4); changed in the catalogue.
- "Is the 360 px check possible?" Only with the preview page; if TOKI-016 is not merged by the time of the PR, the PR says it was not done.
