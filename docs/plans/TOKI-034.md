# TOKI-034 Browse channels and the people picker: plan

Ticket: TOKI-034 (issue 121) · Tier M · Branch `feat/toki-034-browse-channels-people-picker`
Spec (source of truth, decisions recorded in PR 194): `docs/specs/2026-11-17-browse-channels-people-picker-design.md`. Requirement numbers `R1`..`R30` are the spec's; the "Check" sentences of the spec and its Testing section are the cases each test holds. TOKI-033 is on `main`, so the seams it owns exist.

## Design

The spec is the design: behaviour, Table A (rows CSS), Table B (chip CSS) and Table T (texts) are fixed. This section says where it meets the code on `main` today.

### What is already there

- `apps/web/src/conversation-list/list-actions.tsx` (`ListActionsProvider`, `useRegisterListActions`, `useListActions`), `use-conversations.ts` (`useConversationSelector`), `people/person-hue.ts` (`personHue`), `conversation/UnjoinedView.tsx` (renders `NotFoundView`, four props `channelId`, `onJoined`, `onMember`, `onNotFound`), `routes/app-layout.tsx` (`AppShellRoute` wraps `ShellBody` in `ListActionsProvider`).
- `apps/web/src/patterns`: `useFormGuard`, `hasFormContent`, `useOnlineGate`. `@toki/ui-web`: `Modal`, `Field`, `Avatar`, `EmptyState`, `Tag`, `Button`, `IconButton`, `useToasts`.
- The store (`packages/client-core/src/conversations/store.ts`) has `joinChannel`, `readChannel`, `openDirect`, `refresh`, `hasConversation`, `getPeople`.
- `packages/i18n/src/messages/{en,vi}/picker.ts` already holds three keys (`search.label`, `chip.remove`, `empty`) and `common.close` exists, both added by TOKI-098. This ticket adds `browse` (12 keys) and the other four `picker` keys (`title`, `start`, `limit`, `error.deactivated`).
- `apps/web/src/features/create-channel/deps.ts` has `TODO(TOKI-034)` stand-ins (`PeoplePickerStandIn`, `usePeople`, `useCurrentUserId`). Replacing them is TOKI-098's change, by the spec's Hand-offs (R2); this ticket leaves that folder alone and names the three exports in the pull request.

### Where the spec's text differs from the code (build details, no change of behaviour)

