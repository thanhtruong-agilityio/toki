# TOKI-025 Admin page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use cl-dev:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/admin` page of `apps/web`: members table with search and status chips, Invite members dialog, row actions with confirmations, Channels list, and the no-access view for a Member.

**Architecture:** Feature code under `apps/web/src/admin/`, plain React with `useReducer` hooks (no data library), calling the seven member routes of TOKI-024 through `api.request`. Every permission decision comes from `@toki/shared` permission functions; the page compares no role itself. Texts go through `@toki/i18n` (new `admin` namespace plus a few `common` keys).

**Tech Stack:** React, TanStack Router, Vitest, Testing Library, user-event, zod schemas of `@toki/shared`, Playwright (browser test).

**Spec:** `docs/specs/2026-11-17-admin-page-design.md` (R1 to R33, Table A texts, Table B css, Testing, Data safety). Executors read it with this plan. Requirement numbers below (R5, R22 ...) are the spec's.

## Global Constraints

- Tests are written first; a new test must be seen failing for the right reason before its code.
- English is the default language; every text goes through `useTranslation`; no quoted string with a letter in `apps/web/src/admin` except class names, test ids, keys and the glyph "—" (R28).
- Dates reach components as epoch milliseconds only; conversion from ISO happens once, in `adminApi.ts` (R5, R30).
- No `crypto.randomUUID`; keys come from `newId()` of `apps/web/src/ids.ts`, the only `apps/web/src` file that touches a random source (R5, R33).
- No address, name, key or answer body in any `console` call, URL or storage (Data safety).
- `packages/ui-web` gains no file. Every colour in `admin.css` is a token variable; no selector names `data-eff`, `data-look`, `data-accent`, `data-density` (R31).
- Fake data only: `sam@example.com`, `Lan`, `Minh`.
- Branch `feat/toki-025-admin-page`; commits are Conventional Commits with a lowercase subject; no attribution lines.

## Design

The spec is the approved design. This section records only what the build adds, and where the real tree differs from the spec.

### Findings that change the build (checked against `main` at db25011)

1. **No change request to TOKI-032 is needed.** `RequestOptions` in `packages/client-core/src/api/client.ts` already has `headers?` and `timeoutMs?`; the client already ignores caller `accept`, `content-type` and `origin`. The spec's R5 "change request" and "this work's build waits for it" are therefore closed. A test in Task 3 proves `headers` and `timeoutMs` reach the request and cannot replace `Accept`.
2. **Path mismatch:** the section list is `apps/web/src/layout/sections.ts`, not `shell/sections.ts`. `sections` holds only `home` today; `tests/layout/sections.test.ts` has a "holds the Home row only" test that Task 4 updates.
3. **`personHue` does not exist** (TOKI-033, Blocked). Task 6 adds `apps/web/src/admin/personHue.ts` (string to hue 0..359, deterministic). TOKI-033 replaces it when it lands; this is a stop-gap, not a second shared helper.
4. **`CreateChannelButton` does not exist** (TOKI-098, Blocked). Spec R25 says whichever lands second adds the import and one line, and no dead "+" is drawn. `ChannelsSection` takes an optional prop `headingAction?: (reload: () => void) => ReactNode`; `AdminPage` passes nothing now. The test with a stand-in button uses that prop.
5. **`common.close`, `common.role.member|admin`, `common.today|tomorrow|yesterday` are absent.** R28 says the first ticket to land creates them. Task 2 creates all six keys in `en` and `vi` with the texts of R28.
6. **R31 names `pnpm lint:boundaries`, which does not exist.** Use `pnpm lint` and `pnpm test:lint-rules` (the boundary rules run in both). The browser test uses `pnpm test:e2e` and `pnpm test:e2e:real` as they exist.
7. `canInviteMember`, `canOpenAdminPage`, `canManageInvitations`, `canChangeRole`, `canDeactivateAccount`, `canReactivateAccount` exist in `packages/shared/src/permissions/account.ts`. Action ids `changeRole`, `deactivateMember`, `reactivateMember`, `revokeInvitation` exist in `apps/web/src/patterns/actions.ts` (pattern `confirm`).
8. `createUuidV7Generator` does not exist anywhere; Task 1 builds it (R33).
9. `apps/web/tests/client.test.ts` pins the exports of `client.ts`; the page adds nothing to `client.ts`.
10. **`AppShellRoute` reads no session** (`routes/app-layout.tsx` takes `role` as a test prop and calls `visibleSections(undefined)`). Without a change the Admin entry never shows in the real app. Task 4 makes `AppShellRoute` read `useSession()` when no `role` prop is given. This touches the shell, which R2 says it does not; the PR description records it as a needed deviation.
11. `packages/i18n/tests/common.test.ts` pins the `common` keys at exactly ten; Task 2 extends it.
12. `ConfirmAction` already calls `ensureOnline` itself; `useAdminAction` gates only Resend (a second call would show two offline messages).
13. `useFormGuard` needs a `formName`: use `t("admin.invite.title")`. With no text it closes at once on Esc, so `InviteDialog` wraps `onRequestClose` to ignore every reason while a request runs and skips the guard on the result step.
14. `Field` has no `hint` prop and its `error` takes one string; the hint and the error-ID line are separate elements tied with `aria-describedby`. `MenuItem` wraps children in a `span`, so the lock reason is a child `span.adm-lock`.
15. 40px controls come from the ui-web Button, IconButton and Chip css, not from `admin.css`; Task 6 asserts it from those files and the browser test at 360px, not from `admin.css`.

