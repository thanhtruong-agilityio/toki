# TOKI-035 Conversation header and Details panel - implementation plan

**Goal:** an open conversation shows its header (glyph and name, topic, star, head count, Back on a narrow screen), and the members button opens the Details panel (About, people, notification level, mute, star, Leave) in the shell's side slot, with Back closing the panel first.

**Spec:** `docs/specs/2026-11-17-conversation-header-details-design.md` (R1 to R30, all concerns decided; PR 190). Tier M. Ticket: issue 123. Branch `feat/toki-035-conversation-header-details`.

## Design

The design is the merged spec, section "Design" (files, hooks, Table A, B, C). It is not repeated here. What the code on `main` changes, found while exploring (TOKI-033, TOKI-029 and TOKI-032 are merged):

1. **`saveSettings` exists.** `conversations.saveSettings(id, patch: Partial<SettingsValues>)` is in the store (TOKI-032, PR 179). `useConversationSettings` (R19) calls it; no fake seam is written. The "exactly one key" rule is a type of this ticket: `save(patch: OneOf<SettingsValues>)`.
2. **Route file.** `conversationRoute` is in `apps/web/src/routes/conversation.tsx`, not `router.tsx`. `validateSearch` there becomes `(s) => s.panel === "details" ? { panel: "details" as const } : {}` (R8). `HistoryState.detailsPushed?: boolean` is added in `src/routes/__root.tsx` next to `fromList`. Callers that navigate to `/c/$conversationId` may need `search: {}`; typecheck tells.
3. **Kinds.** The store's channel entry is `kind: "channel"` plus `isPrivate`; `canEditChannelDetails` wants `public_channel` or `private_channel`. One small mapper in `useConversation.ts`.
4. **Members.** `api.channels.members` answers `{ userId, joinedAt }`; names and status come from `getPerson`. The spec does not say what a person the store does not hold looks like. Decided in the grilling round (Thanh Truong, 2026-11-23): when `getPerson(userId)` is missing, the panel calls `conversations.refresh()` once and reads again; a person still missing is left out of the list. The head count stays the server's `memberCount`, so it can be higher than the rows; no text is invented. Step 8 tests it (one refresh, then the row is drawn or left out).
5. **Dates.** `formatDate(at: number, ctx, { weekday: false })` takes epoch ms; the detail's `createdAt` is ISO, so `Date.parse`, and a `null` or unparsable value draws no date (R12). The context is built inline from `clock.now()`, the browser zone and `useTranslation().language`, with a constant empty `dayWords` as the spec says (R12 (m)).
6. **Summary versus detail.** `GET /channels/{id}` answers a detail or a summary; narrow with `"description" in detail`.
7. **No new action row.** `actionPatterns` has `leavePublicChannel` and `leavePrivateChannel` (owner TOKI-035). The public last-member dialog needs `leavePublicChannelLastMember` (R24, concern 2): one `confirm` row is added to `apps/web/src/patterns` and to `tests/patterns/actions.test.ts`. TOKI-093 owns that file, so this is a one-row edit named in the PR (decided in the grilling round, Thanh Truong, 2026-11-23: add it here, do not borrow `leavePrivateChannel`).
8. **Providers.** The header calls no `useToasts`, so the existing `ConversationPage` test still renders without providers. `DetailsPanel` renders in the shell's slot (inside `ToastProvider`), so `useUndo` and `useOnlineGate` work there.
9. **Fake api in tests.** The harness `useFakeStore` fakes only `bootstrap`; this ticket adds `channels.get/update/leave/join/members` and `conversations.saveSettings` to a fake api in `tests/support/conversation-api.ts` and does not change the existing harness's behaviour.
10. **i18n.** New namespace `conversation` (en and vi, Table B, 39 keys), `common.back` and `common.closePanel`, and `tests/conversation.test.ts` in `packages/i18n` with the Table B triples.
11. **No thread route yet** (TOKI-045): the thread-address half of R8 gets no test now; the `panel` parameter test covers the address that exists.

## AC -> step -> test

Each step writes its test first, sees it fail for the right reason, then writes the code. Files are under `apps/web/src/conversation/` unless named.

