# TOKI-018 The platform package: plan

Ticket: TOKI-018 (issue 23). Branch: `feat/toki-018-platform-package`. Tier: M.
Spec (the source of truth, merged with the decisions of 2026-11-18): `docs/specs/2026-11-16-platform-package-design.md`.
Requirements are named `R1` to `R28` as in the spec. This plan does not copy the interface or the lint cases; the tests type them in from the spec.

## Design

The spec is the design. This plan adds only what the repository and the order of work change.

Build order (each step ends green; stop after any step if needed):
package set-up, interface and holder, storage, notifications, file picking, sound, lint, wiring in `apps/web`, verify.

### Decisions taken in this plan (differences from the spec)

1. **`jsdom` is already pinned by `ui-web` (`31.0.1`).** `packages/platform` uses the same exact version as a dev dependency (spec, Layout), so the workspace holds one. `vitest` is `5.1.0`, as in `ui-web` and `tokens`.
2. **One Vitest config, two environments.** `packages/platform/vitest.config.ts` sets `environment: "jsdom"`. `src/current.test.ts` starts with `// @vitest-environment node`, so R4 ("no DOM needed") is proved by that file running in `node`. The root `vitest.config.ts` already finds the package by its glob.
3. **The `files` list of rule 1 is shared.** `eslint.config.js` gets one list of the covered folders (the four packages and `packages/platform/src`), with `packages/platform/src/web/**` and test files in `ignores`. The block that gives Node globals to `.js` files leaves the same list out. Rule 3 gets the same `@typescript-eslint/no-restricted-imports` ban next to its existing `no-restricted-syntax`; the existing `<audio>` selector stays.
4. **Lint proof is a Node test**, as for TOKI-012: `tools/lint-rules/platform-boundary.test.mjs` runs `ESLint.lintText` on the real `eslint.config.js`. The spec's fixtures and `lint:boundaries` no longer exist (TOKI-002 dropped them) and the spec already says so.
5. **Edits to the TOKI-002 spec** listed in the spec Scope (last bullet) are made in the same PR, as plain text edits of `docs/specs/2026-11-12-lint-format-boundary-rules-design.md` (step 7).
6. **Sound address.** The web implementation is built with a made-up address in tests only. `apps/web/src/main.tsx` calls `createWebPlatform()` with no `sounds` option; TOKI-075 passes the real address (concern 1).

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :-- | :-- | :-- |
| R3 exports, R25 no dependencies | 1 | `src/package.test.ts` reads `package.json`: two `exports` entries, no `dependencies`; a search of `src` finds no `@toki/i18n` |
| R1, R2, R4 | 2 | `src/types.test.ts` (type-level: names exist, `createWebPlatform()` assignable to `Platform`; fails under `pnpm typecheck`), `src/current.test.ts` in `node` |
| R5 no side effect | 3 to 6 | `src/web/index.test.ts`: recording fakes for `Notification`, `Audio`, `localStorage`, `sessionStorage`; none called, no new element |
| R6 to R9 storage | 3 | `src/web/storage.test.ts`: areas, `toki:` prefix, `clear()` keeps foreign keys, second implementation reads the first, throwing storage |
| R10 to R12 notifications | 4 | `src/web/notifications.test.ts`: no `Notification`, three browser values, throwing and rejecting request, request count 0 elsewhere |
| R13 to R17 files | 5 | `src/web/files.test.ts`: `change`, `cancel`, `multiple`, `accept`, 200 MB made-up size, input removed, second call resolves the first, `click()` before first `await` |
| R18 to R20 sound | 6 | `src/web/sound.test.ts`: fake `Audio`, `true` and `false`, no address, no element before first `play`, restart on the same element |
| R21, R22, R24, R28 lint | 7 | `tools/lint-rules/platform-boundary.test.mjs`: cases of R23, R24 and R28 |
| R26 wiring | 8 | search for `@toki/platform/web`; TOKI-008's end-to-end sample still passes |
| R27 | 9 | `pnpm typecheck`, `pnpm lint`, `pnpm test:lint-rules`, `pnpm format:check`, `pnpm test` exit 0 |

## Steps

1. **Package set-up.** `package.json` (second `exports` entry `./web`, `test` script, dev dependencies `jsdom` and `vitest`), `tsconfig.json` with `lib` `DOM`, `vitest.config.ts`. Install with pnpm and commit the lockfile. Test first: `package.test.ts` fails on the missing entry.
2. **Interface and holder.** `src/types.ts`, `src/current.ts`, `src/index.ts`. Tests first: `current.test.ts` and `types.test.ts`.
3. **Storage.** `src/web/storage.ts` (`createStorageArea(getStore, prefix)` used for both areas, every access inside `try`).
4. **Notifications.** `src/web/notifications.ts`.
5. **File picking.** `src/web/files.ts` (hidden input, `change` and `cancel`, one pending call).
6. **Sound and `createWebPlatform`.** `src/web/sound.ts`, `src/web/index.ts` with `createWebPlatform(options?)` and the R5 test.
7. **Lint.** Cases first, seen failing. Then the changes in `eslint.config.js` (decision 3), the test file added to the `test` and `test:lint-rules` scripts, then the edits of the TOKI-002 spec (decision 5). Then `pnpm lint` over the whole repo.
8. **Wiring.** `@toki/platform` as `workspace:*` in `apps/web`, one `setPlatform(createWebPlatform())` call in `main.tsx` before `createRoot`. Add the new test commands to the Commands section of `CLAUDE.md`.
9. **Verify.** The five commands of R27 at the root, `pnpm --filter ./apps/web build`, `pnpm size`, the two by-hand lint checks of Testing. The check in Chrome, Safari and Firefox (dialog, prompt, sound, tab and device values) is done by the owner and recorded in the PR; the PR says it is not done by Claude.

## What can break (grilling, round 1)

- **Riskiest step: 7, lint.** A pattern that is too wide could ban `@toki/platform` itself, or one that is too narrow could miss `import("@toki/platform/web")`. Mitigation: the test has the allowed case (`@toki/platform` has no message) and the dynamic and template forms, and it fails when the ban is removed.
- **Rule 1 now covers `packages/platform/src`.** If `current.ts` or `types.ts` use a global outside the allow list (`Promise` is fine), `pnpm lint` fails. Mitigation: step 2 runs `pnpm lint` right after the files exist.
- **jsdom has no `Notification` or `Audio` that behaves like a browser.** The tests replace them with fakes; the real behaviour is the by-hand check, which this plan does not claim to run.
- **`createWebPlatform()` read at import time** would break R5 and the `node` test. Mitigation: nothing in `web/` touches a global outside a function body; `index.test.ts` checks it with recording fakes.
- **Two Vitest environments in one package.** If the `node` docblock is ignored, `current.test.ts` passes for the wrong reason. Mitigation: the test first asserts `typeof document === "undefined"`.
- **Lockfile churn.** Adding `jsdom` and `vitest` to a new package must not change other packages' versions; the diff of `pnpm-lock.yaml` is read before commit.
