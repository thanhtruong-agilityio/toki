# TOKI-023 Sign-in screens: plan

Ticket: TOKI-023 (issue 20). Branch: `feat/toki-023-sign-in-screens`. Tier: M.
Spec (source of truth, answered 2026-11-19, PR 161): `docs/specs/2026-11-16-sign-in-screens-design.md`. Requirements `R1` to `R47` and concerns `1` to `16` are named as in the spec; this plan does not copy its tables, the tests type them in from the spec.

## Design

The spec is the design. This plan adds only what the repository on 2026-11-19 changes.

Scope of this PR, decided by Thanh Truong on 2026-11-19: **the screens first, the real API later.** TOKI-022 (PR 162, open), TOKI-032 (`api.request`, Blocked) and TOKI-020 (`parseEmail`, in progress) are not on `main`. This PR builds everything that does not need them, against a small interface, and a second PR (steps 7 and 8) joins it to the real client when they land.

Build order: i18n texts; the session store in `client-core`; the pieces of `ui-web/sign-in`; the web wiring (guard, `/login`, modal) against a fake `SignInApi`; then, after TOKI-022 and TOKI-032 merge, the real calls and the end-to-end tests.

### Decisions taken in this plan (differences from the spec)

Found by comparing the spec with `main` on 2026-11-19.

