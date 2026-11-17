# Archive and restore a channel (screens) design

Date: 2026-11-17 · Status: draft for review
Intent: docs/intents/archive-restore-channel.md (Thanh Truong)
Ticket: TOKI-101

## Goal
Admins need to put a channel away and bring it back, and members need to read what was said in a channel that was put away. The server has the two requests (TOKI-029 R14) and the client has the two commands `archiveChannel` and `restoreChannel` (TOKI-032 R15); no screen uses them. This work builds: the "Archive channel" button of the Details panel with its confirmation; the page a member sees when they open an archived channel, with the name, the topic, an "Archived" label, the readable history and, where the composer would be, the notice "This channel has been archived"; and the "Restore" button beside an archived channel in Browse channels. Nothing deletes a channel (D-029, AC-052).

## Scope
- In:
  - `apps/web/src/channel-archive/`: the two access functions (R6, R7), `ArchiveSection` (the button and its confirmation), `ArchivedChannelPage` with its header and notice, `RestoreButton`, the plain functions behind the two requests, the seam file `deps.ts`, one CSS file and the tests (Design, "Layout").
  - The `archive` i18n namespace, ten keys, English and Vietnamese (R3).
  - One row added to the action table of TOKI-093, `restoreChannel` (R5).
  - Four small additions to files of other tickets, each named once and none changing what that ticket builds: one section in the list of `DetailsPanel` (TOKI-035, R8); one `RestoreButton` in `BrowseRow` and one prop on `BrowseChannelsDialog` (TOKI-034, R18, R20); one branch in the route `/c/$conversationId` (TOKI-033, R13). Design, "Hand-offs", lists them.
- Out (not now):
  - The requests and every server rule: who may archive and restore, #general, the repeat of a request, the locks: TOKI-029 R14, R15, and the functions `canArchiveChannel`, `canRestoreChannel` of TOKI-027 R9. The refusal of a message posted in an archived channel is `canPostInConversation` (TOKI-027 R5), called by the message API (TOKI-037); this ticket only draws the notice.
  - The two store commands and the rules that remove or add the list entry: TOKI-032 R14, R15, R26. This ticket calls them as they are.
  - The conversation list, which already leaves out an archived channel (TOKI-031 R6, TOKI-033 R29). The header, the panel, the About, Members and Leave of an ordinary channel: TOKI-035. Browse channels, its rows, its "Archived" label and "Join": TOKI-034.
  - The message list that draws the history: TOKI-041; this ticket gives it the place (R14). The composer: TOKI-043; an archived channel's page has none, so TOKI-043 changes nothing for it. Search results from archived channels: TOKI-071, TOKI-072.
  - The strip "This channel was just archived" for members who have the channel open at that moment, and the live removal of the channel from their list: needs events (TOKI-038, TOKI-040) and the class `.strip` (TOKI-082); no ticket owns the strip (concern 5, TOKI-029 concern 4).
  - The Details panel of an archived channel and the personal settings of one (concern 4; TOKI-035 concern 3).
  - Archiving a channel when its last member leaves (D-051): TOKI-029 R12 does it and TOKI-035 R24 warns; it is the leave flow, not this one.
  - Deleting a channel: not built, by decision (D-029).

