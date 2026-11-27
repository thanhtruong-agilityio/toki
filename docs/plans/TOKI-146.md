# TOKI-146 Create the mobile app skeleton: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** `apps/mobile` is an Expo app in the pnpm workspace: one screen runs in a development build on an iOS simulator and an Android emulator, and it imports `@toki/shared` and `@toki/i18n` from source.

**Architecture:** A new project `@toki/mobile` with Expo Router (`src/app/`), a Metro configuration that adds one resolver fallback (`.js` to `.ts`/`.tsx` for relative imports from `packages/`), and generated native folders that git ignores. No file of `packages/` or `apps/web` changes.

**Extends order (R14):** SDK 58's `expo/tsconfig.base` sets `module: preserve`, `moduleResolution: bundler`, `noEmit`, `jsx: react-jsx`, `target: ESNext` and the `react-native` custom condition; the root base then sets `strict`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler` and `noEmit`. `ESNext` with `Bundler` is a valid pair, the custom condition is kept, and `pnpm typecheck` passes, so the order undoes nothing Expo needs. `include` and `exclude` are those of R14.

**Tech stack:** Expo SDK 58 (`expo` 58.0.26), React Native 0.88.1, React 19.3.0, Expo Router 58.0.32, TypeScript from the root.

**Spec:** `docs/specs/2026-11-27-mobile-app-skeleton-design.md` (R1 to R23). Intent: `docs/intents/mobile-app-skeleton.md`.

## SDK in use (R3)

- Expo SDK 58. The newest SDK 58 release on 2026-11-27 is `expo` 58.1.0, published on 2026-11-26. pnpm's default minimum release age (one day) refuses it and would write a `minimumReleaseAgeExclude` list into `pnpm-workspace.yaml`. The plan takes the previous release, `expo` 58.0.26 (2026-11-17), and the versions its `bundledNativeModules.json` names, so no age exception is added.
- Pinned exactly (no `^` or `~`): `expo` 58.0.26, `expo-router` 58.0.32, `expo-dev-client` 58.0.21, `expo-constants` 58.0.16, `expo-linking` 58.0.17, `expo-status-bar` 58.0.5, `react` 19.3.0, `react-dom` 19.3.0, `react-native` 0.88.1, `react-native-safe-area-context` 5.11.1, `react-native-screens` 4.30.1, `@types/react` 19.3.3.
- `react-dom` 19.3.0 is listed because `@expo/metro-runtime` peer-depends on it; without it pnpm brings the web app's 19.3.1, which asks for `react` ^19.3.1, and `pnpm peers check` fails.

## Global constraints

- No file of `packages/` or `apps/web` changes (R9, R22).
- Isolated `node_modules` layout; no `.npmrc` (R2).
- No `dev`, `build` or `test` script in `@toki/mobile` (R19, R20).
- One ticket, branch `feat/toki-146-mobile-app-skeleton`. Never merge, never force-push.

## Decisions

1. **`metro.config.js` as an ES module, so R24's lint block is left out.** `@toki/mobile` sets `"type": "module"` (R24). SDK 58 loads an ES module Metro configuration (`npx expo export` for both platforms bundles with it), so, as the spec's Design allows, the file is `metro.config.js` written as an ES module (`import`, `import.meta.dirname`, `export default`), and no `.cjs` file or `eslint.config.js` block for `apps/mobile/*.cjs` is added. `eslint.config.js` changes only by the three ignores of R17.
2. **The `.js` fallback** is `resolver.resolveRequest`, as the design says: default resolver first; on failure, only for a relative `.js` specifier from a file under `packages/`, try `.ts` then `.tsx`; otherwise throw the original error.
3. **No `babel.config.js`.** SDK 58 needs none.
4. **No hoisting entries.** The bundle builds with the isolated layout; if the device build needs one, the pull request names it (concern 3).

## What can break

- **The device builds (R10, R11)** need a Mac with Xcode and Android Studio. The cloud environment has neither (and no KVM for an emulator), so the bundles are checked there with `npx expo export --platform ios|android`, and the device runs are done on the engineer's Mac.
- **`npx expo install --check` (R4)** calls `api.expo.dev`, which the cloud network refuses; there it runs with `EXPO_OFFLINE=1`, which checks against the local `bundledNativeModules.json`. It is run again online on the Mac.
- **Vitest projects** glob `apps/*`; a project with no test file must not change the count (R19).

## AC to step to test

| AC | Step | Check |
| :---- | :---- | :---- |
| R1, R2 | Task 1 | `pnpm ls -r --depth -1`; `pnpm install` on a clean clone |
| R3, R4 | Task 1 | `package.json` has no range; `npx expo install --check` |
| R5 | Task 1 | `npx expo config --type public` |
| R6, R7 | Task 1 | the screen in the screenshots |
| R8, R9 | Task 2 | `npx expo export` for both platforms; again with the fallback removed: fails on `./error.js` |
| R10, R11, R12 | Task 4 | `pnpm --filter @toki/mobile ios` and `android` on the Mac, screenshots |
| R13 | Task 3 | `git status --porcelain` after `pnpm install`, `npx expo prebuild`, `pnpm typecheck`, `pnpm lint` |
| R14 to R16 | Task 1 | `pnpm typecheck`; again with `const x: number = "a";` |
| R17, R18 | Task 3 | `pnpm lint`, `pnpm format:check` |
| R19, R20 | Task 3 | test counts of `pnpm test` against `main`; scripts of `package.json` |
| R21 | Task 1 | `pnpm --filter @toki/mobile start` starts Metro |
| R22 | Task 3 | `git diff --stat main -- apps/web packages`; `pnpm build`; `pnpm size` |
| R23 | Task 3 | `CLAUDE.md` |

## Tasks

### Task 1: the project (R1 to R7, R12, R14 to R16, R21)
- [ ] `apps/mobile/package.json`, `app.config.ts`, `tsconfig.json`, `src/app/_layout.tsx`, `src/app/index.tsx`.
- [ ] `pnpm install`; `pnpm peers check`; `npx expo install --check`; `npx expo config --type public`; `pnpm typecheck`.

### Task 2: Metro (R8, R9)
- [ ] `metro.config.js` (ES module) with the fallback; export both platforms; the negative check.

### Task 3: ignores, commands, the rest of the repository (R13, R17 to R20, R22, R23)
- [ ] `.gitignore`, `.prettierignore`, the ignores of `eslint.config.js`; `CLAUDE.md` (Repository layout, Commands).
- [ ] `pnpm lint`, `pnpm format:check`, `pnpm test` (counts against `main`), `pnpm build`, `pnpm size`, `git status --porcelain` after a prebuild.

### Task 4: the devices (R10, R11)
- [ ] On a Mac: `pnpm --filter @toki/mobile ios`, then `android`; a screenshot of each, showing the three lines of R7, attached to the pull request.
