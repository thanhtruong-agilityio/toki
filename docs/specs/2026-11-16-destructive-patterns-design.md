# Destructive-action and unsaved-form patterns design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/destructive-patterns.md (Thanh Truong)
Ticket: TOKI-093

## Goal
The builder (Thanh and Claude) needs one way to ask "are you sure?", one way to offer Undo, and one way to stop a form with text from being thrown away, before the screens that delete, leave, archive, deactivate, sign out or pin are built. The decision log gives the rule (D-061, D-069, D-070) and the prototype does not follow it: it asks for confirmation with a line under the message and then also shows an Undo toast for the same Leave, and its dialogs close on any backdrop click and on Esc even when a form holds text.
After this change `ui-web` exports a `ConfirmDialog` that names its target. `apps/web` holds the helper that runs a reversible action at once and offers Undo for 5 seconds, the wrapper that confirms an irreversible one, the guard for a form that has content, and one table that says which pattern each phase 1 action uses and which ticket builds its screen. The table is typed, so one action cannot use both patterns. The Undo, Cancel and discard texts exist in English and Vietnamese. No screen is built here.

## Scope
- In:
  - `ConfirmDialog` in `packages/ui-web` (a Modal of TOKI-014 that holds a title, a description, the target, a Cancel button and a confirm button), its CSS, tests and examples.
  - In `apps/web/src/patterns/`: `actionPatterns` (the table of Design, Table A) with its types; `useUndo`; `useOnlineGate` and `setConnectionCheck`; `ConfirmAction`; `useFormGuard` and `hasFormContent`.
  - The i18n namespace `common` with the nine keys of Design, Table B, in English and Vietnamese.
  - The list of every phase 1 action that is destructive or irreversible, with the pattern, the decision and the ticket that owns the call site (Table A). The call sites themselves are not built here.
  - The test set-up of `apps/web` (R2), because the helpers need a DOM and the Toast and Modal providers.
- The line with TOKI-013 (Toast), stated once. TOKI-013 builds the Toast: its look, its place, its 5-second timer (`TOAST_MS_WITH_ACTION`), the button, `onPress` (run after the toast has gone) and `useToasts().show`. This ticket calls `show` with `action` and nothing else: it adds no timer, no second toast component and no `duration`. TOKI-013 hands this ticket the Undo press while the connection is down (its Scope, "The line with TOKI-093"): R14 and R17 are that answer. TOKI-013 also says the plan line of this ticket should read "the pattern on the Toast of TOKI-013", not "a 5-second Undo toast" (concern 11 here).
- The line with TOKI-014 (overlays), stated once. A layer never closes itself and reports why a close was asked: `"escape"`, `"outside"` or `"close"` (TOKI-014 R8). This ticket is what decides what to do with the reason (R19 to R22) and renders the confirmation in a `Modal`. It does not change `Modal`, `Sheet` or `Menu`. A modal over a modal is allowed there (TOKI-014, "What the layer gives the preview page and the screens"), which is how the discard question opens over its form.
- The line with the screen tickets, stated once. This ticket builds the patterns and the list. Each screen ticket builds its own call site (the button, the menu entry, the text of its own question, the request) and passes its id from Table A to the pattern. Owners are named in Table A; none of those tickets is changed by this one.
- The line with i18n (TOKI-017). `ui-web` holds no text (TOKI-012 R3), so the dialog takes every text as a prop. The `common` keys of Table B are this ticket's; the question and the confirm button of each confirmation are the call site's keys, in its own namespace.
- Out (not now):
  - The Toast and its timer (TOKI-013); the layers and the focus rules (TOKI-014); the connection state itself, the offline banner and the writes that wait (TOKI-039, TOKI-040, TOKI-082). This ticket reads the connection through one function that those tickets replace (R17).
  - Every call site (Table A), the requests and the server rules behind them (for example that an action can be undone, that the last Admin cannot be deactivated).
  - Phase 4, 5 and 7 rows (cancel a Meet, delete an automation, archive an email). D-061 gives their pattern; the ticket that builds each adds its row to Table A (R10).
  - A warning when the browser tab is closed or reloaded with a form open, and a guard on the Back button (concerns 2 and 5). The in-place edit of a message and the composer draft (concern 6).
  - Keyboard shortcut for Undo (concern 8).