## Requirements
Packaging and shared rules
- R1. `apps/web/src/channel-archive/` holds `deps.ts`, `access.ts`, `archiveFlow.ts`, `restoreFlow.ts`, `ArchiveSection.tsx`, `useArchiveChannel.ts`, `ArchivedChannelPage.tsx`, `ArchivedHeader.tsx`, `ArchivedNotice.tsx`, `archivedDetail.ts`, `RestoreButton.tsx`, `useRestoreChannel.ts`, `archive.css`, `index.ts`, and a test file next to each `.ts` and `.tsx`. `index.ts` exports `ArchiveSection`, `ArchivedChannelPage`, `RestoreButton`, `canOfferArchive`, `canOfferRestore` and `isArchivedMember`. A test checks that the files exist and the names are exported; it does not require that nothing else is. `packages/ui-web` gets no file and no change.
- R2. The seam. `deps.ts` is the only file of this change that imports `apps/web/src/client.ts` (TOKI-032 R25). It exports `conversations` (for `readChannel`, `archiveChannel`, `restoreChannel`, `refresh`, `getChannelDetail`, `getMemberCount`, `hasConversation`, `getUser`), `classifyApiError`, `useConversationSelector` (TOKI-033 R29) and `useCurrentUser()`, which is `useConversationSelector((s) => s.getUser())` (a `{ id, role }` that keeps its identity until the store changes, TOKI-032 R22). Every other file of this change imports from `./deps`. A test reads the files of the folder and fails on an import of `@toki/client-core` or of `client` outside `deps.ts`. The tests of the screens replace `deps.ts` with `vi.mock`.
- R3. Texts. `packages/i18n/src/messages/en/archive.ts` and `vi/archive.ts` hold exactly the ten keys of Table T with the texts written there, and both language `index.ts` files list the namespace. `pnpm i18n:check` exits 0. No file of this change (test files excepted) holds a visible English word in a JSX text or a string prop: every text comes from `t(...)`; a test reads the files and fails on a JSX text node that has a letter. A test compares the ten keys and both texts with a copy of Table T. Reused, not added: `common.cancel`, `common.undo`, `common.error.actionFailed` (TOKI-093 Table B) and `conversation.header.back` (TOKI-035 Table B).
- R4. `archive.css` holds exactly the rules of Table A and no other. It uses only the 32 properties of TOKI-009 R10 through `var(--…)`, no colour literal, no `!important`, no `:hover` rule and no `style=` attribute in the sources of the folder. It writes no selector of TOKI-035's `conversation.css`: a test reads it and fails on `.mh`, `.dp-leave`, `.mrow` or `.later-ic`.
- R5. Table A of TOKI-093 gets one row in the same change (TOKI-093 R10: a ticket that adds an action adds its row, and the test that holds a copy of the table is updated with it): `restoreChannel`, pattern `undo`, source `reading of D-069 (concern 2)`, owner `TOKI-101`. `actionPatterns` then holds 19 rows, and a test of this folder reads `actionPatterns.archiveChannel.pattern` (`confirm`, owner `TOKI-101`) and `actionPatterns.restoreChannel.pattern` (`undo`).

Who is offered what
- R6. `canOfferArchive({ actor, channel })` in `access.ts` is a pure function. `actor` is `{ id, role }` (`useCurrentUser()`); `channel` is `{ isPrivate, isGeneral, archived, isMember }`. It returns `true` only when `archived` is `false` and `canArchiveChannel(actor, facts)` of `@toki/shared` (TOKI-027 R9) is allowed, with `facts` `{ kind: isPrivate ? "private_channel" : "public_channel", isGeneral, archived, isMember }`. The function compares no role itself (TOKI-027 R16). A table test: Admin member of a public channel `true`; Admin member of a private channel `true`; Admin member of #general `false`; Admin who is not a member `false`; Member who is a member `false`; Admin member of an archived channel `false`; a missing actor (`null`) `false`.
- R7. `canOfferRestore({ actor, channel })` is the same with `canRestoreChannel` and the opposite state: `true` only when `archived` is `true` and the function allows. Table test: Admin member of an archived public channel `true`; of an archived private channel `true`; Admin who is not a member of an archived public channel `false` (concern 1); Member `false`; an active channel `false`; `null` actor `false`. The one line that concern 1 would change is the call inside this function.

