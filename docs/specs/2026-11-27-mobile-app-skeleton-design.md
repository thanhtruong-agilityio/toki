# Create the mobile app skeleton design

Date: 2026-11-27 · Status: draft for review
Intent: docs/intents/mobile-app-skeleton.md (Huy Nguyen)
Ticket: TOKI-146

## Goal
The engineers who build the phone app need a place in the repository to build it, and proof that the shared packages load in React Native. Today `apps/mobile` does not exist, and only the web app imports `@toki/shared`, `@toki/client-core`, `@toki/tokens`, `@toki/i18n` and `@toki/platform`. After this change `apps/mobile` is an Expo app in the pnpm workspace: one screen runs in a development build on an iOS simulator and an Android emulator, and it imports two workspace packages from source. Every other MM1 ticket builds on it.

## Scope
- In:
  - The project `apps/mobile` (`@toki/mobile`): Expo, Expo Router, TypeScript and one screen.
  - The Metro configuration that resolves the workspace packages from source.
  - The app's names and identifiers.
  - The `.gitignore`, ESLint ignore and Prettier ignore lines for files that Expo generates.
  - One block in `eslint.config.js` for the CommonJS configuration files of `apps/mobile` (R24).
  - The mobile commands in `CLAUDE.md`.
- Out (not now):
  - Mobile lint rules and the `ui-native` boundaries: MOB-04.
  - The connection to a local server: MOB-05.
  - CI for mobile, including the iOS and Android builds on GitHub Actions: MOB-06.
  - The test harness and the first mobile test: MOB-07.
  - Tokens as React Native styles, fonts and icons: MOB-08 to MOB-10.
  - The native build of `platform`: MOB-11.
  - `packages/ui-native`, the app shell, navigation beyond the one screen, sign-in, and any screen of the prototype.
  - Store listing, signing certificates, app icon and splash art.
  - A release build: only the development build is in scope.

## Requirements
- R1. `apps/mobile/package.json` names the project `@toki/mobile` and sets `"private": true`. `pnpm ls -r --depth -1` lists it beside the projects that exist today, and it lists no other new project.
- R2. On a clean clone with Node 22, `pnpm install` at the root exits 0 with the workspace's default `node_modules` layout. No `.npmrc` sets `node-linker` or `shamefully-hoist`.
- R3. Every dependency of `@toki/mobile` is pinned to one exact version, with no `^` or `~` range. The versions are those of the stable Expo SDK in use when the ticket is built, chosen with `npx expo install`. The SDK version is written in the plan `docs/plans/TOKI-146.md`.
- R4. Running `npx expo install --check` in `apps/mobile` reports no package whose version does not match the SDK.
- R5. `apps/mobile/app.config.ts` sets: the display name `Toki`; the slug `toki`; the URL scheme `toki`; the iOS bundle identifier and the Android package name `dev.toki.mobile` (a placeholder until store publishing, concern 1). `npx expo config --type public` prints these values.
- R6. The app uses Expo Router. The file `apps/mobile/src/app/index.tsx` is the first and only screen, and its route is `/`.
- R7. The screen shows the following, each line as text: the app name `Toki`; the names of the two languages, read from `LANGUAGE_NAMES` of `@toki/i18n`; the result of `parseEmail(" Member@Example.COM ")` of `@toki/shared`, which is `member@example.com`.
- R8. `apps/mobile/package.json` declares `@toki/shared` and `@toki/i18n` as `workspace:*` dependencies. Metro loads both from their `src/` files, with no build step and no emitted file in either package.
- R9. When the importing file is under `packages/`, Metro resolves a relative import that ends in `.js` to the `.ts` or `.tsx` file of the same name when no `.js` file exists. Imports from `apps/mobile/src` and from `node_modules` resolve as Metro's default resolver does. With this, `export * from "./email.js"` in `@toki/shared` loads `email.ts`. No file of `packages/` is changed for it.
- R10. `npx expo run:ios` builds and installs a development build on an iOS simulator, and the screen of R7 shows with no red error screen.
- R11. `npx expo run:android` builds and installs a development build on an Android emulator, and the screen of R7 shows with no red error screen.
- R12. `expo-dev-client` is a dependency, so the build of R10 and R11 is a development build. The app is not run in Expo Go.
- R13. Git ignores the following: the folders `apps/mobile/ios` and `apps/mobile/android`; `apps/mobile/.expo`; `apps/mobile/expo-env.d.ts`. After `pnpm install`, `npx expo prebuild`, `pnpm typecheck` and `pnpm lint`, `git status --porcelain` prints nothing.
- R14. `apps/mobile/tsconfig.json` extends `expo/tsconfig.base` and then `../../tsconfig.base.json`, in that order. It does not set `strict`, `target`, `module` or `moduleResolution` itself. Its `include` is `src`, `app.config.ts`, `expo-env.d.ts` and `.expo/types/**/*.ts`, and its `exclude` is `ios`, `android` and `node_modules`, so a type check after a prebuild reads no generated native file.
- R15. `@toki/mobile` has a `typecheck` script, `tsc --noEmit`. `pnpm typecheck` at the root type-checks it and exits 0.
- R16. When a type error is added to `apps/mobile/src/app/index.tsx`, `pnpm typecheck` exits non-zero and prints that file path.
- R17. `pnpm lint` exits 0. ESLint lints the source of `apps/mobile` with the base configuration, and ignores the folders `ios`, `android` and `.expo` of `apps/mobile`.
- R18. `pnpm format:check` exits 0, and Prettier ignores the same three folders.
- R19. `pnpm test` exits 0, and it runs the same test files as before this ticket. `@toki/mobile` has no test file and no `test` script.
- R20. `@toki/mobile` has no `dev` script and no `build` script. The root `pnpm dev` and `pnpm build` run the same projects as before this ticket.
- R21. `@toki/mobile` has these scripts: `start`: `expo start`; `ios`: `expo run:ios`; `android`: `expo run:android`. `pnpm --filter @toki/mobile start` starts Metro.
- R22. The web app is unchanged: `git diff --stat main -- apps/web packages` prints nothing, and `pnpm build` and `pnpm size` exit 0.
- R23. "Commands" of `CLAUDE.md` lists the three scripts of R21, and the line of `apps/mobile` in "Repository layout" reads "Expo + React Native (phone app)".
- R24. `@toki/mobile` sets `"type": "module"`. Its Metro and Babel configuration files are CommonJS and named `metro.config.cjs` and `babel.config.cjs`. One block in `eslint.config.js`, for `apps/mobile/*.cjs` only, sets `sourceType` to `commonjs` and turns off `@typescript-eslint/no-require-imports`; no other rule and no other file is changed. With it, R17 holds.