### Wiring decisions (from the plan review)

- **403:** `AdminForbiddenContext` (created in Task 4) provides `onForbidden()`. `useMemberList`, `useChannelList`, `useAdminAction` and `InviteDialog` call it on a 403; each has a 403 test.
- **`actionOutcome(error): "stale" | "forbidden" | "session" | "inProgress" | "failed"`** is one pure function in `apps/web/src/admin/actionOutcome.ts`, tested as a table of every R19 and R22 condition. Success is not an error, so it is not in the table.
- **`useKeyPerId()`** in `apps/web/src/admin/useKeyPerId.ts` holds idempotency keys (one per id; the invite form uses the id `"invite"`). It owns the rule of R20 and R22: keep the key after timeout, network error, 5xx and `request_in_progress`; drop it after 200 and `idempotency_key_reused`; the invite form also drops it when text or role change. Tested once; used by Resend, the invite form and the Resend buttons of the result step.
- **`useAdminAction` is called once, in `MembersSection`,** which renders its `dialogs` once and passes `headingRef`, `actor` and `reload` to it. The focus after a reload (R19): focus goes back to the opener; once the reload settles, if the opener is no longer in the document, focus goes to the members heading.

### Decisions built here (builder choices, all inside the spec)

- One `useLoadMore(onMore, { enabled })` hook returns a ref callback for the sentinel; used by members and channels.
- A shared reducer shape for the two list hooks is not extracted; two small hooks with the same rules are clearer than a generic one (YAGNI), but both are tested with the same ordering cases.
- The fake `api` of the tests is one helper `apps/web/src/admin/test-support/fakeAdminServer.ts` that applies the server's rules (search, status, counts, limit 50..100, cursor) over an in-memory list, so the chip-equals-rows test is real.

## AC -> step -> test

Acceptance criteria are the six "Proposed outcome" lines of the intent (`docs/intents/admin-page.md`) and its constraints.

