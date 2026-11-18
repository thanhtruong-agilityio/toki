# TOKI-012 Base components, group 1: plan

Ticket: TOKI-012 (issue 34). Branch: `feat/toki-012-base-components-group-1`. Tier: M.
Spec (the source of truth, merged with the decisions of 2026-11-18): `docs/specs/2026-11-16-base-components-1-design.md`.
Requirements are named `R1` to `R31`, tables `A` to `K`, as in the spec; this plan does not copy the tables, the tests type them in from the spec.

## Design

The spec is the design. This plan adds only what the repository and the order of work change.

Build order (the order of concern 12, stop after any step if needed):
base CSS, Button, IconButton; Chip, Switch, Tag, Badge; Field and Select; examples; the lint rule; the wiring in `apps/web`.

### Decisions taken in this plan (differences from the spec)

1. **TOKI-010 (fonts) and TOKI-011 (icons) are not on `main`** (the spec lists them as needs, concern 5; the owner chose to start without them on 2026-11-18).
   - `IconButton` needs `Icon` and `IconName`. Until TOKI-011 merges, `src/internal/icon-stand-in.tsx` exports a small `Icon` (one `svg` with class `ic`, `aria-hidden`) and `IconName` (a string union of the few names the examples use). `IconButton` and `Field` import only from this file. When TOKI-011 merges, one change swaps the import to the real icons and deletes the file. No export of the package ends in `Icon` because of this file (it is not exported from `index.ts`).
   - The `body` text rule and the form-control font rule that TOKI-010 owns are left out of `base.css` until it merges. Table J lines that depend on them are marked in the test with a comment and added back by TOKI-010's ticket or a follow-up. The lint rule needs no real icons: it reads import specifiers only.
   - The PR says this in its description so a reviewer sees the gap.
2. **The fixture check of R25 no longer exists.** TOKI-002 dropped `tools/lint-fixtures/`, `check.mjs` and `pnpm lint:boundaries` (its plan, concern 13). The lint rule is therefore proved by a test of its own:
   `tools/lint-rules/icon-only-button-name.test.mjs`, run with `node --test` (as `tools/bundle-size/check.test.mjs` is), added to the root `test` script. It uses ESLint's `Linter`/`RuleTester` with the 36 cases of Table K (21 reported, 15 not) and `calculateConfigForFile` for the two real paths (rule at `error`, inline configuration off). `disabled.tsx` becomes a case that checks an `eslint-disable` comment is reported and the line still is.
3. **Where the rule lives.** The existing local rules are in `tools/lint-rules/*.js`, registered inline as the `toki` object of `eslint.config.js`. The new rule is `tools/lint-rules/icon-only-button-name.js`, added to that object. The spec's `tools/eslint-rules/index.js` is not created.
4. Versions of `jsdom`, `@testing-library/*`, `postcss` are looked up when the dependencies are added and pinned exactly; Vitest is `5.1.0`, as in `packages/tokens`. `packages/platform` exists on `main`: if it pins `jsdom`, that version is used (R27).

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :-- | :-- | :-- |
| R27 test set-up | 1 | `src/test/setup.test.tsx`: renders a component twice in two tests, finds it once with `getByRole` |
| R9 base.css, exports | 2 | `src/styles/base.test.ts`: Table J against `base.css`, `package.json` exports, `src/index.ts` imports no CSS |
| R4, R5, R8, R10, R11 Button | 2 | `Button.test.tsx` (DOM, keys, disabled), `Button.css` table C and I through `readCss` |
| R12 IconButton | 2 | `IconButton.test.tsx`, Table D |
| R13 Chip, ChipGroup | 3 | `Chip.test.tsx`, Table E |
| R14 Switch | 3 | `Switch.test.tsx` (`onChange(!checked)` once, Space, Enter, disabled, `labelledBy`), Table F |
| R19, R20 Tag, Badge | 3 | `Tag.test.tsx`, `Badge.test.tsx` (`sr` label, `aria-hidden`), Table G |
| R15 to R18 Field, Select | 4 | `Field.test.tsx`, `Select.test.tsx` (three forms, id, error, `aria-describedby` order, one message, `disabled`/`readonly` classes), Table H |
| R1, R2, R3 | 2 to 4 | `src/components/exports.test.ts`: names, constants, `className` order, owned attribute wins, `ref`, empty `textContent`, no `@toki/i18n` import |
| R6, R7, R21 | 5 | `src/components/css-rules.test.ts` walks the eight CSS files; a source scan for `tabindex` and `outline` |
| R26, R31 | 5 | `src/examples.test.ts`: each list value has an example, ids unique, nine selectors match, folder has a line, examples file and entry |
| R22, R23, R24, R25 | 6 | `tools/lint-rules/icon-only-button-name.test.mjs`: Table K, 36 cases; real-path config check |
| R28 | 5, 6 | `pnpm lint`, `pnpm typecheck`, `pnpm format:check` exit 0; boundary rules still pass |
| R29 | 7 | `src/styles/order.test.ts`; `pnpm --filter ./apps/web build` and `typecheck` |
| R30 type errors | 2 to 4 | the `// @ts-expect-error` lines in each component test; `pnpm typecheck` |

