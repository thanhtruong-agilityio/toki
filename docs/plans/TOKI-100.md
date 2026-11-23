# TOKI-100 Add and remove people in a channel (screens)

**Spec:** `docs/specs/2026-11-17-add-remove-people-design.md` (R1 to R19; its Design section is the design). Intent: `docs/intents/add-remove-people.md`. Tier M. Product decisions of concerns 1, 2 and 4 are recorded in the spec (2026-11-20, PR 196).

## Design

The spec is the design. What the code check on `main` (2026-11-23) adds:

- The seams TOKI-035 had to give already exist, so nothing waits and nothing is stubbed: `PeopleSection` takes `Controls` (`PeopleControls` type with `heading`, `row`, `dialogs` slots), `useChannelMembers` returns `{ rows, ids, status, error, reload }`, `DetailsPanel` already receives and forwards an optional `Controls`, and `div.mrow` has its own `div.mrow-main`. This ticket edits **one line of `DetailsPanel.tsx`** (`Controls={Controls ?? MembershipControls}`), as R16 says, and does not edit `PeopleSection.tsx` or `useChannelMembers.ts`.
- `PeoplePicker` (`features/people/PeoplePicker.tsx`) and `usePeople`, `useCurrentUserId` (`features/deps.ts`) exist (TOKI-034). `useCurrentRole` exists in `features/create-channel/deps.ts` (TOKI-098); `membership/deps.ts` re-exports it from there if it is exported, else writes the one-line hook of R2. `canAddPeopleToChannel` and `canRemovePeopleFromChannel` are in `@toki/shared`. `removeFromChannel` is already `confirm` in `actionPatterns`.
- `clearSearch` is part of the `Controls` contract already (`PeopleSection` passes it).
- Checked: `addMembers` returns `{ added, alreadyMembers }`, `removeMember` returns `{ changed }` (`packages/shared/src/channels/schemas.ts`); `ConfirmAction` takes the R11 props plus `open` and `onCancel`; `reload()` never returns to `"loading"` once rows are held.

### Findings of the advisor review (2026-11-23) and what the plan does

Each was checked against the code. Items 1 and 2 differ from the spec's wording and need the Dev's approval of this plan.

