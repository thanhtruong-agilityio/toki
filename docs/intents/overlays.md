# Intent: Overlays
Author: Thanh Truong

## Problem
The prototype draws three kinds of layer over the page: small menus that open from a button, centred dialogs ("modals") and, on a phone, the More sheet. Each is a string of markup that the prototype's own script opens and closes. The script moves no focus into a layer, does not keep focus inside it, does not return focus to the button that opened it, and gives a menu no arrow-key handling. Its Esc key closes the layers in a fixed order that is part of one large function, and a click on the dark backdrop closes a dialog even when a form inside it has text.
Many phase 1 screens need such a layer: Browse channels, the people picker, Create channel, Invite members, Set status, the file viewer, the account menu, the message More menu, the More sheet on phones, every confirmation, and the "Your session has ended" cover. If each screen builds its own, they will differ in how focus, Esc and the backdrop behave, and a person using a keyboard or a screen reader can get lost behind a dialog.
Two rules apply to all of them. A modal traps focus and returns it to the opening button, and menus work with arrow keys (D-075). No feature may be hover-only or desktop-only (D-067).

Source: Toki Blueprint, ticket TOKI-014; decisions D-067, D-070, D-075; requirements FR-28 and NFR-03.

## Proposed outcome
`ui-web` offers three components: Menu, Modal and Sheet. Each looks as the prototype's layers do in Calm and Focus and works with a keyboard, a touch screen and a screen reader.
While a Modal or Sheet is open, focus stays inside it, and it goes back to the button that opened it when the layer closes.
Esc closes the layers one at a time, the one opened last first, and the key does nothing else while a layer is open.
A Menu can be driven with the arrow keys alone.
Each layer shows correctly from 360 x 560 upwards, in both looks.
The layer reports why it wants to close (Esc, a press outside, its close button), so that the ticket that guards a form with content (D-070) can decide without changing the layer.
The "Your session has ended" cover of the sign-in screens can be built from the Modal without a second component.

## Affected users and systems
- The builder (one person building with Claude). Indirectly every Member and Admin, and everyone who uses a keyboard or a screen reader. Source: Toki Blueprint, intent I02 design-system.
- `packages/ui-web`; the component preview page (TOKI-016) and the AppShell (TOKI-015) that sit beside the layers; the screens that open them.

## Constraints
- Blueprint work area: Design system. Milestone M1, size M. Source: Toki Blueprint, ticket TOKI-014.
- Needs: TOKI-012 (base components, group 1). Needed by, as the plan lists them: TOKI-023, TOKI-034, TOKI-071 and TOKI-093. Source: Toki Blueprint, ticket Needs column.
- Agreed scope: Menu, Modal, Sheet; focus trapped inside and returned on close, Esc in order, menus usable with arrow keys. Source: Toki Blueprint, ticket TOKI-014; D-075.
- A modal traps focus and returns it to the opening button; menus work with arrow keys. Source: D-075, requirement NFR-03.
- No feature is hover-only or desktop-only. Source: D-067, requirement NFR-02.
- A form with content does not close on an outside click; closing it by its button asks whether to discard. The guard that does this belongs to TOKI-093; the layer must let it work. Source: D-070, business rule BR-21, requirement FR-28; ticket TOKI-093.
- Smallest supported size is 360 x 560. Under 720 px one pane at a time; from 720 to 1099 px side panels overlay the chat. Source: D-068, requirement NFR-01.
- Both looks, Calm and Focus, are built, and English is the default language with every text translated. Source: D-018, requirement NFR-05.
- Looks, sizes and states come from the prototype; where it draws nothing, Claude decides. Source: D-019.
- The shared conventions of the base components apply: folder layout, `ref` on every component, no text inside a component, one examples file for the preview page. Source: spec of TOKI-012 ("Contract for TOKI-013").
- The web styling is the prototype's CSS on CSS variables; no Tailwind and no runtime styling library. Source: Toki Blueprint, technical design, Frontend.
- Toasts and floating bars never cover the composer or navigation. Source: D-078.
- Tickets written at the same time: TOKI-015 (AppShell), TOKI-016 (preview page). TOKI-013 (Toast) and the sign-in screens (TOKI-023) already state what they expect from the layers.

## Open questions
- Does Esc on a form that has content ask whether to discard, like its close button? D-070 names only the outside click and the close button.
- Does the browser's Back button close an open dialog or sheet? D-089 says only that Back closes a side panel first.
- Is the Sheet used for anything on a phone besides the More sheet, and do other dialogs become sheets on narrow screens? The prototype draws one More sheet, as a dialog.
- What happens when a toast appears while a dialog or sheet is open?