| AC | Step (task) | Test |
| :-- | :-- | :-- |
| A1 Only an Admin opens the page; Member sees no entry and, by address, only "You do not have access to this page" | Task 4 | `routes/admin.test.tsx > member sees only the no-access title and the fake api has zero calls`; `layout/sections.test.ts > admin row only for admin`; `admin/AdminRoute.test.tsx > a 403 from the members list switches an admin page to the view`; `routes/app-layout.test.tsx > the shell shows the Admin entry for a signed-in Admin without a role prop` |
| A2 Table: name, email, role, status (Expired for a run-out invitation), last active; search; status chips with totals; first 50 and more on scroll | Tasks 5, 6 | `useMemberList.test.ts > reload aborts load-more and drops its answer`; `MembersSection.test.tsx > chip total equals rows for 120 rows with and without search`; `MemberRow.test.tsx > real ISO strings show formatted dates`; `useLoadMore.test.ts > root is the nearest scrolling ancestor with 48px margin` |
| A3 Invite members: several addresses, role Member by default, per-address results, Resend and Revoke (Revoke confirms) | Tasks 7, 8 | `InviteDialog.test.tsx > ten addresses give 3 Invited and 7 Mail not sent each with Resend`; `useAdminAction.test.tsx > revoke asks a confirmation naming the address`; `useAdminAction.test.tsx > resend reuses the key after a timeout` |
| A4 Row menu: Change role, Deactivate, Reactivate each confirm and name the person; forbidden entries locked with reason on own row and last Admin | Tasks 7 | `RowMenu.test.tsx > last admin and own row items are aria-disabled with the reason inside`; `RowMenu.test.tsx > fact_missing leaves the item out`; `useAdminAction.test.tsx > each R19 result` |
| A5 Channels list with member counts under "Channels", a place for the "+" | Task 9 | `ChannelsSection.test.tsx > rows, archived tag, plural counts`; `ChannelsSection.test.tsx > stand-in create button appears once and absent when not passed` |
| A6 Everything works on a phone, no hover-only action | Tasks 6, 7, 10 | `admin.css.test.ts > 719px card layout and 40px controls`; `e2e/admin.spec.ts > 360px no horizontal scroll` |
| C1 Idempotency, 75 s timeout on mail routes; key from `newId` with no `crypto.randomUUID` | Tasks 1, 3 | `ids.test.ts` (exact outputs, scan); `adminApi.test.ts > inviteMembers sends a 36 char key and timeoutMs 75000 with randomUUID undefined` |
| C2 English first; every text through i18n; Vietnamese present | Task 2 | `admin.texts.test.ts > keys and both texts equal Table A`; `pnpm i18n:check` |

## File map

Create:
- `packages/shared/src/ids/uuid-v7.ts`, `packages/shared/tests/ids/uuid-v7.test.ts`; modify `packages/shared/src/index.ts`
- `apps/web/src/ids.ts`, `apps/web/tests/ids.test.ts`
- `packages/i18n/src/messages/en/admin.ts`, `vi/admin.ts`; modify both `index.ts` and `common.ts` (en, vi); `packages/i18n/tests/admin.test.ts`
- `apps/web/src/admin/`: `adminApi.ts`, `AdminRoute.tsx`, `AdminPage.tsx`, `NoAccess.tsx`, `useLoadMore.ts`, `useMemberList.ts`, `useChannelList.ts`, `MembersSection.tsx`, `MemberRow.tsx`, `RowMenu.tsx`, `useAdminAction.tsx`, `InviteDialog.tsx`, `ChannelsSection.tsx`, `notices.tsx`, `useDateContext.ts`, `personHue.ts`, `admin.css`, `test-support/fakeAdminServer.ts`, and a `*.test.ts(x)` next to each in `apps/web/tests/admin/`
- `apps/web/src/routes/admin.tsx`
- `e2e/real-server/admin.spec.ts` (the spec asks for the real server with the fake mail layer; run with `pnpm test:e2e:real`)

Modify: `apps/web/src/router.tsx`, `apps/web/src/layout/sections.ts`, `apps/web/tests/layout/sections.test.ts`, `apps/web/tests/router.test.ts`.

## Tasks

### Task 1: UUIDv7 generator and `newId` (R33)

**Files:** Create `packages/shared/src/ids/uuid-v7.ts`, `packages/shared/tests/ids/uuid-v7.test.ts`, `apps/web/src/ids.ts`, `apps/web/tests/ids.test.ts`. Modify `packages/shared/src/index.ts`.

**Interfaces:**
- Produces: `createUuidV7Generator({ clock: { now(): number }, randomBytes(length: number): Uint8Array }): () => string`; `newId(): string` from `apps/web/src/ids.ts`.

**Acceptance Criteria:**
- [ ] Exact outputs of R33 for the four fixed vectors and the floor case.
- [ ] 1000 seeded ids match the v7 pattern and are distinct; bad clock (-1, 2^48, NaN, Infinity) throws before `randomBytes` is called; 9 random bytes throws.
- [ ] Scan test: `crypto.`, `randomUUID`, `getRandomValues` appear in `apps/web/src` (non-test) only in `ids.ts`; `newId()` matches the pattern with `crypto.randomUUID` undefined.