## Requirements
Packaging and shared rules
- R1. `packages/ui-web/src/components/ConfirmDialog/` holds `ConfirmDialog.tsx`, `ConfirmDialog.css`, `ConfirmDialog.test.tsx`, `ConfirmDialog.examples.tsx` and `index.ts`. `src/components/index.ts` gains one `export * from "./ConfirmDialog"` line and `src/examples.ts` one import and one entry `ConfirmDialog`, after the entries that are there; no other shared file of TOKI-012, TOKI-013 or TOKI-014 changes. `@toki/ui-web` exports at least `ConfirmDialog`, `ConfirmDialogProps`, `confirmVariants` and `confirmCancelReasons`. `apps/web/src/patterns/` holds `actions.ts`, `online.ts`, `useOnlineGate.ts`, `useUndo.ts`, `ConfirmAction.tsx`, `useFormGuard.tsx`, `formContent.ts`, `index.ts` and a test file next to each; `index.ts` exports `actionPatterns`, `ActionId`, `ActionPattern`, `UndoActionId`, `ConfirmActionId`, `useUndo`, `useOnlineGate`, `setConnectionCheck`, `ConfirmAction`, `useFormGuard`, `hasFormContent` and `GUARD_ESCAPE`. A test checks that each name is exported and does not require that nothing else is.
- R2. `apps/web` gets a Vitest configuration with the `jsdom` environment and a setup file that does what `packages/ui-web/src/test/setup.ts` does (cleanup after each test and `IS_REACT_ACT_ENVIRONMENT`), unless an earlier ticket has added both; its devDependencies `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` and `jsdom` use the versions that `ui-web` already has. `pnpm --filter @toki/web test`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check` and `pnpm i18n:check` exit 0 at the end of this work.
- R3. No source file of `ConfirmDialog` (test and examples files excepted) imports `@toki/i18n`, `@toki/platform` or `@toki/tokens`, or holds a visible word of its own: rendering it with every text prop set to the empty string and a one-character target gives a `textContent` that is only that character. Its CSS holds no colour literal and no custom property that is not one of the 32 names of TOKI-009 R10, and no selector with `data-eff`, `data-look`, `data-accent` or `data-density`.

ConfirmDialog
- R4. `<ConfirmDialog open title description target confirmLabel cancelLabel onConfirm onCancel />` renders one `Modal` (TOKI-014 form (a)) with `title`, no `closeLabel` (so no close button), the class `cfm` on the panel, and `aria-describedby` set to the id of the description element when one is rendered. The body is `div.mbd` holding, in this order: `p.cfm-text` with `description` when `description` is given; `p.cfm-target` holding `strong` with `target`, only under R5. The footer is `div.mft` holding a `Button` of TOKI-012 with `cancelLabel`, then a `Button` with `confirmLabel`. `variant` is one of `confirmVariants`, `danger` (default, a `Button` with `variant="danger"`) or `primary`. `onCancel` and `onConfirm` are required. The dialog never closes itself: the owner changes `open`.
- R5. A confirmation names its target (AC-078). `target` is a required string. If it is empty or only white space, the component throws an `Error` whose message contains `target`, in every build. If `title` or `description` contains `target` as a substring (case-sensitive), nothing is added. Otherwise the component renders the `p.cfm-target` line of R4, so the target is always visible in the dialog whatever the caller wrote. A test renders a dialog whose texts do not hold the target and finds it in `p.cfm-target`, and one whose title holds it and finds no `p.cfm-target`.
- R6. Keys and focus. When the dialog opens, focus is on the Cancel button (`initialFocusRef`, TOKI-014 R11): the safe choice is the one that has focus, and Enter on a freshly opened dialog changes nothing. Cancel calls `onCancel("cancel")`; Esc calls `onCancel("escape")` and an outside press calls `onCancel("outside")` (TOKI-014 R8); the confirm button calls `onConfirm()` once. Esc and an outside press never confirm.
- R7. `busy` (boolean, default `false`) is the state of a confirmed request that has not come back (D-111: a button is disabled while the request runs). While `busy` is `true`, both buttons have `disabled`, `onCancel` is not called for Esc or an outside press, the panel has `aria-busy="true"`, and, in the commit in which `busy` turns `true`, focus moves to the panel, so that it is not lost to the `body` when the pressed button is disabled. A second press of the confirm button cannot reach `onConfirm`.
- R8. `ConfirmDialog.css` holds exactly the rules of Table C and no other. Both buttons are the `Button` of TOKI-012 and so are at least 40 px tall at 719 px and below (TOKI-012 R8); the dialog has no hover-only part (D-067).
- R9. `ConfirmDialog.examples.tsx` exports `examples` (the type of TOKI-012 R26) with five openable demos, ids `delete-message`, `archive-channel`, `notify-channel`, `busy` and `long-target`: `danger` with the prototype's own words for deleting a message; `danger` whose description names a channel and its member count; `primary`; `busy` set; and a target of 120 characters that wraps without overflowing the panel. Each demo's first `button` opens the dialog and its owner closes it on every reason; each passes its own ref as `returnFocusRef` (TOKI-014 R13). The ids are unique.

The table of actions, and "never both"
- R10. `apps/web/src/patterns/actions.ts` exports `actionPatterns`, an object whose keys are the action ids of Table A and whose values are `{ pattern, source, owner }`: `pattern` is `"undo"`, `"confirm"` or `"none"`; `source` is the decision or requirement that says so (for example `"D-061, AC-054"`); `owner` is the key of the ticket that builds the call site, matching `^TOKI-\d{3}$`. The object holds exactly the 18 rows of Table A with the pattern, source and owner written there (a test holds a copy of the table and compares). `ActionId` is `keyof typeof actionPatterns`; `UndoActionId` is the ids whose `pattern` is `"undo"` and `ConfirmActionId` those whose `pattern` is `"confirm"`, both derived from the object by the compiler. A ticket that adds an action adds its row in the same change, and the test of this requirement is updated with it.
- R11. An action never has both patterns (D-069, AC-077). (a) Each id appears once in `actionPatterns`, with one `pattern`, so the sets of `UndoActionId`, `ConfirmActionId` and the ids with `"none"` are disjoint and their union is `ActionId`. (b) `useUndo().run` takes only an `UndoActionId` and `ConfirmAction` only a `ConfirmActionId`: a call of `run` with a confirm id, or `ConfirmAction` with an undo id, is a type error that `pnpm typecheck` finds, and the tests mark each with `// @ts-expect-error`. (c) The check also runs when the types are cast away: `run` with an id whose pattern is not `"undo"`, and `ConfirmAction` with an id whose pattern is not `"confirm"`, throw an `Error` whose message contains the id and the pattern the table gives it, before anything is performed or shown.

