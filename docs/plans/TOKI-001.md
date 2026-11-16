# TOKI-001 Set up the pnpm monorepo and TypeScript - implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task.

**Goal:** `main` gets a pnpm workspace with two apps and six packages, all empty, sharing one TypeScript config.

**Architecture:** Config files only. TypeScript is installed once at the root; every project is an ES module consumed from source and is only type-checked (no build, no emit).

**Tech stack:** Node 22, pnpm 12.21.0, TypeScript 7.0.2 (the stable releases on npm on 2026-11-16; spec R9 and concern 3).

**Spec:** `docs/specs/2026-11-12-monorepo-typescript-setup-design.md` (R1 to R12). Tier S: no design section, no grilling.

## AC -> step -> test

There is no test runner yet (TOKI-008), so each test is a command run by hand, as the spec's Testing section says. All tests run in a clean clone of `feat/toki-001` under Node 22.

| AC | Step | Test (command -> expected) |
| :-- | :-- | :-- |
| R1 | 1 | `pnpm install` -> exit 0; `pnpm-workspace.yaml` lists `apps/*` and `packages/*` |
| R2 | 2 | `pnpm ls -r --depth -1` -> exactly the eight `@toki/*` names besides the root |
| R3 | 2 | `ls apps/mobile apps/desktop packages/ui-native` -> all three missing |
| R4 | 2 | `git ls-files apps packages \| wc -l` -> 24; each `package.json` has `private`, `type: module`; the six packages have `exports`; each `src/index.ts` is `export {};` |
| R5 | 1, 2 | `tsconfig.base.json` has the four options; `grep -L '"extends"'` over the eight project `tsconfig.json` prints nothing; `grep -lE '"(strict\|target\|module\|moduleResolution)"'` prints nothing |
| R6 | 2 | `pnpm typecheck` -> exit 0, eight projects run |
| R7 | 2 | per project: add `const x: number = "a";` to `src/index.ts`, `pnpm typecheck` -> non-zero and names the project and `src/index.ts`; revert |
| R8 | 1 | `.nvmrc` is `22`; under Node 24 `pnpm install` -> unsupported engine error, non-zero |
| R9 | 1 | `pnpm --version` -> `12.21.0`; `git ls-files` has `pnpm-lock.yaml`, no `package-lock.json`, no `yarn.lock` |
| R10 | 2 | per app: add `import {} from "@toki/shared";`, `pnpm typecheck` -> exit 0; revert |
| R11 | 1 | `git check-ignore .env .env.local` prints both; `git check-ignore .env.example` prints nothing; after install and typecheck `git status --porcelain` is empty |
| R12 | 1 | `pnpm dev` -> exit 0 |

Each test is run before its step (it must fail) and after it (it must pass).

## Steps

### Step 1: root workspace files

Files (create): `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.nvmrc`, `.gitignore`, `pnpm-lock.yaml` (generated).

`package.json`:
```json
{
  "name": "toki",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.21.0",
  "engines": { "node": "22.x" },
  "scripts": {
    "typecheck": "pnpm -r run typecheck",
    "dev": "pnpm -r --parallel --if-present run dev"
  },
  "devDependencies": { "typescript": "7.0.2" }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true
  }
}
```

`.nvmrc`: `22`

`.gitignore`:
```
node_modules
dist
.env
.env.*
!.env.example
```

No `.npmrc` (spec, Design). Commit: `chore(repo): add the pnpm workspace root (TOKI-001)`.

### Step 2: the eight projects

Files (create), three per project: `package.json`, `tsconfig.json`, `src/index.ts` in `apps/server`, `apps/web`, `packages/shared`, `packages/client-core`, `packages/tokens`, `packages/i18n`, `packages/platform`, `packages/ui-web`. Then `pnpm install` updates `pnpm-lock.yaml`.

`package.json` of a package (name is `@toki/<folder>`):
```json
{
  "name": "@toki/shared",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "typecheck": "tsc --noEmit" }
}
```

`package.json` of an app (`@toki/server`, `@toki/web`): no `exports`, and
```json
"dependencies": { "@toki/shared": "workspace:*" }
```

`tsconfig.json` (same in all eight):
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

`src/index.ts`: `export {};`

Commit: `chore(repo): add the two apps and six packages (TOKI-001)`.

### Step 3: full check on a clean clone

Clone `feat/toki-001` into a temporary folder, switch to Node 22, run every test of the table in the spec's order (R1, R2, R3, R4, R5, R6, R9, R10, R12, R11), then R7 and R8. No file changes.

## What can break

- pnpm 12 or TypeScript 7 behaves differently from the spec's wording (engine check on the workspace root, `--if-present` exit code, `tsc` path output). Step 3 runs each command for real; a difference stops the build and goes back to the Dev, it is not worked around.
- The build machine has Node 24 and no pnpm: Node 22 is installed with `nvm`, pnpm comes from `corepack` through the `packageManager` field. Nothing of that is committed.