- [ ] Step 1: write both test files with the vectors of R33 (RFC 9562 B.2: clock 1645557742000 and bytes `0c c3 18 c4 dc 0c 0c 07 39 8f` give `017f22e2-79b0-7cc3-98c4-dc0c0c07398f`).
- [ ] Step 2: run `pnpm --filter @toki/shared test -- uuid-v7` and `pnpm --filter ./apps/web test -- ids`; expect FAIL (module not found).
- [ ] Step 3: implement the mapping of R33 (bytes 0-5 = 48-bit `t`, byte 6 `0x70 | r[0]&0x0f`, byte 7 `r[1]`, byte 8 `0x80 | r[2]&0x3f`, bytes 9-15 = `r[3..9]`), re-export from the shared index, write `ids.ts` using the system clock of TOKI-008 (`apps/web/src/clock.ts`) and `crypto.getRandomValues`.
- [ ] Step 4: run both; expect PASS.
- [ ] Step 5: commit `feat(shared): add uuid v7 generator and web newId (TOKI-025)`.

### Task 2: Texts (R28, R29, C2)

**Files:** Create `packages/i18n/src/messages/{en,vi}/admin.ts`, `packages/i18n/tests/admin.test.ts`. Modify `messages/{en,vi}/index.ts`, `messages/{en,vi}/common.ts`, `packages/i18n/tests/common.test.ts` (its table of ten keys becomes sixteen).

**Interfaces:**
- Produces: message keys `admin.*` (72 keys of Table A) and `common.close`, `common.role.member`, `common.role.admin`, `common.today`, `common.tomorrow`, `common.yesterday`; plural `admin.channels.members` with `one` and `other` (en) and `other` (vi).

**Acceptance Criteria:**
- [ ] The test holds a copy of Table A (key, English, Vietnamese) extracted from the spec and compares it with both catalogs.
- [ ] `common.role.*` English "Member", "Admin"; Vietnamese "Thành viên", "Admin"; day words English "Today", "Tomorrow", "Yesterday", Vietnamese "Hôm nay", "Ngày mai", "Hôm qua"; `common.close` English "Close", Vietnamese "Đóng".
- [ ] `pnpm i18n:check` exits 0.

- [ ] Step 1: extract Table A from the spec lines to a test fixture with a one-off script kept out of the repo; write `admin.test.ts` including plural cases 0, 1, 2.
- [ ] Step 2: run `pnpm --filter @toki/i18n test -- admin`; expect FAIL.
- [ ] Step 3: write `admin.ts` for both languages, register in both `index.ts`, add the six `common` keys.
- [ ] Step 4: run `pnpm --filter @toki/i18n test` and `pnpm i18n:check`; expect PASS.
- [ ] Step 5: commit `feat(i18n): add admin page texts and shared role and day words (TOKI-025)`.

### Task 3: Calls to the server (R5, R30 conversion)

**Files:** Create `apps/web/src/admin/adminApi.ts`, `apps/web/tests/admin/adminApi.test.ts`, `apps/web/src/admin/test-support/fakeAdminServer.ts`.

**Interfaces:**
- Consumes: `api.request` and `RequestOptions` (`headers`, `timeoutMs`) of `apps/web/src/client.ts` / client-core; `newId` (Task 1); schemas and constants of `@toki/shared` members.
- Produces: `listMembers({ search?, status?, limit?, cursor? }, signal?)`, `inviteMembers({ emails, role }, key, signal?)`, `resendInvitation(id, key)`, `revokeInvitation(id)`, `changeRole(userId, role)`, `deactivateMember(userId)`, `reactivateMember(userId)`. `listMembers` returns rows whose `lastActiveAt` and `invitation.createdAt` are numbers or `null`.

**Acceptance Criteria:**
- [ ] One test per function for method, path, query (empty `search` and unset `status` left out), body, header.
- [ ] `inviteMembers` and `resendInvitation` pass `timeoutMs: 75000`; others pass none.
- [ ] A real ISO string becomes epoch ms; null and an invalid string become `null`.
- [ ] One test runs `inviteMembers` through the real `createApiClient` with fake timers and a fake `fetch` that answers after 20 s: it resolves (75 000 ms applies) while a call without `timeoutMs` times out at 10 s.
- [ ] With `crypto.randomUUID` undefined the key is still made; the file contains no `crypto` call; imports are limited to `api`, shared schemas and constants, `newId`.

