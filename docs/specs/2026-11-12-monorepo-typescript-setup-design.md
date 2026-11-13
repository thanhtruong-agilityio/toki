# Set up the pnpm monorepo and TypeScript design

Date: 2026-11-12 · Status: draft for review
Intent: docs/intents/monorepo-typescript-setup.md (Thanh Truong)
Ticket: TOKI-001

## Goal
The builder (Thanh and Claude) needs one agreed place for the server, the web app and the shared packages. `main` holds only the TOKI-095 workflow files (`CLAUDE.md`, `.claude/settings.json`, `.github/pull_request_template.md`, `docs/definition-of-done.md`, `docs/ticket-config.yml`): no `package.json`, no workspace and no code. Every other Repository foundation ticket waits for this base. After this change the two apps and six packages of phase 1 exist, empty, and share one TypeScript configuration.

## Scope
- In: the pnpm workspace; `apps/server` and `apps/web`; the packages `shared`, `client-core`, `tokens`, `i18n`, `platform`, `ui-web`; one shared TypeScript config; a root type check command; the root `dev` script; the Node 22 pin; a `.gitignore`.
- Out (not now):
  - `apps/mobile` and `packages/ui-native` (phase 3), `apps/desktop` (phase 6).
  - ESLint, Prettier and the three package boundary rules: TOKI-002.
  - `infra/`, Docker Compose and the `dev:*` scripts: TOKI-003.
  - Fastify, environment variable reading, `/healthz`: TOKI-004. Drizzle and migrations: TOKI-005.
  - Vite, React, router and dev proxy: TOKI-006. CI workflow: TOKI-007.
  - Vitest, Playwright and `e2e/`: TOKI-008.
  - Content of the packages: tokens TOKI-009, i18n TOKI-017, platform TOKI-018, shared date and time rules TOKI-094.
  - `CLAUDE.md`, `.claude/settings.json` and the `docs/` folders: TOKI-095. `.env.example` and the variable inventory: TOKI-096.

## Requirements
- R1. `pnpm-workspace.yaml` exists at the root and lists `apps/*` and `packages/*`. On a clean clone with Node 22, `pnpm install` exits 0.
- R2. `pnpm ls -r --depth -1` lists exactly eight workspace projects besides the root, by their package names: `@toki/server`, `@toki/web`, `@toki/shared`, `@toki/client-core`, `@toki/tokens`, `@toki/i18n`, `@toki/platform`, `@toki/ui-web`.
- R3. The paths `apps/mobile`, `apps/desktop` and `packages/ui-native` do not exist.
- R4. Each of the eight projects holds exactly three files: `package.json`, `tsconfig.json` and `src/index.ts`. Every `package.json` sets `"private": true` and `"type": "module"`. Each of the six `package.json` files under `packages/` also sets `"exports": { ".": "./src/index.ts" }`. `src/index.ts` contains only `export {};`.
- R5. `tsconfig.base.json` exists at the root and sets `"strict": true`, `"module": "ESNext"`, `"moduleResolution": "Bundler"` and `"noEmit": true`. Every project `tsconfig.json` extends it, and no project `tsconfig.json` sets `strict`, `target`, `module` or `moduleResolution` itself (checked with `grep`).
- R6. `pnpm typecheck` at the root type-checks all eight projects and exits 0.
- R7. When a type error is added to `src/index.ts` of any one project, `pnpm typecheck` exits non-zero and prints that file path.
- R8. The root `package.json` sets `engines.node` to `22.x` and `.nvmrc` holds `22`. With another Node major version, `pnpm install` stops with an unsupported engine error.
- R9. The root `package.json` has a `packageManager` field of the form `pnpm@<exact version>`; the version is the stable pnpm release in use when this ticket is built. Check: `pnpm --version` at the root prints exactly that version, and `git ls-files` lists `pnpm-lock.yaml` and neither `package-lock.json` nor `yarn.lock`.
- R10. `apps/server` and `apps/web` each declare the `shared` package as a `workspace:*` dependency. A line `import {} from "@toki/shared"` in either app passes `pnpm typecheck`; it resolves to the source file through the `exports` entry of `@toki/shared` (R4), with no build step.
- R11. `.gitignore` ignores `node_modules`, build output (`dist`) and local environment files, with exactly these environment patterns: `.env`, `.env.*`, `!.env.example`. Check: `git check-ignore .env` and `git check-ignore .env.local` each print the path, and `git check-ignore .env.example` prints nothing. After `pnpm install` and `pnpm typecheck`, `git status --porcelain` prints nothing.
- R12. The root `package.json` has the `dev` script `pnpm -r --parallel --if-present run dev`. It runs the `dev` script of every workspace project that has one, all at the same time. It starts no service (Postgres, file storage, mail); those are started with `pnpm dev:up` (TOKI-003). At the end of this ticket no project has a `dev` script, and `pnpm dev` at the root exits 0.