Undo
- R12. `useUndo()` returns `{ run }`. `run({ action, text, perform, undo, key? })` takes an `UndoActionId`, the already translated `text` of the toast, two functions that return nothing or a promise, and an optional `key` string. It returns a promise that resolves to `"done"`, `"failed"` or `"blocked"`, and never rejects. Order: (1) `ensureOnline()` of R17; when it returns `false`, `perform` is not called, no toast with a button is shown, and `run` resolves `"blocked"`. (2) `perform()` is called at once, in the same call, and awaited. (3) If `perform` throws or rejects, one plain toast with `t("common.error.actionFailed")` is shown, no Undo is offered, and `run` resolves `"failed"`. (4) Otherwise `show` of the Toast is called once with `text` and `action` `{ label: t("common.undo"), onPress }`, and `run` resolves `"done"`. A synchronous `perform` therefore shows the toast in the same turn of the event loop, before any timer runs.
- R13. `onPress` (what the Undo button does, run by the Toast after it has removed itself, TOKI-013 R24): (1) `ensureOnline()`; when `false`, `undo` is not called, the explanation toast of R17 is shown, and nothing else (the action stays done; the person is told they are offline, never shown a false success, D-079). (2) Otherwise `undo()` is called once and awaited. (3) If it throws or rejects, one plain toast with `t("common.error.undoFailed")` is shown. (4) If it succeeds, no toast is shown: the screen shows the restored state, as the prototype's Undo does (line 2306, `joinChannel(cid,true)`, which is quiet).
- R14. Time. Undo is offered for exactly the time of the Toast, 5000 ms (TOKI-013 R23, D-069), and the helper adds nothing to it: no source file of `useUndo.ts` calls `setTimeout`, `setInterval` or `requestAnimationFrame` (checked by a test that reads the file), and with fake timers the toast is in the document 1 ms before 5000 ms after `run` resolved and gone at 5000 ms, and `undo` is not called after that because the button is gone.
- R15. `key`. When `run` is called with a `key` while the toast of an earlier `run` with the same `key` is still shown, that earlier toast is dismissed (`dismiss(id)` of the Toast) before the new one is shown, so that an old Undo cannot reverse a newer state (pin then unpin the same message, Done then Undo then Done). Calls with different keys, or with no key, leave each other's toasts alone and each keeps its own 5 seconds. The helper keeps the map from `key` to toast id in a `ref`, and removes an entry when its toast goes.
- R16. `run` is the same function from one render to the next while the provider lives (it can be a dependency of an effect), and the toast of an action outlives the component that started it: when that component unmounts, an Undo that is still shown works, because `run` holds no state of the component. The helper never consults Pause or Focus time: an own-action toast is shown during both (concern 8).

Online gate
- R17. `setConnectionCheck(fn | null)` sets the function that tells whether the connection is up; `null` restores the default, which returns `false` only when `navigator` exists and `navigator.onLine === false`. `useOnlineGate()` returns `ensureOnline(): boolean`. It calls the check; if the check returns `true`, or throws, it returns `true` (a broken check never blocks the person); if it returns `false`, it shows one plain toast with `t("common.offline.blocked")` (TOKI-013 R23: 2800 ms), and returns `false`. The module has no state other than the one function. TOKI-039, TOKI-040 and TOKI-082 replace the default by calling `setConnectionCheck` with the real connection state (concern 7).
- R18. `ConfirmAction({ action, ...ConfirmDialog props except cancelLabel })` is `ConfirmDialog` with `cancelLabel` set to `t("common.cancel")` and an `onConfirm` that first calls `ensureOnline()`: when `false`, `onConfirm` of the caller is not called, the dialog stays open and the explanation toast is shown (D-060, D-079: admin actions and every other action are blocked offline). It takes a `ConfirmActionId` (R11) and forwards every other prop, `busy` and `returnFocusRef` included.

Form guard
- R19. `hasFormContent(values)` takes an object and returns `true` when at least one value is a string that is not empty after trimming, an array with at least one element, or a `Set` or `Map` with at least one element; any other value (a number, a boolean, `null`, `undefined`, an object that is none of these) is not content. `hasFormContent({})` is `false`. It never throws. A switch or a select left at any value does not make a form "have content" (concern 5).
- R20. `useFormGuard({ hasContent, formName, onClose })` returns `{ onRequestClose, requestClose, discardDialog }`. `onRequestClose(reason)` is passed to the `onRequestClose` of the form's `Modal` or `Sheet`; `requestClose()` takes no argument, is for the form's own Cancel button and acts as `onRequestClose("close")`; `discardDialog` is a React element (or `null`) that the form's screen renders beside the form's Modal, not inside it (TOKI-014: a screen renders its layer beside a clickable element). `onClose` is called with `DialogCloseReason` or `"discard"` and is the owner's way to set `open` to `false`. A form that is submitted successfully closes through the owner's own code and does not use the guard.
- R21. Decision table. With `hasContent` `false`, every reason (`"escape"`, `"outside"`, `"close"`) calls `onClose(reason)` at once and no discard dialog opens (AC-075, TS-119). With `hasContent` `true`: `"outside"` does nothing, so the form stays open with its text and focus unchanged (D-070, AC-074, TS-117); `"close"` opens the discard dialog (AC-075, TS-118); `"escape"` does what `GUARD_ESCAPE` says. `GUARD_ESCAPE` is exported and is `"ask"`, which opens the discard dialog as `"close"` does; the other value the type allows is `"ignore"`, which does nothing. The value is a proposal, because the log does not decide Esc (concern 1), and it is kept in one place so that the decision changes one line and one test.
- R22. The discard dialog is a `ConfirmDialog` with `title` `t("common.discard.title")`, `description` `t("common.discard.message", { name: formName })`, `target` `formName`, `confirmLabel` `t("common.discard.confirm")`, `cancelLabel` `t("common.discard.keep")` and `variant` `danger`. Keep editing, Esc or an outside press on it: the discard dialog closes, `onClose` is not called, the form is still open with its text, and focus returns to the element of the form that had focus when the discard dialog opened (TOKI-014 R13). Discard: the discard dialog closes and `onClose("discard")` is called once. One Esc closes one layer (TOKI-014 R9): with the discard dialog open over the form, the first Esc closes the discard dialog and keeps the form.
- R23. If the screen that holds the guard unmounts while the discard dialog is open, the discard dialog unmounts with it and leaves no listener, lock or inert element (TOKI-014 R4). The guard keeps no timer and no storage, and does not read the form's fields: `hasContent` is a prop, computed by the screen, usually with `hasFormContent`.