## Design
### Layout
```
apps/mobile/
├─ package.json        @toki/mobile; scripts start, ios, android, typecheck; "main": "expo-router/entry"
├─ app.config.ts       name, slug, scheme, ios.bundleIdentifier, android.package, plugins: expo-router
├─ metro.config.cjs    expo/metro-config + the .js -> .ts fallback (R9); CommonJS (R24)
├─ babel.config.cjs    only if the SDK in use still needs one; otherwise absent
├─ tsconfig.json       extends expo/tsconfig.base, then ../../tsconfig.base.json
└─ src/app/
   ├─ _layout.tsx      Expo Router root: a Stack with the one screen
   └─ index.tsx        the screen of R7
```
- The project follows Expo's default template for the SDK in use, with these changes: `src/app/`, the Metro fallback, and no sample screens or assets beyond what `app.config.ts` needs.
- The native folders `ios/` and `android/` are generated by `npx expo prebuild` (Continuous Native Generation) and are not committed (R13, concern 2). Native settings live in `app.config.ts` and in config plugins.
- `@toki/mobile` installs its own `react` and `react-native` at the exact versions the SDK names. The web app keeps its own `react` range. With pnpm's isolated layout each project resolves its own copy, so the two do not meet. The shared packages that peer-depend on React, such as `@toki/i18n/react`, are not imported by this ticket.
- TypeScript comes from the root, as for every other project. The mobile `tsconfig.json` adds only what Expo's base adds: `jsx`, `lib` and the Expo types. The root base comes last, so its `strict`, `target`, `module`, `moduleResolution` and `noEmit` win over Expo's; Expo's base also sets `moduleResolution` to `bundler` and does not emit, so nothing Expo needs is undone. If the SDK in use sets one of these differently, the plan says so and the order stays.
- The package is an ES module like every other project (`"type": "module"`), so its Metro and Babel configuration files, which those tools load with `require`, are `.cjs` files. The base ESLint set (`typescript-eslint` recommended) bans `require` in every file, so one block of `eslint.config.js` allows it in `apps/mobile/*.cjs` only (R24). It is not a boundary rule. If the SDK in use loads an ES module configuration file, the plan may use `metro.config.js` as an ES module instead, and then R24's lint block is left out.