## Design
### Layout
```
toki/
├─ package.json          private root; scripts: typecheck, dev; engines; packageManager
├─ pnpm-workspace.yaml   apps/*, packages/*
├─ pnpm-lock.yaml
├─ tsconfig.base.json    the one shared compiler config
├─ .nvmrc  .gitignore
├─ apps/
│  ├─ server/            package.json, tsconfig.json, src/index.ts
│  └─ web/               same three files
└─ packages/
   ├─ shared/  client-core/  tokens/  i18n/  platform/  ui-web/   same three files each
```
- TypeScript is installed once, in the root `devDependencies`. No project installs its own copy.
- Each project has a `typecheck` script that runs `tsc --noEmit`. The root `typecheck` script runs it in every project with `pnpm -r`.
- The root `dev` script is `pnpm -r --parallel --if-present run dev` (R12). `--if-present` makes it exit 0 while no project has a `dev` script; `--parallel` starts the long-running dev servers together and streams their output. It does not start the services of TOKI-003. TOKI-004 and TOKI-006 add only the `dev` script of their own project (`apps/server`, `apps/web`); they do not edit the root script.
- The Node pin in R8 needs no extra setting: pnpm checks the `engines.node` of the workspace root itself. There is no `.npmrc` and no `engine-strict` setting, because `engine-strict` would also refuse any dependency whose own `engines` excludes the running Node.
- `.gitignore` is owned by this ticket (R11). `.env.example` stays tracked, so TOKI-096 can add it without editing `.gitignore`.
- Compiler options that differ by project (for example DOM types for `web` and `ui-web`) are added by the ticket that first needs them, in that project's `tsconfig.json`.
- Packages are named `@toki/<folder>` (for example `@toki/shared`). Decided, see concern 1.
- All projects are ES modules and are consumed from source: no build step and no emitted files; type check only. Decided, see concern 2.

### Errors
- Wrong Node major version -> `pnpm install` stops with an unsupported engine error (R8).
- Type error in any project -> `pnpm typecheck` exits non-zero and names the file (R7).
- No project has a `dev` script -> `pnpm dev` has nothing to run and exits 0, with no error (R12).

## Testing
- There is no test runner yet (TOKI-008) and no CI yet (TOKI-007). The checks are run by hand on a clean clone, in this order: R1, R2, R3, R4, R5, R6, R9, R10, R12, R11.
- R4 is checked with `git ls-files apps packages` (24 files, three per project) and by reading each `package.json` and `src/index.ts`.
- R5 is checked with `grep` over the eight project `tsconfig.json` files: each has `extends`, none has `strict`, `target`, `module` or `moduleResolution`.
- R10 is checked once per app: add `import {} from "@toki/shared";` to `src/index.ts`, run `pnpm typecheck`, see it pass, then remove the line so R4 holds again.
- R7 is checked once per project: add `const x: number = "a";` to `src/index.ts`, run `pnpm typecheck`, see it fail, then remove the line.
- R12 is checked by running `pnpm dev` at the root and reading the exit code (0).
- R8 is checked by switching to another Node major version and running `pnpm install`.
- No data is used. No sample or seed content is added.

## Data safety
- `.env` files are ignored by git (R11). The Blueprint states that secrets live in `.env`, never in git.
- This change adds no secret, no credential and no environment variable.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Repository foundation (TOKI-001) | Planning fact; no design impact. |
| Milestone: M1 "Foundation and design system" | Planning fact; no design impact. |
| Size: S (about half a working session with Claude) | Scope: eight empty projects and config only; all content is left to the tickets named under Out. |
| Belongs to Blueprint intent I01 repo-foundation, alongside TOKI-001 to TOKI-008 | Planning fact; Scope "Out" names TOKI-002 to TOKI-008 so the work does not overlap. |
| Needs: no other ticket | Planning fact; the design uses nothing from another ticket. |
| Needed by TOKI-002, 003, 004, 006, 009, 017, 018, 094 directly; 005, 007, 008 through those | R2 and R4: every folder those tickets build in exists and type-checks (R6). |
| Scope is fixed: `apps/server`, `apps/web` and six packages, with shared TypeScript config | R2, R4, R5. |
| Not in this ticket: `apps/mobile`, `apps/desktop`, `ui-native` | R3. |
| One monorepo, managed with pnpm | R1, R9. |
| The full agreed structure also holds `apps/mobile`, `apps/desktop` and `ui-native` | R1: the globs `apps/*` and `packages/*` take those folders later with no workspace change. |
| Stack: Node 22 and TypeScript | R8 (Node 22), R5 and R6 (TypeScript). The TypeScript version is concern 3. |
| The server and every client share one package of data contracts | R10 for `server` and `web`. Other internal dependencies are concern 4. |
| Lint, format and package boundary rules belong to TOKI-002 | Scope "Out"; no ESLint or Prettier file or dependency is added. |
| M1 exit check this ticket supports: `pnpm dev` runs and CI is green | R12: the root `dev` script exists and exits 0. R1 and R6 give CI a workspace and a type check to run. The project `dev` scripts come from TOKI-004 and TOKI-006, and CI from TOKI-007; see concern 5. |

