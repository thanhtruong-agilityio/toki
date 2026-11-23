# TOKI-033 Conversation list: plan

Ticket: TOKI-033 (issue 122) · Tier L · Branch `feat/toki-033-conversation-list`
Spec (source of truth, accepted in PR 191): `docs/specs/2026-11-17-conversation-list-design.md`. Requirement numbers `R1`..`R35` below are the spec's; each requirement's "Check" sentence is the list of cases its test holds. The store it reads is TOKI-032 (`createConversationStore`, on `main`).

## Design

The spec fixes behaviour, Table A (CSS) and Table B (texts). This section says how it fits the code on `main` today, and the eight places where the code differs from the spec's text. None changes a behaviour the owner decided; each is a build detail or a test file the spec did not list.

### What is already there

- `packages/ui-web`: components are exported from `src/components/index.ts` (Chip, ChipGroup, Field, Badge, Tag, Avatar, EmptyState, IconButton, icons `HashIcon`, `LockIcon`, `UsersIcon`, `StarIcon`, `PlusIcon`, `DownIcon`); CSS is imported per component; tests sit in `packages/ui-web/tests/`, `readCss` is in `tests/support/css.ts`, and `tests/layout/shell.css.test.ts` is the model for a typed-in Table A test. `AppShell` (TOKI-015) already takes `list`, `chatOpen`, `workspace`, `panel`, `panelLabel`, `onNavigate`.
- `apps/web`: `router.tsx` (`appLayoutRoute.addChildren([indexRoute])`), `routes/app-layout.tsx` (`AppShellRoute`, passes only sections, labels and `onNavigate`), `client.ts` (`api`, `conversations`), `useSession.ts`, `guard.ts`, `platform.storage.device` (web build prefixes keys with `toki:`), `useTranslation` of `@toki/i18n/react`. Tests are in `apps/web/tests/`; e2e in `e2e/`.
- `packages/client-core`: `createConversationStore` has every member of "What the list reads", and `foldSearchText` already folds diacritics (`src/conversations/search.ts`), so **R35 is not blocked**: its case is written, not skipped.
- `packages/i18n`: one file per namespace per language under `src/messages/{en,vi}/`, listed in each `index.ts`. `nav.conversations` exists. The check is `pnpm i18n:check`.

### Where the code differs from the spec's text (decided here, nothing for the owner)

1. **R1 export test.** `packages/ui-web/tests/components/exports.test.ts` (about lines 166 to 182) requires every export of the entry, other than the known groups, to end in `Icon`; `tests/layout/exports.test.ts` has the same pattern. Adding `export * from "./conversation-list"` fails them. This ticket adds `conversationList` to the known groups of both tests (one line each); R1's own test lists the new exports.
2. **R31 `pnpm lint:boundaries`.** It does not exist (TOKI-002 concern 13 dropped it); `pnpm lint` runs the three boundary rules. The final check runs `pnpm lint`.
3. **Tests that assert the page "Toki".** Besides the two named in Scope, `e2e/component-preview.spec.ts` (R1, line about 34), `apps/web/tests/app-providers.test.tsx` (about line 57) and `apps/web/tests/routes/app-layout.test.tsx` (about line 62, and the test "gives the shell no list, no panel, no workspace and no account") assert the old index page or the old shell. They are changed in this ticket: the index page is replaced by R23, the shell now gets a list, a workspace and a panel slot. `apps/web/tests/router.test.ts` only checks that `indexRoute` is a child and stays.
4. **Stubs for the bootstrap request.** The layout route now calls `conversations.load()`. A Playwright test that opens the signed-in app with no stub for `GET /api/v1/bootstrap` reaches the real server, gets a 401, `reportUnauthenticated` flips the session to `ended` and the session-ended modal appears. So the bootstrap stub is added to every e2e file that opens the app signed in: `e2e/sample.spec.ts`, `e2e/app-wiring.spec.ts`, `e2e/component-preview.spec.ts` and the five `openAppSignedIn` uses in `e2e/sign-in.spec.ts` (through one helper `stubBootstrap` in `e2e/support/`, next to `stubSignedIn`). In jsdom, `loadApp`, `app-layout.test` and `app-providers.test` get a fake store, so no test fetches.
5. **R26 panel slot.** `AppShell` treats any non-null `panel` as open. `AppShellRoute` therefore gives `panel` as `undefined` when no owner is set, and as the stable `PanelOutlet` element only while `{ owner, label }` says a page owns the panel.
6. **R20, R23 history state.** `routes/__root.tsx` declares `interface HistoryState { email?: string }`. `fromList` and `opening` are added there.
7. **R21 (b) not-found view.** The "not-found view of TOKI-006" is an inline `notFoundComponent` in `__root.tsx`. It is extracted to `apps/web/src/routes/NotFoundView.tsx` (same markup, same text), used by `__root.tsx`, `UnjoinedView` and the route's direct draw. No change of behaviour or text.
8. **R29, "does not re-render".** `applyBootstrap` builds new arrays on every refresh, so a refresh with identical content gives the pane a new list object. The no-re-render case of R29 covers an `isRefreshing` or event-number change, which is what the spec says; the plan does not promise more.

