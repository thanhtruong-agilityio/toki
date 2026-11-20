# TOKI-098 Create channel dialog - second pull request: the dialog, with stand-ins

**Spec:** `docs/specs/2026-11-17-create-channel-dialog-design.md` (R3 to R22; the Design section is the design). Tier M. The first pull request (R1, R2: `createUuidV7Generator`, `newId`) is merged (192).

## Design

**Stand-ins (decided by the Dev, 2026-11-20: "build first with mocks").** TOKI-033 (`personHue`, `useConversationSelector`, route `/c/$conversationId`) and TOKI-034 (`PeoplePicker`, `usePeople`, `useCurrentUserId`, `common.close`) are not on `main`. Everything the dialog takes from them goes through `features/create-channel/deps.ts` (R3), so the stand-ins live in that one file, each marked `TODO(TOKI-033)` / `TODO(TOKI-034)`, with the real export named in the comment:

| Missing piece | Stand-in in `deps.ts` | Replaced by |
|---|---|---|
| `useConversationSelector`, `usePeople`, `useCurrentUserId`, `useCurrentRole` | hooks reading the TOKI-032 store of `apps/web/src/client.ts` with `useSyncExternalStore` (`getUser`, `getPeople`) | the real hooks (re-export) |
| `personHue(id)` | stable hash of the id to 0-359 | TOKI-033 R28 |
| `PeoplePicker` | small component with the props R9 names (candidates, chosen ids, `max`, `limitMessage`, `searchLabel`, `emptyText`, `removeLabel`): search input, a list of rows, chips with a remove button, `data-autofocus` | `features/people/PeoplePicker.tsx` |
| route `/c/$conversationId` | `onOpenConversation(id)` navigates with the router of TOKI-006 to `/c/{id}` through an untyped call | typed route |
| `common.close` | added to `packages/i18n` `common` en/vi (first-to-land rule; TOKI-034 R3 keeps the same text) | already there |

The stand-ins are the only code that is thrown away; every test of the screen mocks `deps.ts` (R3), so the tests stay when the real pieces land. The Dev checks nothing in the picker's look: it is not this pull request's (R20 leaves it to TOKI-034).

**Order** (each step: test first, see it fail for the right reason, then code):

| # | Step | Requirements | Test |
|---|---|---|---|
| 1 | `channelName.ts`: `normalizeChannelName`, `validateChannelName`, topic check | R6, R7, R8 | unit tables of the spec |
| 2 | `submitCreateChannel.ts` and `idFor` | R11, R14, R15 | unit: bodies, offline, id reuse and change, each answer kind |
| 3 | i18n `createChannel` (13 keys, en and vi) and `common.close` | R19 | key and text comparison with Table T; `pnpm i18n:check` |
| 4 | `deps.ts` with the stand-ins | R3, R9 | folder-scan test for imports outside `deps.ts` |
| 5 | `CreateChannelDialog.tsx` and `createChannel.css` | R5, R9, R10, R13, R14, R16, R17, R18, R20 | component tests of every row of R10, R13, R14, R16, R17; CSS test of Table A; text scan of R19 |
| 6 | `useCreateChannelDialog.tsx`, `CreateChannelButton.tsx` | R4, R12, R18 | component tests: roles, focus return, three calls in order, mounted flags; scan that no other file imports `CreateChannelDialog` |
| 7 | Browser checks at the five widths | R21 | recorded in the pull request (a preview page that mounts the button; the dev pages of the repository are for this, see `apps/web/src/preview`) |
| 8 | Commands | R22 | `pnpm --filter @toki/web test`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm i18n:check` |

**Not in this pull request:** the "+" inside the Admin page (TOKI-025 places `<CreateChannelButton />`, concern 4); the list filter rule (TOKI-033, concern 6); the system line and Activity item (concern 10); real `PeoplePicker`, `personHue`, `useConversationSelector`, `/c/$conversationId` (stand-ins, above).

## What can break / riskiest step

- **Step 5 is the risk:** one component holds the guard (R16), the busy state (R10, R17), Vietnamese composition (R6) and five answer kinds. Mitigation: steps 1 and 2 hold all the logic as plain functions, so the component only wires them, and its tests are one per row of the spec.
- **A stand-in drifts from the real API.** Mitigation: its props are exactly the ones R9 and TOKI-034 R18 name; the tests mock `deps.ts`, so they do not depend on the stand-in.
- **Lint boundary rules (TOKI-002)** may refuse something in `deps.ts` (it imports the client, the store and a router). Check `pnpm lint` after step 4.
- **Merge order with TOKI-034/033:** whichever lands second replaces the stand-ins; the pull request says so and lists them.

## Amendment after the first verifier round (2026-11-20)

The verifier found these files that the plan did not name; they are accepted and listed here so that the plan matches the diff:
- `features/create-channel/PeoplePickerStandIn.tsx`: the stand-in picker in its own file, because `deps.ts` cannot hold JSX; `deps.ts` re-exports it.
- `packages/i18n` `picker` namespace (en, vi, both `index.ts`), three keys only (`picker.search.label`, `picker.empty`, `picker.chip.remove`, the texts of TOKI-034 Table T): R9 uses them and the typed `t` refuses a key that is not in the catalogue. TOKI-034's `picker.ts` is a superset; the one that lands second merges.
- Tests live in `apps/web/tests/features/create-channel/` (the repository's convention; `vitest.config.ts` only includes `tests/**`), with a shared `fakeDeps.tsx` and `support.ts`; the i18n tests are in `packages/i18n/tests/`.
- A sixth result kind `silent` of `submitCreateChannel` for an `unauthenticated` or `ignore` class (R14: no line, Create enabled), which the five kinds of R11 cannot express.
