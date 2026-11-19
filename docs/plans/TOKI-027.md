# TOKI-027 Shared permission functions - implementation plan

**Goal:** `packages/shared/src/permissions/` holds 22 pure `can…` functions that answer the phase 1 rows of the capability table for a Member and an Admin, with a reason code for every refusal; all of it is exported from `@toki/shared`.

**Spec:** `docs/specs/2026-11-17-permission-functions-design.md` (R1 to R17, all concerns decided). Tier M.

## Design

The design is the merged spec, section "Design" (Table A, what a caller passes, layout, errors). It is not repeated here. Decisions taken at the plan stage, approved by the Dev on 2026-11-19:

1. **`ConversationFacts` is not defined again.** TOKI-028 put it in `permissions/types.ts`. This ticket adds to the same file `Role`, `Actor`, `ActorInput`, `MessageFacts`, `TargetPerson`, `DenyReason`, `Decision`, `DeleteDecision` and the value `DENY_REASONS` (the eleven codes in the order of R2, `as const`; `DenyReason` is derived from it, so the runtime test of R2 has a list to read).
2. **`checks.ts` holds the steps in the order of R3.** Each returns a `DenyReason` or `null`; a function runs its steps in the fixed order and returns the first reason. Runtime checks are written by hand with `typeof`; nothing is imported from outside the module (R15), so no Zod.
   - `actorReason(actor)`: not an object, `id` not a non-empty string, or `role` not a string: `fact_missing`; `role` a string other than `"member"` or `"admin"`: `unknown_role`.
   - `conversationReason(conv, needs)`: `kind` not one of the four, `isGeneral` not a boolean, `isGeneral` true with a kind other than `public_channel`, and, when asked, `archived` or `isMember` not a boolean: `fact_missing`.
   - `messageReason(msg)`, `targetReason(target)`, `countReason(n)`, `roleValueReason(role)` (an invited role or a new role: not a string `fact_missing`, another string `unknown_role`).
   - All `fact_missing` checks of a function run before any `unknown_role` check, so a missing fact wins over an unknown role (R3).
3. **Which conversation facts a function needs.** Every function that takes `conv` checks all four facts, with two exceptions: `canJoinChannel` does not need `isMember` (R9) and `canRestoreChannel` needs only `kind` and `isGeneral` (R9, concern 1). So `canArchiveChannel` and `canLeaveChannel` refuse a missing `archived` with `fact_missing` although they do not branch on it (Table A lists C for them; R4: a missing fact never allows).
4. **Steps of each function**, after the fact and role checks (`F`), in the order they run:

   | Function | Steps |
   | :-- | :-- |
   | `canReadConversation(actor, conv)` | F, member |
   | `canPostInConversation(actor, conv)` | F, member, archived |
   | `canUseAtChannel(actor, conv)` | F, member, channel, archived |
   | `canPinMessage(actor, conv)` | F, member, archived |
   | `canEditMessage(actor, conv, msg)` | F, member, archived, author |
   | `canDeleteMessage(actor, conv, msg)` | F, member, archived; author: `as: "author"`; else Admin: `as: "admin"`; else `not_author` |
   | `canCreateChannel(actor)` | F, admin |
   | `canCreateDirectConversation(actor)` | F |
   | `canJoinChannel(actor, conv)` | F, channel, not private, archived |
   | `canAddPeopleToChannel(actor, conv)` | F, member, channel, archived |
   | `canRemovePeopleFromChannel(actor, conv)` | F, admin, member, channel, not #general, archived |
   | `canLeaveChannel(actor, conv)` | F, member, channel, not #general |
   | `canArchiveChannel(actor, conv)` | F, admin, member, channel, not #general |
   | `canRestoreChannel(actor, conv)` | F, admin, channel, not #general |
   | `canEditChannelDetails(actor, conv)` | F, member, channel, archived |
   | `canUseWorkspaceViews(actor)` | F |
   | `canOpenAdminPage(actor)` | F, admin |
   | `canInviteMember(actor, invite)` | F (with `invite.role`), admin |
   | `canManageInvitations(actor)` | F, admin |
   | `canChangeRole(actor, target, newRole, activeAdminCount)` | F, admin; `last_admin` when the target is an active Admin, `newRole` is `"member"` and the count is 1 or less |
   | `canDeactivateAccount(actor, target, activeAdminCount)` | F, admin, `self_target` when `target.id === actor.id`, `last_admin` when the target is an active Admin and the count is 1 or less |
   | `canReactivateAccount(actor)` | F, admin |

   Steps: member `not_a_member`; admin `role_not_allowed`; channel `not_a_channel` for `dm` and `group_dm`; not private `private_channel`; not #general `channel_is_general`; archived `channel_archived`; author `not_author`.
5. **The actor parameter is typed `ActorInput`**; the other parameters carry their fact types. Tests pass broken values through a cast.
6. **The matrix test reads the function names from the module** (`import * as`, the keys that start with `can` and are functions), expects 22, and fails when a name is in no entry or an entry names a function that is not exported.

Two deviations from the spec, to be written in the pull request:

- **Tests live in `packages/shared/tests/permissions/`**, the convention of the package, not beside the source as the Layout draws them.
- **R15, "`dependencies` is empty".** `packages/shared/package.json` on `main` already has `zod` (auth schemas), so that test cannot pass. Kept: the test that reads every source file of the module and fails on an import that leaves the module. That this ticket adds no dependency is shown by `package.json` not being in the diff.

## AC -> step -> test