### Metro
- `metro.config.cjs` starts from `getDefaultConfig(__dirname)` of `expo/metro-config`. Recent SDKs detect the pnpm workspace and set `watchFolders` and `nodeModulesPaths` themselves. The file adds a `watchFolders` entry for the repository root only if the SDK in use does not.
- The `.js` fallback (R9) is a `resolver.resolveRequest` function. It does the following:
  1. It sends the request to Metro's default resolver.
  2. If that fails, the specifier is relative and ends in `.js`, and the origin file is under `packages/`, it tries the same path with `.ts`, then with `.tsx`.
  3. If none is found, it throws the original error.

  It changes nothing for imports that resolve today. Concern 5 says why the fix is in Metro and not in the packages.
- `@toki/*` packages are found through their `exports` entry (`./src/index.ts`). Package exports are on by default in the Metro of recent SDKs. If the SDK in use leaves them off, `resolver.unstable_enablePackageExports` is set to `true`.

### Commands
- `pnpm --filter @toki/mobile start` starts Metro.
- `pnpm --filter @toki/mobile ios` and `pnpm --filter @toki/mobile android` build and launch the development build. Each one runs `prebuild` first when the native folder is missing.
- The root `pnpm dev` does not start Metro (concern 4).

### Errors
- A workspace import that Metro cannot resolve: the bundle fails, and the red screen names the import. R10 and R11 catch this.
- A dependency with a build script and no `allowBuilds` decision: pnpm 12 stops `pnpm install`. Each one that Expo brings gets an entry in `pnpm-workspace.yaml`, with a one-line comment that says why it is on or off, as for `esbuild` today.
- An Expo package at a version that does not match the SDK: `npx expo install --check` names it (R4).

## Testing
- No test runner covers mobile yet (MOB-07), and no CI does (MOB-06). The checks are run by hand on a clean clone, on a Mac with Xcode and Android Studio. They run in this order:
  1. R1 and R2.
  2. R3 and R4.
  3. R5.
  4. R13, after a prebuild.
  5. R14, R15 and R16.
  6. R17 and R18.
  7. R19 and R20.
  8. R22 and R23.
  9. R10 and R11, then R6 to R9 and R12, on each device.
- R10 and R11 are checked with a screenshot of each device, attached to the pull request. The screenshots show R7's three lines.
- R9 is checked twice. First, the import of `@toki/shared` works on both devices. Second, the resolver function is removed for a moment, Metro is seen to fail on `./error.js`, and the function is put back.
- R16 is checked by adding `const x: number = "a";` to `index.tsx`, running `pnpm typecheck` and seeing it fail, then removing the line.
- R19 is checked by comparing the file count that `pnpm test` reports with the count on `main`.
- No data is used. The email of R7 is a made-up address on `example.com`.

## Data safety
- `app.config.ts` holds no key, token or secret. No `.env` file is read by the app in this ticket.
- The development build talks to no server (MOB-05 adds that).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint ticket MOB-03 "The `apps/mobile` skeleton", from web tickets TOKI-001 and TOKI-006. Size M | Planning fact. Scope keeps the ticket to one project and one screen. |
| Milestone MM1 "Mobile foundation and design system". Outcome IM01 | Planning fact. R15, R17 and R19 put the app under the same typecheck, lint and test commands as the web. |
| Needs no other mobile ticket | Planning fact. The design uses nothing from another mobile ticket. |
| Needed by every other MM1 ticket that adds code to `apps/mobile` or `packages/ui-native` | R1, R6 and R8: the project, its router and its workspace imports exist for them to build on. |
| React Native with Expo, for iOS and Android (D-024) | R3, R10, R11. |
| Expo Router and TypeScript, in the pnpm workspace; Metro resolves the workspace packages | R6, R14, R15, R1, R8, R9. |
| The repository layout names `apps/mobile` as "React Native + Expo (phase 3)" | R1 and R23. |
| Packages are named `@toki/<folder>`, are ES modules, and are consumed from source | R1 (`@toki/mobile`), R24 (`"type": "module"`), R8 and R9: no build step and no change to the packages. |
| Tool versions are the stable release when built, pinned exactly | R3 and R4. |
| Node 22 and the pnpm version of the root `package.json` | R2: the root `engines`, `devEngines` and `packageManager` are unchanged. |
| The app runs as a development build, not in Expo Go | R10, R11, R12. |
| One app in the stores serves every company (Q1) | R5: one fixed bundle identifier and package name, no per-company value. |
| iOS and Android builds run on our own GitHub Actions (Q4) | Concern 2: the native folders are generated by `expo prebuild`, which a GitHub Actions job can run. No EAS configuration is added. CI itself is MOB-06. |
| `client-core`, `shared`, `tokens` and `i18n` use no DOM or browser API | R22: no package changes. R10 and R11 show that `shared` and `i18n` run on Hermes. |
| Not in this ticket: MOB-04 to MOB-11 | Scope, "Out". |

