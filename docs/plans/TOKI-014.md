# TOKI-014 Overlays: plan

Ticket: TOKI-014 (issue 39). Branch: `feat/toki-014-overlays`. Tier: L.
Spec (the source of truth, merged with the decisions of 2026-11-18, PR 134): `docs/specs/2026-11-16-overlays-design.md`.
Requirements are named `R1` to `R34`, tables `A` to `D`, as in the spec. This plan does not copy the requirements or the tables; the tests type the tables in from the spec.

## Design

The spec is the design (as in the plan of TOKI-012). It was approved when PR 134 merged. This plan adds only what the repository and the order of work change.

Build order (the order of concern 12; stop after any step if needed):
overlay layer, Modal, Sheet, Menu with its hook, examples, then the checks of R28 and R29 in a browser.

### Decisions taken in this plan (differences from the spec, or gaps it leaves)

1. **TOKI-013 (Toast) is not on `main`.** `Toast/Toast.css` does not exist, so the part of the R28 test that reads `.toasts` is skipped, not failed (the spec says so). `ToastRegion` does not carry `data-layer-skip` yet (R34 asks it of TOKI-013); the R34 test uses a stand-in element. Neither is changed here (R1).
2. **TOKI-016 (preview page) is not on `main`.** The browser checks of R29 use a throw-away page that imports `@toki/ui-web/examples`; it is not committed. The record goes in the PR description, one line for each width.
3. **`lint:boundaries` does not exist** (TOKI-002 dropped it; see the plan of TOKI-012, decision 2). R31 is checked with `pnpm lint`, the import scan in the tests, `pnpm typecheck`, `pnpm format:check` and the package tests.
4. No dependency is added (Scope). The package tests run with `corepack pnpm --filter @toki/ui-web test` under Node 22.
5. **StrictMode** (`apps/web/src/main.tsx` uses it; React 19 runs each effect twice on mount). The opener and the stack order are stored in a ref, set once for each false-to-true change of `open`, and cleared only when `open` turns false, not in every cleanup. A test of Modal and one of Menu run inside `<StrictMode>`.
6. **Effects depend on `[open]` only.** Handlers (`onRequestClose`, `onClose`) are read through a "latest" ref, so an owner that re-renders with an inline handler does not release and retake the lock and the isolation or pull focus back. Test: the owner re-renders while focus is in a second input, and focus stays there.
7. **A dialog moves focus in only when it is the topmost layer** (a gap in R11: a Menu that opens in the same commit as its parent Modal runs its layout effect first and would lose focus to the Modal). The stack entry also holds `getNode()`, so the trap's `focusin` rule (R12) can tell "inside a layer above it".
8. **R33 is tested by the order of calls**, not by focus: jsdom does not blur an element that becomes inert. The test spies on the four helpers (record opener, lock, isolate, focus) and asserts that order. The close half is also tested by `activeElement`, which jsdom does set to `body` when a focused node is removed.
9. **`focus.ts` has `canFocus(el)`** (connected, and no `display: none` or `visibility: hidden` on it or an ancestor, read with `getComputedStyle`), because jsdom ignores visibility in `focus()`. The hidden-opener and hidden-anchor tests of R13 and R22 use it.
10. **jsdom limits.** `isolate.ts` uses `setAttribute`, `getAttribute` and `removeAttribute` for `inert` (jsdom has no `inert` property). In R34, jsdom asserts the attributes and that `getByRole` finds the region; "announced" is checked by hand with the screen readers of step 8. The "outside" test of R8 uses `pointerdown` and `pointerup` targets, not `click`.
11. **Types.** `ModalProps` omits the HTML `title` attribute before adding its own; `anchorRef` and `returnFocusRef` are `RefObject<HTMLElement | null>` (React 19). The R27 walk looks at host elements only, so `<Dialog title={title}>` does not trip it.
12. **Shared files.** `examples.ts`, `components/index.ts` and `examples.test.tsx` also change in TOKI-013; whichever merges second rebases them. The existing `folders (R31)` test of `examples.test.tsx` requires, for each folder of `components/`, an `export *` line, a `<Name>.examples.tsx` and a `componentExamples` entry, so each component step adds those three (steps 2 to 4), and step 6 only adds the R30 checks. `sources.test.ts` does not scan these folders: step 5 adds an import scan (R3, R31) over `Menu`, `Modal`, `Sheet` and `internal/overlays`.
13. The CSS files are written in the order of the tables (`expectCssTable` compares in order).

## Steps

Each step starts with its test file, run and seen to fail for the right reason, then the code.