| Requirement | Step | Test: what it proves |
| :-- | :-- | :-- |
| R28 | 1. i18n: `conversation` namespace (en, vi), `common.back`, `common.closePanel` | `packages/i18n/tests/conversation.test.ts`: every Table B triple; `pnpm i18n:check` passes |
| R29 | 2. `conversation.css` with exactly Table C | `tests/conversation/css.test.ts`: the selector list equals Table C; no other file defines `.mrow`, `.mh`, `.dp-*` |
| R7, R19 | 3. `useConversation.ts`, `useConversationSettings.ts` | hook tests with the fake api: entry, detail (summary and detail), the kind mapper; `save` with one key calls `saveSettings` once, `pending` only for the pressed control; reject leaves the entry unchanged |
| R1 to R6 | 4. `ConversationHeader.tsx` | `ConversationHeader.test.tsx`: each kind's glyph and name, topic on or off, star, count (and the count before a detail is held), Back calls `onBack`, buttons named |
| R8, R9 | 5. `useDetailsPanel.ts`, `validateSearch`, `detailsPushed` | `useDetailsPanel.test.tsx` with a memory router: open pushes one entry with the flag, Close and Escape go back, a reload keeps it open, a link with no state is closed by `replace`, opening another conversation then Back |
| R10, R11 | 6. `ConversationPage.tsx` calls `useShellPanel`; `DetailsPanel.tsx` frame | `ConversationPage.test.tsx` (kept and extended): panel appears in the slot when `panel=details`, title Details or Profile, label, test id kept |
| R12, R14 | 7. `AboutSection.tsx` | date cases (zone, other year, `null`, bad string, vi); the loading and failed-read states; `no_access` calls `onNoAccess` |
| R13 | 8. `useChannelMembers.ts`, `PeopleSection.tsx` | 3, 120, 200 and 201 fixtures (2, 2, 3 requests of 100, stop at 10), 50 at a time on scroll, search shown above 50, sort by name, DM row, `Controls` seam |
| R15, R16 | 9. edit form in `AboutSection.tsx` | Edit visibility per kind and `archived`; Escape; validation at 250 and 251 code points, emoji, white space; exact request bodies; offline; double press; header redraw after save |
| R17, R18 | 10. `NotificationsSection.tsx`, `SettingsSection.tsx` | radios and switches in each state; one key per `save`; pending on the pressed control only; offline; no second person's values |
| R20 to R26 | 11. `LeaveSection.tsx` and the `leavePublicChannelLastMember` row | fake timers at 4999 and 5000 ms; private flow with Cancel, Esc, outside press, Confirm, failure, offline; the three count cases for private and public; no Leave for #general, DM, group; navigation after leave; each answer of `leave` (200 changed true and false, 404, 409, 403, 500, timeout); no flow shows both a confirmation and Undo |
| R30 | 12. archived variant | About, Members and Leave only; no Edit, Notifications, Settings; no count read; Undo failure shows one toast |
| R27 | 13. boundary | lint (`pnpm lint`) and a test that the panel imports only `client.ts`; no `fetch` |
| all | 14. whole check | `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm i18n:check`, `pnpm --filter @toki/web build`, `pnpm size` |

## What can break / riskiest step

1. **Step 11, Leave.** A wrong build is costly (a private leave cannot be undone). The count read before the press, the 10-second wait, the 404 rule that differs for private and public, and the rule "never a confirmation and an Undo together" each get a test. This step is built last and reviewed twice.
2. **Step 5, history.** `pushed` entry plus Back plus reload plus opening another conversation. TanStack's `history.back()` can leave the app if the entry was not pushed by this app; the `detailsPushed` flag decides, and the test uses a memory history that starts on the panel address.
3. **Step 6, panel outside the page.** The panel renders in the shell's slot, so a `notFound()` thrown there does not reach the route; `onNoAccess` state in the page is the route out and is tested.
4. **Step 8, member list size.** 200 people mean 2 requests; a stop at 10 requests; a failure in the middle shows Retry and keeps the rows already read.
5. **TOKI-101 and TOKI-100 seams.** `PeopleSection`'s `Controls` prop and the one section slot in `DetailsPanel.tsx` are part of the contract; a test renders a stand-in.

## Out of scope (spec Scope)

Search and Meet buttons in the header, the tab row, system lines, Add people, Archive, profile cards, presence, message list and composer, thread panel.