1. **CSS names collide with a test.** `apps/web/tests/conversation/css.test.ts:120` fails when a CSS file other than `conversation.css` defines `.mrow`, `.mrow-main` or `.dp-*`. Table C uses `.dp-people-add` and `.mrow .mrow-remove`. **Deviation:** use `.mbr-add` and `.btn.sm.mbr-remove` (the second selector may not contain `.mrow` either; declarations unchanged: `margin:0 0 8px`; `margin-left:auto; flex:none; color:var(--danger)`), and the CSS test compares against Table C with those two names. The row stays `.mrow` and the button is still its last child. The spec text (R5, R17, Table C) is updated in this pull request to the new names.
2. **`Controls` cannot reach `onNoAccess`.** `PeopleControls` passes `ids`, `status`, `reload`, `clearSearch` only, and `readFailure` only returns a value. A 403 or 404 on add or remove (R9, R13, including a demoted Admin who is still a member, concern 10) needs the panel's `onNoAccess`. **Decision:** `membership/` exports `NoAccessProvider` (a context holding `onNoAccess`); `DetailsPanel.tsx`, which already has `onNoAccess`, wraps `PeopleSection` in it. This stays inside the one file R16 gives this ticket, and `PeopleSection.tsx` and `useChannelMembers.ts` are not touched.
3. **`reload()` reuses a read already running** (`useChannelMembers.ts:67`), so a second change made while the first reload runs could be missed. **Decision:** `MembershipControls` chains its reloads (`pending = pending.then(reload)`), so every change gets a read that starts after it. A test removes two people in a row against a slow fake `api`.
4. **`pnpm lint:boundaries` does not exist** (root `package.json`). R19 is met with `pnpm lint` (the ESLint boundary rules run in it); the pull request says so.
5. **Test location.** `apps/web/vitest.config.ts` includes only `tests/**`, so tests go to `apps/web/tests/conversation/membership/` (the repository's convention), not next to the sources. One test checks the file list and the exports of R1.
6. **`useCurrentRole`** is written as one line in `membership/deps.ts` (not re-exported from `features/create-channel/deps.ts`, a stand-in seam whose `useCurrentUserId` returns `null`). `classifyApiError` comes from `@toki/client-core`, imported in `deps.ts` only. `usePeople` and `useCurrentUserId` are re-exported from `features/deps.ts`.
7. **Existing tests render the new controls.** With `MembershipControls` now the default, `DetailsPanel` and `ConversationPage` tests that mock only `client` may meet extra buttons. Step 8 runs them and adjusts their mocks (not their expectations) where needed.

**Order of the build** (each step: the test first, see it fail for the right reason, then the code).

## AC -> step -> test

| # | Step | Requirements | Test |
|---|---|---|---|
| 1 | i18n namespace `membership` (13 keys en and vi), both `index.ts` lists | R3 | key and text comparison with a copy of Table T; `pnpm i18n:check` |
| 2 | `offers.ts` (`membershipOffers`) and `candidates.ts` (`candidatesFor`) | R4, R6 | table tests of R4 and R6, with a comparison against the two shared functions |
| 3 | `deps.ts` (the only import of the client and of `@toki/client-core`; own `useCurrentRole`) and the source scan | R2, R19 | folder scan: no import of `@toki/client-core` or `client.ts` outside `deps.ts`; no role literal compared; no `api.messages` |
| 4 | `useAddPeople.ts` (`addPeople`, plain function) | R8, R9 | unit: order of ids, offline, 200 with `added` empty and with `alreadyMembers`, `invalid_member`, 409, 403/404, 5xx and timeout |
| 5 | `AddPeopleDialog.tsx` with `useFormGuard` and `PeoplePicker` | R7, R8, R9, R10 | component: 50/100/120 window, nobody text, "nguyen" vs "Nguyễn", chosen and typed text empty at each opening, every close reason with 0 and 2 chosen, line `role="alert"`, double press sends once |
| 6 | `useRemoveMember.ts`, `RemoveMemberButton.tsx`, `RemoveMemberDialog.tsx` (`ConfirmAction`, `removeFromChannel`) | R5, R11, R12, R13 | component: name in `p.cfm-target strong` (also "An"), one `p.cfm-text` with both sentences for public and private, no Undo, one request for a double confirm, `changed: false`, offline, each status of R13 |
| 7 | `AddPeopleButton.tsx`, `MembershipControls.tsx`, `membership.css`, `index.ts` | R1, R5, R14, R15, R16, R17 | component with a fake `PeopleSection`: controls land in heading, rows, dialogs; all cases of R5 (Member, Admin, #general, private, DM, group, archived, missing detail, own row, deactivated row); reload and count after add and remove; focus after removal; Add not disabled during reload; members search cleared by an add; CSS test against Table C (renamed, finding 1) and the R17 walk; two quick removals against a slow fake `api` (finding 3) |
| 8 | The edit in `DetailsPanel.tsx`: `Controls ?? MembershipControls` and `NoAccessProvider` around `PeopleSection` | R16, finding 2 | the existing `DetailsPanel`, `PeopleSection` and `useChannelMembers` tests pass; a DM and a group show none of the new elements; the panel's other sections work with a dialog open (R15) |
| 9 | Browser checks at 360 x 560, 719, 720, 1099, 1100 in Calm and Focus, keyboard-only run, touch emulation | R18 | one line for each width in the pull request (throw-away page with 120 members under `apps/web/src/preview`) |
| 10 | Commands | R19 | `pnpm --filter @toki/web test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm i18n:check` exit 0 |

**Not in this pull request:** system lines, Activity items and the live update (concern 1: no requirement changes); a block list for public channels (concern 2); archive (TOKI-101); the pressable-row hand-off to TOKI-057.

## What can break / riskiest step

- **Step 7 is the risk:** `MembershipControls` joins the offers, two dialogs, a reload of the list and the count, and a focus rule. Mitigation: steps 2 to 6 hold every rule as plain functions or single-purpose components first; step 7 only wires them, and its test uses a fake `PeopleSection`.
- **Focus after a removal (R14):** the row's button is gone, so focus must go to "Add people" only when `document.activeElement` is the `body` or detached. Mitigation: a test for each of the three cases (removal, add, an element the user focused meanwhile).
- **`reload()` must not flash:** if TOKI-035's hook sets `"loading"` while rows are held, "Add people" is disabled during the reload and the R14 check fails. Mitigation: the test of R14; if it fails, the fix is a change request to TOKI-035, not an edit to its files here (R16).
- **A person added in two places at once:** `alreadyMembers` and `changed: false` both end in the same state; tests of R8 and R12 cover them.
- **`removeRows` with a deactivated Admin or a missing detail** denies by the shared rule; the R4 table covers a missing fact.
- **Boundary lint:** `membership/deps.ts` imports the client; run `pnpm lint` after step 3, not at the end.
- **Merge with TOKI-101**, which edits `DetailsPanel.tsx` on other lines: rebase before the pull request.

## Amendment after the build (2026-11-23)

So that the plan matches the diff:
- `membership/noAccess.tsx` (finding 2) and `membership/deps.ts` hooks `useChannelName`, `useConversationEntry`, `useChannelDetail`, `useCurrentUser`: files and exports the plan did not list.
- The Remove selector is `.btn.sm.mbr-remove`: the first rename (`.mrow .mbr-remove`) still tripped `css.test.ts`, which refuses `.mrow` in any other CSS file. The spec (R5, Table C) carries the same names.
- `RemoveMemberDialog` keeps the last target while it closes, because `ConfirmDialog` refuses a blank name; `AddPeopleButton` takes an optional `buttonRef` for the focus rule of R14.
- Tests live in `apps/web/tests/conversation/membership/` with a `fakeDeps.tsx` and a `sources.test.ts` (R1, R2, R3, R17, R19 scans).
- **R18 (browser checks at five widths) is not done.** It needs the app with a database and 120 members, and the `.env` that holds the test database is off limits to the agent; the Dev runs it, or accepts it as a follow-up. The pull request says so.