Texts
- R24. `packages/i18n/src/messages/en/common.ts` and `messages/vi/common.ts` hold exactly the nine keys of Table B with the English and Vietnamese texts written there, and both language `index.ts` files list the namespace; if an earlier ticket has created the `common` namespace, the nine keys are added to it and nothing there changes. `pnpm i18n:check` exits 0. Every key follows the naming rule of TOKI-017. A test compares the nine keys and both texts with a copy of Table B. The Vietnamese texts are proposals (D-139; concern 4).

## Design
### Layout
```
packages/ui-web/src/components/ConfirmDialog/
  ConfirmDialog.tsx  ConfirmDialog.css  ConfirmDialog.test.tsx  ConfirmDialog.examples.tsx  index.ts
apps/web/
  vitest.config.ts   src/test/setup.ts          (R2, unless an earlier ticket made them)
  src/patterns/
    actions.ts  online.ts  useOnlineGate.ts  useUndo.ts  ConfirmAction.tsx
    useFormGuard.tsx  formContent.ts  index.ts   and a *.test.ts(x) next to each
packages/i18n/src/messages/{en,vi}/common.ts     (and the two index.ts lists)
```
Decided in this spec: the dialog is in `ui-web` and the helpers are in `apps/web`. The dialog has no text and no connection, so it can be drawn on the preview page (TOKI-016) and reused by any client. The helpers need `useTranslation` (`@toki/i18n/react`), the Toast's `useToasts` and the connection, which `ui-web` may not import (TOKI-012 R3, boundary rules of TOKI-002). The cost is that the two helpers cannot be previewed on the page; the dialog they use can.

### Which pattern an action gets
The rule is D-069: a reversible action happens at once and shows Undo for 5 seconds; an irreversible action, or one that affects other people, asks for confirmation and names its target; never both. The rule cannot always tell which side an action is on (pinning shows a line to everyone in the conversation and still gets Undo, AC-098), so Table A is the authority and the rule is the reason. The decisions that name an action win over any reading of the rule: D-061 lists Undo for archive an email, mark done, leave a public channel, remove from Later and unpin, and confirmation for delete a message, delete an automation, deactivate a member, archive a channel and cancel a Meet; D-156 settles the private channel (confirmation, no Undo); AC-098 adds pin to Undo; D-087 says deleting a message that was not sent asks nothing.

Table A. Every phase 1 action that is destructive or irreversible, from context.md (F06, F16, F23, F26, F27, F28, F40, F41, F42, F02, F22) and requirements.md (FR-29 and the acceptance criteria named). 18 rows are in `actionPatterns`.

| Action id | What it does | Pattern | Source | Owner of the call site |
| :---- | :---- | :---- | :---- | :---- |
| `leavePublicChannel` | Leave a public channel (the Details panel); the toast reads as the prototype's "You left #name" (line 2306) | undo | D-061, D-069, AC-054 | TOKI-035 |
| `pinMessage` | Pin to conversation | undo | AC-098, TS-153 | TOKI-048 |
| `unpinMessage` | Unpin | undo | D-061, AC-098, TS-152 | TOKI-048 |
| `markActivityDone` | Done on an Activity item | undo | D-061, D-069, AC-112 | TOKI-066 |
| `removeFromLater` | Remove a saved message from Later | undo | D-061 | TOKI-067 |
| `deleteOwnMessage` | Delete your own message; no Undo | confirm | AC-031, D-043, F16 | TOKI-047 |
| `deleteMemberMessage` | An Admin deletes someone else's message; the confirmation names the author | confirm | F42, D-049 | TOKI-047 |
| `leavePrivateChannel` | Leave a private channel; says a member must invite you back; for the last member it also says the channel will be archived | confirm | D-051, D-156, AC-055 | TOKI-035 |
| `archiveChannel` | Archive a channel; names the channel and its member count | confirm | D-061, F26 | TOKI-101 |
| `removeFromChannel` | An Admin removes a person from a channel; names the person | confirm | D-085, D-069 | TOKI-100 |
| `deactivateMember` | Deactivate a person; names the person and the effect | confirm | D-061, F41, AC-069 | TOKI-025 |
| `reactivateMember` | Reactivate a person; names the person | confirm | D-069 (affects another person); plan line of TOKI-025 | TOKI-025 |
| `changeRole` | Change a role; names the person and the new role | confirm | F40, D-069 | TOKI-025 |
| `revokeInvitation` | Revoke an invitation; names the address | confirm | plan line of TOKI-025; D-069 (affects another person) | TOKI-025 |
| `signOutDevice` | Sign out one other device; names the device | confirm | D-158, AC-134 | TOKI-099 |
| `signOutOtherDevices` | Sign out all other devices; names how many | confirm | D-158, AC-135 | TOKI-099 |
| `notifyChannel` | Send `@channel` in a channel of 20 or more people; names the number | confirm | D-041, AC-044 | TOKI-050 |
| `deleteUnsentMessage` | Delete a message that shows "Not sent"; asks nothing | none | D-087 | TOKI-042 |

Not in the table, on purpose:
- Not decided: signing out on this device (D-178, Open: the proposal is no confirmation, drafts saved first; owner TOKI-099), and the small actions listed in concern 10. They are added when decided.
- Later phases, named by D-061 and added by the ticket that builds them: archive an email (phase 7, undo), delete an automation (phase 5, confirm), cancel a Meet (phase 4, confirm).
- Forms: a dialog with fields uses the guard of R19 to R23, not Table A. Forms that exist in phase 1 and are built by other tickets: Create channel (TOKI-098; its plan line already says closing with content asks, D-070), Invite members (TOKI-025), Set status (TOKI-056), Add people to a channel (TOKI-100), the people picker (TOKI-034). Browse channels and the command palette hold a search text and are not forms (concern 5).
- The prototype and the journeys draw some of these differently; see "What the prototype does" below.