## Open questions from the intent
- What are the app's display name, iOS bundle identifier and Android package name? Answered: `Toki`, with the placeholder id `dev.toki.mobile` until store publishing is set up. See concern 1.
- Are the native `ios/` and `android/` folders committed, or generated by `expo prebuild` and ignored by git? Answered: generated by `expo prebuild` and ignored by git. See concern 2.
- Does Expo build with pnpm's default (isolated) `node_modules` layout, or does the workspace need the hoisted layout? Answered: the default isolated layout. See concern 3.
- Does the root `pnpm dev` also start the mobile bundler? Answered: no. See concern 4.
- How does Metro resolve the `.js` import specifiers that the workspace packages use for their `.ts` files? Answered: a fallback in the Metro configuration. See concern 5.
- Clarify gap: which workspace package does the screen import? Answered: `@toki/shared`, which uses `.js` specifiers and Zod, and `@toki/i18n`, which uses neither. Together they test the hard case and the plain case (R7, R8).
- Clarify gap: the root `pnpm test` runs a Vitest project for every folder under `apps/`. Does the new folder break it? Answered: a project with no test file adds nothing. R19 checks that the test count is unchanged, and MOB-07 adds the mobile test harness.

## Areas of concern
1. The display name, iOS bundle identifier and Android package name are not in the Blueprint. They become permanent only when the app is first uploaded to a store, not in a development build, and with generated native folders (concern 2) a change before then is one line in `app.config.ts`. Decided: display name `Toki`; for now the iOS bundle identifier and the Android package name are both the placeholder `dev.toki.mobile`, used only in development builds (R5). The final identifiers, under a reverse domain the publisher owns, are chosen before the first store upload, by the ticket that sets up store publishing; one app serves every company (Q1), so they name the publisher, not a customer. Decided by Huy Nguyen (product owner) on 2026-11-27. Owner: Huy Nguyen (product owner).
2. The native folders can be committed, or generated by `expo prebuild` and ignored by git. Decided: generate them and ignore them (Continuous Native Generation, R13). Native settings then live in `app.config.ts`, so an SDK upgrade needs no hand merge of Xcode and Gradle files. The GitHub Actions jobs of MOB-06 run `expo prebuild` before `xcodebuild` and Gradle (Q4). The cost: a native change that has no config plugin needs a small local config plugin. Decided by Huy Nguyen (product owner) on 2026-11-27, as recommended. Owner: Huy Nguyen (product owner).
3. pnpm can install the workspace in its default isolated layout or in the hoisted layout. The setting applies to the whole workspace, web included. Decided: keep the isolated layout (R2), which recent Expo SDKs support. If the development build fails because a native package cannot find a dependency, the fix is a narrow `publicHoistPattern` entry for that package. It is not a switch to `node-linker=hoisted`, and the pull request names each entry. Decided by Huy Nguyen (product owner) on 2026-11-27, as recommended. Owner: Huy Nguyen (product owner).
4. The root `pnpm dev` runs the `dev` script of every project in parallel (TOKI-001, R12). Decided: no. `@toki/mobile` has a `start` script and no `dev` script (R20, R21). Metro is interactive, it needs a simulator or a device, and it holds port 8081. Starting it with the server and the web app would slow down every web session. Decided by Huy Nguyen (product owner) on 2026-11-27, as recommended. Owner: Huy Nguyen (product owner).
5. The workspace packages import their `.ts` files with `.js` specifiers (for example `./email.js`). Vite and TypeScript accept this; Metro does not. Decided: a fallback in `metro.config.cjs` (R9), not a change to the packages. The `.js` form is how the packages are written today, and TypeScript, Vite and the server already accept it. Rewriting every import would touch every package for the sake of one bundler. Decided by Huy Nguyen (product owner) on 2026-11-27, as recommended. Owner: Huy Nguyen (product owner).