- [ ] Step 1: write tests against a recording fake of `api.request`; also one test that real `createApiClient` ignores a caller `Accept` header (guards finding 1).
- [ ] Step 2: run `pnpm --filter ./apps/web test -- adminApi`; expect FAIL.
- [ ] Step 3: implement; write `fakeAdminServer.ts` (in-memory members list, rules of TOKI-024 R21 to R25: search case and diacritic insensitive, status filter, counts follow the search and not the chip, limit default 50 max 100, cursor).
- [ ] Step 4: run; expect PASS.
- [ ] Step 5: commit `feat(web): add admin api calls (TOKI-025)`.

### Task 4: Route, gate, no-access view, section row (R1 to R4)

**Files:** Create `apps/web/src/routes/admin.tsx`, `apps/web/src/admin/AdminRoute.tsx`, `apps/web/src/admin/AdminPage.tsx` (an empty page here, filled by Tasks 6 to 9), `apps/web/src/admin/NoAccess.tsx`, `apps/web/src/admin/notices.tsx`, `apps/web/src/admin/AdminForbiddenContext.ts`, `apps/web/tests/routes/admin.test.tsx`, `apps/web/tests/admin/AdminRoute.test.tsx`. Modify `apps/web/src/router.tsx`, `apps/web/src/layout/sections.ts`, `apps/web/src/routes/app-layout.tsx` (read the role from `useSession()` when no `role` prop is given), `apps/web/tests/layout/sections.test.ts`, `apps/web/tests/routes/app-layout.test.tsx`, `apps/web/tests/router.test.ts`.

**Interfaces:**
- Consumes: `useSession()` (`apps/web/src/useSession.ts`), `canOpenAdminPage`, `SectionPage` of `@toki/ui-web`, `appLayoutRoute`.
- Produces: `adminRoute` (path `/admin`, parent `appLayoutRoute`); `AdminRoute`; `NoAccess` (no props); `AdminNotices: () => null`; `AdminForbiddenContext` with `useForbidden(): () => void` that every request site of Tasks 5, 7, 8 calls on a 403; `AdminRoute` provides it and switches to `NoAccess`.

**Acceptance Criteria:**
- [ ] `visibleSections("admin")` holds `admin` after `people` when `people` exists and before `preferences` when it exists (the test reads ids order); `member` and `undefined` do not hold it; row has `icon: "shield"`, `more: true`, no `tab`, no `calmHidden`.
- [ ] A Member sees `admin.noAccess.title` and nothing else (no page title, no count), and the fake `api` has zero calls.
- [ ] An Admin sees the page; a 403 from any request switches to the view.
- [ ] The real `AppShellRoute` with a signed-in Admin session (no `role` prop) shows the Admin entry; with a Member session it does not.

- [ ] Step 1: write tests (update the "Home row only" test to expect the admin row for admin only).
- [ ] Step 2: run `pnpm --filter ./apps/web test -- sections admin router`; expect FAIL.
- [ ] Step 3: add the row, route, gate and view; `AdminPage` is a temporary empty page here, filled by later tasks.
- [ ] Step 4: run; expect PASS, including the TOKI-015 shell test.
- [ ] Step 5: commit `feat(web): add admin route, gate and no-access view (TOKI-025)`.

### Task 5: List hooks and load more (R6, R9, R10, R32)

**Files:** Create `apps/web/src/admin/useLoadMore.ts`, `useMemberList.ts`, `useChannelList.ts` and their tests under `apps/web/tests/admin/`.

**Interfaces:**
- Consumes: `listMembers` (Task 3), `api.channels.list({ cursor? }, signal)`.
- Produces: `useMemberList(): { rows, counts, activeAdminCount, status: "loading"|"ready"|"failed", isRefreshing, error, loadMore, reload, query, setQuery }`; `useChannelList(): { rows, status, error, loadMore, reload }`; `useLoadMore(onMore: () => void, opts?: { enabled?: boolean }): (el: Element | null) => void`.

