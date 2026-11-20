# TOKI-099 Account menu, Sign out and signed-in devices: plan

Ticket: TOKI-099 (issue 91). Branch: `feat/toki-099-account-menu-devices`. Tier: L.
Spec (the source of truth): `docs/specs/2026-11-17-account-menu-devices-design.md`.
Requirements are named `R1` to `R24`, concerns `1` to `15`, Tables A and B, as in the spec; this plan does not copy them, the tests type their values in from the spec.

## Design

The spec is the design (registry, sign-out order, tab signal, sessions API, devices section, page, texts). This plan adds only what the repository, as it is on `main` at `db25011`, changes.

Where the code differs from the spec (decided here, none changes a requirement):

- Paths: the shell is `apps/web/src/routes/app-layout.tsx` (`AppShellRoute`) and `apps/web/src/layout/sections.ts`, not `shell/…`. Tests live in `apps/web/tests/…` and `packages/platform/tests/…`, not beside the source; the new files follow that.
- `ToastProvider` is mounted inside `AppShell`, below `AppShellRoute`, and each provider draws its own live region, so a second provider would add a second region with no anchor (it would not be centred in `main` and could cover the bottom bar under 720 px). `useSignOut` and `useOnlineGate` call `useToasts`, which throws outside a provider. Decided: no second provider and no change in `ui-web`. `AppShellRoute` keeps the state that needs no toast (the registry provider, `useMenuTrigger`, `useSession`, `useSigningOut`, the `account` prop). A child component `AccountHost`, rendered as a child of `AppShell` next to the `Outlet` (so inside its provider), calls `useSignOut`, registers the `preferences` and `signOut` entries, runs the tab listener (R12) and renders `AccountMenu` (a sibling of the shell's card, never inside `button.ucard`). A test mounts the real `AppShellRoute` and finds one toast region and the failed-sign-out toast; the browser test at 360 px asserts the toast does not overlap the bottom bar. If `Menu` is not positioned fixed or in a portal, so that its place under `main` clips it, the fallback is to pass the toast `show` out of the shell instead, still with one provider.
- The session is not wired into `AppShellRoute` yet (it takes `role` as a test prop). Step 6 reads `useSession()`, builds `account` from the `signedIn` user, passes the real role to `visibleSections`, and keeps the `role` prop only for the existing tests.
- Sign out and the guard: after `markSignedOut()` the root's guard may send the router to `/login?next=<old path>`, and going to `/login` while still `signedIn` is sent back to `/`. Which navigation lands last is not known. Step 6 starts with a test of the final history entry after all effects have flushed. If the race shows, the guard is the only one that navigates: `endLocalSession` sets a one-shot flag that `decideGuard` reads to return `login` with no `next` (this would touch `guard.ts` and `routes/__root.tsx`, named in the PR).
- Overlap of the tab signal and a local sign-out: `endLocalSession` clears the running flag; an in-flight `signOut` that finds the state already `signedOut` returns `"done"` with no toast and no second post; the listener ignores a message while the state is not `signedIn`. A forged same-origin `signedOut` only signs the interface out (the spec accepts this).
- `ensureOnline` is a hook (`useOnlineGate()`), synchronous, returns a boolean: R7 step (2) is `if (!ensureOnline()) return "blocked"`. `useSignOut` calls the hook and keeps the function in a ref (the module-level running flag, R7, stays outside React).
- `personHue` (TOKI-033 R28) is not on `main`. This ticket adds `apps/web/src/people/person-hue.ts` with the same signature and names the file in the PR for TOKI-033 to replace. The hue is a pure function of the id.
- `apps/web/src/clock.ts` and `timers` in `apps/web/src/client.ts` already exist; R13 adds only `sessions` to `client.ts`, and R15 creates no clock.
- The rows `signOutDevice` and `signOutOtherDevices` already exist in `actionPatterns`; nothing is added.
- `sections.ts` holds only `home`. The `preferences` row goes after `home`. The ordering test asserts that `preferences` is the last id of `visibleSections("admin")`, and a comment in `sections.ts` says later rows go before it. This is a change from the spec's "the order does not depend on which ticket merges first": TOKI-025 must insert `people` and `admin` above `preferences`. The PR says so.
- `pnpm lint:boundaries` is not a script in this repository, and `pnpm lint` has no rule for deep imports from `apps/web`. The check of R24 is the exports map of `@toki/client-core` (only `.`) plus a test that reads `apps/web/src/account` and finds no `@toki/platform/web` and no `/src/` import. `@toki/platform` also exports `./web`, so the test is needed.
- `personHue`: copy the formula of TOKI-033 R28 exactly and test it with its values (read the spec first); if it has none, say so in the PR.
- Table B names the key `account.devices.browser.other`, but `pnpm i18n:check` refuses a key part named `other` (a plural form name). The key is `account.devices.browser.otherBrowser`, with the same texts; `device-words.ts` maps the code `other` to it and every other code to its own name. The PR names this for the spec.
- The tests of `@toki/client-core` sit beside the source (`src/auth/…`), not in a `tests` folder. Step 2 reads how they run today (root Vitest) and names the command; `pnpm --filter @toki/client-core test` is used only if a `test` script exists, and adding one is in scope.
- The 10 s task window uses `timers.after` of `apps/web/src/timers.ts`; step 5 reads that file first and names the exact API (`after(ms, fn)` returning a cancel function, as the exploration reported).
- The `e2e/support/session.ts` stub covers only `GET /auth/session`; `e2e/account-menu.spec.ts` stubs `DELETE /auth/session`, `/auth/sessions` and `bootstrap` itself.

Order of work: the platform and client-core pieces first (no UI), then the web pieces bottom-up, the page and the browser test last.

## AC to step to test

| Requirement | Step | Test (written first, seen to fail) |
| :---- | :---- | :---- |
| R10 | 1 | `packages/platform/tests/web/tabs.test.ts`: two `createWebPlatform()` instances exchange `signedOut`; a tab does not get its own message; fake `BroadcastChannel` absent and throwing (`post` and `subscribe` never throw); malformed message dropped; channel closed after the last listener. `tests/types.test.ts` updated to five members |
| R13 | 2 | `packages/client-core/tests` or beside `auth/`, as `emergency` does: fake `fetch`; four methods and paths; encoded id; 204; 404, 400 `current_session`, 401 (hook called); `{ sessions }` read to an array; no `sessions` is `invalid_response`; unknown key dropped; `browser: "brave"` read as `unknown`; missing `id` is `invalid_response` |
| R22 | 3 | `account` namespace in `en` and `vi` (31 keys of Table B), five `common` keys; `pnpm i18n:check`; a test reads every key of Table B in both languages |
| R2 | 4 | `account-detail.test.ts`: member, admin, unknown, missing; source scan finds no `Owner` |
| R3 | 4 | `account-entries.test.tsx`: wrong-order registration gives fixed order; last wins; unmount removes only the still-registered one; `null` removes; a group for `signOut` ignored; ten re-renders with an inline `onSelect` render the consumers at most twice |
| R7, R8 | 5 | `sign-out.test.ts`: fake API client, fake `ensureOnline`, recording `markSignedOut`, platform and router; the six paths; order of calls in (5); a second call from the same and from a second hook instance returns `"busy"` with one API call; three fake tasks (slow, throwing, fast) and a recording fake `timers` (no Vitest fake time): the call waits for the slow one, a never-settling task releases at the recorded 10 000 ms timer; a removed task is not run |
| R9, R12 | 6 | the real `createConversationStore`, the real session store and a memory router with the real guard: `signOut()` leaves the store `idle`, state `signedOut`, address `/login` with no search; same with `AppShellRoute` unmounted before `markSignedOut()`; a `signedOut` tab message does the same; malformed and post-unmount messages change nothing |
| R11 | 6 | pressing Sign out finds no `role="dialog"` before the call |
| R1, R4, R5, R6 | 6 | `apps/web/tests/account/account-menu.test.tsx` (new, on the real `AppShellRoute`; `app-layout.test.tsx` only gets a platform and the new card and link): `button.ucard` named "Your account menu" with the name; no `.usercard` when `signedOut`; "Signing out…" and `aria-busy` during a slow call; exactly two `menuitem`s, then with stand-in `setStatus` and `focus` group the order; separators and headings; `user-event` for press, ArrowDown, ArrowUp, chosen item and Esc with focus back on `button.ucard`; the failed-sign-out toast shows once |
| R23 | 6 | same menu for member and admin; no item named Active, Away or Do not disturb |
| R14, R15 | 7 | `use-devices.test.tsx`, `use-date-context.test.tsx` and `signed-in-devices.test.tsx`: loading, ready, failed then Retry, a reload keeps rows and sets `aria-busy`, a failed reload keeps rows, two overlapping reads where the first answers last; rows with phone and laptop, one `devnow`, time lines, `unknown` codes, bad date, two identical rows ("1 of 2", "2 of 2"), server order |
| R16 to R20 | 7 | button per other row with distinct accessible names; Cancel, Esc and outside press send nothing; Confirm sends one `endOne` (second press while busy sends none); 204, 404 with id gone, 404 with id still there, 500; "Sign out all other devices" with 1, 2, 3 others, none (no button, `noOthers`), a list that grew; focus on the `h2` after a removed opener and on the button after Cancel; offline (`setConnectionCheck(false)`) sends nothing and keeps the dialog |
| R21 | 8 | `sections.test.ts` order; route test for `/prefs`; `e2e/account-menu.spec.ts` as the spec lists (two looks, 1100 px menu, Sign out, Back, two pages, `/prefs` at 360, 719, 720, 1099, 1100, button height at 719 and below, the two confirmations) |
| R24 | 9 | every command of the spec's R24 (the boundary check as in Design: exports map and the import test; no `lint:boundaries` script exists); bundle size under the TOKI-006 limit; the section loaded with its route |

## Steps

1. `packages/platform`: `TabMessage`, `tabs` in `Platform`, `web/tabs.ts`, wire into `createWebPlatform`, update the member-count test (`tests/types.test.ts`, title and array) and the hand-made `fake(): Platform` in `tests/current.test.ts`, the new test. Grep `apps/web/tests` for any other hand-made `Platform`. No browser global in the interface file (TOKI-018 R24). Typecheck is green at the end of the step.
2. `packages/client-core/src/auth/sessions.ts` (`createSessionsApi`), export from `index.ts`, tests; one line `export const sessions = createSessionsApi(api)` in `apps/web/src/client.ts`.
3. `packages/i18n`: `account` namespace in both languages (Table B), the five `common` keys (check first whether another ticket added them), list in both `index.ts`; `pnpm i18n:check`.
4. `apps/web/src/account/`: `account-detail.ts`, `account-entries.tsx`, and `people/person-hue.ts`.
5. `sign-out.ts`: module-level running flag with `useSyncExternalStore`, `useSignOut`, `useSigningOut`, `registerBeforeSignOut`, `endLocalSession` (clears the flag). Only the unit tests of R7 and R8 here (fake API, fake `ensureOnline`, fake router and store); the tests that need the real `AppShellRoute` are in step 6.
6. `AccountMenu.tsx`, `AccountHost` (child of `AppShell`: `useSignOut`, the two built-in entries, the tab listener, the menu), `AppShellRoute` reads `useSession()` and passes `account` and the real role, the registry provider, `account.css` for the menu if it needs any. The tests of R9 (history after effects flush), R11 and R12 are written first in this step; the guard flag is added only if the race shows.
7. `use-date-context.ts`, `device-words.ts`, `use-devices.ts`, `SignedInDevices.tsx`, `account.css` (Table A), the confirmations, focus rule.
8. `routes/preferences.tsx`, the route in `router.tsx`, the row in `layout/sections.ts`, `e2e/account-menu.spec.ts`.
9. Run the commands of R24; look at the page at 360 px in the browser pane; fill the PR template.

## What can break, and the riskiest step

- Riskiest step: 5, Sign out. The order of the six steps is the contract (a failed call must leave the person signed in; the signal and the reset must not depend on an effect of a layout that the state change unmounts). The 10 s task window must use `timers.after` from the web app, not `setTimeout`, so the test can fire it. A never-settling task must not hold the call: race the tasks against the timer and cancel the timer when the tasks settle first.
- Step 6: `AccountHost` inside the one `ToastProvider` of the shell. A test must fail if the toast of a failed sign-out is rendered twice or not at all; the real provider is used, not a stand-in.
- Step 6: `endLocalSession` runs from the tab listener while `AppShellRoute` is mounted and from `signOut`; it must be safe to call twice (`reset()` of an empty store and `markSignedOut()` of a signed-out state are no-ops, which the tests assert).
- Step 5: the running flag is module-level; tests must reset it between cases or they leak into each other.
- Step 2: `schema: z.undefined()` with a 204; the schema library is the one of `@toki/shared`, not a second copy.
- Step 7: focus after a removed opener (R19) is not reproducible by a real press in jsdom; assert `document.activeElement` after the reload resolves, as TOKI-093 did.
- Step 1: `BroadcastChannel` is absent in jsdom; the tests inject a fake, and the browser test covers the real one.
- Step 3: another ticket may have added `common.today` and the role keys; adding them twice breaks the i18n check. Read the files first.
- Lockfile and `client.ts` can conflict with open branches (TOKI-025 touches `sections.ts` and `common`); rebase, do not merge by hand.
- Roll back: delete `apps/web/src/account/`, `routes/preferences.tsx`, `sessions.ts`, `tabs.ts`, the `account` namespace and the e2e file; revert the one line in `client.ts`, the `sections.ts` row, the `Platform` member and the `AppShellRoute` split.

## Build notes

What the build found, none of it a change of a requirement. The plan was edited after the Dev approved it (this section and the `otherBrowser` line of Design), so it needs the Dev's approval again before the pull request.

- `personHue` is in `apps/web/src/people/person-hue.ts`, the path TOKI-033 R28 names, with the formula of that spec (FNV-1a 32-bit over the lower-cased UTF-8 id, modulo 360) and a table test of values computed apart. TOKI-033 keeps the file.
- The guard race of step 6 did not show: the test of the final history entry (the real route tree and guard) ends on `/login` with no search. `endLocalSession` uses `router.history.replace("/login")` after `markSignedOut()`; no flag was added to `guard.ts`.
- `SectionPage` draws its own `div.secbody`, so the page holds a `div.prefs` inside it, not `div.secbody.prefs`.
- Table B names a key `account.devices.browser.other` that the i18n check refuses; the key is `otherBrowser` (Design).
- Test files changed that the plan did not name: `apps/web/tests/client.test.ts` (the exports now hold `sessions`), `packages/platform/tests/web/index.test.ts` (five members), `packages/i18n/tests/common.test.ts` (the five new `common` keys), `apps/web/tests/routes/app-layout.test.tsx` (a platform, the card, the Preferences link) and `apps/web/tests/layout/sections.test.ts`. The state file `docs/plans/TOKI-099.state.json` is changed by `dev-state`.
- The browser test stubs `**/api/v1/auth/**` and `bootstrap`; the shell sends no bootstrap call yet, so that stub only records one.
- The status element of R7 uses the class `acct-status` of Table A. An import test of `apps/web/src/account` stands for the rule of R24.
- The overlap of a toast with the bottom bar is asserted in the browser test at 360 and 719 px, and `account-menu.test.tsx` counts the toast regions (one).
- Tests of step 7 were written together with the component, not before it; the order was not as the plan says. Two overlapping reads are tested on the hook.
- The three sign-in browser tests (`layout 360, 719, 720 px calm en`) timed out once in a full run under load and passed in a run of their own (50 of 50).
- `pnpm --filter @toki/client-core test` and `pnpm lint:boundaries` do not exist; the client-core tests run with the root `vitest`, and the import rule is checked by the exports map and the existing lint.
- Not run here: the `server-db` projects (no database). `tests/main.test.ts` of the server fails here on the mail values; no server file is changed by this ticket.

## Grilling (L, up to two rounds)

Round 1 (Opus, read-only): ten findings, all taken into this plan.

- Two toast providers draw two live regions, the outer one unanchored: no second provider; `AccountHost` lives inside `AppShell` (Design).
- Sign out may race the guard and bring `?next=` back: test the final history entry first, guard flag only if it shows (Design, step 6).
- No step wired `useSession()` into `AppShellRoute`: added to step 6.
- The client-core test command did not exist as written: step 2 names the real command (Design).
- Step 1 broke `fake(): Platform` in `current.test.ts`: added to step 1.
- Steps 5 and 6 could not each end green: tests of R9, R11, R12 moved to step 6.
- The `preferences` ordering claim was false: the test asserts it is last, and the PR tells TOKI-025 (Design).
- `pnpm lint` does not cover the import rule of R24: replaced by the exports map and an import test (Design).
- Tab signal against a local sign-out in flight: `endLocalSession` clears the flag, in-flight sign-out returns `"done"`, listener ignores when not `signedIn`; test "message arrives during (4)" added to step 6.
- `personHue` formula and the `timers.after` API unverified: both read before use (Design).

Round 2: not run; round 1 left no open question that needs a second pass. Say so at approval if the Dev wants one.