## Steps

1. **Package set-up.** Add dev dependencies and `vitest.config.ts` (jsdom, `setupFiles`), `src/test/setup.ts`, `src/test/css.ts` (`readCss`), `src/internal/cx.ts`, `src/internal/example.ts`, `src/internal/icon-stand-in.tsx`, a `test` script. Test first: the two-render cleanup test fails before `setup.ts` exists.
2. **base.css, Button, IconButton.** `src/styles/base.css` (Table J), the two `exports` entries, `components/index.ts`, the line in `src/index.ts`. Each component with its CSS, tests typed from Tables C, D, I.
3. **Chip and ChipGroup, Switch, Tag, Badge.** Tables E, F, G, I.
4. **Field and Select.** `FieldFrame.tsx` (label, id, error shared); Table H, I. The three forms of R15 and the type errors of R30.
5. **Examples and cross-file tests.** `<Name>.examples.tsx` for each component, `src/examples.ts`, the R6, R7, R21, R26, R31 tests.
6. **Lint rule.** Cases of Table K first, seen failing; then `icon-only-button-name.js`, the block of R24 in `eslint.config.js` (one block, `noInlineConfig: true`), the `test` script. Then `pnpm lint` over the whole repo.
7. **Wiring in `apps/web`.** Two dependencies and two imports in `main.tsx`, after the `fonts.css` import if it exists (TOKI-010 not merged: the three-import order is checked with the imports that exist), then `order.test.ts`, build, typecheck, bundle size.
8. **Verify.** Run `pnpm --filter @toki/ui-web test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, root `pnpm test`, `pnpm --filter ./apps/web build`.

## What can break, and the riskiest step

- **Riskiest: step 6 (the lint rule).** 36 cases with fine rules (conditional children, aliased imports, namespace imports, spread, `title` not a name). A wrong rule either lets an unnamed button through or reports a correct one, which teaches people to disable it. Mitigation: all 36 cases are written before the rule; the rule does not report when it cannot tell (spec); the block of R24 is checked on the real paths; the rule is run over the whole repo so a false report on existing code is seen. `noInlineConfig` on `apps/web/src` could make a later `eslint-disable` a failure (concern 18, accepted).
- **Step 7.** The `main.tsx` import order and the bundle limit. Mitigation: `order.test.ts`, the build's size check.
- **CSS typed from the spec, not from the prototype** (concern 11): the tests prove CSS equals the spec only. The look comparison against the prototype by hand (Testing, last two bullets) needs the prototype at `docs/blueprint/prototype/index.html`, which is not in this checkout; it is left to the owner and said so in the PR.
- **Prop typing (R30).** Conditional types for `Field`, `Button`, `Switch` are easy to get wrong; each rule has its `@ts-expect-error` line, and an unused one is an error.
- **Swapping the icon stand-in** later changes names in `IconButton` and `Field`; kept to one file by design.

## Not done by this ticket

The by-hand look comparison and the screen-reader pass (Testing); the `body` and form-control font rules of TOKI-010; the real icons of TOKI-011.