**Acceptance Criteria:**
- [ ] First request has no `limit`; later answers of older generations are dropped; reload aborts a load-more and its late answer is not appended; two quick reloads keep the later.
- [ ] Reload sends `limit` = rows shown clamped to 50..100, same query, no cursor.
- [ ] A page is never asked twice for one cursor; not asked when `nextCursor` is null; each row once (by `kind` + `userId` or `invitation.id`; channel by id).
- [ ] `useLoadMore` passes the nearest ancestor with `overflow-y` auto or scroll as `root` with `rootMargin` `0px 0px 48px 0px`, else `root` null; focus entering the last row also asks.
- [ ] A failed refresh never empties the rows; a failed later page keeps the rows and sets an error for the retry line of R9; reload does not set the scroll position.
- [ ] A 403 on the members list and on the channel list each calls `useForbidden()`; a 401 does nothing more.

- [ ] Step 1: write tests with the fake server and a fake `IntersectionObserver` helper that records `root` and `rootMargin` and fires on demand.
- [ ] Step 2: run `pnpm --filter ./apps/web test -- useMemberList useChannelList useLoadMore`; expect FAIL.
- [ ] Step 3: implement with `useReducer`, a generation counter, an `AbortController` per request.
- [ ] Step 4: run; expect PASS.
- [ ] Step 5: commit `feat(web): add admin list hooks and load more (TOKI-025)`.

### Task 6: Members table, search, chips, states, css (R7, R8, R11 to R14, R26, R30)

**Files:** Create `MembersSection.tsx`, `MemberRow.tsx`, `useDateContext.ts`, `personHue.ts`, `admin.css`, tests `MembersSection.test.tsx`, `MemberRow.test.tsx`, `admin.css.test.ts`.

**Interfaces:**
- Consumes: Tasks 3 and 5; `formatDate`, `formatDateTime` of `@toki/shared`; `Avatar`, `Chip`, `ChipGroup`, `Field`, `EmptyState`, `Tag`, `Button` of `@toki/ui-web`.
- Produces: `<MembersSection />` taking the hook result and the actor `{ id, role }`; `MemberRow` taking one row and optional `actions` slot (filled by Task 7); `useDateContext(): { timeZone, now, language, dayWords }`; `personHue(seed: string): number`.

**Acceptance Criteria:**
- [ ] Search sends after 300 ms without a key (five keys inside 300 ms give one request; 301 ms apart give two), trimmed, not in the address, not stored.
- [ ] Five chips All, Active, Invited, Expired, Deactivated with totals; chip total equals the rows its press shows for 120 rows with and without search text; a chip with 0 shows `EmptyState`.
- [ ] Status cell: "Mail not sent" for pending plus failed mail; "Expired" for expired whatever the mail status; "—" for null or invalid dates; no `a` or `href` anywhere.
- [ ] Loading, failed (with and without `requestId`) and unreadable states; `aria-busy` while a query or page is awaited.
- [ ] At 719px each `tr` is a card with `data-label`; roles `table|row|columnheader|cell` explicit; the header stays in the accessibility tree; the min height of 40px of Button, IconButton and Chip is asserted from the ui-web css files (and checked again in the browser test).
- [ ] `useDateContext` gives `en` and `vi` dates, with the clock moved across midnight and a year end.
- [ ] The page in `vi` shows no English word except `Join` and `Admin`.

- [ ] Step 1: write tests including a snapshot of cells for each row kind of R12/R13.
- [ ] Step 2: run `pnpm --filter ./apps/web test -- MembersSection MemberRow admin.css`; expect FAIL.
- [ ] Step 3: implement; `admin.css` per Table B with token variables only.
- [ ] Step 4: run; expect PASS.
- [ ] Step 5: commit `feat(web): add admin members table (TOKI-025)`.

### Task 7: Row actions, locks, confirmations, Resend (R15 to R20)

**Files:** Create `RowMenu.tsx`, `useAdminAction.tsx`, `actionOutcome.ts`, `useKeyPerId.ts`, tests `RowMenu.test.tsx`, `useAdminAction.test.tsx`, `actionOutcome.test.ts`, `useKeyPerId.test.ts`. Modify `MemberRow.tsx` (hosts the actions) and `MembersSection.tsx` (calls `useAdminAction` once, renders `dialogs` once).

