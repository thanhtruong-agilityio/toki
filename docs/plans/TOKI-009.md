# TOKI-009 The tokens package: plan

Ticket: https://github.com/thanhtruong-agilityio/toki/issues/16
Spec: docs/specs/2026-11-16-tokens-package-design.md (source of truth for every value; Tables A to E)
Tier: M. Branch: `feat/toki-009-tokens-package`.

## Design

The spec is the design. This work follows its Layout section without change:

```
packages/tokens/
├─ package.json        exports "./tokens.css"; scripts generate, test; devDependencies
├─ scripts/generate-css.ts
└─ src/ index.ts, tokens.ts, theme.ts, css.ts, tokens.css (generated), tokens.test.ts
```

Choices the spec leaves to the builder:

- Versions match `apps/server` so one copy is in the lockfile: `vitest` 5.1.0, `@types/node` 22.20.5. `tsx` is pinned to 4.23.15 (stable on 2026-11-18, older than two weeks). No Vitest at the root, so the package pins its own (concern 8).
- `tokens.test.ts` and `scripts/generate-css.ts` use `node:fs`. The test sits in `src/` but the lint rule of TOKI-002 exempts `*.test.*`; the script sits outside `src/` (R19). `@types/node` is a devDependency so `pnpm typecheck` accepts both; `tsconfig.json` `include` gains `scripts` and `compilerOptions.types` is `["node"]`.
- The prettier ignore: `.prettierignore` exists, so this PR adds `packages/tokens/src/tokens.css` (concern 6).

## AC -> step -> test

| Req | Step | Test (in `src/tokens.test.ts` unless noted) |
| :-- | :-- | :-- |
| R1 | 3 | `looks`, `accents`, `densities` equal the lists in order |
| R2 | 3 | each look holds the 17 colours and 4 tints of Table A |
| R3 | 3 | 8 look/accent pairs hold the 4 values of Table B |
| R4 | 3 | `densityValues` Table C; `lookDensity` |
| R5, R6 | 3 | `radii` Table D; `shadows` Table E (empty list for Focus `shadow`) |
| R7 | 3 | `getTheme` for 24 combinations: 32 keys, table values, default density |
| R8 | 3 | walk every export: number, `#RRGGBB` / `rgba()` string, layer list; no `var(`, `calc(`, unit suffix |
| R9 | 4 | `exports` holds exactly the two entries and each named file exists (every test run; no hand check, per the spec) |
| R10-R14 | 4 | parse `tokens.css`: selectors, their fixed order, property names, `color-scheme`; the device block equals the Focus block |
| R15 | 4 | the five worked examples as literal text; every length ends in `px`, every tint in `%`, every shadow layer has four lengths |
| R16 | 4 | cascade by specificity then file order for the 30 states (24 with `data-eff`, on a light and a dark device; 6 without it), compare 32 values with `getTheme` |
| R17 | 4, 6 | `toCss()` equals the committed file and the failure names the command; by hand: change a colour, see fail, regenerate, undo |
| R18 | 4 | test reads every file under `src` and `scripts` except the test file for the six names |
| R19 | 4, 5 | test: no `dependencies` entry; source files have no DOM global, `process`, `require` or non-relative import; `pnpm lint` |
| R20 | 5, 6 | `pnpm --filter @toki/tokens test` and `pnpm typecheck` exit 0; by hand: a type error in `scripts/generate-css.ts` fails the type check |

## Steps

1. Package setup: devDependencies, scripts `generate` and `test`, `exports`, `tsconfig` include; `pnpm install`.
2. Write `tokens.test.ts` with its own copy of Tables A to E; run it; see it fail because the exports do not exist.
3. `tokens.ts`, `theme.ts`, `index.ts`: value tests (R1 to R8) go green.
4. `css.ts`, `scripts/generate-css.ts`, run `generate`: CSS tests (R10 to R17) go green.
5. `.prettierignore`, then `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`.
6. Hand checks from the spec's Testing section: R17 (change a colour, see the test fail, regenerate) and R20 (type error in the script).

## What can break (riskiest first)

1. **R16 cascade test is the proof the CSS matches the objects.** It must apply blocks by selector match and file order, not by hard-coded precedence, or it would pass for a wrong file. Mitigation: it implements the match on attributes (`data-eff`, `data-accent`, `data-density`, plus the unset case) and I check once that swapping two blocks in the file fails it.
2. **Typing Tables A to E twice.** The test's copy is typed from the spec, `tokens.ts` from the spec again; a typo in both would pass. Mitigation: type the test copy first, `tokens.ts` after, and diff the two by eye once at the end.
3. **The `@media (prefers-color-scheme: dark)` block (R12).** It must repeat the Focus declarations exactly. `toCss()` builds it from the same function as the Focus block, so the two cannot drift.
4. **Lockfile and pnpm 12.** New devDependencies pull `esbuild`, which `pnpm-workspace.yaml` already allows with `allowBuilds: esbuild: false`. If the install stops on another build script, add a decision there and say so in the PR.
5. **Lint rule 1** may reject a global in the test or script. Both are outside the rule (`*.test.*` and `scripts/`); confirmed by running `pnpm lint`.

## Out of scope

Everything in the spec's Scope, Out list. No change to `apps/web`; the R9 hand check adds and removes one line and leaves no trace.