1. Tests sit in `apps/web/tests/<folder>/` and `packages/ui-web/tests/`, not next to each file (the repository's habit, TOKI-033 plan). R1's "test file next to each" is read that way; the file-and-export test of R1 lists the sources.
2. `pnpm lint:boundaries` does not exist (TOKI-002 concern 13); R28 is met with `pnpm lint`.
3. `packages/ui-web` export tests (`tests/components/exports.test.ts`) may need `PersonChip` added to their known lists, as the TOKI-033 plan found for its component.

### Where the code goes

```
packages/ui-web/src/components/PersonChip/   PersonChip.tsx .css .examples.tsx index.ts   (+ tests)
packages/ui-web/src/components/index.ts      + 1 line;  src/examples.ts  + 1 entry
packages/i18n/src/messages/{en,vi}/browse.ts (new)  picker.ts (4 keys added)  + index lines
apps/web/src/features/   deps.ts  ConversationStarters.tsx  useMoreOnScroll.ts  rows.css
  channels/  BrowseChannelsDialog.tsx BrowseRow.tsx UnjoinedChannel.tsx browseRows.ts useBrowsePages.ts joinChannel.ts useJoinChannel.ts
  people/    PeoplePicker.tsx NewMessageDialog.tsx matchPeople.ts startDirect.ts
apps/web/src/conversation/UnjoinedView.tsx   body only
apps/web/src/routes/app-layout.tsx           + <ConversationStarters /> inside ListActionsProvider
apps/web/tests/features/...                  one test file per source file
```

## Plan

Each step is test first: write the test from the spec's Check sentence, run it, see it fail for the right reason, then write the code. Commands from the worktree root with `export PATH=/Users/thanhtruong/.nvm/versions/node/v22.23.5/bin:$PATH` and `corepack pnpm` (check the Node path with `ls ~/.nvm/versions/node` first).

| # | Step | Requirements |
| :-- | :---- | :---- |
| 0 | Baseline: `pnpm build && pnpm size`, note the initial JS gzip size in the state file | R28 |
| 1 | Texts: `browse` (en, vi), the four new `picker` keys, index lists; the test compares the 19 keys and `common.close` with a copy of Table T; `pnpm i18n:check` | R3 |
| 2 | `PersonChip` (TSX, CSS of Table B, examples, exports, `src/examples.ts`); tests: markup, `ref`, `className`, remove label, empty-`removeLabel` text, long name, CSS table, no `@toki/i18n` import | R1, R17, R26, R28, R29 |
| 3 | `features/deps.ts` (Table N names, `usePeople`, `useCurrentUserId`) and the scan test (no client-core or `client` import outside `deps.ts`); `useMoreOnScroll.ts` | R2, R8 |
| 4 | `matchPeople.ts` | R19 |
| 5 | `rows.css` (Table A) and its test | R26 |
| 6 | `PeoplePicker.tsx`: controlled `selected`, chips, search, window of 50, limit message, `fieldset disabled`, focus rules | R18, R19, R20 |
| 7 | `startDirect.ts` and `NewMessageDialog.tsx` with `useFormGuard`; start errors | R21 to R25 |
| 8 | `browseRows.ts`, `BrowseRow.tsx`, `useBrowsePages.ts` (`useInfiniteQuery`, 250 ms debounce, `gcTime: 0`) | R5 to R8 |
| 9 | `joinChannel.ts`, `useJoinChannel.ts`, `BrowseChannelsDialog.tsx` (empty, loading, failure, join, open, 409 reset, `rowExtra`) | R4, R9 to R15 |
| 10 | `UnjoinedChannel.tsx`; replace the body of `UnjoinedView.tsx` | R16 |
| 11 | `ConversationStarters.tsx`; one line in `app-layout.tsx`; test with the real `ListActionsProvider` | R30 |
| 12 | Browser checks of R27 on a throw-away page (360x560, 719, 720, 1099, 1100, Calm and Focus, 120 channels, 200 people, keyboard run, touch emulation); one line per width recorded in the pull request | R27 |
| 13 | Final: `pnpm --filter @toki/web test`, `--filter @toki/ui-web test`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm i18n:check`, `pnpm build && pnpm size` | R28 |

## AC -> step -> test

| Requirement | Step | Test |
| :---- | :-- | :---- |
| R1 files and exports | 2, 3, 6 to 11 | `tests/features/files.test.ts` lists the sources and the exports of R4, R7, R16, R18, R21, R30 |
| R2 seam | 3 | `tests/features/deps.test.ts` scan; screens' tests `vi.mock` `deps.ts` |
| R3 texts | 1 | `tests/features/texts.test.ts`: 19 keys and `common.close`, en and vi, JSX-text scan |
| R4, R5 request, debounce, order | 8, 9 | `BrowseChannelsDialog.test.tsx` with fake timers |
| R6, R7 rows, `browseRowAction` | 8 | `browseRows.test.ts` (six combinations), `BrowseRow.test.tsx` |
| R8 more on scroll | 3, 8 | `useMoreOnScroll.test.tsx`, dialog test with 120 channels |
| R9, R10 empty, loading, failure | 9 | dialog tests |
| R11 to R13 join, open, 409 | 9 | `joinChannel.test.ts` (order recorder, closed-while-held), dialog tests |
| R12 no entry built here | 9 | source scan for `notificationLevel` and `memberIds` |
| R14, R15 no create, no message calls | 9 | button list for Admin and Member, spy on `deps.ts` |
| R16 `UnjoinedChannel` | 10 | `UnjoinedChannel.test.tsx` (a) to (d), loading, failure; `UnjoinedView.test.tsx` |
| R17 `PersonChip` | 2 | `packages/ui-web/tests/components/PersonChip.test.tsx` |
| R18 `PeoplePicker` | 6 | `PeoplePicker.test.tsx` |
| R19 matching and window | 4, 6 | `matchPeople.test.ts`, 120 people show 50, 100, 120 |
| R20 limit | 6, 7 | picker and dialog tests: seven chips, the eighth refused, request holds seven |
| R21 to R23 candidates, start, errors | 7 | `startDirect.test.ts`, `NewMessageDialog.test.tsx` |
| R24 form guard | 7 | every close reason with zero and two chosen |
| R25 focus | 7, 9 | open, Esc, return focus, Tab order |
| R26 CSS | 2, 5 | CSS tests compare with copies of Tables A and B and walk the files |
| R27 browser checks | 12 | recorded in the pull request |
| R28 boundaries and commands | 13 | the commands |
| R29 examples | 2 | existing examples test of TOKI-012 R31 |
| R30 `ConversationStarters` | 11 | `ConversationStarters.test.tsx` with the real registry |

## What can break, and the riskiest step

- **Riskiest: step 9** (`BrowseChannelsDialog`). It joins paging, a debounce, ordering of late answers, join ordering and `reset()`. Mitigation: `useBrowsePages` is built and tested alone in step 8 with fake timers, and `joinChannel.ts` is a plain function tested without React.
- **Late answers.** An answer for an old search must not replace a newer one (R5). `useInfiniteQuery` keyed by the trimmed text covers it; the test reverses the order of two answers.
- **`getPeople()` identity.** `usePeople()` must not build an array (R2); a selector that returns a new array every call loops `useSyncExternalStore`. A test renders it and counts renders.
- **Modal and form guard.** The discard dialog is rendered beside the `Modal`, not inside it (R24); `trackFocus` goes on the picker's wrapper. Wrong placement shows only in the close-reason test, so that test is written first in step 7.
- **Export lists of `ui-web`.** Adding `PersonChip` can fail a known-exports test (difference 3); found at step 2.
- **Stand-ins of TOKI-098.** Left alone; a note in the pull request.
- **R27 numbers.** The 40 px floor and the "Start" in view at 360x560 are measured in a browser, not asserted; the fallback is stated in the spec.

## Out of this plan

The "Lan joined" system line (TOKI-029 concern 4), TOKI-101's Restore button and archived route, TOKI-082's shared pages, TOKI-098 and TOKI-100's switch to the real picker.