This is the riskiest task: R19's result table, the per-invitation keys and the focus rule meet here. Build `actionOutcome` and `useKeyPerId` first, each with its own table test, then the hook on top of them.

**Interfaces:**
- Consumes: `canManageInvitations`, `canChangeRole`, `canDeactivateAccount`, `canReactivateAccount`; `ConfirmAction`, `useOnlineGate`, `useMenuTrigger`, `Menu`, `MenuGroup`, `MenuItem`, `MenuSeparator`; actions `changeRole|deactivateMember|reactivateMember|revokeInvitation`; calls of Task 3; `reload` of Task 5; `onForbidden` of Task 4.
- Produces: `useAdminAction({ reload, actor, headingRef }): { openChangeRole, openDeactivate, openReactivate, openRevoke, resend, dialogs }`; `actionOutcome(error: unknown)` and `useKeyPerId()` as in the Design wiring decisions; `useForbidden()` of Task 4 for 403.

**Acceptance Criteria:**
- [ ] Menu contents by row kind exactly as R16; a `last_admin` result disables with `admin.lock.lastAdmin`, `self_target` with `admin.lock.self`, any other denial (including `fact_missing`) leaves the item out; locked items are `aria-disabled`, reachable by arrow keys, show the reason inside the item.
- [ ] Each confirmation names the target; Esc, outside press and Cancel send nothing; confirm sends once; second press while busy sends none; offline gate keeps the dialog open.
- [ ] Each R19 result: 200 (toast, reload, focus), 409 with the four codes and 404 (close, reload, `admin.error.stale`), 403 (no-access view), 401 (nothing more), 409 `request_in_progress`, other 409, 400, 5xx with and without `requestId`, timeout, network.
- [ ] Resend asks no confirmation; two fast presses send one request; the key is reused after timeout, network error, 5xx and `request_in_progress`, replaced after 200 and after `idempotency_key_reused`, one key per invitation id, dropped on unmount; toasts `resent` and `resentNoMail`.
- [ ] Focus returns to the opener, or to the members heading (`tabindex="-1"`) when its row has gone; the test checks it after `reload()` settles, not only when the dialog closes.
- [ ] Only Resend calls the offline gate; confirmations rely on `ConfirmAction`'s own gate (one offline message, not two).
- [ ] Each action button has `aria-describedby` on the name cell; the menu label is `admin.action.menu` with the person's name; Invite members is left out when `canInviteMember` refuses.

- [ ] Step 1: write tests (stub a permission function to `fact_missing` for the unknown-result case).
- [ ] Step 2: run `pnpm --filter ./apps/web test -- RowMenu useAdminAction`; expect FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run; expect PASS.
- [ ] Step 5: commit `feat(web): add admin row actions and confirmations (TOKI-025)`.

### Task 8: Invite members dialog (R21 to R24)

**Files:** Create `InviteDialog.tsx`, `InviteDialog.test.tsx`. Modify `AdminPage.tsx` (button in `actions`).

**Interfaces:**
- Consumes: `canInviteMember`, `parseAddressList`, `INVITATION_BATCH_MAX`, `parseEmail`, `inviteMembers`, `resendInvitation`, `Modal`, `useFormGuard`, `hasFormContent`, `useOnlineGate`.
- Produces: `<InviteDialog open onClose reload onForbidden returnFocusRef />`.

