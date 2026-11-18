# TOKI-013 Base components, group 2: plan

Ticket: TOKI-013 (issue 32). Branch: `feat/toki-013-base-components-group-2`. Tier: M.
Spec (the source of truth, with the decisions of 2026-11-18): `docs/specs/2026-11-16-base-components-2-design.md`.
Requirements are named `R1` to `R34`, concerns `1` to `16`, as in the spec; this plan does not copy them, the tests type their values in from the spec.

## Design

The spec is the design. This plan adds only what the repository and the order of work change.

Build order (concern 16, stop after any step if needed):
Avatar and PresenceDot; EmptyState; Toast, provider and timers; the placement (R27 to R29, R31); the on-screen keyboard (R34); examples and cross-file checks.

### Decisions taken in this plan (differences from the spec)

1. **TOKI-012 is not on `main`.** Its pull request (#136) is In Review. This branch is cut from its head and merged with `main` (which holds the spec decisions), and the pull request of this ticket targets `feat/toki-012-base-components-group-1` until #136 merges, then its base is changed to `main`. The files this ticket needs from TOKI-012 (`src/test/setup.ts`, `src/test/css.ts`, `src/internal/cx.ts`, `src/internal/example.ts`, `components/index.ts`, `base.css`, the `Example` type, `src/examples.ts`) are used as they are and not edited, except the one line each in `components/index.ts` and `src/examples.ts` that the spec asks for. If #136 changes them before it merges, this branch merges the change (no rebase).
2. **Group-1 cross-file tests walk the folders.** `components/sources.test.ts` reads every folder of `components/` except Menu, Modal and Sheet, so the four new folders are checked for the shared rules (R3, R6, R7, R21 of TOKI-012) without an edit. `components/exports.test.ts` lists names; this ticket adds its own `exports-group2.test.ts` for the names of group 2 instead of editing TOKI-012's file.
3. **No new dependency.** `window.visualViewport`, `ResizeObserver` and `getBoundingClientRect` are stubbed in tests (jsdom has none of the first two).

### Changes made during the build (recorded after verifier round 1)

- `components/sources.test.ts` (TOKI-012's cross-file check of its R6) now skips the four group-2 CSS files: their rules hold `hsl(var(--h) ...)`, the density size `--av`, the names `--h` and `--s` and the Toast's one look selector, which R6 of TOKI-012 bans for its eight components. The group-2 rules (TOKI-013 R1, R3, R20) are checked by the new `components/sources-group2.test.ts`. This is the one edit to a TOKI-012 file besides the index and examples lines. It replaces decision 2 where it says the four folders are checked "without an edit".
- The tests for `computeToastBottom`, `computeToastExtent` and the placement hooks are in `Toast.test.tsx`, not in separate files, because R1 allows one test file per folder. `components/exports-group2.test.tsx` (not `.ts`) holds the export check and the example checks of R30.
- `ToastProvider.tsx` holds a registry (the avoided elements, the anchors, one `ResizeObserver`) next to the timers; the region subscribes to it. Registration listens to `transitionend` and `transitioncancel` of the element it was given when it registered.
- Files added that the steps did not name: `docs/plans/TOKI-013.state.json` and the lines of `src/examples.ts` and `components/index.ts`.
- Known and not covered by a test: an element swapped under the same ref after it registered keeps the old listeners; a second click of the Undo button in the same tick (React flushes discrete events at once).

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :-- | :-- | :-- |
| R1 folders, exports | 1 to 3 | `src/components/exports-group2.test.ts`: names `Avatar`, `getInitials`, `PresenceDot`, `presenceStates`, `EmptyState`, `Toast`, `ToastProvider`, `useToasts`, `ToastRegion`, `useToastAvoid`, `useToastAnchor`; `src/index.ts` re-exports them and was not edited |
| R3, R4, R5 shared rules | 1 to 3 | `Avatar.test.tsx`, `PresenceDot.test.tsx`, `EmptyState.test.tsx`, `Toast.test.tsx`: `className` order, owned attributes win, `ref`, no text of its own, no `@toki/i18n` import |
| R6, R8, R12 Avatar | 1 | `Avatar.test.tsx`: markup, `--h`, `--s`, caller `style` merged, `aria-*` and `title` removed; people and hues of the spec's Testing; hue and size edge values |
| R7 `getInitials` | 1 | `Avatar.test.tsx` table: the names of the spec, `"Ông Ba"` (asserts the input's first code point is `O`), `ß Test`, astral letter, one, three words, leading and double spaces, empty and blank |
| R9, R10 Avatar CSS, `presence` wrapper | 1 | `Avatar.test.tsx`: wrapper `pdw`, dot as second child, `--h` and `--s` stay on `.av`; `readCss` compares the declaration lists |
| R11, R13, R14 PresenceDot | 1 | `PresenceDot.test.tsx`: three states, `label` on and off (`role="img"`, `aria-label`, `aria-hidden`), `presenceStates`, CSS table |
| R15, R16, R17, R18 EmptyState | 2 | `EmptyState.test.tsx`: order of children, `icon` type, `action` on and off, `filtered` gives `role="status"` and none otherwise, caller `role` dropped, `title` and `children` omitted from the props type (`// @ts-expect-error`), CSS table. R17 centring: checked by hand in a browser |
| R19, R20, R24 Toast | 3 | `Toast.test.tsx`: no `role`, span and button, `type="button"`, ref; press removes the toast before `onPress`, once; CSS table |
| R21, R22, R26 provider, region | 3 | `Toast.test.tsx` with fake timers: region exists with no toast, `aria-live="polite"`, error outside a provider that names `ToastProvider`, stable `show` and `dismiss`, a caller renders once for three toasts, no React warning after unmount |
| R23 timers and pause | 3 | `Toast.test.tsx`: 4999 and 5000 ms with a button, 2799 and 2800 ms without; the timer stops on pointer enter and on focus in, restarts with the full time on pointer leave and on focus out |
| R25 order and cap | 3 | `Toast.test.tsx`: order of three toasts; a fourth removes the oldest without calling `onPress` and clears its timer, also when the oldest has an `action`; equal texts are not merged |
| R27 `computeToastBottom` | 4 | `toastPlace.test.ts`: the table of the spec's Testing (no obstacle 20, bar 76, two obstacles, below the window, `NaN`, no width, small clearance, span overlap by 1 px, touching) |
| R31 `computeToastExtent`, anchor | 4 | `toastPlace.test.ts`: 331.2 at 360 px, 276 for an anchor 300 wide; `Toast.test.tsx`: inline `left` and `width` follow an anchor stub |
| R28 `useToastAvoid` | 4 | `Toast.test.tsx` with stubs for `getBoundingClientRect` and `ResizeObserver`: `bottom` follows a registered element, changes on a new size, falls back to 20 when it is removed or has height 0, changes after `transitionend` and after a toast is added, works with no `ResizeObserver` |
| R29 placement in a browser | 4 | by hand on a temporary page (not committed): 360, 720, 800, 1099, 1100 px, both looks; result and one screenshot in the PR |
| R32, R33 narrow rule, focus ring | 3 | `Toast.test.tsx` CSS table: the `@media (max-width: 719px)` block and `.toast button:focus-visible` |
| R34 keyboard | 5 | `Toast.test.tsx` with a `window.visualViewport` stub: `bottom` is the larger of the R27/R28 value and `covered + 20`, in both orders, follows `resize` and `scroll`, unchanged when `visualViewport` is undefined. By hand once on a phone or an emulator |
| R30 examples | 6 | TOKI-012's `src/examples.test.tsx`: each folder has an examples file and a `componentExamples` entry (it fails before the entries exist) |
| Both looks match | 1 to 3 | `readCss` tests compare the declarations with the spec's requirements; by-eye comparison with the prototype goes in the PR |

## Steps

1. **Avatar and PresenceDot.** `components/Avatar/` (`Avatar.tsx`, `getInitials.ts`, `Avatar.css`, test, examples, `index.ts`) and `components/PresenceDot/`. Tests first and seen to fail. One line each in `components/index.ts`.
2. **EmptyState.** `components/EmptyState/`, with `filtered`. Icon names come from TOKI-011's `IconName`.
3. **Toast, provider and timers.** `components/Toast/` with `Toast.tsx`, `ToastProvider.tsx` (list, timers, pause, cap of three, `useToasts`), `ToastRegion.tsx`, `Toast.css`. Placement is not built yet: the region sits at 20 px (concern 8 describes this state).
4. **Placement.** `toastPlace.ts` (`computeToastBottom`, `computeToastExtent`, constants), `useToastAvoid`, `useToastAnchor`, the measuring times of R28, merged `ref` in the region. Then the browser check of R29 on a temporary page.
5. **Keyboard.** R34 on top of step 4.
6. **Examples and entries.** `<Name>.examples.tsx` for the four, four entries in `componentExamples` after those of group 1.
7. **Verify.** `pnpm --filter @toki/ui-web test`, root `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm --filter ./apps/web build`. The manual checks of R17, R29, R34 and the screen reader check of concern 15 are written in the PR.

## What can break, and the riskiest step

- **Step 4, placement.** The region measures other components; a wrong measuring time shows only in a browser. The tests use stubs, so the manual check of R29 is not optional. A change in size of a registered element and a `transform` on it (a bar that hides itself) are the two cases that fail without the `transitionend` and toast-added measurements.
- **Timers and pause.** Pause and restart are easy to get wrong with fake timers: a timer must not fire after the pointer entered, and the cap of three must clear the removed toast's timer.
- **R34 with R28.** The keyboard value is a maximum, not a sum; the test with both an obstacle and a keyboard guards it.
- **Dependency on #136.** If #136 changes `src/test/css.ts`, `Example` or `components/index.ts`, this branch needs a merge. Checked before the pull request is opened.
- **Size.** The ticket is likely to run over M; the build order allows a stop after any step, and the PR then says which steps are left.

## Grilling (M, one round)

- *Does a toast with an `action` pause too?* Yes, concerns 1 and 2: the rule is for every toast (R23).
- *What does the cap do to an Undo toast?* The oldest is removed without `onPress`; accepted in R25, and the caller (TOKI-093) must not rely on a 5 s stay.
- *Is anything built that a later ticket should own?* No text keys (R3), no `presence` namespace, no hue source (concern 5): the accounts and People tickets apply it.
- *What if `ResizeObserver` or `visualViewport` is missing?* The hooks fall back to the window events, and `covered` is 0 (R28, R34).
