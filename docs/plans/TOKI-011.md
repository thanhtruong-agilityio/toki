# TOKI-011 Icon set: plan

Tier S. Spec: `docs/specs/2026-11-16-icon-set-design.md` (source of truth). Branch: `feat/toki-011-icon-set`.

## Steps

1. `packages/ui-web/package.json` and `tsconfig.json`: dependencies, `sideEffects`, `test` script, `jsx`, the DOM lib and `types: ["node"]` (the test reads files) (R11, R12). Versions: react `19.3.1`, react-dom `19.3.1`, `@types/react` `19.3.0`, `@types/react-dom` `19.3.0` (lockfile pins of `apps/web`), `@types/node` `22.20.5` and `vitest` `5.1.0` (same as `tokens`); peer `react` `^19.0.0`.
2. Write `src/icons/icons.test.tsx` first; run it and see it fail on the empty package.
3. `src/icons/paths.ts` (43 paths copied from the prototype by script), `icon-base.tsx`, `icons.tsx`, `index.ts`, `src/index.ts`.
4. Check R8 by script against the prototype's `ICONS` object, R11 (`package.json`, `exports`), R14 by search. Record the results in the PR.
5. `pnpm install` (this changes `pnpm-lock.yaml`, the `packages/ui-web` block only), typecheck, lint, `format:check`, tests. `lint:boundaries` does not exist in the repository yet, so R13 covers lint and format only.

## Files outside the code

- `pnpm-lock.yaml`: written by `pnpm install` in step 5.
- `docs/plans/TOKI-011.state.json`: the state file of the dev flow (`dev-state`); it records the tier, the approval and the verifier rounds.

## AC -> step -> test

| Requirement | Step | Test |
| :-- | :-- | :-- |
| R1, R2, R9, R10, R16 names, exports, left-out names | 3 | `icons.test.tsx` lists of 43 and 32 names; export names |
| R3 `Icon` equals named icon | 3 | `icons.test.tsx` markup equality for 43 names |
| R4 attributes and path | 3 | `icons.test.tsx` parsed markup, three literal paths |
| R5 props, owned attributes win | 3 | `icons.test.tsx` render with size, strokeWidth, className, cast props |
| R6 no colour literals | 3 | `icons.test.tsx` reads source files |
| R7, R15 types | 3 | `@ts-expect-error` lines, `pnpm typecheck` |
| R8 paths match prototype | 4 | one-off script, result in PR |
| R11 sideEffects, exports, module statements | 1, 3, 4 | module-statement test; script for package.json |
| R12, R13 install, typecheck, lint | 5 | commands exit 0 |
| R14 no import in `apps/web` | 4 | search |

## What can break

Riskiest step: copying paths (a typo draws a wrong icon). Guard: script comparison with the prototype (R8) plus three literal paths in the test.
