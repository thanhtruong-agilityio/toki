# Intent: Destructive-action and unsaved-form patterns
Author: Thanh Truong

## Problem
Many phase 1 actions remove something or change something for other people: delete a message, leave a channel, archive a channel, remove a person from a channel, change a role, deactivate or reactivate a person, revoke an invitation, sign out a device, pin and unpin, mark an Activity item done, remove a saved message from Later. The decision log gives one rule for all of them: a reversible action happens at once and shows a toast with Undo for 5 seconds; an irreversible action, or one that affects other people, asks for confirmation and names its target; never both for one action (D-061, D-069). A second rule covers forms: a form that has content does not close on an outside click, and closing it with a button asks whether to discard (D-070).
The prototype does not follow either rule. It asks for confirmation with a line under the message or under the Leave button, and it shows an Undo toast for the same Leave, so one action has both. Its dialogs close on any click on the backdrop and on Esc, even when a form inside holds text. If each screen ticket builds its own version, the wording, the focus behaviour and the choice between Undo and confirmation will differ from screen to screen, and nothing will check that an action never has both.
The Toast (TOKI-013) and the layers (TOKI-014) already exist as parts. What is missing is the pattern on top of them: the confirmation that names its target, the helper that runs an action at once and offers Undo, the guard on a form that has content, and one list that says which pattern each action uses.

Source: Toki Blueprint, ticket TOKI-093; decisions D-061, D-069, D-070; requirements FR-28 and FR-29 (AC-074 to AC-078); business rules BR-20 and BR-21.

## Proposed outcome
There is one confirmation dialog. It names the thing it acts on (the channel, the person, the device), has a cancel button that has first focus, and shows a danger or a primary confirm button.
There is one helper that runs a reversible action at once and shows the Toast with an Undo button for 5 seconds. Pressing Undo reverses the action. The helper does not run, and does not offer Undo for, an action while the connection is down; it says why.
There is one guard for a form that has content. An outside press does nothing, the close button and the form's own Cancel button ask whether to discard, and a form with no content closes at once.
There is one list of every phase 1 action that is destructive or irreversible, with the pattern each one uses, the decision behind it and the ticket that builds the screen. A call site that goes through the two helpers cannot give one action both patterns. The ticket builds the patterns and the list, and none of the screens that call them.
The words of the Undo button, the Cancel button and the discard question are texts in both languages.

## Affected users and systems
- The builder (one person building with Claude). Indirectly every Member and Admin, who see the same behaviour for every destructive action. Source: Toki Blueprint, intent I02 design-system.
- `packages/ui-web` (the confirmation dialog), `apps/web` (the helpers that need texts and the connection), `packages/i18n` (a `common` namespace). The screen tickets that call the patterns: TOKI-025, TOKI-034, TOKI-035, TOKI-047, TOKI-048, TOKI-050, TOKI-056, TOKI-066, TOKI-067, TOKI-098, TOKI-099, TOKI-100, TOKI-101.

## Constraints
- Needs: TOKI-013 (Toast) and TOKI-014 (overlays). Source: Toki Blueprint, ticket Needs column.
- A reversible action happens at once and shows a toast with Undo for 5 seconds. An irreversible action, or one that affects other people, asks for confirmation and names its target. Never both. Source: D-069, D-061, requirement FR-29, business rule BR-20.
- A form that has content does not close on an outside click; closing it by a button asks whether to discard. Source: D-070, requirement FR-28, business rule BR-21.
- No action shows both a confirmation and an Undo, and every confirmation names the thing it acts on. Source: AC-077, AC-078.
- Leaving a private channel asks for confirmation and has no Undo. Source: D-156, D-051.
- When the connection drops, every action other than a message waiting to send is blocked with an explanation, never a false success. Source: D-079, D-060.
- The Toast owns its look, its 5-second timer, its button and `show`. The layers never close themselves and report why a close was asked (`escape`, `outside`, `close`). This ticket adds no timer and no second toast component. Source: specs of TOKI-013 and TOKI-014.
- No feature is hover-only or desktop-only; every control is at least 40 px tall at 719 px and below. Source: D-067, requirement NFR-02, journey F38.
- English is the default language and every text goes through i18n; Vietnamese is complete. Source: D-018, D-064.
- Every wording in quotes that the prototype does not contain is a proposal. Source: D-139.
- The shared conventions of the base components apply: folder layout, no text inside a `ui-web` component, one examples file for the preview page. Source: spec of TOKI-012 ("Contract for TOKI-013").
- Toasts never cover the composer or navigation. Source: D-078.

## Open questions
- Does Esc on a form that has content ask whether to discard, like its close button? D-070 names only the outside click and the close button.
- Does the browser's Back button close an open dialog? D-089 says only that Back closes a side panel first.
- What is the wording of each confirmation, of the discard question and of the offline explanation, in English and in Vietnamese? The prototype holds only two confirmation lines and one Undo toast.
- Is the confirmation a dialog or the inline line that the prototype draws for deleting a message and for leaving a channel, and that journey F16 draws for deleting a message?
- What happens when Undo is pressed while the connection is down? The Toast spec hands this to this ticket.
- Which phase 1 actions are reversible and which are not, and which ticket builds each one?