## Open questions from the intent
- The intent lists no open question ("None").
- Clarify gap: the ticket table says "7 empty packages" but the intent says six. Answered: six packages, `ui-native` comes in phase 3 (Blueprint extract, UPDATE section, TOKI-001 scope).
- Clarify gap: do `infra/`, `e2e/` and `docs/` belong here? Answered: no. `infra/docker-compose.dev.yml` is TOKI-003 and the `docs/` folders are TOKI-095 (Blueprint extract, ticket scopes). `e2e/` is not assigned by name; this spec leaves it to TOKI-008 (Playwright). Assumption.
- Clarify gap: what are the package names? Answered: `@toki/<folder>`. See concern 1.
- Clarify gap: which module format, and do packages build or are they used from source? Answered: ES modules, used from source. See concern 2.
- Clarify gap: which pnpm and TypeScript versions? Answered: both are the stable release in use when the ticket is built, pinned exactly (R9 for pnpm, root `devDependencies` for TypeScript). See concern 3.
- Clarify gap: which internal dependencies are declared now? Not answered. Carried forward as concern 4.
- Clarify gap: which ticket creates the root `dev` script? Answered: TOKI-001 creates it; TOKI-004 and TOKI-006 add only their own project's `dev` script. See concern 5.

## Areas of concern
1. Package names are not in the Blueprint. Every later import uses the name, so a change after TOKI-002 is costly. Decided: packages are named `@toki/<folder>` (`@toki/server`, `@toki/web`, `@toki/shared`, `@toki/client-core`, `@toki/tokens`, `@toki/i18n`, `@toki/platform`, `@toki/ui-web`) (R2, R10). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Owner: Thanh Truong.
2. The Blueprint does not state the module format (ES modules or CommonJS) or whether packages are built or consumed from source. Decided: every project is an ES module (`"type": "module"`), and packages are consumed from source through `"exports": { ".": "./src/index.ts" }`; `tsconfig.base.json` sets `module` `ESNext`, `moduleResolution` `Bundler` and `noEmit` (R4, R5, R10). This ticket has no build step. How the server is run and built is left to TOKI-004, and the web build to TOKI-006. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Owner: Thanh Truong.
3. The Blueprint fixes Node 22 but gives no pnpm or TypeScript version. Answered in part: the spec names no pnpm version; R9 pins whichever stable pnpm release is in use when the ticket is built and checks the pin against `pnpm --version`, so R9 can be built and checked without a version in this spec. The TypeScript version follows the same rule. Decided: the root `devDependencies` pins TypeScript to one exact version (no `^` or `~` range), the stable release in use when the ticket is built. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Owner: Thanh Truong.
4. R10 declares only `server` and `web` depending on `shared`. The Blueprint says every client shares the contracts but does not list the other links (for example `client-core` on `shared`, `ui-web` on `tokens` and `platform`). Decide whether they are declared now or by the ticket that first imports them. Owner: Thanh Truong.
5. No ticket scope in the Blueprint names the root `dev` script, yet the M1 exit check and intent I01 need `pnpm dev` to run. Decided: TOKI-001 creates the root `dev` script. It runs the `dev` script of every workspace project that has one. TOKI-004 and TOKI-006 add only their own project's `dev` script (`apps/server`, `apps/web`); they do not edit the root script. At the end of TOKI-001 no project has a `dev` script yet, so the root command has nothing to run and must exit without error (R12). Decided by Thanh Truong (lead, as product owner) on 2026-11-12. Also decided: the command is `pnpm -r --parallel --if-present run dev`, and it does not start the TOKI-003 services; `pnpm dev:up` is run first. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Owner: Thanh Truong.
6. TOKI-095 and TOKI-096 also write root files (`CLAUDE.md`, `.claude/`, `.env.example`) and neither needs TOKI-001. Answered in part: TOKI-095 landed first on `main` and created no `package.json` and no `.gitignore`, so TOKI-001 creates the root `package.json`. Decided: TOKI-001 owns `.gitignore` (R11) and TOKI-096 adds only `.env.example`. Decided by Thanh Truong (lead, as product owner) on 2026-11-13. Still open: the environment-config spec (TOKI-096) lists `.gitignore` in its own layout and has to be changed to match. Owner: Thanh Truong.