1. **`ui-web` has no `@toki/i18n` dependency**, and the spec says no component holds a literal text (R28) and that `CodeStep` brings its own texts (R41). Built: `@toki/i18n` is added to `packages/ui-web` (workspace link, a portable package, allowed by the boundary rules) and the sign-in components call `useTranslation()`. `AppShell` keeps its `labels` props; this ticket does not change it.
2. **Props added to the pieces of `ui-web/sign-in` (not removed):** `CodeStep` and `CodeField` take `codeLength`, and `EmailStep` takes `isValidEmail(address)`. Reason: `CODE_LENGTH` and `parseEmail` are in PR 162 and not on `main`, and `ui-web` must not import them from a branch. `apps/web` passes the shared constant and function (R9, concern 10 stay true: no number of this ticket).
3. **`createSignInCalls(api)` takes a minimal `ApiRequest` type** (`(path, init) => Promise<result>` with the result kinds of the spec's table: ok, http error with code and details, `network`, `timeout`, `invalid_response`). It is declared in `client-core/src/auth/sign-in.ts`. When TOKI-032 lands its `api.request` is passed as the argument (R43 already says the client is an argument) and the type is replaced by the client's own.
4. **Request and response shapes are local until TOKI-022 merges.** `client-core/src/auth` carries local types for the four answers, taken from `docs/specs/2026-11-16-sign-in-api-design.md`; step 7 replaces them with the shared schemas of `packages/shared/src/auth/schemas.ts` and the error codes. The three session error codes are plain strings until then.
5. **`apps/web/src/main.tsx` mounts no `I18nProvider`** today (the app is English only). Built: it mounts one with the language last used on the device (`platform.storage.device`, key `signIn.language`), else English (concern 3); the look is read the same way. No switch is added.
6. **No Mailpit or seeded server in Playwright** (TOKI-008). The end-to-end cases of the spec's Testing need TOKI-022; until then the browser cases run with `page.route` stubs (R42) and the real-server cases are step 8.
7. **`apps/web` has no `@toki/client-core` dependency**; it is added with step 4 (lockfile change, versions untouched).
8. **R42:** `app-layout.test.tsx`, `e2e/app-wiring.spec.ts` and `e2e/sample.spec.ts` open `/` and expect the app; they get a signed-in stub of `GET /api/v1/auth/session` in step 5.

### Deferred to the second PR (steps 7 and 8)

R43 (calls through the real `api.request`, the line `api.setOnUnauthenticated(reportUnauthenticated)`), R45's `timers.after` from `apps/web/src/client.ts` (this PR gives `SignInTimeProvider` its own `timers` prop with a fake in tests), the real shared schemas, and the real-server end-to-end cases (TS-001, TS-006, TS-011, session ended, deactivated). The PR description says so; the ticket stays open until the second PR is merged.

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :-- | :-- | :-- |
| R28, R47 texts | 1 | `pnpm i18n:check`; `signIn.test.ts` in `packages/i18n`: every key of the spec's Texts table, one and other forms of the three counted keys with 1 and 4 (en, vi) |
| R39 session state | 2 | `session-store.test.ts`: every row of the state table, two refusals give one change, the three functions touch nothing else, `getSessionState`, `subscribeSession` after unsubscribing; `check-clock-use.sh` clean |
| R9, R10, R36 field and send action | 3 | `CodeField.test.tsx` (letters, 7th digit, paste `ab12cd`, `123 456`), `CodeStep.test.tsx` (once on 6th digit, once on Enter, nothing with 5, nothing while a check runs) |
| R4 to R8, R13 to R23, R37, R41 | 3 | `CodeStep.test.tsx` and `EmailStep.test.tsx`: one case per outcome of `send` and `resend`, text under the right field, state after; `expiresInSeconds` 0 opens expired |
| R12, R18, R19, R37, R45 waits | 3 | fake `timers` and the test clock of `@toki/shared`: 59 and 60 seconds, minutes rounded up (1, 60, 61, 719), countdown; a search of `ui-web/src/sign-in` and `client-core/src/auth` finds no `setTimeout`, `setInterval`, `Date.now(`, `new Date()` |
| R24, R26, R27, R46 modal | 3 | `SessionEndedModal.test.tsx`: Esc and outside press ask nothing, focus on the text or the button, no focus return, inert behind, one modal for many refusals |
| R31, R33, R34 | 3 | roles, `aria-describedby`, `aria-invalid`, live region; reduced motion removes the shake; only tokens and base components (a source search for colour literals) |
| R1 to R3, R25, R40, R44 guard and `next` | 4, 5 | `guard.test.ts` (four states, flag `public`, `next` rule: `/c/1` kept, `//other.example`, `/\other.example`, `https://other.example`, `/login` give `/`), `login.test.tsx` with a fake `SignInApi` |
| R14, R15, R32, R35 tab record | 5 | `login.test.tsx`: record in tab storage, removed on sign-in, on 'Use a different email' and at expiry; reload shows the code step with the remaining wait; nothing in the address or the console |
| R38 workspace name | 5 | shown after the answer, absent while it loads and when it fails |
| R29, R30 layout and keyboard | 6 | `e2e/sign-in.spec.ts` with `page.route` stubs at 360, 719, 720, 1099, 1100 px, Calm and Focus, en and vi; keyboard-only run; axe check |
| R42 | 5 | the three tests of decision 8 pass with the stub |
| R43, R21, R22 with the real client | 7 | fake `api.request` with the kinds and a 401 with each code; hook called once per 401 (after TOKI-032) |
| R1 to R3, R7 to R11, R15 to R17, R20, R24 to R26 end to end | 8 | `e2e/sign-in-server.spec.ts` against the real server and Mailpit (after TOKI-022) |

## Steps

Each step is one commit, tests first. After each: `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, the tests of the touched package; at step 6 also `pnpm test`, `pnpm test:e2e`, `pnpm size` (limit 200000 bytes is not raised), `pnpm i18n:check`.

1. **Texts.** `signIn` and `sessionEnded` namespaces in `packages/i18n/src/messages/{en,vi}` and both `index.ts`; Vietnamese with 'bạn' (R47).
2. **Session store.** `packages/client-core/src/auth/session-store.ts`, a `test` script in `client-core`, export from `index.ts`.
3. **Pieces of `ui-web/sign-in`.** `CodeField`, `SignInTimeProvider`, `SignInCard`, `EmailStep`, `CodeStep`, `SessionEndedModal`, examples for the preview page; `@toki/ui-web` gains `@toki/i18n`.
4. **Calls and hook.** `client-core/src/auth/sign-in.ts` (`createSignInCalls`), `apps/web/src/clock.ts`, `useSession.ts`; `@toki/client-core` added to `apps/web`.
5. **Wiring.** Guard and flag `public` in `__root.tsx`, `/login`, the modal mount, `I18nProvider` in `main.tsx`; the R42 stubs. Open as a draft PR after this step so CI runs.
6. **Browser tests with stubs, layout, keyboard, accessibility.** Mark the PR ready.
7. (After TOKI-032.) Real client, shared schemas, the hook line.
8. (After TOKI-022.) Real-server end-to-end cases.

## What can break / riskiest step

- Step 5: the guard makes every existing test that opens `/` fail until R42's stub is in; they are changed in the same commit.
- Step 3: the focus rules (modal text focus, no return) rest on `Modal` props that exist (`initialFocusRef`, `returnFocus`, `backdrop="opaque"`); a test proves each one instead of trusting the props.
- Steps 7 and 8 depend on two other tickets; if their shapes differ from the local types of decision 4, the types change, not the screens.

## Decisions from grilling round 1 (2026-11-19, Thanh Truong)

- Steps 1 to 6 are one PR that is merged when done; its description names what is deferred (steps 7 and 8). The ticket stays In Progress until the second PR is merged.
- The sign-in components in `ui-web` call `useTranslation()` (decision 1 stays).
- The language is read from `platform.storage.device` (`signIn.language`), else English; no browser-language fallback (concern 3 as decided).
- Step 5 adds a test that the shell of TOKI-015 still renders its English texts after `I18nProvider` is mounted in `main.tsx`.
- The Vietnamese texts are written at step 1 with 'bạn'; the PR description marks them for review.
