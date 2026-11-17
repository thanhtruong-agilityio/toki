# Admin page design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/admin-page.md (Thanh Truong)
Ticket: TOKI-025

## Goal
An Admin needs a screen to bring people into Toki and keep the member list in order: see who is a member, who is only invited, whose mail did not go out and who has been deactivated; invite people with a role; resend or revoke an invitation; change a role; deactivate and reactivate a person. A Member must see nothing of it. The server already does all of this (TOKI-024); this work builds the page that calls it: the `/admin` route, the member table with its search and status chips, the Invite members dialog, the row actions with their confirmations, the Channels list, and the "no access" view.

## Scope
- In:
  - The route `/admin` and its row in the shell's list of sections, for Admins only (R1, R2); the gate and the "no access" view (R3, R4).
  - The calls to the seven routes of TOKI-024, in a file of `apps/web` (R5).
  - The member table: columns, rows, search, status chips with totals, the first 50 and more on scroll, reload after a change (R6 to R14).
  - The row actions and their locks, with the reason: Resend and Revoke on an invitation; Change role, Deactivate and Reactivate on a person; the confirmations; the errors (R15 to R20).
  - The Invite members dialog and its per-address results (R21 to R24).
  - The Channels list with each channel's member count, and the place where TOKI-098 puts its "+" (R25).
  - The narrow-screen form of the page, the texts in English and Vietnamese, the dates, the checks (R26 to R31).
- Out (not now):
  - The "+" on the Channels list, the Create channel dialog and everything it does: TOKI-098. This work builds the section it sits in and places TOKI-098's `CreateChannelButton` in its heading (R25).
  - The disk-space warning (80% and 95%, D-106): TOKI-103. This work leaves it an empty file that the page renders above the sections (R27).
  - The server: routes, rules, the record of actions: TOKI-024. The permission functions: TOKI-027. The API client and the conversation store: TOKI-032, which this work does not change, except for the one change request of R5. The shell, `SectionPage` and the section list: TOKI-015. Confirmation, Undo and the form guard: TOKI-093. The Toast, the base components, Menu and Modal: TOKI-012, TOKI-013, TOKI-014.
  - The More sheet that reaches the page on a phone: TOKI-092. This work gives its row `more: true` (R2).
  - The shared "not found or no access" page and loading skeletons: TOKI-082. This work draws its own small view and loading line, and TOKI-082 replaces their bodies (R4, R7).
  - The People page, where the role label also changes (F40): TOKI-079.
  - Analytics and Automations tabs of the Admin page (phase 5), a screen for the record of administrative actions (D-110: none in phase 1), permanent deletion of an account (BR-29).
  - The Activity item "Lan changed your role to Admin" and the live update of the changed person's screen (concern 5).