Archive
- R8. `ArchiveSection({ conversationId })` is added to the list of sections of `DetailsPanel` (TOKI-035 R11), after Settings and before the Leave button, which stays the last element of the panel body (placement: concern 3, a proposal). It renders nothing unless `canOfferArchive` is `true` for the entry and the held detail of the channel (`getConversation(id)` gives `isPrivate`, `isGeneral`; `getChannelDetail(id)` gives `archived`; `isMember` is `true`, a panel is a member's). When it renders, it is `div.dp-archive` holding one `Button` of TOKI-012 with the class `archive`, the default variant and the text `t("archive.button")`; its red text comes from Table A, as the Leave button's does (TOKI-035 R21). It is drawn at every width. Check: present for an Admin who is a member of a public and of a private channel and on a 360 px viewport; absent for a Member, for #general as an Admin and as a Member, and for a DM and a group (they are no channel, `canArchiveChannel` gives `not_a_channel`).
- R9. The press. In this order: (1) the button is disabled and `aria-busy="true"` while the next step runs (D-111); (2) `conversations.readChannel(id)`, then `getMemberCount(id)`, so the count is read at the press and not taken from a detail that may be old; (3) when the read fails and a count is held, that held count is used; when it fails and none is held, nothing opens and one toast `t("common.error.actionFailed")` is shown (the confirmation must name the count, F26, so it is never opened without one; Decided in this spec); (4) `ConfirmAction` of TOKI-093 R18 opens with `action: "archiveChannel"`, `title` `t("archive.title")`, `target` `#{name}` (the channel's name with a `#`), `description` `t("archive.message", { count })`, `confirmLabel` `t("archive.confirm")`, `variant` `danger`, and the archive button as `returnFocusRef`. Cancel, Esc and an outside press close it and change nothing (TOKI-093 R6). `ConfirmAction` checks the connection itself: offline, `onConfirm` is not called, the dialog stays open and the explanation toast shows (D-079). Check: no `archiveChannel` before the confirm; the dialog holds the target `#design` and the count (`1 member`, `25 members`); a count of 2 in the held detail and 25 in the fresh read shows 25; a failed read with a held count of 7 shows 7; a failed read with none opens no dialog and shows the one toast; a second press while the read runs opens one dialog.
- R10. Confirm. `onConfirm` runs `archiveFlow` (a plain function that takes the store commands, `show`, `t` and the callbacks as arguments and calls no hook, so it works after the dialog has unmounted) with `busy` set on the dialog until the command answers (TOKI-093 R7). It calls `conversations.archiveChannel(id)` once. On success, which is any resolved command (a repeat answers 200 with `changed` false, TOKI-029 R14, D-111), it shows one plain toast `t("archive.done", { name })` with no button (an action with a confirmation never also offers Undo, D-069, AC-077) and the store has removed the entry and kept the detail with `archived` true (TOKI-032 R15). The person is not moved: the route of R13 draws the archived page for that address, so what they see afterwards is the channel with its composer replaced (F26: "Afterwards ... its composer is replaced"; Decided in this spec, concern 6). The dialog closes with the panel, which unmounts with the page it belonged to. Check: one `archiveChannel` call with the buttons disabled while it runs; one toast with no `Undo` button; the page test of R13 ends on the archived page at `/c/{id}`, with the history not grown.
- R11. Failures of the archive request, by `classifyApiError` (TOKI-032 R8, D-131): `no_access` (403 or 404: the person is no longer an Admin or a member) closes the dialog and applies the not-found view as TOKI-035 R14 does; `fresh_copy` (409, for example `channel_is_general` on a stale screen) calls `readChannel(id)`, closes the dialog and shows `t("common.error.actionFailed")`; `unauthenticated` and `ignore` do nothing here; every other kind keeps the dialog open with `busy` off and shows that toast, so the person can try again or cancel. Check: one test per kind, each asserting the dialog, the toast and the calls; a double press of Archive in the dialog sends one request.
- R12. Nothing deletes a channel (AC-052). With a session of an Admin and of a Member, in the Details panel of a channel, the buttons are those of TOKI-035 plus at most the one of R8; no element holds the words of a delete action, and no source file of this change calls a `DELETE` of `/channels/{id}` or the name of a delete command. A test lists every `button` of the panel for both roles and compares it with that list, and a test reads the folder's sources and fails on such a call.

The archived channel
- R13. The route. In `apps/web/src/routes/conversation.tsx` (TOKI-033 R21), once the store's `status` is `ready`, an id that is not a conversation of the list and whose held detail satisfies `isArchivedMember(detail)` draws `ArchivedChannelPage` with `channelId` and the route's `onBack`. This check comes before cases (b) and (c) of TOKI-033 R21 and replaces the not-found view that the branch of `memberChecked` draws today. `isArchivedMember(detail)` in `archivedDetail.ts` is true only for a held `ChannelDetail` or `ChannelSummary` whose `archived` and `isMember` are both `true`. So: a member who opens an archived channel from Browse reaches `UnjoinedChannel`, which reads it and calls `onMember` (TOKI-034 R16 (c)); the route then refreshes once and draws the archived page, because the store keeps the detail of an archived channel through a refresh (TOKI-032 R14). A member who archived it, or opens it again in the same session, gets the page at once (the check precedes the `seen` fallback). A person who is not a member, a private channel the person is not in, an id that does not exist, and a channel that is not archived are decided as before. Check, with a memory router and a fake store: each of these inputs ends on the page or on the view TOKI-033 draws today; a store that holds the entry draws the ordinary page (case (a) wins); after `restoreChannel` the same address draws the ordinary page.
- R14. `ArchivedChannelPage({ channelId, onBack, children? })` renders, inside the main area, `div` with `data-testid="archived-channel-page"` holding in this order: `ArchivedHeader` (R15); `div.arch-body` holding `children` (the place of the message list; it is empty until TOKI-041 fills it, Hand-offs); `ArchivedNotice` (R17). It renders no composer: no `textarea`, no element with `contenteditable`, no button that sends, and no `form`. It reads the channel only through `getChannelDetail(channelId)` and asks for no message of its own. Check: the structure and order; `children` appear inside `div.arch-body`; none of the listed elements is in the page.
- R15. `ArchivedHeader({ channelId, onBack })` renders `div.mh` (the classes of TOKI-035 Table C, `conversation.css`, whose stylesheet the file imports and does not copy, R4) holding `button.ib.back` (an `IconButton`, `icon="left"`, named `t("conversation.header.back")`, calling `onBack`); `div.grow` holding `h1.ell` (the glyph `lock` for a private and `hash` for a public channel, `span.ell` with the name, and a `Tag` of TOKI-012 with `t("archive.label")`) and, when the topic is neither null nor empty, `div.topic.ell` with the topic as plain text. It draws no members button, no search button and no tab: the Details panel of an archived channel is not decided (concern 4). While no detail is held it renders no name. Check: markup for a public channel with a topic, a private one with none, a topic `<b>x</b>` shown as text; a press on Back calls `onBack` once; no members button.
- R16. Reads and changes. On mount the page calls `conversations.readChannel(channelId)` once, so the label and the topic are the server's now. When the answer says the channel is no longer archived or no longer shared with the person, the store changes by TOKI-032 R14 and the route draws something else by R13: an active member gets the ordinary page (the entry is added), and a person who is no longer a member gets the view of TOKI-033 R21. A rejection by `classifyApiError`: `no_access` applies the not-found view as in R11; every other kind keeps what is held and shows nothing (the page is readable from the held detail; a read that cannot be repeated is not an error to the person). Two mounts of the page for one id make one request while it runs. Check: one `readChannel` per mount; the three answers; both kinds of rejection.
- R17. `ArchivedNotice` renders `p.arch-notice` with `t("archive.notice")` and `role="status"`, the last element of the page, where the composer sits in an ordinary conversation (D-078: nothing covers it). It is the only text in that place and it is drawn for every role, an Admin and a Member alike. It is not a control: it has no button and no link. Check: text in English and Vietnamese, the role, its place as last child; Admin and Member render the same.

Restore
- R18. `RestoreButton({ channel, onChanged })` is added to `BrowseRow` (TOKI-034 R6, R7) after the row's own action button. It renders nothing unless `canOfferRestore` is `true` for the row's `ChannelSummary` (`isPrivate`, `isGeneral`, `archived`, `isMember`) and the current user. When it renders, it is a `Button` of TOKI-012 with `size="sm"`, the text `t("archive.restore")` and `aria-label` `t("archive.restoreNamed", { name })`. `browseRowAction` and its six cases are not changed: an archived channel that the person belongs to keeps its "Open" button, and the restore button is a second one (Decided in this spec; TOKI-034 R7 says only that TOKI-101 extends the row). The dialog passes `onChanged` (R20). Check: a row for an archived channel with an Admin member shows the label, "Open" and "Restore", in that order; an Admin who is not a member shows the label only; a Member shows the label and "Open"; an active channel shows no restore; a private archived channel the Admin belongs to shows it; the row's buttons are at least 40 px tall at 719 px and below (the `Button` of TOKI-012 R8; a browser test measures one).
- R19. The press runs `run` of `useUndo()` (TOKI-093 R12) through `restoreFlow`, a plain function with the same shape as R10: `action: "restoreChannel"`, `text` `t("archive.restored", { name })`, `perform` the command `conversations.restoreChannel(id)`, `undo` the command `conversations.archiveChannel(id)`, `key` `restore:{id}`. No confirmation is asked (concern 2). The store's command puts the entry in the list with the person's earlier level, mute and star, by the refresh it runs (TOKI-032 R15), and a failed refresh does not reject it, so a `"done"` result is never read as a failed restore (the caution TOKI-032 R15 gives this ticket). The button is disabled and `aria-busy="true"` while the call runs, and a second press is ignored (D-111). Offline, the helper returns `"blocked"` with its explanation and nothing is sent. Undo archives the channel again without a question: it is the reverse of this action, not the action `archiveChannel` of R9 (the table keeps one pattern for each action, TOKI-093 R11). Check with fake timers: one `restoreChannel` call; the toast holds `Undo`; Undo within 4999 ms calls `archiveChannel` once and not later; a rejected restore gives the helper's one failure toast and no Undo; offline sends nothing.
- R20. After any outcome of R19 other than `"blocked"` (done, failed, and the press of Undo), `onChanged()` is called so that the dialog resets its list to the first page and asks it again, as TOKI-034 R13 does after a 409, and the row then shows what the server says: no `Archived` label and no restore button after a restore, the label and the button again after an Undo. `BrowseChannelsDialog` takes the reset function it already has and passes it down; it closes for none of these. The restored channel appears in the conversation list through the store (TOKI-033 R29) with no reload. Check: a fake `api.channels.list` that answers an archived row, then the active row, after the restore: the row loses the label and the button; after Undo it has them again; the list of the store gains the channel; the dialog stays open.

Controls and texts everywhere
- R21. Every control of this change is a component of TOKI-012 and so is at least 40 px tall at 719 px and below; none is hover-only (D-067); each opened dialog returns focus to the control that opened it (TOKI-014 R13) and a `RestoreButton` that disappears after its restore leaves focus to the dialog's own rule (TOKI-014 concern 9). The archived page has one `h1`, the channel's name (R15).
- R22. Both languages. Each of the ten keys is rendered once in `en` and once in `vi` (a test), and no text of the screens is built by joining parts of another text, except that `#` is put in front of a channel name, which is not a word (TOKI-035 R23 does the same).

## Design
### What the prototype does, and what this spec does
| Behaviour | Prototype | This spec |
| :---- | :---- | :---- |
| Archive a channel | None: the Details panel has Leave only (line 1452) | The button and the confirmation of R8 to R11; every text is a proposal (D-139) |
| An archived channel | None: no data holds one (TOKI-034, "What the prototype does") | The page of R13 to R17 |
| Restore | None | The button of R18 to R20 |
| Browse channels, archived rows | None | The label and the button; the label is TOKI-034's |
| Confirmation | An inline row (lines 1369, 1452) | A dialog that names its target, from TOKI-093; the prototype's inline row is not used |
| A toast after an action | `toast(text, act)`: 2800 ms plain, 5200 ms with a button (line 1192) | The Toast of TOKI-013 (5000 ms with a button, TOKI-013 R23) |

The prototype offers nothing to copy for the new screens. Their layout is built from the classes the header already has (`.mh`, TOKI-035 Table C, lines 210 to 214) and from the paddings of the prototype's composer (lines 311 and 537), which the notice takes.

### The flow of an archive
```
Archive pressed
  readChannel(id) -> count          (failed: held count, else one toast, no dialog)
  ConfirmAction names #name and the count
    Cancel / Esc / outside -> nothing changed
    Confirm -> offline? explanation, dialog stays
            -> archiveChannel(id), dialog busy
                 ok   -> toast "Archived #name" (no Undo); store removes the entry, keeps the detail
                         route draws ArchivedChannelPage at the same address (R13)
                 409  -> readChannel(id), close, one toast
                 403/404 -> close, not-found view
                 other -> dialog stays, one toast
```
Other members see the change at their next refresh or read; live update is concern 5.

### The flow of an open
```
Browse "Open" (member) -> /c/{id}   id not in the list
  -> UnjoinedView -> UnjoinedChannel reads the channel -> isMember true -> onMember(detail)
  -> route refreshes once; entry still absent; detail kept (archived true)
  -> isArchivedMember(detail) -> ArchivedChannelPage
```
The route draws nothing of the channel's messages itself; the message list of TOKI-041 will go in the page's body (R14).

### What each requester may see (R6, R7)
| Person | #general | Active channel (member) | Archived channel (member) | Archived channel (not a member) |
| :---- | :---- | :---- | :---- | :---- |
| Member | nothing | nothing | page, label in Browse, "Open" | label in Browse, no button |
| Admin | nothing | "Archive channel" | page, label, "Open" and "Restore" in Browse | label in Browse, no button (concern 1) |

### Table T. Texts, namespace `archive`
Every text is a proposal (D-139): the prototype has none of them. "This channel has been archived", "Restore" and "Archived" are the words of the journeys and the plan (F10, F21, F26), which D-091 accepts as behaviour and not as wording. The Vietnamese form of address is not decided (D-188, Open); the table avoids a pronoun where it can. The count takes plural forms (TOKI-017 R6).

| Key | English | Vietnamese (proposal) |
| :---- | :---- | :---- |
| `archive.button` | Archive channel | Lưu trữ kênh |
| `archive.title` | Archive this channel? | Lưu trữ kênh này? |
| `archive.message` | `{ one: "It will leave everyone's list and nobody will be able to post in it. {count} member can still read its history.", other: "It will leave everyone's list and nobody will be able to post in it. {count} members can still read its history." }` | `{ other: "Kênh sẽ biến mất khỏi danh sách của mọi người và không ai gửi được tin nhắn trong đó. {count} thành viên vẫn đọc được lịch sử." }` |
| `archive.confirm` | Archive | Lưu trữ |
| `archive.done` | Archived #{name} | Đã lưu trữ #{name} |
| `archive.label` | Archived | Đã lưu trữ |
| `archive.notice` | This channel has been archived | Kênh này đã được lưu trữ |
| `archive.restore` | Restore | Khôi phục |
| `archive.restoreNamed` | Restore #{name} | Khôi phục #{name} |
| `archive.restored` | Restored #{name} | Đã khôi phục #{name} |

### Table A. `archive.css`
The prototype has no archive screen, so every value is decided here; the source column says where it comes from.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.dp-archive` | `margin-top:16px` | decided: the same spacing as `.dp-leave` (TOKI-035 Table C) |
| `.dp-archive .archive` | `color:var(--danger)` | decided: the same as the Leave button (TOKI-035 R21) |
| `.arch-body` | `flex:1; min-height:0` | decided: the page's body takes the space between the header and the notice |
| `.arch-notice` | `margin:0 20px 16px; padding:12px 14px; border:1px solid var(--line); border-radius:var(--radius); background:var(--surface); color:var(--muted); text-align:center` | decided: the box has the margins of the prototype's `.composer` (line 311) and the border of its `.cbox` (line 313) |
| `@media (max-width: 719px)` `.arch-notice` | `margin:0 max(12px,env(safe-area-inset-right,0px)) calc(12px + env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))` | line 537, the same margins as the composer on a narrow screen |

### Layout
```
apps/web/src/channel-archive/
├─ deps.ts  access.ts  archivedDetail.ts
├─ archiveFlow.ts  useArchiveChannel.ts  ArchiveSection.tsx
├─ ArchivedChannelPage.tsx  ArchivedHeader.tsx  ArchivedNotice.tsx
├─ restoreFlow.ts  useRestoreChannel.ts  RestoreButton.tsx
├─ archive.css  index.ts   and a test next to each
packages/i18n/src/messages/{en,vi}/archive.ts   (+ the two index.ts lists)
```
`archiveFlow.ts` and `restoreFlow.ts` are plain functions that take `ensureOnline` (or `run`), `show`, `t`, the store commands and the callbacks as arguments and call no hook, so they do not depend on the component being mounted; `useArchiveChannel.ts` and `useRestoreChannel.ts` read `useOnlineGate()`, `useUndo()`, `useToasts()` and `useTranslation()` and return the bound functions (the form TOKI-034 R11 uses).

### Errors
- Archive: the failures of R11; a failed read of the count, R9.
- Restore: the failures are the helper's one toast (R19); the list is asked again (R20).
- Offline: both actions are blocked with the explanation of TOKI-093 R17 (D-079).
- A page for a channel whose detail is gone from the store: the route no longer draws it (R13) and draws what TOKI-033 draws for that case.

### Hand-offs
| To | What it must do or give |
| :---- | :---- |
| TOKI-029 | Gives `POST /channels/{id}/archive` and `/restore`, the answer `{ channel, changed }`, the permission rules and `memberCount` (R14, R7). Its concern 2 (who restores a channel with no Admin member) is concern 1 here |
| TOKI-032 | Gives `archiveChannel`, `restoreChannel`, `readChannel`, `getChannelDetail`, `getMemberCount`, `getUser`, `classifyApiError`; keeps the detail of an archived channel through a refresh (R14) |
| TOKI-033 | Owns the route. This ticket adds one branch to `src/routes/conversation.tsx` (R13) and nothing else there; TOKI-033 R21 (b) and its concern 13 name this ticket for the not-found view that the branch replaces |
| TOKI-034 | Owns `BrowseRow` and `BrowseChannelsDialog`. This ticket adds `RestoreButton` to the row and one prop to the dialog (R18, R20); `browseRowAction` is not changed. TOKI-034 R7 and its concern 2 name this ticket |
| TOKI-035 | Owns `DetailsPanel`. This ticket adds `ArchiveSection` to its section list (R8). The panel of an archived channel is TOKI-035 concern 3 and is not built here (concern 4) |
| TOKI-093 | Gets the row `restoreChannel` (R5); its confirmation and Undo are used as they are |
| TOKI-041 | Draws the history of an archived channel in `div.arch-body` of `ArchivedChannelPage` (R14), reading it with the membership rule of TOKI-027 R5 |
| TOKI-043 | Draws no composer for an archived channel: the page of this ticket has none. For an ordinary conversation nothing changes |
| TOKI-037 | Refuses a post to an archived channel with `canPostInConversation` (TOKI-027 R5, BR-11); this ticket draws only the notice |
| TOKI-038, TOKI-040, TOKI-082 | Live removal of the channel from other members' lists, the strip "This channel was just archived" and its class `.strip` (concern 5) |
| TOKI-016 | Nothing: this ticket adds no component to `ui-web` |

## Testing
- R6, R7: the two table tests, including a role that is not `member` or `admin` and a `null` actor, which give `false`; a source scan finds no comparison of a role to `"admin"` or `"member"` in the folder (TOKI-027 R16).
- R8 to R12: component tests with a fake store and `deps.ts` mocked, for an Admin and a Member, a public, a private and the general channel; each branch of R9 (count from the fresh read, held count, none); Cancel, Esc, outside, Confirm; the buttons disabled while a request runs; each status of R11; offline. Every `Button` is found by role and name, never by a class.
- R13: a router test with the real conversation route, a memory history and a fake store, for the inputs listed in R13. The page test of R10 ends on the archived page.
- R14 to R17: markup tests for the page, the header and the notice; the absence of every composer element; the content of both languages.
- R18 to R20: tests of `BrowseRow` with the dialog's fake `api.channels.list`; fake timers for the Undo; the reset of the list; the store gaining the entry.
- R21: one browser test (the browser project of TOKI-008) at 360 px that opens the page with a fake store and measures the notice's box inside the viewport and a restore button's height (at least 40 px).
- R3, R22: the key comparison, `pnpm i18n:check`, the render of each key in both languages.
- Finish: `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check`, `pnpm i18n:check` exit 0. All data is fake.

## Data safety
- The server decides who may archive and restore (TOKI-029 R14, BR-09). The screen hides a button the server would refuse and nothing more; a forged request is refused there.
- An archived channel is read only by its members: the page reads the channel with `GET /channels/{id}`, which gives a non-member the summary only and a private channel not joined a 404 (TOKI-029 R1, R7). The page draws nothing for those answers.
- The toasts and the dialog hold a channel name and a count, which the person already sees. No message text, no email and no secret is shown or logged by this change.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Archive offered only to an Admin who is a member, never for #general (D-047, D-034, D-090, F26, AC-016) | R6, R8, the access table in Design |
| The confirmation names the channel and its member count; never both a confirmation and an Undo (F26, D-061, D-069, AC-077, AC-078) | R9, R10 (no Undo after a confirmation), R19 and R5 (one pattern for each action) |
| After archiving: out of the list, composer replaced, history readable (F10, F26, D-029) | R10, R13, R14, R17; the list is TOKI-033's (R10 relies on TOKI-032 R15); the history is TOKI-041's place (R14) |
| No control deletes a channel (D-029, AC-052) | R12 |
| Browse shows the "Archived" label and gives Admins a "Restore" button (F26, F21) | R18 to R20; the label is TOKI-034 R7 |
| Blocked offline with an explanation; a button disabled while its request runs (D-079, D-111) | R9, R10, R19 |
| No feature hover-only; controls at least 40 px at 719 px and below (D-067, NFR-02) | R21 |
| English default, every text translated (D-018, D-064) | R3, R22, Table T |
| Every wording in quotes the prototype does not contain is a proposal (D-139) | Table T, "What the prototype does"; concern 8 |
| Permissions on the server (BR-09, D-090) | R6, R7 use the shared functions; Data safety |

## Open questions from the intent
- Who restores an archived channel in which no Admin is a member? Not answered. Carried forward as concern 1.
- Does Restore ask for confirmation, offer Undo, or neither? Not answered. Carried forward as concern 2.
- Where does "Archive channel" open from? Not answered. Carried forward as concern 3.
- What does a member see and reach when they open an archived channel? The log answers part: it is readable and the composer is replaced by a notice (F10, F26, D-029, AC-052). How a member reaches it, and what the route draws, is decided in this spec (R13, concern 6). The Details panel and the personal settings are not answered. Carried forward as concern 4.
- What do other members see when a channel they have open is archived? Not answered. Carried forward as concern 5.
- Which member count does the confirmation show, and does it include deactivated people? Not answered. Carried forward as concern 7.

## Areas of concern
1. Restoring an archived channel in which no Admin is a member. Not decided. The capability table (D-090) and D-047 say an Admin archives and restores only where they are a member, and TOKI-027 R9 and TOKI-029 R14 build that; F26 says Browse channels gives Admins a "Restore" button, and D-184 (Open) asks who restores a channel with no members. R7 follows the capability table, so an Admin who is not a member sees the label and no button, and a channel archived by its last member (D-051), or whose Admin members left, can be restored by nobody. Proposal only, not a decision (D-184): any Admin restores and becomes a member; it changes `canRestoreChannel` (TOKI-027), TOKI-029 R14 and the one call in `canOfferRestore`, and the tests. Owner: Thanh Truong (product owner); the same question as TOKI-029 concern 2, TOKI-027 concern 1 and TOKI-034 concern 2.
2. The pattern for Restore. Not decided. D-061 names the pattern of Archive (a confirmation) and the log names none for Restore; D-069 says a reversible action shows Undo and an action that affects other people asks for a confirmation, and Restore is both (it can be reversed by archiving again, and it returns the channel to every member's list); F26 mentions a confirmation for Archive only. R19 builds the first reading and R5 records it. Proposal only, not a decision: Undo, as the rule says for a reversible action. If the owner chooses a confirmation, the row `restoreChannel` becomes `confirm`, R19 becomes a `ConfirmAction` like R9 and the Undo test goes. Owner: Thanh Truong (product owner).
3. Where "Archive channel" opens from. Not decided. D-185 (Open) proposes the channel's Details panel for Add people, Remove from channel and Archive channel, and F22 and F26 name no place. R8 puts it in the Details panel, after Settings and before Leave, which is a proposal and also the only place a member of any width can reach (D-067). If the owner picks another place, the section moves and R8 changes. Owner: Thanh Truong (product owner).
4. What an archived channel's page offers beyond its header, history and notice. Not decided. TOKI-035 concern 3 asks the same: whether the Details panel is reachable, whether Leave and the members list are offered, whether the person's notification level, mute and star are kept or hidden, and whether the page has a "Restore" button for an Admin. The log decides only that the channel is readable and the composer is replaced (F10, F26). R15 draws no members button and R17 no control, so the page is the smallest that the log decides. Proposal only, not a decision: the proposal of TOKI-035 concern 3 (header and About from the channel read, Members list, Leave, no Edit, Notifications or Settings); Restore stays in Browse channels, where F26 puts it. Owner: Thanh Truong (product owner), with TOKI-035.
5. Members who have the channel open when it is archived. Not decided. F26 says they see a strip, "This channel was just archived"; the log gives no owner and no ticket builds live events for channels yet (TOKI-029 concern 4, TOKI-038, TOKI-040), and `.strip` is TOKI-082's. Until then a member learns of it at the next refresh or read: the entry leaves the list and the route draws what TOKI-033 R21 (c) draws, which is #general. Proposal only, not a decision: when TOKI-040 applies the event, it reads the channel (`readChannel`), so the route draws `ArchivedChannelPage` with the strip above the notice. Owner: Thanh Truong (product owner, for the plan).
6. How a member reaches an archived channel, and where the Admin is after archiving. Decided in this spec (R13). Reason: TOKI-034 concern 2 and TOKI-033 concern 13 leave the route to this ticket and the log decides the result (readable, composer replaced, only members open it: F10, F21, F26, D-029). The page is drawn from the detail that the store already keeps for an archived channel (TOKI-032 R14), through one branch of the route, so no new request, no new store field and no change to the first load are needed (TOKI-031 concern 2 decides the same: the client reads `GET /channels/{id}`). The person who archives a channel stays on it and sees the notice, because F26 says "afterwards" the composer is replaced and no flow says the view moves (F23 says it for Leave only); the move to #general of F09 is for opening the app (D-035). Owner: Thanh Truong.
7. The member count in the confirmation. Not decided. F26 says the question names the channel and its member count; TOKI-029 R7 returns `memberCount` as the number of member rows, and its concern 9 asks whether deactivated people count (proposal there: yes). R9 shows the number the server returns. Owner: Thanh Truong (product owner), with TOKI-029 concern 9.
8. Wording. Accepted: D-139 makes every wording the prototype does not contain a proposal and leaves the final words to the design. Table T marks every text as a proposal; the Vietnamese form of address is D-188 (Open). Owner: Thanh Truong.
9. Plan changes and edits to other tickets. Decided in this spec. The plan line `TOKI-101 needs: TOKI-093` is not enough: the build also needs TOKI-029 (the requests), TOKI-032 (the commands), TOKI-033 (the route), TOKI-034 (Browse channels) and TOKI-035 (the panel), and may start only when they have landed; the lead applies the line `TOKI-101 needs: TOKI-093, TOKI-029, TOKI-032, TOKI-033, TOKI-034, TOKI-035`. TOKI-034 R7 says this ticket "extends `browseRowAction`"; this spec leaves that function as it is and adds a button beside the row's own (R18), so the wording there needs only a note. This spec edits no other spec; the additions to files of TOKI-033, 034, 035 and 093 are listed in Design, "Hand-offs", and are part of this ticket's pull request. Owner: Thanh Truong (lead).
10. Technical choices the Blueprint leaves to the builder. Decided in this spec: (a) the confirmation is never opened without a count (R9); (b) the archive toast has no button (R10); (c) `RestoreButton` is a second button and `browseRowAction` is unchanged (R18); (d) the archived page is drawn from the held detail through one branch of the route (R13); (e) the page asks for no message and has no composer element at all, instead of a disabled composer (R14); (f) the two flows are plain functions, as in TOKI-034 R11 (Layout). Reasons are in the requirements. Owner: Thanh Truong.