Also: a test row for R2's empty-`textContent` check uses an empty `avatar.name` (the `Avatar` draws initials); `getGeneralId()` is `string | null`, so R22 handles `null` (no redirect until it is not null).

### Where the code goes

```
packages/ui-web/src/conversation-list/   ConversationList.tsx, conversation-list.css, index.ts   (+ tests/conversation-list/)
packages/ui-web/src/index.ts             + 1 line
packages/i18n/src/messages/{en,vi}/conversationList.ts   + 2 index lines
apps/web/src/conversation-list/          ConversationListPane.tsx, list-actions.tsx, use-conversations.ts, last-viewed.ts, device-memory.ts
apps/web/src/conversation/               ConversationPage.tsx, UnjoinedView.tsx
apps/web/src/people/person-hue.ts
apps/web/src/shell/shell-slots.tsx
apps/web/src/routes/                     conversation.tsx (new), NotFoundView.tsx (new), index.tsx, app-layout.tsx, __root.tsx, router.tsx (changed)
e2e/conversation-list.spec.ts, e2e/support/bootstrap.ts   (new)
```

### Order and why

Pure pieces first (they have no dependency on each other), then the pane, then the routes, then the layout, then the tests of earlier tickets, then the browser test. The component is built and tested alone in `ui-web` before anything wires it.

## Plan

Each step is test first: write the test from the spec's Check sentence, run it and see it fail for the right reason, then write the code. Commands run from the worktree root with `export PATH=/Users/thanhtruong/.nvm/versions/node/v22.23.5/bin:$PATH` and `corepack pnpm`.

| # | Step | Requirements |
| :-- | :---- | :---- |
| 0 | Baseline: `pnpm build && pnpm size`, record the gzip size of the initial JavaScript in the state file (limit 200000 bytes) | R31 |
| 1 | `person-hue.ts` and its unit test | R28 |
| 2 | i18n namespace `conversationList` (en, vi), keys of Table B including `group.unread` | R27 |
| 3 | `ConversationList` (TSX, CSS of Table A) in `ui-web`, exports, DOM, CSS and sources tests; fix the two export tests; `pnpm size` after the step | R1 to R14, R2 |
| 4 | Device memory (`device-memory.ts`: filter, collapsed, `readStateAvailable`) and `last-viewed.ts` | R18, R22 |
| 5 | `list-actions.tsx` registry, `shell-slots.tsx` slot, and `session-sets.tsx` (a provider that holds `seen`, `memberChecked` and their clear on reset, so the route and the layout share them and a StrictMode remount does not lose them) | R25, R26, R21, R32 |
| 6 | Store seam, route skeleton, then the pane: (a) `conversations/test-support.ts` builds a real `createConversationStore` over a fake api and `apps/web/tests/support/` mocks `src/client` with it (used by `loadApp` too); (b) `conversation.tsx` registered in `router.tsx` with a stub component and `HistoryState` extended, so `navigate({ to: "/c/$conversationId" })` typechecks; (c) `use-conversations.ts` and `ConversationListPane.tsx` (groups, unread total of a collapsed group, filters, search, toggle, open row, R33, R34) | R15 to R17, R19, R20, R29, R33, R34 |
| 7 | `NotFoundView` (extracted), `ConversationPage`, `UnjoinedView`, the real body of `conversation.tsx` | R21 |
| 8 | Index redirect and narrow rule (`routes/index.tsx`); its test replaces the "Toki" assertion of `routes/app-layout.test.tsx` and `app-providers.test.tsx` in this same step | R23 |
| 9 | `e2e/support/` bootstrap stub installed inside `stubSignedIn` and inside `stubAuth` (not per call site); then `app-layout.tsx`: list, `chatOpen`, workspace, slots, registry, Home through `onNavigate`, the store's life. The old test "gives the shell no list, no panel, no workspace and no account" is replaced here. `pnpm size` after the step | R23, R24, R32 |
| 10 | Final grep of `e2e/` and `apps/web/tests/` for the old page "Toki", `stubSignedIn`, `stubAuth` and `openAppSignedIn`; update the remaining files (`sample`, `app-wiring`, `component-preview`, `sign-in`) | R30, Scope |
| 11 | `e2e/conversation-list.spec.ts` (five widths, two looks, three fixtures, the 'ngoc' case); one unit test parses the three fixtures with the schema of `packages/shared` | R30, R35 |
| 12 | Whole check: `typecheck`, `lint`, `format:check`, `test`, `i18n:check`, `build`, `size`, `test:e2e`; the pull request records the 500-conversation measurement (concern 17) and the by-eye comparison with the prototype in Calm and Focus at 1100 and 360 px (spec Testing) | R31 |

Every step ends green: an edit to a test of an earlier ticket is made in the step that breaks it (steps 8 and 9), so no commit in between is red.

## AC to step to test