Table B. Texts of this ticket, namespace `common`. English "Undo" and "Cancel" are the prototype's words (lines 2306 and 1369); every other English text and every Vietnamese text is a proposal (D-139). The Vietnamese form of address is not decided (D-188, Open); the table uses "bạn".

| Key | English | Vietnamese (proposal) |
| :---- | :---- | :---- |
| `common.undo` | Undo | Hoàn tác |
| `common.cancel` | Cancel | Hủy |
| `common.discard.title` | Discard what you typed? | Bỏ nội dung bạn đã nhập? |
| `common.discard.message` | What you typed in "{name}" will be lost. | Nội dung bạn đã nhập trong "{name}" sẽ bị mất. |
| `common.discard.confirm` | Discard | Bỏ |
| `common.discard.keep` | Keep editing | Tiếp tục chỉnh sửa |
| `common.offline.blocked` | You are offline. Try again when the connection is back. | Bạn đang ngoại tuyến. Hãy thử lại khi có kết nối. |
| `common.error.actionFailed` | That did not work. Try again. | Không thực hiện được. Hãy thử lại. |
| `common.error.undoFailed` | Could not undo. Try again. | Không hoàn tác được. Hãy thử lại. |

None of these takes a number, so none needs plural forms. `{name}` is the translated or typed name of the form (for example the title of the Create channel dialog).

Table C. `ConfirmDialog.css`. The prototype has no confirmation dialog, so the whole table is decided.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.cfm-text` | `margin:0` | decided: the paragraph sits in `.mbd` (TOKI-014 Table A), which has the padding |
| `.cfm-target` | `margin:8px 0 0; font-weight:600; overflow-wrap:anywhere` | decided: the name is the point of the dialog, so it is heavier, and a long name wraps |
| `.cfm .mft` | `flex-wrap:wrap` | decided: two long Vietnamese button labels may not fit side by side at 360 px |

### What the prototype does, and what this spec does
Measured by reading the prototype's script (`docs/blueprint/prototype/index.html`; line numbers are that file's).

| Behaviour | Prototype | This spec |
| :---- | :---- | :---- |
| Delete a message | An inline row under the message: "Delete this message?" with Delete (danger) and Cancel (lines 1369, 2372 to 2374). Afterwards a toast "Message deleted" with no button (2373) | A dialog that names the target (R4, R5). The prototype's words are the sample of the `delete-message` example; the inline row is concern 3 |
| Leave a channel | An inline row in the Details panel for every channel: "Leave #name? You can rejoin from Browse channels." (1452), then the toast "You left #name" with Undo (2306). One action has a confirmation and an Undo | Public: no confirmation, the toast with Undo (D-069, D-156, AC-054). Private: a confirmation and no Undo (D-051). The prototype's line for a private channel says the opposite of D-051 and is not used as wording |
| Undo time | 5200 ms with a button, 2800 ms without (1192) | 5000 ms (D-069), by TOKI-013 R23 |
| Archive an email | A toast "Archived" with no Undo (2436), although D-061 lists Undo | Phase 7; D-061 decides |
| Close a dialog | The backdrop click closes it always (2503) and Esc closes it always (2565 to 2567) | R21: with content, an outside press does nothing; close asks; Esc is concern 1 |
| Discard a form | None | R22 |
| Offline | Only the banner "Offline: showing saved messages" (D-102) | R12, R13, R17, R18 |

### The Undo helper
```
run({ action, text, perform, undo, key })
  gate offline? ── yes ──> toast "offline" ── "blocked"      (perform not called)
  perform()  ── throws ──> toast "did not work" ── "failed"  (no Undo offered)
  show(text, Undo)  ── "done"
       press Undo ──> gate offline? ── yes ──> toast "offline"   (action stays done)
                      undo() ── throws ──> toast "could not undo"