Each step writes its test first, sees it fail for the right reason, then writes the code. Source files are under `packages/shared/src/permissions/`, test files under `packages/shared/tests/permissions/`. Run one file with `corepack pnpm vitest run packages/shared/tests/permissions/<file>`.

| Requirement | Step (files) | Test file: what it proves |
| :-- | :-- | :-- |
| R2 | 1. `types.ts`: the types and `DENY_REASONS`; `index.ts` exports them | `types.test.ts` (extended): `expectTypeOf` for `Role`, `Actor`, `ActorInput`, `MessageFacts`, `Decision`, `DeleteDecision`; `Actor` is assignable to `ActorInput`; `DENY_REASONS` equals the eleven codes in order |
| R3 (order), R4 | 2. `checks.ts` | `checks.test.ts`: each check with a good value, a missing value, `null`, a wrong type, an empty id, `"guest"` and `"owner"`; `isGeneral: true` on a `dm` and a `private_channel` |
| R5, R6, R7 | 3. `conversation.ts`: the six functions | `conversation.test.ts`: a Member and an Admin; a member and a non-member; archived and not; own and another person's message; `as: "author"` for an Admin's own message and `as: "admin"` for another's; `@channel` in a channel and in a DM; pin in a DM; an Admin outside a private channel and a DM cannot read, post or delete |
| R8, R9 | 4. `channel.ts`: the nine functions | `channel.test.ts`: create for both roles; direct conversation with `"member"`, `"admin"`, `"guest"`; join public, private, archived, with `isMember` removed; add; remove in #general; leave #general and an archived channel; archive as a member and a non-member Admin; restore as a member Admin and a non-member Admin, public and private, with `isMember` and `archived` removed, Member `role_not_allowed`, #general, a DM; edit details in a public and a private channel, a DM, a group DM, an archived channel |
| R10, R11, R12 | 5. `account.ts`: the seven functions | `account.test.ts`: both pages for both roles; invite with `"member"`, `"admin"`, `"guest"`, no role; one Admin and two Admins; demoting oneself with one and with two; deactivating oneself; a deactivated Admin with a count of 1 (allowed); promoting and the same role; counts `-1`, `1.5`, `NaN`, `"2"`; a bad `status` |
| R3 (pure) | 6. `purity.test.ts` over every function | deeply frozen arguments; two calls give equal results; spies on `Date.now`, `Math.random` and `fetch` are never called; no throw for `undefined`, `null`, a number and a string in place of each argument |
| R4 | 7. `missing-facts.test.ts` | a table of the 22 functions with good arguments and the paths of their facts; removes each fact in turn, sets a wrong type, and passes the roles `"guest"` and `"owner"`; expects `fact_missing` or `unknown_role`, never `allowed: true`. The table and the module's `can…` names must be the same set |
| R13, R14 | 8. `capability-matrix.test.ts` | the 17 rows in the words of the table, entry 18 and entry 19; the result for Member and Admin of every function of every entry, with the reason codes; 22 functions, 20 in a row; fails when a function has no entry; order cases with two broken rules (`canArchiveChannel`: Member, non-member, archived gives `role_not_allowed`; Admin, non-member gives `not_a_member`; `canRestoreChannel`: Admin, non-member, archived is allowed) |
| R1, R15 | 9. `index.ts` complete; `packages/shared/src/index.ts` already exports the module | `exports.test.ts`: imports every name from `../../src/index.js` (the entry of `@toki/shared`); reads every `.ts` file of `src/permissions/` and fails on an import path that does not start with `./` |
| R16, R17 | 10. Whole checks | `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test` from the worktree root; the `grep` of R16, its lines read one by one and written in the pull request |

Files changed: `packages/shared/src/permissions/{types,index,checks,conversation,channel,account}.ts`, `packages/shared/tests/permissions/*.test.ts`, `docs/plans/TOKI-027.md`, `docs/plans/TOKI-027.state.json`. Nothing else; `packages/shared/package.json` and `packages/shared/src/index.ts` do not change.

## Risks (riskiest step first)

Result of the "what can break" round, run against the spec; it raised no question for the product owner.

- **Step 2 and 4, the order of reasons.** A wrong order still gives a refusal, so only the order cases catch it. Every function has at least one case that breaks two rules; `fact_missing` before `unknown_role` has its own case (a `"guest"` actor with a missing `kind`).
- **Step 7, a fact that is read but not checked.** The table of fact paths is written by hand; a path left out hides a permissive default. Guard: the table must name every function (same set as the module), and for a function that takes `conv` the paths are derived from one constant per kind of need (all four, no `isMember`, `kind` and `isGeneral` only).
- **Step 4, restore.** The one function that drops the membership step. An Admin outside a private channel is allowed by the function; hiding that channel is the API's work (TOKI-029 R1). The test names this case so it does not read as a bug.
- **Step 5, the last Admin.** `activeAdminCount` of 0 with an active Admin target is `last_admin` ("1 or less"); a deactivated Admin target is never `last_admin`. `self_target` comes before `last_admin` (R3).
- **Never throws.** An argument can be `undefined` or a primitive; every check tests "is an object" before it reads a property. A getter that throws is not covered: the callers pass plain data.
- **R16.** The `grep` already lists type declarations and table fixtures on `main` (`apps/web/src/layout/sections.ts` has its own `Role` type). They are read at step 10; a line that decides an action is reported in the pull request and fixed only if it is in this module.
- **Size.** Seventeen requirements in one pull request: kept small by writing no code beyond the ten steps.