**Acceptance Criteria:**
- [ ] Member chosen first; commas, CR, LF, CRLF split; a repeated address counts once; one invalid piece shows `admin.invite.error.invalid` under the field and keeps Send disabled; 50 addresses send and 51 show tooMany with Send disabled.
- [ ] Form guard: no text closes at once; text asks to discard on close button and Cancel; outside press does nothing; a role change alone is not content.
- [ ] While the request runs both buttons are disabled and Esc is ignored.
- [ ] Key kept for retry after 5xx, timeout, network error and `request_in_progress` when text and role are unchanged; replaced after 200 and after an edit.
- [ ] A fake server answering at 20 s of the test clock gives the result step, not a failure.
- [ ] Result step for ten addresses (3 invited, 7 mail_not_sent) shows each result; Resend inside it uses the key rule of R20; one line of each result kind; list reloads at the 200, not at Done; focus on open and on close.
- [ ] Offline blocks Send with `common.offline.blocked`.
- [ ] A 400 `batch_too_large` shows tooMany under the field; any other 400 and a 409 `idempotency_key_reused` show `common.error.actionFailed` (the latter also replaces the key); a 403 calls `useForbidden()`.
- [ ] `formName` is `t("admin.invite.title")`; `onRequestClose` is ignored for every reason while a request runs; the result step skips the guard.
- [ ] The hint and the error-ID line are separate elements tied to the field with `aria-describedby`; the key rule comes from `useKeyPerId` (id `"invite"`) and `actionOutcome`.

- [ ] Step 1: write tests.
- [ ] Step 2: run `pnpm --filter ./apps/web test -- InviteDialog`; expect FAIL.
- [ ] Step 3: implement.
- [ ] Step 4: run; expect PASS.
- [ ] Step 5: commit `feat(web): add invite members dialog (TOKI-025)`.

### Task 9: Channels section and page assembly (R25, R27)

**Files:** Create `ChannelsSection.tsx`, `ChannelsSection.test.tsx`, `AdminPage.test.tsx`. Modify `AdminPage.tsx` (created in Task 4; here it gets the sections, the notices region and the Invite button in `actions`).

**Interfaces:**
- Consumes: `useChannelList`, `useLoadMore`, `AdminNotices`, `MembersSection`, `InviteDialog`.
- Produces: `<ChannelsSection headingAction?: (reload: () => void) => ReactNode />`.

**Acceptance Criteria:**
- [ ] Heading `nav.channels`; rows show lock or hash icon, name, member count by plural (0, 1, 2), archived `Tag`; rows are not links.
- [ ] Own loading, error, Retry states; a refresh never empties; a 403 gives the no-access view.
- [ ] A stand-in `headingAction` appears once in the heading row with the list's `reload`; with none, no "+" is drawn.
- [ ] `AdminNotices` renders above the members section in its own region.

- [ ] Step 1: write tests.
- [ ] Step 2: run `pnpm --filter ./apps/web test -- ChannelsSection AdminPage`; expect FAIL.
- [ ] Step 3: implement and assemble the page.
- [ ] Step 4: run; expect PASS.
- [ ] Step 5: commit `feat(web): add admin channels list and assemble page (TOKI-025)`.

### Task 10: Checks, browser test, size (R31, Testing)

**Files:** Create `e2e/real-server/admin.spec.ts` (run with `pnpm test:e2e:real`; it exits green with no `TEST_DATABASE_URL`, so a green exit alone proves nothing: check that the spec actually ran).

**Acceptance Criteria:**
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test:lint-rules`, `pnpm format:check`, `pnpm --filter ./apps/web test`, `pnpm i18n:check`, `pnpm --filter ./apps/web build` exit 0; `pnpm size` stays under the limit.
- [ ] Browser test: a Member at `/admin` sees the view and the browser sent no request to `/api/v1/members`; an Admin invites two, resends one, revokes the other after confirming; deactivates a Member after confirming; cannot deactivate or demote themselves; at 360px no horizontal scroll.
- [ ] Texts scan: no quoted string with a letter in `apps/web/src/admin` beyond class names, test ids, keys and "—".

- [ ] Step 1: write the e2e spec and the texts scan test.
- [ ] Step 2: run `pnpm test:e2e:real` with a test database, and `pnpm test:e2e` for the existing suites; expect FAIL until the page is wired.
- [ ] Step 3: fix what the browser shows; run all checks.
- [ ] Step 4: if the real-server e2e cannot run on this machine, say so in the PR and do not claim it passed.
- [ ] Step 5: commit `test(web): add admin browser test and final checks (TOKI-025)`.

## How This Plan Was Created

1. **Spec provided:** `docs/specs/2026-11-17-admin-page-design.md`
2. **Explore:** the real tree on `main` (db25011) was read for the client, layout, patterns, shared permissions, ui-web components and i18n; findings are in Design.
3. **Implementation plan created:** this document; recommended execution: `cl-dev:executing-plans`.