1. **Layer helpers** in `packages/ui-web/src/internal/overlays/`: `stack.ts` (stack, counter, Esc listener, handled-press `WeakSet`), `focus.ts` (tabbable list, move focus), `scrollLock.ts`, `isolate.ts` (with `data-layer-skip`), each with its test next to it (R4, R9, R10, R12 helper part, R14, R15, R34).
2. **Dialog and Modal**: `Modal/Dialog.tsx`, `Modal.tsx`, `Modal.css`, `index.ts`, `Modal.test.tsx`, `Modal.examples.tsx` (its five ids), the index line and the `componentExamples` entry (decision 12). Cases that need a Menu (R9 stack of three, R10, R14 with a Menu, R15 with a later Menu) wait for step 4. Open and close order of R33, focus in, trap, return, `onRequestClose` reasons, forms (a) and (b), types of R32 for Modal (R2, R3, R5, R7 to R9, R11 to R16, R33, R34).
3. **Sheet**: `Sheet/Sheet.tsx`, `Sheet.css`, `index.ts`, `Sheet.test.tsx`, `Sheet.examples.tsx` (two ids), the index line and the entry (R6, Table B).
4. **Menu**: `menuPlace.ts` (`computeMenuPosition`), `Menu.tsx`, `MenuItem.tsx`, `MenuGroup.tsx` (with `MenuSeparator`), `useMenuTrigger.ts`, `Menu.css`, `index.ts`, `Menu.test.tsx`, `Menu.examples.tsx` (six ids), the index line and the entry; then the Menu cases deferred from step 2 and R21's handler that opens a Modal (R9, R10, R14, R15, R17 to R24, Table C and D).
5. **CSS tests, rules and scan**: one table test per CSS file (R25), the walk for R26, R27, R28 (the `Toast.css` part skipped while it does not exist), and the import scan of decision 12 (R3, R31).
6. **Examples and exports checks**: the 13 ids, the map of R30, the open-and-Esc checks in `examples.test.tsx`, and the export names in `exports.test.ts` (R1, R30). The files themselves came with steps 2 to 4.
7. **Checks**: `pnpm --filter @toki/ui-web test`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, each exit 0 (R31, R32).
8. **Browser checks** on a throw-away page, in Calm and Focus, at 360 x 560, 719, 720, 1099 and 1100 px (R28, R29, Testing). Results go in the PR description. Screen readers (concern 5): done by hand by the owner; the PR says what was and was not run.

## Files outside the code

- `docs/plans/TOKI-014.state.json`: the state file of the dev flow (`dev-state`).
- No lockfile change (no dependency).

## AC -> step -> test

| Requirement | Step | Test |
| :-- | :-- | :-- |
| R1 names and files | 6 | `exports.test.ts`, each folder has its five files |
| R2 conventions (`ref`, `className`, owned attributes) | 2, 3, 4 | the three component tests |
| R3 no text, no `@toki/i18n` | 2, 3, 4 | empty-text render; import scan |
| R4 nothing left when closed | 1, 2, 4 | listener spies, `body` children, `inert`, lock |
| R5, R6 DOM of Modal and Sheet | 2, 3 | `Modal.test.tsx`, `Sheet.test.tsx` |
| R7, R8 props, close reasons | 2 | `Modal.test.tsx` (Esc, close button, scrim press and release) |
| R9 Esc order, IME | 1, 4 | `stack.test.ts`; three layers, three presses; `isComposing`, `keyCode` 229 |
| R10 one press, one layer | 4 | `stack.test.ts`; Menu over Modal |
| R11 to R13 focus in, trap, return | 1, 2 | `focus.test.ts`; `Modal.test.tsx` |
| R14 scroll lock | 1, 2, 4 | `scrollLock.test.ts`; two dialogs and a Menu |
| R15, R34 opaque backdrop, toast region | 1, 2, 4 | `isolate.test.ts`; stand-in region |
| R16 dialog that cannot be dismissed | 2 | `Modal.test.tsx`, both forms |
| R17 to R22 Menu, items, keys, choosing, closing | 4 | `Menu.test.tsx` |
| R23 position | 4 | `menuPlace.test.ts`; one DOM test with a mocked rectangle |
| R24 `useMenuTrigger` | 4 | `Menu.test.tsx`; type test on three elements |
| R25 CSS equals tables | 5 | one table test for each file |
| R26, R27 CSS rules | 5 | CSS walk |
| R28 z-order | 5, 8 | CSS walk (three values); `elementFromPoint` in a browser |
| R29 narrow screens | 8 | browser, widths listed in the spec |
| R30 examples | 6 | `examples.test.tsx` |
| R31 boundaries and checks | 7 | commands exit 0; import scan |
| R32 types | 2, 3, 4, 7 | `@ts-expect-error` lines, `pnpm typecheck` |
| R33 order of steps | 2 | spy on the four helpers (decision 8); opaque over dim; StrictMode run (decision 5) |

## What can break

Riskiest step: step 2, the open and close order of R33 and the focus return (R13). The browser blurs a focused element that becomes inert, and focus goes back only after React removes the portal. Guard: write the R33 test before `Dialog.tsx`, as a test of the order of calls (decision 8), plus a run inside `<StrictMode>` (decision 5), where a second mount would record the wrong opener.

Next: the Esc stack (R9). Effects of a child run before its parent's, so a Menu inside a Modal must take its order from a counter read at first render, not from effect order, and the Modal must not take focus from it (decision 7). Guard: the test of a Menu that opens in the same commit as its parent Modal.

Next: R10 with React's own listeners. A bubble-phase listener would run after the scrim's handler. Guard: capture phase on `document`, test with a Menu over a Modal.

jsdom limits: no layout, no `showModal`, no `inert` behaviour for focus, no accessibility tree (decisions 8 to 10). The tests set attributes and read them; what jsdom does not model is covered by step 8 in a real browser.