## Requirements
Route, gate and no-access view
- R1. `apps/web/src/routes/admin.tsx` exports `adminRoute`, a route with the path `/admin`, the parent `appLayoutRoute` (TOKI-015 R30), no search parameter, whose component is `AdminRoute` (R3). `src/router.tsx` adds it to the children of `appLayoutRoute`; nothing else of the router changes. The page is drawn inside the shell's `SectionPage` (TOKI-015 R12) with the title `t("nav.admin")` and, as its `actions`, the "Invite members" button (R21).
- R2. `apps/web/src/shell/sections.ts` gains one row after the rows that exist: `id: "admin"`, `icon: "shield"` (the prototype's icon for Admin, line 1199, in the icon set of TOKI-011), `labelKey: "nav.admin"`, `to: "/admin"`, `match: p => p === "/admin" || p.startsWith("/admin/")`, `roles: ["admin"]`, `more: true`, and neither `tab` nor `calmHidden`. `visibleSections("admin")` holds it and `visibleSections("member")` and `visibleSections(undefined)` do not (TOKI-015 R36; F08, F39, D-090). The row is the only change this work makes to the shell.
- R3. Gate. `AdminRoute` reads the signed-in person (`id`, `role`) from the session state of TOKI-023 through the one React binding that `AppShellRoute` uses (TOKI-015 R36); this work adds no second binding. It calls `canOpenAdminPage({ id, role })` of `@toki/shared` (TOKI-027 R10). When the result is `allowed: false` it draws the view of R4 and sends no request to the server: a test with a fake client finds no call at all. When the result is `allowed: true` it draws the page of R6 to R27. The check only shapes the screen; the server repeats it on every request (BR-09, D-090).
- R4. The no-access view. `apps/web/src/admin/NoAccess.tsx` renders, in the shell's `SectionPage`, with the title `t("admin.noAccess.title")` ("You do not have access to this page", journey F39) and nothing else: no member, no count, no channel, no word that names the page's content, not even the page's own title. A Member who types `/admin` sees it (AC-064, TS-100); an Admin sees it too when any request of this page is answered 403, so a person demoted while the page is open loses the page at their next action (R19). One shared view serves 403 and 404 in the whole app (D-131); TOKI-082 builds it and then replaces the body of `NoAccess.tsx`, keeping the file and its props (none). Until then this view is the one. Whether the view is drawn inside the app frame is concern 6.

Calls to the server
- R5. `apps/web/src/admin/adminApi.ts` exports one function for each route of TOKI-024, each calling `api.request` of TOKI-032 (R2, R9: the generic method of the client in `apps/web/src/client.ts`) with the response schema that `packages/shared/src/members/` exports (TOKI-024 R35) and the shared constants: `listMembers({ search?, status?, limit?, cursor? }, signal)` (`GET /members`, R21 to R25 there), `inviteMembers({ emails, role }, key, signal)` (`POST /invitations`), `resendInvitation(id, key)`, `revokeInvitation(id)`, `changeRole(userId, role)`, `deactivateMember(userId)` and `reactivateMember(userId)`. An empty `search` and an unset `status` are left out of the query. The client of TOKI-032 does not yet let a caller set a header and the two routes that send mail need `Idempotency-Key` (TOKI-024 R13): the request core takes one more optional field, `headers`, which it adds to the request and which can never replace `Accept`, `Content-Type` or the credentials mode (change request to TOKI-032, concern 7; this work's build waits for it). The key is `globalThis.crypto.randomUUID()`, which is 36 characters of `A-Za-z0-9-`, inside the 1 to 64 of `A-Za-z0-9_-` that the server takes. The file adds no method to the client or the store of TOKI-032 and holds no state.

The member list
- R6. `apps/web/src/admin/useMemberList.ts` is the hook that holds the list: `{ rows, counts, activeAdminCount, status, isRefreshing, error, loadMore, reload, query, setQuery }`. The query is `{ search, status }`. On mount it asks the first page with no `limit` (the server's 50, D-109). Every answer is kept with `counts` and `activeAdminCount` of TOKI-024 R22 and R24. `status` is `loading` until the first answer, `ready` while data is held, `failed` when there is none and the request failed (the rule of TOKI-032 R10, so a refresh never empties the table). A request is aborted through its `signal` when a newer one starts, and an answer that arrives from an earlier request or an earlier query is dropped, so the table never shows the rows of an old search.
- R7. Search. The search box is `Field` with `variant="search"`, `icon="search"` and `aria-label` from `admin.members.search.label`, and the placeholder `admin.members.search.placeholder` (TOKI-012 R15 (b)). Typing sets the displayed text at once and the query's `search` after 300 ms without a key (decided in this spec: one request for each key press would load the server and flicker the table; a test with the clock moved shows one request for five key presses inside 300 ms). The text sent is trimmed. The filtering is the server's (case-insensitive; TOKI-024 R24): the page filters nothing itself, so the rows, the counts and the chips cannot disagree. The search text is not put in the address and is not stored (Data safety). While the first answer for a new query is awaited, the old rows stay and the table has `aria-busy="true"`.
- R8. Status chips (D-074, F39). A `ChipGroup` with `aria-label` `admin.members.filter.label` holds five `Chip`s in this order: All, Active, Invited, Expired, Deactivated (`admin.filter.all`, `admin.status.active`, `admin.status.invited`, `admin.status.expired`, `admin.status.deactivated`), each with its total after the label: `counts.active`, `counts.invited`, `counts.expired`, `counts.deactivated`, and for All their sum. `pressed` is true for the chip of the query's `status` (All when there is none). Pressing a chip sets the query's `status` to its value (All clears it) and asks the first page again. The totals are those of the last answer, which follow the search text and not the chip (TOKI-024 R24), so with any search text and any chip, the number on the chip equals the number of rows that pressing it shows (a test with a fake server that applies the same rule to 120 rows). A chip with a total of 0 is shown and can be pressed; the table then shows R14. Decided in this spec: Expired has a chip of its own (concern 9).
- R9. More on scroll (D-109). A sentinel element after the last row is watched with an `IntersectionObserver` with a root margin of 48 px at the bottom, so that it works in the scrolling area of the shell's `SectionPage` without a reference to it. When it comes into view, `nextCursor` of the last answer is not null and no page is being asked, the next page is asked with that cursor. A page is never asked twice for one cursor; with `nextCursor` null nothing is asked; the sentinel is also reachable by a keyboard-only person, because focus entering the last row asks the page too (the same rule as TOKI-034 R8). The rows of all pages are shown in order and each row once (a row is the same row when `kind` and `userId`, or `invitation.id`, are the same). While a later page is asked the table has `aria-busy="true"`. A page that fails keeps the rows and shows R19's retry line under the table.
- R10. Reload after a change. After any change that succeeded, or answered 409 or 404 (R19), `reload()` asks one page with `limit` equal to the number of rows now shown, no less than 50 and no more than 100 (the server's largest, TOKI-024 R21), with the same query and no cursor, and replaces the rows, the counts and `activeAdminCount` and the cursor. The scroll position is not touched. Reason: the server's order moves a row when its name or address changes nothing, but a status change moves it out of a filtered chip, and a reload keeps the table the same length. A person with more than 100 rows loaded sees the first 100 after a reload and scrolls to get the rest again.

The table
- R11. The table is a `table` with the class `adm-table` and one `thead` row of five `th`: `admin.col.name`, `admin.col.role`, `admin.col.status`, `admin.col.lastActive` and, visually hidden, `admin.col.actions`. The `tbody` holds one `tr` for each row of R6 in the server's order; the page sorts nothing (TOKI-024 R23). Its accessible name is the section's heading `admin.members.title`.
- R12. Name cell. An `Avatar` of TOKI-013 with `name` the display name, or the address for an invitation, and `hue` from `personHue(userId ?? email)` of TOKI-033 R28; then the name, or for an invitation the address, in bold; then the address (account rows only) in the muted small text; a `Tag` with `admin.row.you` beside the name on the signed-in person's own row. An invitation row has a second muted line `t("admin.row.invitedBy", { name, date })` with `invitation.invitedBy.displayName` and `date` from `formatDate(invitation.createdAt, ctx)` (R30), which is F02's "the date and who invited them". Nothing in the row is a link: no part of the page leads to a profile, a conversation or a message (F39: nothing on the Admin page leads to message content).
- R13. Role, status and last active. The role cell is `admin.role.member` or `admin.role.admin` from the row's `role`. The status cell is the label of the row's `status` (`admin.status.invited`, `expired`, `active`, `deactivated`), except that an invitation row whose `invitation.state` is `pending` and `mailStatus` is `failed` reads `admin.row.mailNotSent` instead of "Invited" (D-099, AC-067: after a batch where the mail failed halfway, three rows read Invited and seven read Mail not sent, each with Resend). An expired invitation reads Expired whatever its `mailStatus`. The status cell carries a text and the colour is never the only sign (D-067). The last-active cell is `formatDateTime(lastActiveAt, ctx)` (R30) for an account, and the glyph "—" when `lastActiveAt` is null or for an invitation row.
- R14. Empty and failed states. With no row for the query, the table body is replaced by `EmptyState` (TOKI-013 R15) with the icon `users`, the title `admin.members.empty.title` ("Nobody matches", the prototype's People empty state, line 1636) and the description `admin.members.empty.hint`, centred in the content area (D-074). While the first answer is awaited the section shows `admin.members.loading` as a `role="status"` line. When the first load failed the section shows `admin.members.error`, the "Error ID" line of `admin.error.id` when the error has a `requestId` (D-131) and a `Button` `admin.error.retry` that asks again; for a `classifyApiError` result of `unreadable` it shows `admin.error.unreadable` and no retry. The same views, with the `channels` texts, serve the Channels list (R25).

Row actions
- R15. An invitation row (state `pending` or `expired`) has, in the last cell, two `Button`s of size `sm`: `admin.action.resend` and `admin.action.revoke`, shown whenever `canManageInvitations(actor).allowed` (TOKI-027 R11), and each named for its row by `aria-describedby` on the name cell, so a screen reader hears "Resend, Invited by ...". Resend and Revoke are on the row and not in a menu, as F02 says ("An 'Invited' row has two buttons"). An account row has an `IconButton` with `icon="more"`, size `sm`, `label` `t("admin.action.menu", { name })` that opens a `Menu` (TOKI-014 R17) made with `useMenuTrigger`, `aria-label` the same text, `align="end"`. The button is always drawn, never on hover (D-067). A person with a deactivated account and a pending invitation is an account row (concern 1).
- R16. The menu of an account row, for the actor `{ id, role }`, the target `{ id: userId, role, status }` and `activeAdminCount` of the last answer, is built only from the permission functions of TOKI-027; the page compares no role itself. For an active person it holds a `MenuGroup` with the heading `admin.action.changeRole` and two items, `admin.role.member` and `admin.role.admin`, where the item of the person's current role is disabled with the line `admin.lock.current` and the other item calls `canChangeRole(actor, target, thatRole, activeAdminCount)`; then a `MenuSeparator` and one item `admin.action.deactivate` (variant `danger`) that calls `canDeactivateAccount(actor, target, activeAdminCount)`. For a deactivated person it holds one item `admin.action.reactivate`, shown when `canReactivateAccount(actor).allowed`; decided in this spec: no Change role for a deactivated person, because the person comes back with the role they had and an Admin changes it afterwards (TOKI-024 R26, R30; F41). An item whose function answers `allowed: true` is enabled. `last_admin` makes it disabled with the reason `admin.lock.lastAdmin` ("Make someone else an Admin first", F40), and `self_target` with `admin.lock.self`. Any other result, `fact_missing` and `unknown_role` included, leaves the item out: a refusal that the page cannot explain never shows a control (TOKI-027, "the reason lets a screen choose"). On the actor's own row Deactivate is locked by `self_target`, and Change role is locked by `last_admin` only when the actor is the last Admin (concern 4).
- R17. A locked item is a `MenuItem` with `disabled` (TOKI-014 R18: `aria-disabled`, focusable, a press does nothing) and its reason is drawn inside the item as a second line of muted small text, so that the reason is on the screen for a touch user and is read with the item by a screen reader (D-067; TOKI-014 R20 lets the arrow keys reach a disabled item for this). The reason is never a `title` and never shown only on hover.
- R18. Confirmations (D-061, D-069, F40, F41, F02). Choosing Change role's item, Deactivate or Reactivate, or pressing Revoke, opens `ConfirmAction` (TOKI-093 R18) with the action id of Table A of that spec, the `target` and the texts of "The texts":

  | Action id | Opened by | `target` | `variant` | Question and confirm button | Request |
  | :---- | :---- | :---- | :---- | :---- | :---- |
  | `changeRole` | a role item | the person's display name | `primary` | `admin.changeRole.title` with `admin.changeRole.toAdmin` or `admin.changeRole.toMember` as the description (the new role and what changes), `admin.changeRole.confirm` | `changeRole` |
  | `deactivateMember` | Deactivate | the display name | `danger` | `admin.deactivate.title`, `admin.deactivate.description` (they are signed out everywhere, cannot sign in again, messages stay), `admin.deactivate.confirm` | `deactivateMember` |
  | `reactivateMember` | Reactivate | the display name | `primary` | `admin.reactivate.title`, `admin.reactivate.description`, `admin.reactivate.confirm` | `reactivateMember` |
  | `revokeInvitation` | Revoke | the address | `danger` | `admin.revoke.title`, `admin.revoke.description`, `admin.revoke.confirm` | `revokeInvitation` |

  The dialog's `returnFocusRef` is the button that opened it (the row's menu button, or the Revoke button). Closing it with Cancel, Esc or an outside press changes nothing and sends nothing (F40 "Closing the confirmation changes nothing"). The confirm button calls the request with `busy` true while it runs (D-111: a second press cannot reach it; TOKI-093 R7). A confirmation has no Undo (D-069: never both). When the offline gate of TOKI-093 R17 answers false the dialog stays open and the explanation shows (D-060, D-079).
- R19. Results of an action, one rule for all of R18, R20 and R22. On 200 the dialog closes, `reload()` runs (R10) and one plain toast shows the text of `admin.toast.*` for that action (`roleChanged`, `deactivated`, `reactivated`, `revoked`); focus goes back to the button that opened the dialog, and when the row has gone (a revoked invitation, or a row that left the chip's filter) to the heading of the members section, which has `tabindex="-1"` (TOKI-093 concern 6 leaves this to the call site). On a 409 with the code `last_admin`, `self_target`, `invitation_used` or `invitation_revoked`, and on a 404 (`not_found`, `invitation_not_found`), the page was out of date (D-131: 409 and 410 get a fresh copy): the dialog closes, `reload()` runs and one plain toast shows `admin.error.stale`; a 404 of an action never draws the no-access view. On a 403 the person is no longer an Admin and the view of R4 shows. On a 401 the session modal of TOKI-023 shows and the page does nothing more. On any other 409 (`request_in_progress`, `idempotency_key_reused`), a 400, a 5xx, a timeout or a network error the dialog stays open, its button is enabled again, and one plain toast shows `common.error.actionFailed`, followed on a 5xx by `admin.error.id` when the error has a `requestId` (D-131, D-126); the person retries by pressing the button again, and the request is sent once for each press and never repeated by itself (TOKI-032 R6).
- R20. Resend (D-182, F02). Pressing Resend asks no confirmation and shows no Undo (journey F02, taken as the baseline by D-091; TOKI-093 concern 10 leaves it unclassified). It calls the offline gate, then `resendInvitation(id, key)` with a new key for each press; the button is disabled while the request runs and for no longer (D-111). On 200 with `result` `invited` a plain toast shows `admin.toast.resent` with the address; with `mail_not_sent` it shows `admin.toast.resentNoMail`; the list reloads (R10), so the row reads "Invited" or "Mail not sent" as the server says. A failure follows R19, without a dialog. The same key is not reused for a second press.

The Invite members dialog
- R21. The button `admin.invite.open` ("Invite members", F02, F39) in the page's `actions` opens a `Modal` with the title `admin.invite.title`, `closeLabel` `admin.invite.close`, `returnFocusRef` the button, and the form of F02: a multi-line `Field` with `label` `admin.invite.emails.label` and a line under it `admin.invite.emails.hint` (commas or new lines); a `Select` with `label` `admin.invite.role.label` and the options `admin.role.member` and `admin.role.admin`, `member` first and chosen (D-153; the role the server takes is `member` or `admin`); and, as the `footer`, `Button` `common.cancel` and `Button` `variant="primary"` `admin.invite.send`. The dialog is a form with content, so it goes through `useFormGuard` of TOKI-093 (R20 to R23 there) with `hasContent` from `hasFormContent({ emails })`: an outside press does nothing, the close button and Cancel ask "Discard what you typed?" when there is text, and close at once when there is none (D-070, BR-21, AC-074, AC-075). The choice of a role alone is not content (TOKI-093 R19). Esc follows `GUARD_ESCAPE` of that spec.
- R22. Validation and send (D-104, D-111, F02). The text is split with `parseAddressList` of `packages/shared` (TOKI-024 R35) and each piece is checked with the shared address check (`packages/shared/src/email.ts`, TOKI-020 R16), the same check that the server uses (TOKI-024 R10). The error shows under the field, as one message, and never in a toast: the first piece that fails gives `admin.invite.error.invalid` with the piece as `{address}`, and more than `INVITATION_BATCH_MAX` (50) addresses gives `admin.invite.error.tooMany` with `{count}` 50; the list sent is the parsed list, so a repeated address counts once (TOKI-024 R5). "Send invitations" is disabled while the list is empty, while any piece is invalid, while there are more than 50, and while a request runs (F02: disabled "until every address is valid"). The role sent is the chosen one. A press calls the offline gate, then `inviteMembers({ emails, role }, key)`; while it runs both buttons are disabled and the dialog does not close on any reason. Key rule (TOKI-024 concern 6): the key is made at the first press; the same key is sent again for a retry when the earlier attempt ended with a timeout, a network error or a 5xx and neither the text nor the role has changed since; it is replaced by a new one after a 200 and after any change of the text or the role. A 5xx, a timeout or a network error keeps the dialog open with the form as typed and shows, under the field, `common.error.actionFailed` and, with a `requestId`, `admin.error.id`. A 403 is R19. A 400 `batch_too_large` shows `admin.invite.error.tooMany` under the field; any other 400 shows `common.error.actionFailed` there.
- R23. The result step. On 200 the form is replaced, in the same dialog, by a list with the accessible name `admin.invite.results.label`: one line for each element of `results`, in the server's order, with the address and its result: `invited` reads `admin.status.invited`; `mail_not_sent` reads `admin.row.mailNotSent` and has a `Button` `admin.action.resend` that calls `resendInvitation(result.invitation.id, key)` as R20 does (the line then reads the new result: `invited` or `mail_not_sent`); `already_member` reads `admin.invite.result.alreadyMember`; `already_invited` reads `admin.invite.result.alreadyInvited`; `invalid_email` reads `admin.invite.result.invalid`. A batch where the mail failed halfway therefore shows each address its own result, and the invitations already sent stay (D-099, AC-067, TS-105). The footer is one `Button` `admin.invite.done` that closes the dialog; the form guard no longer applies (a successful send closes through the owner's own code, TOKI-093 R20). The list is reloaded (R10) as soon as the 200 arrives, not when Done is pressed, so the table behind already shows the new rows.
- R24. Offline and focus. A press of "Invite members" while the connection is down opens nothing new: the dialog may open, but "Send invitations" is blocked by the gate with its explanation (D-060: inviting is always blocked offline). When the dialog opens, focus is on the address field (`initialFocusRef`, TOKI-014 R11); when it closes, focus returns to the button that opened it.

The Channels list
- R25. Below the members section, a section with the heading `admin.channels.title` ("Channels", D-183: a plain list of the channels with their member counts; the busiest ranking comes with Analytics). `apps/web/src/admin/ChannelsSection.tsx` reads the channels with `api.channels.list({ cursor? })` of TOKI-032 R9, the first page with no `limit` (50) and more on scroll by the rule of R9 (a second use of the `useLoadMore` hook of R9, in `useLoadMore.ts`), and draws a table `adm-table` with two columns, the channel and `admin.channels.members` as `t(..., { count: memberCount })` ("1 member", "12 members"). A channel is a `lock` or `hash` icon (the prototype's, line 1980) and its name; an archived channel has a `Tag` `admin.channels.archived`. The order and the cursor are the server's (TOKI-029 R6: by name in byte order). A channel row is not a link and opens nothing: the page leads to no message content. Which private channels the list holds is concern 3. The section has its own loading, error and Retry views (R14). The heading row has, at its end, one place for the "+" of TOKI-098: `<CreateChannelButton onCreated={reload} />` of `apps/web/src/features/create-channel/` (TOKI-098 R3, R4), placed once, with no "+" of this work's own (D-151, D-183, D-084). The button, the dialog, its open state, the Admin check and the navigation to the new channel are TOKI-098's; `onCreated` reloads the list for a case where the dialog does not leave the page. Whichever of TOKI-025 and TOKI-098 lands second adds the one import and the one line, so that no dead "+" is drawn before both have landed. Nothing else of the section is TOKI-098's.

Notices, layout, texts, checks
- R26. Narrow screens (D-067, D-053). At a viewport of 719 px or less, each `tr` of `adm-table` is drawn as a card: the cells are blocks, each non-name cell is preceded by its column name (from the `th` text, by a `data-label` attribute set from the same keys), the header row is hidden visually and not from a screen reader, and the table keeps its roles with explicit `role="table"`, `role="row"`, `role="columnheader"` and `role="cell"` so that a stacked layout does not drop the semantics. Every control of the page is at least 40 px tall (TOKI-012 R8; the row's buttons are `Button` and `IconButton`). A phone reaches the page through the More sheet of TOKI-092 (`more: true`, R2) and, until that exists, by its address (TOKI-015 concern 22). No action is hover-only.
- R27. `apps/web/src/admin/notices.tsx` exports `AdminNotices`, `() => null`, which `AdminPage` renders above the members section in a region of its own. TOKI-103 replaces its body with the disk-space warning (D-106, D-191) and keeps the file and the export; this work builds nothing of it.
- R28. Texts. Every word of the page goes through `useTranslation` of `@toki/i18n/react` (TOKI-017). `packages/i18n/src/messages/en/admin.ts` and `vi/admin.ts` hold the 75 keys of Table A, listed in both `index.ts` files (TOKI-017 R13); the page also uses `nav.admin` (TOKI-017), the `common` keys of TOKI-093 (`common.cancel`, `common.discard.*`, `common.error.actionFailed`, `common.offline.*`) and `common.today`, `common.tomorrow` and `common.yesterday` (TOKI-017). This work changes no `common` key. `packages/ui-web` is not changed: it holds no text and this page needs no new component. `pnpm i18n:check` exits 0. Check: a test compares the keys and both texts with a copy of Table A; a search of `apps/web/src/admin` for a quoted string that holds a letter finds only class names, test ids, keys and the glyph "—".
- R29. The plural text `admin.channels.members` has the forms `one` and `other` in English and `other` in Vietnamese (TOKI-017 R6, R17 (f)); the placeholder is `count`.
- R30. Dates. `apps/web/src/admin/useDateContext.ts` returns `{ timeZone, now, language, dayWords }` as TOKI-035 R12 builds it (the browser's time zone, the clock of TOKI-008, the person's language, and the three day words `common.today`, `common.tomorrow`, `common.yesterday`), and `formatDateTime` and `formatDate` of `@toki/shared` (TOKI-094 R2 to R5) write the last-active time and the invitation date: 24-hour time, no AM or PM, the year only when it is not the current year (D-073, D-123). A `null` result from either leaves the value out and shows "—", never "Invalid Date".
- R31. Checks. `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check`, `pnpm --filter ./apps/web test`, `pnpm i18n:check`, `pnpm --filter ./apps/web build` and `pnpm test:e2e` exit 0, and the initial JavaScript of `apps/web` stays under the limit of TOKI-006 R10: the Admin route is loaded by the router's code splitting where TOKI-006 provides it, and in any case `ui-web` gains no file here. Every colour in `admin.css` is a token variable (TOKI-009 R10); no selector names `data-eff`, `data-look`, `data-accent` or `data-density`.

## Design
### Where each part lives
The page is feature code of `apps/web`: it uses the client, the session, the permission functions, the texts and the patterns of TOKI-093, so it is not a `ui-web` component (the same reason as TOKI-034's dialogs). Nothing is kept in the conversation store of TOKI-032: the member list is the Admin page's own and is dropped when the page unmounts, so no other screen holds every person's address (Data safety). The hook `useMemberList` and the helper `useLoadMore` are plain React with `useReducer`; no data library is added.

### The permission map
| Control | Function (TOKI-027) | Allowed | `last_admin` | `self_target` | Any other result |
| :---- | :---- | :---- | :---- | :---- | :---- |
| The page | `canOpenAdminPage(actor)` | page (R3) | none | none | no-access view |
| Invite members | `canInviteMember(actor, { role })` | button and dialog | none | none | button left out |
| Resend, Revoke | `canManageInvitations(actor)` | two buttons | none | none | buttons left out |
| Change role item | `canChangeRole(actor, target, role, count)` | enabled | disabled, `admin.lock.lastAdmin` | none | item left out |
| Deactivate item | `canDeactivateAccount(actor, target, count)` | enabled | disabled, `admin.lock.lastAdmin` | disabled, `admin.lock.self` | item left out |
| Reactivate item | `canReactivateAccount(actor)` | enabled | none | none | item left out |

The server repeats every check on every request (TOKI-024 R1, R27), so a page that is a little out of date is corrected by a 409 and a reload (R19), never by a wrong change.

### The Invite dialog's states
Form (R21, R22) -> sending (both buttons disabled, `busy`) -> results (R23) -> closed. From sending, a failure returns to the form with the typed text and the same key for a retry. From the form, Cancel or the close button with text asks the question of TOKI-093; with no text it closes.

### Errors
| Condition | Behaviour |
| :---- | :---- |
| The person is a Member (client check) | no-access view, no request (R3, R4) |
| Any request answered 403 | no-access view (R19) |
| 401 | session modal of TOKI-023 |
| List 5xx, timeout, network | section error, error ID when there is one, Retry (R14) |
| List answer that does not fit the schema | `admin.error.unreadable`, no retry (R14) |
| Action 409 `last_admin`, `self_target`, `invitation_used`, `invitation_revoked`, or 404 | close, reload, `admin.error.stale` (R19) |
| Action 5xx, timeout, network, other 409, 400 | dialog stays, `common.error.actionFailed`, retry by pressing again (R19) |
| Invite 400 `batch_too_large`, an invalid address | message under the field (R22) |
| Offline | action blocked with `common.offline.blocked` (R18, R20, R22) |

### Table A. The texts (namespace `admin`)
English words that the prototype has are marked (P); every other English text, and every Vietnamese text, is a proposal (D-139). The form of address is "bạn" (the proposal for D-188).

| Key | English | Vietnamese |
| :---- | :---- | :---- |
| `admin.noAccess.title` | You do not have access to this page | Bạn không có quyền truy cập trang này |
| `admin.invite.open` | Invite members | Mời thành viên |
| `admin.members.title` | Members | Thành viên |
| `admin.members.search.label` | Search members | Tìm thành viên |
| `admin.members.search.placeholder` | Search by name or address | Tìm theo tên hoặc địa chỉ email |
| `admin.members.filter.label` | Filter by status | Lọc theo trạng thái |
| `admin.members.empty.title` | Nobody matches (P) | Không có ai phù hợp |
| `admin.members.empty.hint` | Try a name or an address. | Hãy thử một tên hoặc một địa chỉ. |
| `admin.members.loading` | Loading members | Đang tải danh sách thành viên |
| `admin.members.error` | Could not load the members. | Không tải được danh sách thành viên. |
| `admin.filter.all` | All | Tất cả |
| `admin.status.active` | Active | Đang hoạt động |
| `admin.status.invited` | Invited | Đã mời |
| `admin.status.expired` | Expired | Hết hạn |
| `admin.status.deactivated` | Deactivated | Đã vô hiệu hóa |
| `admin.col.name` | Name | Tên |
| `admin.col.role` | Role | Vai trò |
| `admin.col.status` | Status | Trạng thái |
| `admin.col.lastActive` | Last active | Hoạt động gần nhất |
| `admin.col.actions` | Actions | Thao tác |
| `admin.role.member` | Member | Thành viên |
| `admin.role.admin` | Admin | Admin |
| `admin.row.you` | You | Bạn |
| `admin.row.mailNotSent` | Mail not sent | Chưa gửi được thư |
| `admin.row.invitedBy` | Invited by {name} · {date} | {name} đã mời · {date} |
| `admin.action.menu` | Actions for {name} | Thao tác cho {name} |
| `admin.action.resend` | Resend | Gửi lại |
| `admin.action.revoke` | Revoke | Thu hồi |
| `admin.action.changeRole` | Change role | Đổi vai trò |
| `admin.action.deactivate` | Deactivate | Vô hiệu hóa |
| `admin.action.reactivate` | Reactivate | Kích hoạt lại |
| `admin.lock.lastAdmin` | Make someone else an Admin first | Hãy chọn người khác làm Admin trước |
| `admin.lock.self` | You cannot deactivate yourself | Bạn không thể tự vô hiệu hóa mình |
| `admin.lock.current` | Current role | Vai trò hiện tại |
| `admin.changeRole.title` | Change role? | Đổi vai trò? |
| `admin.changeRole.toAdmin` | New role: Admin. They can open the Admin page, invite people, change roles and deactivate people. | Vai trò mới: Admin. Họ có thể mở trang Admin, mời người, đổi vai trò và vô hiệu hóa người khác. |
| `admin.changeRole.toMember` | New role: Member. They can no longer open the Admin page or manage people. | Vai trò mới: Thành viên. Họ không còn mở được trang Admin hay quản lý người khác. |
| `admin.changeRole.confirm` | Change role | Đổi vai trò |
| `admin.deactivate.title` | Deactivate this person? | Vô hiệu hóa người này? |
| `admin.deactivate.description` | {name} will be signed out everywhere and cannot sign in again. Their messages stay. | {name} sẽ bị đăng xuất khỏi mọi nơi và không thể đăng nhập lại. Tin nhắn của họ vẫn được giữ. |
| `admin.deactivate.confirm` | Deactivate | Vô hiệu hóa |
| `admin.reactivate.title` | Reactivate this person? | Kích hoạt lại người này? |
| `admin.reactivate.description` | {name} can sign in again with a code sent to their address, with the same history and channels. | {name} có thể đăng nhập lại bằng mã gửi tới địa chỉ của họ, với cùng lịch sử và kênh. |
| `admin.reactivate.confirm` | Reactivate | Kích hoạt lại |
| `admin.revoke.title` | Revoke this invitation? | Thu hồi lời mời này? |
| `admin.revoke.description` | The invitation to {email} stops working. The Join button in its mail will no longer let anyone in. | Lời mời gửi tới {email} sẽ không còn hiệu lực. Nút Join trong thư sẽ không cho ai vào nữa. |
| `admin.revoke.confirm` | Revoke | Thu hồi |
| `admin.invite.title` | Invite members | Mời thành viên |
| `admin.invite.close` | Close | Đóng |
| `admin.invite.emails.label` | Email addresses | Địa chỉ email |
| `admin.invite.emails.hint` | Separate addresses with commas or new lines. | Phân tách các địa chỉ bằng dấu phẩy hoặc xuống dòng. |
| `admin.invite.role.label` | Role | Vai trò |
| `admin.invite.send` | Send invitations | Gửi lời mời |
| `admin.invite.error.invalid` | "{address}" is not a valid email address. | "{address}" không phải địa chỉ email hợp lệ. |
| `admin.invite.error.tooMany` | Send at most {count} addresses at a time. | Mỗi lần chỉ gửi tối đa {count} địa chỉ. |
| `admin.invite.results.label` | Results | Kết quả |
| `admin.invite.result.alreadyMember` | Already a member | Đã là thành viên |
| `admin.invite.result.alreadyInvited` | Already invited | Đã được mời |
| `admin.invite.result.invalid` | Not a valid address | Địa chỉ không hợp lệ |
| `admin.invite.done` | Done | Xong |
| `admin.channels.title` | Channels (D-183) | Kênh |
| `admin.channels.members` | one: {count} member; other: {count} members | other: {count} thành viên |
| `admin.channels.archived` | Archived (P) | Đã lưu trữ |
| `admin.channels.loading` | Loading channels | Đang tải danh sách kênh |
| `admin.channels.error` | Could not load the channels. | Không tải được danh sách kênh. |
| `admin.error.retry` | Try again | Thử lại |
| `admin.error.id` | Error ID: {id} | Mã lỗi: {id} |
| `admin.error.stale` | This page was out of date. It has been refreshed. | Trang đã cũ. Dữ liệu đã được làm mới. |
| `admin.error.unreadable` | This page is out of date. Reload it to continue. | Trang đã cũ. Hãy tải lại để tiếp tục. |
| `admin.toast.roleChanged` | Role changed | Đã đổi vai trò |
| `admin.toast.deactivated` | Deactivated | Đã vô hiệu hóa |
| `admin.toast.reactivated` | Reactivated | Đã kích hoạt lại |
| `admin.toast.revoked` | Invitation revoked | Đã thu hồi lời mời |
| `admin.toast.resent` | Invitation sent to {email} | Đã gửi lời mời tới {email} |
| `admin.toast.resentNoMail` | Mail not sent to {email} | Chưa gửi được thư tới {email} |

(P) and "(D-183)" are notes in this table only; the catalogs hold the text without them. "Join" in the revoke text is the button's word in the mail (TOKI-021).

### Table B. `admin.css`
The prototype has no members table, so the whole table is decided here, with the prototype's own values where it has them: the table look is the prototype's `.ctable` (lines 743 to 747), the chips are `.chip` (line 98), the search is `.field` and the toolbar is `.toolbar` (line 355).

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.adm-table` | `border-collapse:collapse;width:100%;font-size:12.5px` | `.ctable` |
| `.adm-table th, .adm-table td` | `text-align:left;padding:8px;border-bottom:1px solid var(--line);vertical-align:middle` | `.ctable` (padding 6px 8px in the prototype; 8px so a row with a button reaches 40 px) |
| `.adm-table th` | `font-weight:600;color:var(--muted);font-size:11.5px` | `.ctable` |
| `.adm-name` | `display:flex;align-items:center;gap:10px;min-width:0` | decided |
| `.adm-name b, .adm-name .adm-sub` | `overflow-wrap:anywhere` | decided: a long address wraps |
| `.adm-lock` | `display:block;font-size:11.5px;color:var(--muted)` | decided: the reason line inside a menu item |
| `@media (max-width:719px) .adm-table tr` | `display:block;border:1px solid var(--line);border-radius:var(--radius);padding:8px 12px;margin-bottom:8px` | decided: the card of R26 |
| `@media (max-width:719px) .adm-table td[data-label]::before` | `content:attr(data-label);display:block;font-size:11.5px;color:var(--muted)` | decided |

### Layout
```
apps/web/src/admin/
├─ AdminRoute.tsx       gate (R3), renders AdminPage or NoAccess
├─ AdminPage.tsx        SectionPage, AdminNotices, MembersSection, ChannelsSection
├─ NoAccess.tsx         R4
├─ adminApi.ts          R5
├─ useMemberList.ts     R6 to R10
├─ useLoadMore.ts       R9 (the sentinel), used by R25
├─ MembersSection.tsx   toolbar, chips, table, rows
├─ MemberRow.tsx        R12, R13, R15
├─ RowMenu.tsx          R16, R17 (the map of the permission functions)
├─ useAdminAction.ts    R18, R19, R20 (the four confirmations and Resend)
├─ InviteDialog.tsx     R21 to R24
├─ ChannelsSection.tsx  R25
├─ notices.tsx          the place for TOKI-103 (R27)
├─ useDateContext.ts    R30
├─ admin.css            Table B
└─ *.test.ts, *.test.tsx
apps/web/src/routes/admin.tsx          adminRoute (R1)
apps/web/src/shell/sections.ts         one row (R2)
packages/i18n/src/messages/{en,vi}/admin.ts, index.ts of both
```

## Testing
- Written test-first, in `apps/web` with Vitest, Testing Library and `user-event` (the set-up of TOKI-093 R2), a fake `api` that records its calls and answers from a small in-memory model of the server (the same rules for `search`, `status`, `counts` and `limit`, so the chip test is real), the test clock of TOKI-008 and `IntersectionObserver` faked by a test helper that fires it. Fake data only: `sam@example.com`, `Lan`, `Minh`.
- Route and gate (R1 to R4): `visibleSections` for `admin`, `member` and no role; the route renders the page for an Admin and the no-access view, with the title and nothing else, for a Member, with zero calls of the fake `api`; a 403 of any request switches an Admin's page to the view; the view holds no member, count or channel name; the shell test of TOKI-015 R36 still passes.
- Calls (R5): one test for each function with the method, path, query (an empty `search` left out), body and key header; the `Idempotency-Key` is 36 characters and matches the server's pattern; `api.request` sets `headers` and cannot replace `Accept`; the function files import nothing but `api`, the shared schemas and constants.
- List (R6 to R10): the first request has no `limit`; a stale answer for an older query is dropped; five key presses within 300 ms make one request and 301 ms apart make two; the filter sends `status`; chips show the totals of the answer and the number on each chip equals the rows its press shows, with and without search text, for 120 rows in pages of 50; the All total is the sum; a chip with 0 shows R14; more on scroll asks the next cursor once, never twice for one cursor, not with `nextCursor` null, and shows each row once over 120 rows; focus on the last row asks too; a failed later page keeps the rows; reload sends `limit` of the rows shown clamped to 50..100 and keeps the scroll position; after a failed refresh the table stays.
- Table (R11 to R14): each kind of row (active, deactivated, pending, `failed` mail, expired, the person themselves, a deactivated person with an invitation) in a snapshot of the cells and texts; the status cell reads Mail not sent for a pending invitation with failed mail and Expired for an expired one with failed mail; the invitation line holds the inviter and the date; a null `lastActiveAt` and an invalid date give "—"; no `a` element and no `href` in the page; empty, loading, failed (with and without `requestId`) and unreadable states.
- Actions (R15 to R20): the menu for an active Member, an active Admin among two, the last Admin, the actor's own row with two Admins and with one, a deactivated person; locked items are `aria-disabled`, reachable by arrow keys, show the reason inside the item and do nothing when pressed; an unknown result of a permission function (the function stubbed to `fact_missing`) leaves the item out; each confirmation names the person or the address, `Esc`, outside press and Cancel send nothing, the confirm sends one request, a second press during `busy` sends none, the offline gate blocks and keeps the dialog open; each result of R19 (200, 409 with each of the four codes, 404, 403, 401, 500 with and without `requestId`, a network error, another 409); focus after a success on an existing row and on a row that left the table; Resend sends no confirmation, a new key for each press, one request for two fast presses, and the two toasts.
- Invite dialog (R21 to R24): Member chosen at first; no discard question with no text, and the question with text on the close button and Cancel, an outside press does nothing with text; a changed role alone asks nothing; commas, CR, LF and CRLF; one invalid piece gives the message under the field and keeps Send disabled until fixed; 50 addresses send and 51 give the tooMany message with Send disabled; a repeated address counts once; Send disabled while the request runs and the dialog ignores Esc then; the key is kept for a retry after a 500 and replaced after a 200 and after an edit; the result step for a batch of 10 where the fake server answers `invited` for 3 and `mail_not_sent` for 7 (TS-105), and one result of each kind; Resend inside the result step; the list reloads at the 200 and not at Done; focus on open and on close.
- Narrow (R26): at 719 px the cells are blocks with `data-label`, the roles are kept, the header is not removed from the accessibility tree, and each control is at least 40 px (the test reads the CSS with `readCss`; the layout itself is checked in the browser test).
- Texts and dates (R28 to R30): the keys and both texts against Table A; the plural of `admin.channels.members` for 0, 1 and 2; dates in `en` and `vi` and with the clock moved across midnight and a year end; the page in `vi` shows no English word except `Admin`.
- Channels and the two seams (R25, R27): rows, the archived tag, the lock icon, more on scroll, error and Retry; `AdminNotices` renders nothing; a test replaces it by a stand-in and finds it above the members section; a test with a stand-in `CreateChannelButton` finds it once in the heading row, called with `onCreated`, and finds no "+" in the heading when the stand-in is absent.
- Browser test (Playwright, TOKI-008) once TOKI-024 is built, on the real server with the fake mail layer: a Member who opens `/admin` sees the no-access view and the browser sent no request to `/api/v1/members`; an Admin invites two addresses, sees both rows read Invited, resends one, revokes the other after confirming, and the row goes; the Admin deactivates a Member after confirming and the Member's next request is refused; the one Admin cannot deactivate or demote themselves (the items are locked with the reason); at 360 px the same page works with no horizontal scroll.

## Data safety
- The page holds every person's email address and every invited address. They are held in memory by `useMemberList` only, are dropped when the page unmounts, and are not put in the address, in `localStorage`, in the conversation store or in a log. The search text is not put in the address, so it reaches no history and no `Referer`.
- No `console` call in `apps/web/src/admin` holds an address, a name, a key or an answer body. An `ApiError` is shown only through its kind, status, code and `requestId` (TOKI-032 R4); the address of a failed invitation is never put in an error text.
- The `Idempotency-Key` lives in the memory of the dialog and is not stored. The code and the token of an invitation are never sent to this page: the server answers none (TOKI-024 R22).
- A Member's browser never asks for the list: the gate comes before the first request (R3), and the server refuses it anyway (D-090).
- The page leads to no message content, and an Admin sees no private channel or DM they are not in (F39, D-047; concern 3 is about which private channels the list holds).
- Nothing is deleted from this page: deactivation keeps messages and rows (BR-29).

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to intent I04, milestone M2; size L | Planning fact; Scope draws the lines with TOKI-098, TOKI-103, TOKI-092, TOKI-082 and TOKI-079. |
| Needs TOKI-024 and TOKI-093; also uses TOKI-015, 012, 013, 014, 032, 027, 017, 094 | R5 (calls), R18 (ConfirmAction, TOKI-093), R21 (form guard), R2 and R26 (shell), R16 (permission functions), R28 (texts), R30 (dates); "Plan changes" in concern 12 lists the needs the plan lacks. |
| The "+", the Create channel dialog: TOKI-098; the disk warning: TOKI-103; the More sheet: TOKI-092 | R25 (the place for `CreateChannelButton`), R27 (`AdminNotices`), R2 (`more: true`). |
| Only an Admin opens the page; the server refuses every admin request from a Member; no Owner (D-090, D-152) | R2, R3, R4, R19 (403); every control is decided by the Member and Admin functions only (R16). |
| Invite with Member or Admin, up to 50, each address its own result (D-153, D-134, D-099); the button is disabled while the request runs (D-111) | R21, R22, R23; R18 and R20 for the other buttons. |
| Confirmations name the target; a form with content does not close on an outside click (D-069, D-070) | R18 (`ConfirmAction`, target), R21 (`useFormGuard`). |
| First 50 and more on scroll; a chip's count equals the rows shown (D-109, D-074) | R6, R8, R9, R14. |
| Nothing hover-only or desktop-only; offline blocks admin actions (D-067, D-060, D-079) | R15, R17, R26; R18, R20, R22, R24. |
| Nothing leads to message content; no private channel the Admin is not in (F39, D-047) | R12, R25 (no link); concern 3. |
| English by default, every text through i18n; tests first | R28, R29; Testing. |

## Open questions from the intent
- What does the row show for a deactivated person who has a pending invitation? Not answered. Carried forward as concern 1.
- Does the Admin search ignore diacritics, as Ctrl+K does? Not answered. Carried forward as concern 2.
- Which channels does the Channels list show: the ones the Admin may see, or every channel? Not answered. Carried forward as concern 3.
- Is "Change role" locked on the Admin's own row, as journey F39 says, or only when the last Admin would be demoted, as the rules say? Not answered. Carried forward as concern 4.
- Who refreshes the signed-in person's role, so that the Admin entry appears or disappears at once after a role change? Not answered. Carried forward as concern 5.
- Is the "no access" view drawn inside the app frame or alone? Not answered. Carried forward as concern 6.
- Does the Expired status have a chip of its own, and does Resend ask for confirmation? Answered: Expired has a chip because the server returns it as a status with its own total and journey F02 gives the row that state (R8); Resend asks nothing, as journey F02 says and D-091 accepts it as the baseline (R20). Evidence: F02, D-091, D-074, TOKI-024 R22 and R24.

## Areas of concern
1. What the row of a deactivated person with a pending invitation shows, and how the status counts treat them. Not decided by the log (TOKI-024 concern 3 asks the same; TOKI-019 concern 11 proposes "Deactivated until the invitation is used"). The server returns the account's status and the invitation as a field (TOKI-024 R22). Built as a proposal, which a change touches only `MemberRow` and the counts: the row is an account row with the status Deactivated and the menu of a deactivated person (R15, R16); the invitation is not drawn, so its Resend and Revoke are not reachable from the page. Owner: Thanh Truong (product owner).
2. Whether the Admin search matches Vietnamese typed without diacritics, and whether the order follows Vietnamese rules. Not decided: D-015 decides diacritics only for Ctrl+K, D-177 for People, and no decision names the Admin page. The page sends the text as typed and the server matches case-insensitively and orders by bytes (TOKI-024 R23, R24, concern 11 there); the page does not filter or sort itself, so the answer changes the server and not this screen. Owner: Thanh Truong (product owner).
3. Which channels the Channels list holds. Not decided: D-183 says "all channels with their member counts", D-047 and F39 say an Admin does not see private channels or DMs they are not in, and `GET /channels` returns the public channels and the private ones the person is in (TOKI-029 R6, concern 3 there). The page shows what that route returns, so an Admin does not see another private channel. A list of every private channel would be a new route with its own rule. Owner: Thanh Truong (product owner), with TOKI-098.
4. Whether "Change role" is locked on the Admin's own row. Not decided: journey F39 says the entries are locked on the Admin's own row and on the last Admin's row, while D-153 and TOKI-027 R12 allow an Admin to demote themselves when two or more Admins exist and refuse only the last Admin. The page follows the functions: Deactivate is locked on the own row (`self_target`), and Change role is locked only when the person is the last Admin (R16). If the product owner wants the journey's reading, the own row's role items are locked with a reason that this spec does not yet have. Owner: Thanh Truong (product owner).
5. Who refreshes the signed-in person's role after a change, and who builds the Activity item and the live update of the changed person's screen (F40, F41). Not decided: TOKI-024 concern 8 and TOKI-015 concern 20 leave it without an owner, and the session state of TOKI-023 holds `user` and has no refresh after a change. What this page does: after an Admin demotes themselves, the reload of the list is answered 403 and the page shows the no-access view (R19); the shell's Admin item stays until the session state is refreshed. Owner: Thanh Truong (product owner, for the plan).
6. Whether the no-access view is drawn inside the app frame. Not decided in the log (D-131 says one shared page for 403 and 404; the journey F39 gives the line). Built as TOKI-015's proposal: inside the frame, since the person is signed in and can leave by the navigation; TOKI-082's shared view may change it. Owner: Thanh Truong (product owner), with TOKI-082.
7. The calls and the missing `Idempotency-Key` header. Decided in this spec: the page calls the server through `api.request` in its own `adminApi.ts` and adds no method to the client of TOKI-032 (R5), so TOKI-032 keeps its contract table (its R27). The one thing the client lacks is a way to send a header: this is a change request to TOKI-032, an optional `headers` field of `request` that cannot replace `Accept`, `Content-Type` or the credentials mode, and this work's build waits for it (or TOKI-032 adds it first). Reason: TOKI-024 R13 needs `Idempotency-Key` on the batch and the resend, the two routes that send mail. Owner: Thanh Truong, with TOKI-032.
8. How the table loads. Decided in this spec: the list is the page's own and not in the conversation store (it would hold every address in a store that outlives the page); the search is sent after 300 ms of no typing; more on scroll uses an `IntersectionObserver` on a sentinel and not a reference to the shell's scrolling area, so the page needs no hook into `SectionPage`; after a change the list reloads with `limit` of the rows shown, between 50 and 100, instead of asking every page again (R6 to R10). The 300 ms, the 48 px and the 100-row cap are builder choices, not decisions of the log. `useLoadMore` repeats the rule of TOKI-034 R8 for another scrolling element; a later ticket may move both to one shared hook. Owner: Thanh Truong.
9. Layout choices the Blueprint leaves to the builder. Decided in this spec: five chips with Expired as its own chip and an All chip (R8; the server returns four statuses with totals, F02 gives Expired as a row state, F39 asks for a chip with a total per status); Resend and Revoke are buttons on an invitation row and the other actions are in a menu (F02 says buttons, F39 says a menu); a deactivated person's menu holds only Reactivate (R16); the status of an invitation whose mail failed reads "Mail not sent" (R13, AC-067); the result of a batch is shown per address in the dialog and the table reloads behind it (R23, because F02 says the row of an already-member or already-invited address "says so" and no row is new for them); the locked reason is the second line of the menu item (R17). Resend asks no confirmation: Answered by F02 and D-091 (R20), which TOKI-093 concern 10 leaves unclassified. Owner: Thanh Truong.
10. The texts. Decided in this spec: D-139 makes every wording the prototype does not contain a proposal and leaves the final words to the design, so the texts of Table A are built as written; the Vietnamese texts and the form of address "bạn" are proposals that TOKI-080 reviews. The lock reason "Make someone else an Admin first" is journey F40's line; "You do not have access to this page" is journey F39's line. Owner: Thanh Truong.
11. The lines with the neighbours. Decided in this spec: TOKI-098 owns the "+" button, the Create channel dialog and the new channel; this work owns the Channels section, the list and the heading, in which it places `<CreateChannelButton onCreated={reload} />` (R25). TOKI-103 owns the disk warning; this work owns the region above the members section (R27). TOKI-092 owns the More sheet; this work sets `more: true` (R2). TOKI-082 owns the shared no-access view and the loading skeletons and replaces `NoAccess.tsx` and the loading lines. TOKI-079 owns the People page and the role label there. TOKI-024 owns every rule the page shows; TOKI-093 owns the confirmation, the guard and the offline gate. Owner: Thanh Truong.
12. Plan changes this spec asks for; it edits no plan or other spec. Decided in this spec: TOKI-025 needs TOKI-015, TOKI-012, TOKI-013, TOKI-014, TOKI-017, TOKI-023, TOKI-027, TOKI-032 and TOKI-094 besides TOKI-024 and TOKI-093, and TOKI-032 needs the `headers` field of concern 7; TOKI-098 needs nothing of TOKI-025 (whichever of the two lands second adds the one line in the Channels heading, R25) and TOKI-103 needs TOKI-025 (it fills `AdminNotices`); TOKI-092 needs the `more: true` row of TOKI-025 to list Admin. The build order, if the size needs it: the route, gate and texts; the list with search, chips and paging; the row actions and confirmations; the Invite dialog; the Channels section. Owner: Thanh Truong, for the plan.