| Acceptance (spec) | Step | Test |
| :---- | :---- | :---- |
| Groups Starred, Channels, Direct with collapse, in the store's order (F09, R4, R15) | 3, 6 | `ConversationList.test.tsx` DOM order; pane test with a fake store; no conversation twice |
| `+` on Direct messages, only with a registered opener; hover rule (D-154, R5, R13, R25) | 3, 5 | DOM test; CSS test of Table A; browser test with mouse and with touch |
| Filters All, Unread, Mentions; search by name, in both looks; Clear filter (R9 to R11, R17, concern 1) | 3, 6 | DOM tests; pane test; browser test: field shown in Calm and Focus |
| Row look: bold, count, `@`, muted, star, private, Deactivated (R6, R7, concern 10) | 3 | the 8-combination and the 0, -1, NaN, 1, 100 table tests; each kind |
| Collapsed group shows the unread total, NaN and negative rows ignored (R4, R15, concern 18) | 3, 6 | rows 0, -1, NaN, 3 give 3; 3, -1, 2 give 5; muted left out; 0 draws none; expanded draws none |
| Collapsed groups and filter remembered per device, per person; only `all` restored before TOKI-053 (R18, concern 21) | 4, 6 | fake storage: stored, invalid, unknown, other person, refusing; `readStateAvailable` false and true |
| A conversation that opens is shown: filter, search, collapsed group reset (R34, D-076) | 6 | memory-router cases of R34 |
| `/c/:id` per conversation; not in list; was in list; failed or loading store (R21) | 7 | memory router and fake store, each branch and both `onBack` ways |
| App opens on the last viewed conversation, else #general; narrow shows the list (R22, R23, concerns 12, 20) | 4, 8 | unit tests of `last-viewed`; redirect tests; browser test at 1100 and 360 px |
| Store lifecycle on sign-in, sign-out, change of person (R32) | 9 | the eight cases of R32 |
| Side panel slot without loops (R26) | 5, 9 | ten re-renders render `AppShellRoute` at most twice |
| Texts in en and vi, nothing hard-coded in `ui-web` (R2, R27) | 2, 3, 6 | sources test; empty-text render; i18n check; en and vi pane test |
| Avatar colour from the id (R28, concern 9) | 1 | the four cases of R28 |
| Head count of active people (R24, concern 8) | 9 | layout test with a deactivated person |
| Touch size and layout at 360 and 719 px (R14) | 3, 11 | browser measurements |
| Diacritic search: 'ngoc' finds 'Ngọc' (R35, concern 6) | 11 | browser case, written (TOKI-032 R19 has landed) |
| Nothing breaks in earlier tickets (Scope, R30) | 10 | updated app-layout, app-providers, sample, app-wiring, component-preview, sign-in tests |

## What can break, and the riskiest step

- **Riskiest: step 9 (layout and store life).** It runs at every signed-in screen, and a mistake shows as a request storm, a stale store after a person change, or an infinite render. Mitigation: R32's eight cases are written first; the slot of R26 keeps `content` out of React state (the ten-renders test); `load()` is called only when the store is `idle` or `failed`.
- **Step 10 and the bootstrap stub.** A missed e2e file opens the app against the real server and ends in the session-ended modal. Mitigation: one helper, and a grep of `e2e/` for `stubSignedIn` and `openAppSignedIn` before the run; the full `pnpm test:e2e` is the check.
- **CSS port (step 3).** Table A has ~40 rules in three media blocks; a typo changes a look only a browser sees. Mitigation: the CSS test types the table in (change one value, see it fail), and the browser test measures heights and padding.
- **`personHue` and unstable selectors (steps 1, 6).** A selector that returns a new object per call re-renders in a loop under `useSyncExternalStore`. Mitigation: the pane selects only store getters that are cached (TOKI-032 R22) and a test counts renders.
- **R32 traps.** (b) subscribes with `subscribeSession` inside an effect, not through the render-driven `useSession()`; (c) reads `getSessionState()` at cleanup time; in dev StrictMode a mount, unmount, mount finds a `loading` store and must not call `load()` again. `seen` and `memberChecked` live in the provider of step 5, which outlives that remount, so R21 (c) cases are not sent to (b).
- **Fake store.** The pane and routes import the singleton from `src/client`. Tests use a real `createConversationStore` over a fake api behind a `vi.mock` of `src/client` (and the same in `loadApp`), because the no-re-render case of R29 depends on the real store's list cache.
- **R26 test.** It also asserts that the provider's state setter is not called when only `content` changes.
- **Bundle size.** The layout route is not lazy, so the list lands in the initial JavaScript. Baseline in step 0, check after steps 3 and 9; if headroom is short, the fallback is to lazy-load `ConversationPage` and `UnjoinedView`, not the list.
- **Size.** The spec calls this size L. If step 3 and steps 4 to 9 grow apart, the cut is the component (steps 1 to 3) against the wiring; the contract table does not change.

## Out of this plan

Browse channels and the people picker (TOKI-034), the header, Details, Star and Mute (TOKI-035), the unread data (TOKI-053, TOKI-054), hiding a new direct message (TOKI-037), the archived channel's address (TOKI-101), the offline strip, skeleton and Retry (TOKI-082).