```
- Decided in this spec: the action is performed at once and Undo is a second call that reverses it. The alternative, holding the request for 5 seconds and sending it only if Undo is not pressed, was not chosen: D-069 says the action happens at once, a reload or a closed tab would lose an action that looked done, and other people would not see it. The cost: for the 5 seconds other people may see the action, and an Undo that arrives after a reload is not possible (concern 9). The server's rule that an undone action is allowed is the call site's.
- Decided in this spec: the toast is shown after `perform` has finished, not before. An Undo that appears before the server has answered would offer to reverse something that has not happened. A screen that updates its own list at once passes a `perform` that resolves at once and rolls back by itself on failure.
- Decided in this spec: the successful Undo shows no toast (the prototype's does not: `joinChannel(cid,true)` is quiet, line 2306), and a failure shows a plain one. Only `perform` and `undo` failures get the generic text; a call site that needs a specific message catches it inside `perform`.
- Decided in this spec: the explanation for an offline Undo press is a plain toast. `onPress` runs after the Undo toast has gone (TOKI-013 R24), so the Undo button is already spent: pressing Undo offline cannot keep the button. The action stays done and the person is told, which is what D-079 asks ("blocked with an explanation, never a false success"). The cost is that the 5 seconds are gone; the person undoes the action by hand once the connection is back.
- `key` solves the case where the same target is changed twice within 5 seconds, and nothing else (R15). Different targets keep their toasts side by side, in the Toast's stack (TOKI-013 R25).

### The confirmation dialog
- It is a `Modal` with a title, a body and a footer, and no close button: the way out is Cancel, Esc or an outside press, which all mean "do not do it". Cancel has first focus and the confirm button is the danger one (R6), so that a dialog opened by a keyboard press of Enter or Space on the opening button cannot confirm by the same key press. The confirm button is danger (red) for destructive actions and primary for `notifyChannel`.
- It does not check the connection and does not run the request: `ConfirmAction` checks the connection (R18), and the call site runs the request and sets `busy` (R7) until it comes back, then closes the dialog.
- Why the target is checked here and not left to each call site: AC-078 and TS-122 test every confirmation, and a text written in a catalogue can lose its `{name}` in a translation. R5 makes the target visible whatever the text says. A name is never translated, so the substring test is exact.
- Role: `Modal` owns `role="dialog"` (TOKI-014 R5); this dialog adds `aria-describedby`. `alertdialog` would be more exact for a question that needs an answer; it is not available without a change to TOKI-014 (concern 12).
- Focus after the target is gone: a deleted message's menu or row may no longer exist when the dialog closes. TOKI-014 R13 gives no focus back to an opener that is not in the document (its concern 9); where focus goes then is the call site's (concern 6).

### The form guard
- Decided in this spec: a form with no content closes at once for every reason, an outside press included. D-070 and AC-074 speak of "a form that has content", and the prototype closes every dialog on an outside press; the log does not say an empty form must stay open.
- Decided in this spec: the Cancel button of a form is a close button for this rule: `requestClose("close")`. D-070 says "closing it by button asks whether to discard"; a Cancel button is a button that closes it (prototype: `closemodal`, line 1869).
- The discard question is `ConfirmDialog` over the form (R22). Its Cancel is "Keep editing" and has first focus, so the safe choice is the default. Closing it returns focus into the form (TOKI-014 R13, "closing B returns focus to the element of A that opened B").
- The guard does not look at fields. `hasContent` is a boolean that the screen computes. `hasFormContent` is a small helper for the usual case (R19).
- `GUARD_ESCAPE` is the one line that changes if the product owner decides Esc differently (concern 1).

### Texts
The nine keys are the only texts this ticket owns. The question, the description and the confirm button of each confirmation are written by the call site, in its own namespace, with the target as a placeholder (for example `{name}`); `target` is passed separately so that R5 can check it. Quoted wording in this spec that the prototype does not contain is a proposal (D-139): the journeys (F16, F23, F40, F41) have sample wording ("Leave #name? A member will have to invite you back.", "Left #name") that D-091 accepts as behaviour and not as words.

### Errors
- A blank `target` -> the component throws (R5).
- An action id whose pattern is not the one the helper serves -> an `Error` naming the id and the pattern (R11 c); a type error at build time.
- `perform` fails -> plain toast, no Undo (R12). `undo` fails -> plain toast (R13).
- Offline -> `"blocked"` and the explanation (R12, R13, R17, R18).
- A connection check that throws -> treated as online (R17).
- The owner leaves `open` as it is after Esc or an outside press -> the dialog stays (TOKI-014 R8).

## Testing
Written first and seen to fail. `ConfirmDialog` tests run in `packages/ui-web` with the set-up of TOKI-012 (R27 there); the helpers' tests run in `apps/web` (R2), wrapped in `I18nProvider`, `ToastProvider` and, for the guard, with a `Modal` of TOKI-014. Fake data and the prototype's sample words only.
- R1, R2: a test lists the folder and the exports; the commands of R2 are run on the finished branch.
- R3: the import and empty-text scan; a CSS test reads the file with `readCss` for colour literals, variable names and look selectors.
- R4 to R7: `ConfirmDialog.test.tsx` renders each form; reads the markup (the class `cfm`, `aria-describedby`, the order of the buttons, no close button, `danger` and `primary`); the target cases of R5 (not in the texts, in the title, in the description, blank, white space); first focus on Cancel; Esc, outside press and Cancel with the three reasons; confirm once; `busy` (buttons disabled, Esc and outside ignored, focus on the panel, `aria-busy`).
- R8: a CSS test compares the file with a copy of Table C. At 360 px, in both looks, by eye in a browser on the preview page: the dialog fits, a 120-character target wraps, both buttons are at least 40 px tall; the result is in the PR.
- R9: the examples test of TOKI-012 R26 and R31 passes with the folder; a test renders each example and presses its button.
- R10: a test holds a copy of Table A and compares ids, patterns, sources and owners with `actionPatterns`; every `owner` matches the pattern.
- R11: type tests with `// @ts-expect-error` for a confirm id given to `run` and an undo id given to `ConfirmAction`; a test that the three sets are disjoint and cover `ActionId`; runtime tests that cast the id and read the error message.
- R12 to R16: `useUndo.test.tsx` with fake timers: the order of `perform` and `show` (a synchronous `perform` gives the toast before any timer runs); a failing `perform` gives the plain toast and no button; offline gives `"blocked"` and no `perform`; Undo calls `undo` once after the toast is removed; offline Undo calls nothing and shows the explanation; a failing `undo`; no toast after a good `undo`; 4999 and 5000 ms; the same `key` dismisses the first toast and a different key does not; `run` keeps its identity; unmounting the starting component leaves the Undo working; a source scan finds no timer call in `useUndo.ts`.
- R17, R18: `setConnectionCheck` with `true`, `false`, a throwing function and `null` (the default, with `navigator.onLine` stubbed); `ConfirmAction` offline: no `onConfirm`, dialog still open, toast shown; online: `onConfirm` once; every `ConfirmActionId` rendered with a sample target shows the target in the dialog (AC-078, the unit-level part of TS-122).
- R19 to R23: `hasFormContent` table (empty string, spaces, text, `[]`, `[1]`, empty and filled `Set`, numbers, booleans, `null`, `{}`); `useFormGuard.test.tsx` with a form `Modal` holding an input: no content closes at once for each reason; with content an outside press leaves the form and the text, Esc and the close button open the discard question (with `GUARD_ESCAPE` `"ask"`; a second test replaces `GUARD_ESCAPE` with `"ignore"` through `vi.mock` of its module and expects nothing), the form's Cancel button asks, Keep editing closes the question and returns focus to the element that had it, Discard calls `onClose("discard")` once, the first Esc closes the question and the form stays, unmounting with the question open leaves `document.body` with no extra child and no `inert`.
- R24: a test compares both `common` catalogues with a copy of Table B; `pnpm i18n:check` is run.
- Not tested here: the end-to-end behaviour of a real call site (the 12 flows of TOKI-090 and each screen ticket's own tests, which use `actionPatterns` and these helpers); TS-121 and TS-122 on the whole product wait for those call sites. What a screen reader announces for the confirmation (concern 12).

## Data safety
- Nothing here stores, sends or logs anything. The helpers hold the id of a toast in memory for the 5 seconds; the guard reads no field and keeps no copy of what was typed.
- A toast text and a target are rendered as text, never as HTML.
- An action id in `actionPatterns` is a name, not data about a person.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Needs: TOKI-013 and TOKI-014 | Scope (the two lines); R4 builds on `Modal`; R12 on `show` with `action` |
| A reversible action happens at once with Undo for 5 seconds; an irreversible one, or one that affects other people, asks for confirmation and names its target; never both (D-069, D-061, FR-29, BR-20) | R12, R14 (Undo, 5000 ms); R4 to R6 (confirmation); R10, R11 (Table A and "never both") |
| A form with content does not close on an outside click; closing it by a button asks whether to discard (D-070, FR-28, BR-21) | R19 to R23 |
| No action shows both a confirmation and an Undo; every confirmation names its target (AC-077, AC-078) | R11 (the type and the runtime check); R5 (the target is always in the dialog) |
| Leaving a private channel asks for confirmation and has no Undo (D-156, D-051) | Table A: `leavePrivateChannel` is `confirm`; `leavePublicChannel` is `undo`; R11 |
| When the connection drops, every other action is blocked with an explanation, never a false success (D-079, D-060) | R12 (1), R13 (1), R17, R18 |
| The Toast owns its look, timer, button and `show`; the layers never close themselves; no timer and no second toast here | Scope (the lines with TOKI-013 and TOKI-014); R14 (no timer call), R21 (the reason decides, the layer does not close itself) |
| No feature is hover-only; controls at least 40 px at 719 px and below (D-067, NFR-02, F38) | R8 (the `Button` of TOKI-012, no hover rule); the Toast button is TOKI-013's (R32 there) |
| English is the default and every text goes through i18n; Vietnamese complete (D-018, D-064) | R3 (no text in `ui-web`); R24 and Table B (nine keys in both languages, checked by `pnpm i18n:check`) |
| Wording not in the prototype is a proposal (D-139) | Table B and "Texts"; concern 4 |
| Shared conventions: folder layout, no text in `ui-web`, one examples file | R1, R3, R9 |
| Toasts never cover the composer or navigation (D-078) | Not changed here: the Toast places itself (TOKI-013 R27, R28); this ticket only calls `show` |

## Open questions from the intent
- Does Esc on a form that has content ask whether to discard, like its close button? Not answered. D-070 names the outside click and the close button only. Built as a proposal in one constant (R21). Carried forward as concern 1.
- Does the browser's Back button close an open dialog? Not answered. D-089 covers side panels only. Not built. Carried forward as concern 2.
- What is the wording of each confirmation, of the discard question and of the offline explanation, in English and in Vietnamese? Answered in part: Undo and Cancel are the prototype's words; the rest of Table B is a proposal (D-139) and the call sites own their own questions. Carried forward as concern 4.
- Is the confirmation a dialog or the line under the message that the prototype draws? Not answered. Built as a dialog. Carried forward as concern 3.
- What happens when Undo is pressed while the connection is down? Answered: the action stays done and the person is told, with no false success (R13, D-079). Decided in this spec. The text and the connection source are concerns 4 and 7.
- Which phase 1 actions are reversible and which are not, and which ticket builds each one? Answered in Table A. Not decided and left out: concern 10.

## Areas of concern
1. Esc on a form with content is not decided. D-070 names the outside click and the close button; TOKI-014 asks the same (its concern 1). Proposal, not a decision: Esc acts as the close button, so it asks "discard?" when the form has content and closes at once when it has none, because Esc is the keyboard's way to the close button and a person who presses it by habit loses the text otherwise. The other choice, ignoring Esc on a form with content, leaves a keyboard user with only the close button. Built as the proposal in one constant, `GUARD_ESCAPE` (R21). Owner: Thanh Truong.
2. The browser's Back button and a dialog, or a form with content. D-089 says only that Back closes a side panel first. A dialog has no address, so Back on a phone with a form open leaves the page behind the form and may lose the text. Proposal, not a decision: Back closes the topmost dialog, and with content it asks "discard?" first; it needs the router (TOKI-006) and the shell (TOKI-015) and is not built here. A closed tab or a reload with a form open is not guarded either; proposal: no warning, because a draft in a dialog is short-lived and the browser's own prompt is not translatable. Owner: Thanh Truong.
3. A confirmation as a dialog or as a line. The prototype (lines 1369 and 1452) and the journeys F16 and F23 draw an inline row ("a confirmation line appears under the message") and D-091 accepts the journeys' behaviour; the plan line of this ticket and TOKI-014 say a confirmation dialog, and FR-29 does not say which. This spec builds the dialog. Proposal, not a decision: a dialog for every confirmation, because it traps focus, works the same on a phone, can name a long target and keeps one pattern for the call sites; the inline row stays out. If the answer is the inline row for deleting a message and leaving a channel, TOKI-047 and TOKI-035 draw it and the dialog is used by the rest. Owner: Thanh Truong.
4. Wording. No confirmation text, discard text or offline text is in the prototype except "Delete this message?", "Delete", "Cancel", "Undo" and a Leave line that contradicts D-051; so every other wording in Table B and in the examples is a proposal (D-139), and so is every Vietnamese text (the prototype translates only the navigation). The call sites' questions (for example the Leave question in a private channel, the deactivation effect line) are theirs and are also proposals. The Vietnamese form of address is D-188 (Open; proposal "bạn"). TOKI-080 reviews the Vietnamese. Owner: Thanh Truong.
5. What counts as "content". D-070 says a form "that has content"; AC-075 says "text typed". `hasFormContent` counts typed text and chosen items (the chips of the people picker, a list of addresses) and does not count a switch or a select (R19). Not decided: whether a changed switch, a chosen role or a chosen date counts, and whether a search box (Browse channels, the command palette) is a form; proposal, not a decision: only typed text and chosen items count, and a search box is never guarded. A screen may pass its own boolean. Owner: Thanh Truong.
6. Forms that are not dialogs, and focus after a delete. The in-place edit of a message (Esc cancels with no question in the prototype) and the composer draft (saved, D-168 and D-169) are not dialogs and are not guarded; proposal, not a decision: leave them as they are, since the draft is kept and an edit is cancelled on purpose. After a confirmed delete or archive the element that opened the dialog may be gone, and TOKI-014 gives no focus back then (its concern 9). Not decided: where focus goes. Proposal: the list or the conversation that held the target. The call-site tickets decide. Owner: Thanh Truong.
7. The connection state does not exist yet. No spec defines "the connection is down": TOKI-039 (reconnect), TOKI-040 (sync engine) and TOKI-082 (the offline banner, D-102) will. Decided in this spec: this ticket reads one function, `setConnectionCheck`, whose default is the browser's `navigator.onLine`, which is true on a network that is up but cut off from the server; the three tickets above replace it with the real state. Not decided: the wording of the offline explanation (concern 4) and whether the same explanation is shown for every blocked action (D-079) or each screen words its own; this ticket's `common.offline.blocked` is available to all. Owner: Thanh Truong.
8. Undo and Pause or Focus time, and Undo for a keyboard. D-072 says no toast, push or sound during Pause or Focus; it is written for notifications. An Undo toast is the feedback of the person's own action and the only way to reverse it, so the helper shows it (R16); proposal, not a decision: that is the reading. A 5-second button is also short for a keyboard or screen-reader user, the toast is not in the Tab order, and while a dialog is open the trap holds focus (TOKI-013 concern 2; TOKI-014 concern 5). Proposal, not a decision: a keyboard shortcut for Undo while the toast is shown, and TOKI-013's pause on focus. Not built. Owner: Thanh Truong.
9. What other people see during the 5 seconds. Undo is a second call (Design, "The Undo helper"). Leaving a public channel adds a line "Lan left the channel" for others (F23), pinning adds "who pinned it"; Undo then reverses the state. Not decided: whether an undone leave or pin removes those lines, adds a second line, or leaves both; and that an Undo is not possible after a reload or on another device. The server and the call sites (TOKI-035, TOKI-048) decide. Proposal, not a decision: Undo removes the effect and leaves a line only where the first action posted one for others. Owner: Thanh Truong.
10. Actions the log does not give a pattern. Signing out on this device (D-178, Open; proposal: no confirmation), removing a file card before sending (F18), removing a link preview (F12), clearing a status, an Admin's Restore of an archived channel (F26, D-184), Mark all read, Snooze, Complete in Later and a reaction toggle. Each is reversible by hand or small, and none is in Table A. Proposal, not a decision: none for all of them, with no confirmation and no Undo; a row is added when decided. Revoke of an invitation and Reactivate are in the table from the plan line of TOKI-025 and from D-069 and not from a decision that names them; the product owner may move them to `none`. Owner: Thanh Truong.
11. Plan changes this spec asks for. The plan line of TOKI-093 says "a 5-second Undo toast"; it builds the helper on the Toast of TOKI-013 (TOKI-013 concern 9) and the 5 seconds are TOKI-013's. TOKI-093 also needs TOKI-012 (the `Button`) and TOKI-017 (the `common` texts) and TOKI-018 is not needed. The tickets that call these patterns should list TOKI-093 as a need: TOKI-025, TOKI-034, TOKI-035, TOKI-047, TOKI-048, TOKI-050, TOKI-056, TOKI-066, TOKI-067, TOKI-098, TOKI-099, TOKI-100 and TOKI-101; the plan lists none of them. The plan names the Signed-in devices section in two tickets, TOKI-099 and TOKI-078; Table A gives the confirmation to TOKI-099 as the plan line says, and TOKI-078 should not build a second one. `common` may be created first by TOKI-042 (its day words) or by this ticket; whichever lands second adds its keys to the file (R24). Owner: Thanh Truong.
12. Accessibility of the confirmation. `Modal` fixes `role="dialog"`; a question that needs an answer is an `alertdialog` and would be announced as one. Proposal, not a decision: TOKI-014 lets `Modal` take `role="alertdialog"` as an option; until then this ticket adds `aria-describedby` only. Screen-reader behaviour of the confirmation and of the discard question over a form is not tested until the manual check of TOKI-014 is done. Owner: Thanh Truong.
13. Where the code lives. Decided in this spec: the dialog is in `ui-web` and the helpers in `apps/web` (Design, "Layout"). `apps/web` gets its own DOM test set-up (R2), which TOKI-015 or the test harness (TOKI-008) may also add; whichever lands second reuses the first. The helpers are not on the preview page (TOKI-016); only the dialog is. Owner: Thanh Truong.
14. Size. The Blueprint says M. One dialog, four helpers, a table of 18 rows, nine texts in two languages, a DOM set-up for `apps/web` and the tests of 24 requirements may run over one session. Proposal, not a decision: build in this order and stop after any step if needed: the table and the texts; `ConfirmDialog` with `ConfirmAction`; `useUndo` with the gate; the guard. Owner: Thanh Truong.
