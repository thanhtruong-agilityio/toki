# Overlays design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/overlays.md (Thanh Truong)
Ticket: TOKI-014

## Goal
The builder (Thanh and Claude) needs the three layers of the prototype as components before the screens that open them are built: the Menu that opens from a button, the Modal (a centred dialog) and the Sheet (the panel that rises from the bottom edge of a phone, the More sheet).
The prototype opens and closes these with its own script, which moves no focus into a layer, keeps none inside it, returns none to the opening button and gives a menu no arrow keys. After this change `ui-web` exports Menu, Modal and Sheet, drawn as in the prototype in Calm and Focus, with focus trapped inside a dialog and returned when it closes, Esc closing the layers in order, menus driven by the arrow keys (D-075), nothing hover-only (D-067), and a close request that tells the owner why it was made, so that the form guard of D-070 (TOKI-093) needs no change here.

## Scope
- In:
  - `Menu`, `MenuItem`, `MenuGroup`, `MenuSeparator` and the hook `useMenuTrigger`; `Modal`; `Sheet`.
  - Their CSS, carried over from the prototype with the prototype's class names, one file per component.
  - The overlay layer they share (internal to `ui-web`): the stack of open layers and the Esc key, the focus trap and focus return, the scroll lock, and the optional isolation of the page behind a dialog.
  - Tests, an examples file per component and the three entries of this group in `componentExamples` for the preview page.
- Shared with TOKI-012 and TOKI-013. The rules of "Contract for TOKI-013" in the TOKI-012 spec apply to this ticket too and are not repeated: folder layout, `forwardRef` on every component, owned attributes after the spread, handlers with native names, no text inside a component, jsdom and Testing Library for the whole package, `Example` and `componentExamples`, export lists that are "at least", the base rules of `base.css`, the icon lint rule. This ticket adds no dependency.
- Decided in this spec, one rule that differs from the contract: a handler that is not the handler of a DOM event is named for what it does, not for an event. `onRequestClose` (Modal, Sheet) and `onClose` (Menu) are such handlers: the owner may refuse the request by leaving `open` as it is, so neither is the native `close` event of a `dialog` element.
- The line with TOKI-093, stated once. This ticket builds the layers and tells the owner why a close was asked: `"escape"`, `"outside"` or `"close"` for a dialog (R8). A layer never closes itself; the owner changes `open`. TOKI-093 builds what decides: the guard that, for a form with content, ignores an outside press and asks "discard?" on the close button (D-070, BR-21, AC-074 to AC-076), the check that a form has content, the confirmation dialog that names its target (a Modal that TOKI-093 fills), the Undo helper and the rule "never both" (D-069). Nothing in this ticket looks at what is typed in a dialog.
- The line with TOKI-015, stated once. The AppShell does not mount, host or position an overlay: every layer portals itself into `document.body` (Design, "The overlay layer"). What the shell may rely on, and what it must not do (z-index below 20, scroll, side panels, the toast anchor), is listed in Design, "What the layer gives the AppShell".
- The line with the sign-in screens (TOKI-023). Their "Your session has ended" cover is a Modal with an opaque backdrop, no close button, an owner that ignores Esc and outside presses, a chosen first focus, and no focus return. R15 and R16 give exactly these, so that screen adds no cover of its own.
- Prototype pieces and their owner. Each piece of the prototype's overlay CSS that is in none of the tables below belongs to the ticket that draws it.

| Prototype piece | Owner | Why |
| :---- | :---- | :---- |
| `.scrim`, `.modal`, `.mhd`, `.mbd`, `.mft` (lines 404-409) | Modal (this ticket) | Named in the ticket |
| `scrim sheet` (line 2155: the More sheet), which has no CSS rule of its own | Sheet (this ticket) | The prototype draws the More sheet as a dialog with an extra class and gives the class no rule, so the bottom panel is decided here (Design, "Sheet") |
| `.menu`, `.menu button`, `.menu hr`, `.menu .mt` (lines 410-416) | Menu (this ticket) | Named in the ticket |
| `.menu button.on` (line 413) | Not built | Its only use is the task status menu (Tasks, a later phase: scope box "Later phases") |
| `.menu button.demo`, `.menu button.demo .ic` (lines 670-671) | Not built | Demo-only (D-145) |
| `.menu .emojis`, `.emojis` (lines 417-418) | TOKI-046 (Reactions) | The picker of 8 emoji (D-017) is a grid of buttons that choose a value, not a list of commands. It may use the frame of Menu (`.menu`) and decide its own keys |
| `.pal`, `.pin`, `.kbd` (the command palette, lines 424-426, 2196) | TOKI-071 | A Modal in its `aria-label` form (R5) is its base. The palette sits near the top of the window (`align-items:start`, `margin-top:8vh`), which Modal does not offer; TOKI-071 adds that one placement to Modal when it needs it |
| `.mpop` (the mention suggestion list, line 326) | TOKI-050 (Mentions) | A list that belongs to the composer and follows the caret, with its own keys. Not a Menu |
| `.mrow` (the row of a list in a dialog or in the More sheet, line 336) | The ticket that draws the list (TOKI-092 for the More sheet) | A row, not a layer. Used in 8 places |
| `.acts` (the message action bar, line 255) | TOKI-052 | The bar is not a layer; its More menu is a Menu |
| `.drawer` (the Guide, line 481) | Not built | Demo tooling (D-145) |
| `.minibar`, `.cpanel` (Meet) | Not built | Meet is phase 4 (D-006) |

- Modal-like layers of the prototype that are outside phase 1 and are not built. The reason is the scope box "Later phases" of context.md (Tasks, Notes, custom and link tabs, polls, voice clips, approval requests, send later, Calendar, Meet, Guest portal, automations, Mail), D-006 (Meet), D-007 (Mail) and D-152 (Guest, phase 5):

| Prototype modal (type, line) | Feature | Phase |
| :---- | :---- | :---- |
| `task` (2144) | Tasks | Later |
| `compose` (2148) | Mail | Later (D-007) |
| `startmeet` (2150) | Meet | 4 (D-006) |
| `poll` (2153), `voice` (2154), `approval` (2162) | Polls, voice clips, approval requests | Later |
| `linktab` (2160) | Custom and link tabs | Later |
| `sched` (2163), `calsub` (2164) | Calendar | Later |
| `invite` (2165, the guest invite) | Guest portal | 5 (D-152) |
| `autogallery` (2166), `autoedit` (2167) | Automations | Later |

  The prototype's menus for send later, add a tab, "Post to channel" (Mail) and task status, and its `plus` menu (poll, voice clip, approval request), are outside phase 1 for the same reason.
- Overlays of phase 1 that exist in the prototype and are built by other tickets with these components: `browse` and `newmsg` (TOKI-034), `status` (TOKI-056, the plan line names no overlay; the prototype draws it as a modal), `file` (TOKI-062), `more` (TOKI-092, a Sheet), the command palette (TOKI-071), and the menus `user` (TOKI-099), `more` (TOKI-052), `emoji` (TOKI-046), `snooze` and `remind` (TOKI-066 and TOKI-067: the plan lines name no menu; the prototype draws menus). Overlays that the journeys describe and the prototype does not draw (Create channel, Invite members, confirmations) are in "Which tickets use which layer".
- Out (not now):
  - The confirmation dialog, the discard question, the form guard, Undo (TOKI-093); the content of any dialog; every screen.
  - The AppShell, the bottom tabs, side panels and their Esc (TOKI-015); the preview page (TOKI-016).
  - Toast and its place (TOKI-013).
  - Type-to-select in a menu, sub-menus, a menu with checkboxes or radio items, a context menu opened by a right click, a drag gesture that closes a Sheet. D-075 asks for arrow keys only, and no phase 1 journey needs the others.
  - The browser's Back button and an address for a dialog (concern 2).
  - Any text: the title, the close label, the labels of items and the footer buttons come in as props already translated (TOKI-012 R3, TOKI-017).

## Requirements
- R1. `@toki/ui-web` exports at least these names, each from `packages/ui-web/src/components/<Folder>/` and re-exported by `src/components/index.ts`: `Menu`, `MenuProps`, `MenuItem`, `MenuItemProps`, `MenuGroup`, `MenuGroupProps`, `MenuSeparator`, `MenuSeparatorProps`, `menuAligns`, `menuItemVariants`, `menuCloseReasons`, `MenuCloseReason`, `useMenuTrigger`, `computeMenuPosition`, `Modal`, `ModalProps`, `Sheet`, `SheetProps`, `dialogBackdrops`, `dialogCloseReasons`, `DialogCloseReason`. The folders are `Menu/` (holds `MenuItem`, `MenuGroup`, `MenuSeparator`, `useMenuTrigger` and `menuPlace.ts`), `Modal/` (holds `Dialog.tsx`, which `Sheet` imports and which the package does not export) and `Sheet/`. Each folder has `<Name>.tsx`, `<Name>.css`, `<Name>.test.tsx`, `<Name>.examples.tsx` and `index.ts`, plus the helper files named here; `Sheet/Sheet.css` and `Menu/Menu.css` are the only CSS of their folders. `src/components/index.ts` gains three lines and `src/examples.ts` three imports and three entries; no other shared file of TOKI-012 or TOKI-013 changes (TOKI-012 R31). The test checks that each name is exported and does not require that nothing else is.
- R2. Conventions. Every component of this ticket is made with `forwardRef`; `ref` points at: `Menu` its `div.menu`, `MenuItem` its `button`, `MenuGroup` its `div`, `MenuSeparator` its `hr`, `Modal` and `Sheet` the element with `role="dialog"` (`div.modal`). `className` is added after the component's own classes (on the dialog panel for `Modal` and `Sheet`). Every other attribute of that element passes through except those the component owns; owned attributes are applied after the spread. Handlers keep native names except `onRequestClose` and `onClose` (Scope). The props types of R1 are exported. `open` is the only state: a layer is controlled and holds no open state of its own, so an owner that wants it open keeps it open.
- R3. No source file under `src/components/Menu`, `Modal` or `Sheet` or under `src/internal/overlays` holds a word of its own or imports `@toki/i18n` (test and examples files excepted). Rendering each component open, with every required text prop set to the empty string and no children, gives a `textContent` equal to the empty string.
- R4. With `open={false}`, or after unmount, a layer renders nothing: `document.body` gains no child, no scroll lock is held (R14), no page element is made inert (R15), no `keydown`, `pointerdown` or `focusin` listener of the layer is left on `document`, and the stack of open layers (R9) does not hold it.
- R5. `Modal` portals into `document.body`, as its last child at the time it opens, one `div.scrim` that holds one `div.modal` with `role="dialog"`, `aria-modal="true"` and `tabindex="-1"`. Two forms. (a) With `title`: the panel holds `div.mhd` (an `h2` with the title and an id from `useId`, and, only when `closeLabel` is given, an `IconButton` of TOKI-012 with `size="sm"`, `icon="x"` and `label` equal to `closeLabel`), then `div.mbd` with the children, then `div.mft` with `footer` only when `footer` is given; the panel has `aria-labelledby` equal to the id of the `h2`. (b) Without `title`, with `aria-label` or `aria-labelledby` (passed through to the panel): the panel holds the children directly, with no header, no body wrapper and no footer. Every other attribute passes to the panel.
- R6. `Sheet` renders as `Modal` does in R5, with these differences only: the scrim has the classes `scrim sheet`, and the panel has the classes `modal` and, from R25, a bottom placement. Its props are those of `Modal`. Same behaviour in every requirement from R8 to R16.
- R7. `initialFocusRef`, `backdrop`, `returnFocus` and `footer` are props of `Modal` and `Sheet`: `initialFocusRef` a ref to the element that gets first focus (R11); `backdrop` one of `dialogBackdrops`, `dim` (default) or `opaque` (R15); `returnFocus` a boolean, default `true` (R13).
- R8. A dialog never closes itself; it calls `onRequestClose(reason)` with one of `dialogCloseReasons`: `"escape"` when Esc is pressed while it is the topmost layer (R9); `"outside"` when a press begins on the scrim and ends on the scrim; `"close"` when the header's close button is pressed. A press that begins inside the panel and ends on the scrim (the end of a text selection) is not an outside press. After any of these, an owner that leaves `open` as it is leaves the dialog open with its content, focus and typed text unchanged. No reason is reported for a press on the panel. `onRequestClose` is required.
- R9. Esc and order. The open layers (dialogs and menus) form one stack, in the order their `open` turned `true`. One `keydown` listener on `document`, in the capture phase and present only while the stack is not empty, handles `Escape`: it asks the topmost layer to close (`"escape"`), and it calls `preventDefault` and `stopPropagation` on the event, so that no other handler (a React `onKeyDown` above the layer's owner, a listener on `document` in the bubble phase) sees it. One press asks one layer. With the stack [Modal A, Modal B, Menu], three presses ask the Menu, then B, then A. An `Escape` with `isComposing` true (a Vietnamese or other input method is composing) is ignored by the layer and not stopped. With an empty stack the event is not touched.
- R10. One press closes one layer. A press (`pointerdown`) outside an open Menu that lies on the scrim of a dialog below it closes the Menu only: the dialog gets no `"outside"` request for that press. The Menu marks the press as handled (a `WeakSet` of pointer events in `src/internal/overlays`), and the scrim ignores a marked press.
- R11. Focus in. When a dialog opens, focus moves into it, in this order of choice: the element of `initialFocusRef`; else the first element in the panel that has the attribute `data-autofocus` (the prototype's attribute, line 1185); else the first tabbable element of the panel in document order (the header's close button comes first); else the panel itself. An element that is not a control (plain text) can be the first focus when the owner gives it `tabIndex={-1}`.
- R12. Focus trap. While a dialog is the topmost layer: Tab on the last tabbable element of the panel moves focus to the first, and Shift+Tab on the first moves it to the last; with no tabbable element, Tab and Shift+Tab leave focus on the panel; a focus that lands outside the panel and outside every layer above it (a script, a click on the page behind through a gap) is moved back to the first tabbable element or the panel. A tabbable element is a link with `href`, an enabled `button`, `input` (not `type="hidden"`), `select` or `textarea`, or an element with a `tabindex` that is not `-1`, that has no `hidden` attribute and is not inside an element with `inert` or `hidden`. A Menu above the dialog is not trapped by it (R9, R20).
- R13. Focus return. When a dialog closes (`open` turns `false` or it unmounts), focus goes back to the element that had it when the dialog opened (the opener), when `returnFocus` is not `false`, the opener is still in the document and `document.activeElement` is then the `body` (the browser's state when the focused element has been removed). If the owner has already moved focus to another element in the same commit, that element keeps it. A dialog opened when focus was on the `body` returns nothing. With stacked dialogs, closing B returns focus to the element of A that opened B.
- R14. Scroll lock. While at least one Modal or Sheet is open, `document.body.style.overflow` is `hidden`; when the last one closes it is back to the value it had before the first one opened. A Menu does not lock. The `.modal` has `overscroll-behavior: contain` (Table A).
- R15. Opaque backdrop. `backdrop="opaque"` adds the class `opaque` to the scrim, whose background is `var(--bg)` (Table A), and, while the dialog is open, sets `inert` and `aria-hidden="true"` on every child of `document.body` other than the dialog's own portal; when it closes each element gets back the `inert` and `aria-hidden` it had before. A layer that opens later (a Menu, another dialog) is a new child of `body` and is not affected. With `backdrop="dim"` nothing is made inert or hidden: the page behind is covered by the dim scrim, `aria-modal="true"` and the trap (R12). Decided in this spec; the reason is in Design, "Why not `inert` every time".
- R16. A dialog that cannot be dismissed is possible with the props above and nothing else: with no `closeLabel` the header has no close button; with an `onRequestClose` that does nothing, Esc, an outside press and every other key leave it open; with `returnFocus={false}` no focus is returned; with `initialFocusRef` on a `tabIndex={-1}` text element, that element has first focus. A test builds this dialog and presses Esc, clicks the scrim and tabs; the dialog stays open, focus stays on the chosen element, and a second Tab stays inside.
- R17. `Menu` portals into `document.body` one `div.menu` with `role="menu"`, `data-menu` and `aria-orientation="vertical"`, and the children. It takes `open`, `anchorRef` (a ref to the opening element), `onClose(reason)`, `align` (one of `menuAligns`, `end` default or `start`), `openFocus` (`first` default or `last`), and `aria-label` or `aria-labelledby`; the type accepts nothing without one of the two. `onClose` and `anchorRef` are required. Menu closes only through `onClose`.
- R18. `MenuItem` renders `button` with `type="button"`, `role="menuitem"`, `tabindex="-1"`, and as children an `Icon` of `icon` (an `IconName`, optional) followed by a `span` that holds the children. `variant` is one of `menuItemVariants`, `default` or `danger` (class `dng`). `disabled` sets `aria-disabled="true"` and not the `disabled` attribute: the item stays focusable (R20) and a click on it does nothing (R21). `onClick` is the native handler.
- R19. `MenuGroup` renders `div` with `role="group"`, `aria-labelledby` the id of its heading, a `div.mt` heading holding `label` (required), then the children. `MenuSeparator` renders `hr`. Both may sit anywhere among the items.
- R20. Menu keys. When a Menu opens, focus moves to its first item that is not disabled (the last, with `openFocus="last"`); when every item is disabled, to the first. ArrowDown moves focus to the next item and ArrowUp to the previous, wrapping from the last to the first and the first to the last; Home and End go to the first and the last. Disabled items are visited, so that a locked entry and its reason can be reached by keyboard. Items are found in document order through the groups. Enter and Space press the focused item (the browser's click on a `button`). Other keys do nothing (no type-to-select).
- R21. Choosing. A click on an item that is not disabled (mouse, touch, Enter or Space): in this order, focus moves to the element of `anchorRef`; the item's `onClick` is called; then the Menu calls `onClose("select")`, unless the handler called `event.preventDefault()`, in which case the Menu stays open and its owner decides what it shows (the prototype replaces a menu by another one, line 2367). A click on a disabled item calls nothing and does not close the Menu.
- R22. Closing a Menu. Esc: focus moves to the anchor and `onClose("escape")` is called (the stack of R9 decides which layer gets it). Tab or Shift+Tab: the default is prevented, focus moves to the anchor, `onClose("tab")` is called. A press outside the Menu, and not on the anchor: `onClose("outside")`, with no change of focus by the Menu. A press on the anchor is not an outside press, so the anchor's own click toggles the Menu. Whatever the reason, when the Menu has closed and `document.activeElement` is the `body`, focus moves to the anchor (the same rule as R13).
- R23. Position. `computeMenuPosition({ anchor, menu, viewport, align })` returns `{ left, top }` with `anchor` `{ left, top, right, bottom }`, `menu` `{ width, height }` and `viewport` `{ width, height }`, as the prototype's `posMenu` (lines 2103-2111): `left` is `anchor.right - menu.width` for `end` and `anchor.left` for `start`; `top` is `anchor.bottom + 4`; when `top + menu.height` is more than `viewport.height - 8`, `top` becomes `max(8, anchor.top - menu.height - 4)`; `left` is then limited to `max(8, min(left, viewport.width - menu.width - 8))`. The Menu is `position: fixed` and sets `left` and `top` from the function in a layout effect before the first paint, and again on `resize` of the window and on `scroll` of any element (capture), while it is open. The menu element has `max-height: calc(100% - 16px)` and scrolls (Table C), so a menu taller than the window stays reachable.
- R24. `useMenuTrigger<T extends HTMLElement>()` returns `{ open, setOpen, triggerProps, menuProps }`. `triggerProps` is `{ ref, "aria-haspopup": "menu", "aria-expanded": open, onClick, onKeyDown }`: a click toggles `open`; ArrowDown on the trigger opens it with `openFocus="first"` and ArrowUp with `"last"`. `menuProps` is `{ open, anchorRef, openFocus, onClose }`, where `onClose` sets `open` to `false`. `triggerProps` goes on an `IconButton` or a `Button` without a cast.
- R25. The three CSS files hold exactly the selectors of Tables A, B, C and D, with exactly the declarations listed (value for value, in any order and any white space), and no other rule. Each component's `.tsx` imports its CSS file; `Sheet.tsx` also imports `Modal.css`; `Dialog.tsx` imports `Modal.css`. `Modal.css` and `Menu.css` each hold one `@media (max-width: 719px)` block (Table D).
- R26. The CSS of the three files uses only the design system's names and values. (a) A colour is always `var(--…)`: the check fails on `#`, `rgb(`, `rgba(`, `hsl(`, `hsla(`, `color-mix(` and a named colour; `transparent` is allowed. (b) Every `var(--name)` names one of the 32 properties of `tokens.css` (TOKI-009 R10). (c) No selector contains `data-eff`, `data-look`, `data-accent` or `data-density`. (d) `font-family` appears only in `.modal .mhd h2`. (e) No rule sets `transition` or `animation`.
- R27. Nothing is hover-only (D-067). In the three CSS files every `:hover` rule declares only `background`; no rule sets `opacity: 0`, `visibility: hidden` or `display: none`; no component reads `title` or `onMouseEnter`. Every action of a layer (choose an item, close, confirm) is a click or a key, so it works with a finger, a keyboard and a mouse.
- R28. Layers and z-order. The scrim has `z-index: 20` (Table A), the Menu `z-index: 30` (Table C), and the toast region of TOKI-013 has `z-index: 40` (TOKI-013 R21), the values of the prototype's own layers (lines 402, 410, 419). A test reads the three CSS files and fails when one of them changes. A Menu opened from a dialog shows above it; a toast shows above both.
- R29. Narrow screens. At 719 px or less every control of a layer is at least 40 px tall (journey F38, D-091): the Menu's items by Table D; the header close button by TOKI-012 R8. At 360 x 560, 719, 720, 1099 and 1100 px, in both looks, checked in a browser on the preview page: a Modal with a long body scrolls inside its panel, its header and its close button stay in view, and the panel is never taller than the window; a Sheet sits against the bottom edge, full width up to 520 px; a Menu opened from a button at the bottom edge of the window opens above it, and one opened near the right edge stays 8 px inside the window; the user menu of the prototype (a menu of about 14 rows) is reachable by scrolling at 360 x 560.
- R30. `Menu.examples.tsx`, `Modal.examples.tsx` and `Sheet.examples.tsx` each export `examples`, a list of `Example` (TOKI-012 R26), each an openable demo (a TOKI-012 `Button` that sets `open` on a small component that holds the state). Together they show 13 examples, with these ids: Menu `default` (align `end`), `start`, `groups` (a group heading and a separator), `danger`, `disabled`, `icon`; Modal `with-footer` (form (a), `backdrop` `dim`), `no-footer`, `label-only` (form (b)), `opaque` (`backdrop` `opaque`), `no-close` (no `closeLabel`); Sheet `rows` (a list of rows) and `long-body`. The first example of each entry (`default`, `with-footer`, `rows`) has a TOKI-012 `Button` as the first `button` of its figure, which opens the layer, and its owner closes the layer on every reason, so that Esc closes it and focus returns to that button (the check of the preview page, TOKI-016 R13). The ids are unique within a component. `src/examples.ts` adds the entries `Menu`, `Modal`, `Sheet`, in that order, after the entries of group 2. A test fails when a value of `menuAligns`, `menuItemVariants` or `dialogBackdrops` has no example.
- R31. Boundaries and checks. `src/components/Menu`, `Modal`, `Sheet` and `src/internal/overlays` import nothing from `@toki/platform`, `@toki/i18n`, `@toki/tokens`, `@toki/client-core` or `@toki/shared`, and use none of the APIs that TOKI-002 R9 bans. `pnpm --filter @toki/ui-web test`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check` and `pnpm typecheck` exit 0 with the new files. The header close button and the items raise no report of `toki/icon-only-button-name` (TOKI-012 R22).
- R32. Types. The props types turn these mistakes into type errors that `pnpm typecheck` finds, and the tests mark each with `// @ts-expect-error`: `Modal` with neither `title` nor `aria-label` nor `aria-labelledby`; `Modal` with `title` and `aria-label` together; `Modal` with `closeLabel` and no `title`; `Modal` without `onRequestClose`; `Modal` with `footer` and no `title`; `Modal` with `backdrop="dark"`; `Menu` without `aria-label` and `aria-labelledby`; `Menu` without `anchorRef`; `Menu` with `align="center"`; `MenuItem` with `variant="loud"`; `MenuGroup` without `label`.

## Design
### Source of the values
Every size, colour and state comes from the prototype's style sheet and script (`docs/blueprint/prototype/index.html` of the Toki Blueprint; the line numbers are those of that file). What the prototype draws nothing for says "decided" (D-019). Read from the CSS and the script; no value was measured in a browser.

Table A. `Modal.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.scrim` | `position:fixed; inset:0; z-index:20; background:var(--scrim); display:grid; place-items:center; padding:16px` | 404; the prototype's `.scrim` is `absolute` inside `.ov`, whose `z-index` is 20 (402). Decided: `fixed`, because the page is the window and not a demo device |
| `.scrim.opaque` | `background:var(--bg)` | decided (R15): the content behind is covered, not dimmed |
| `.modal` | `background:var(--surface); border-radius:var(--radius); box-shadow:var(--pop); width:min(520px,100%); max-height:100%; overflow:auto; border:1px solid var(--line); overscroll-behavior:contain` | 405; `overscroll-behavior` decided, so that a scroll that reaches the end does not scroll the page |
| `.modal:focus-visible` | `outline:0` | decided: the panel can hold focus (R11) and a ring around the whole dialog is noise |
| `.modal .mhd` | `display:flex; align-items:center; padding:16px 18px 6px; gap:8px` | 406 |
| `.modal .mhd h2` | `margin:0; font-size:17px; flex:1; font-family:"Bricolage Grotesque",sans-serif` | 407 |
| `.modal .mbd` | `padding:6px 18px 12px` | 408 |
| `.modal .mft` | `display:flex; justify-content:flex-end; gap:8px; padding:10px 18px 16px` | 409 |

Table B. `Sheet.css`. The prototype has no rule for the class `sheet`; the whole table is decided.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.scrim.sheet` | `place-items:end center; padding:0` | decided |
| `.scrim.sheet .modal` | `width:min(520px,100%); max-height:calc(100% - 48px); border-radius:var(--radius) var(--radius) 0 0; border-bottom:0; padding-bottom:env(safe-area-inset-bottom,0px)` | decided. 48 px of scrim stay at the top, so there is always something to press to dismiss it. The safe area is the prototype's habit on the bottom edge (lines 506, 519, 537, 558) |

Table C. `Menu.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.menu` | `position:fixed; min-width:200px; max-width:min(300px,92%); background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); box-shadow:var(--pop); padding:4px; z-index:30; max-height:calc(100% - 16px); overflow-y:auto` | 410; `fixed` and `max-height` decided (R23) |
| `.menu button` | `display:flex; align-items:center; gap:10px; width:100%; padding:7px 10px; border-radius:7px; color:var(--ink); min-height:32px` | 411 |
| `.menu button:hover` | `background:var(--hover)` | 412 |
| `.menu button:focus-visible` | `background:var(--hover); outline-offset:-2px` | decided: the focus that the arrow keys move (R20) needs a visible place; `-2px` keeps the ring inside a scrolling menu where an outer ring would be clipped |
| `.menu button.dng` | `color:var(--danger)` | 414 |
| `.menu button[aria-disabled="true"]` | `opacity:.5; cursor:not-allowed` | decided: the 0.5 of `.btn[disabled]` (TOKI-012) |
| `.menu hr` | `border:0; height:1px; background:var(--line); margin:4px 0` | 415 |
| `.menu .mt` | `font-size:11.5px; color:var(--muted); padding:6px 10px 2px; font-weight:600` | 416 |

The `:hover` rule also matches a disabled item, which keeps the hover background; accepted, the lowered opacity says it is not available.

Table D. Narrow screens: one `@media (max-width: 719px)` block in each file.

| File | Selector | Declarations | Source |
| :---- | :---- | :---- | :---- |
| `Modal.css` | `.scrim` | `padding:12px` | 560 |
| `Modal.css` | `.modal` | `width:100%` | 561 |
| `Menu.css` | `.menu button` | `min-height:40px` | 538 |

As in TOKI-012 Table I, the files use the viewport (`max-width: 719px`) and not the prototype's container query on its demo frame (concern 8 of that spec). `Sheet.css` has no narrow rule: a Sheet is full width up to 520 px at every width.

### What the prototype does and what this spec adds
| Behaviour | Prototype | This spec |
| :---- | :---- | :---- |
| Name of a dialog | None: `role="dialog" aria-modal="true"`, no name (line 2133) | `aria-labelledby` the title, or an `aria-label` (R5) |
| Focus into a dialog | Once, to the first `[data-autofocus]` (line 1185) | R11 |
| Focus kept inside | No | R12 |
| Focus returned | No | R13 |
| Esc | Palette, then menu, then modal, then the Guide, the mention list, editing, the side panel (2557-2571) | One stack of layers, topmost first (R9). Closing the side panel and the rest stays with their owners; a layer takes the key first and stops it |
| Backdrop press | Closes a dialog whenever the click lands on the scrim, form or not (2503) | Reported as `"outside"`; the owner decides (R8). A press that began inside the panel is not one |
| Close button | `ib sm`, `aria-label="Close"` (2134) | `IconButton` with `closeLabel` from the screen (R5) |
| Menu keys | None | R20 |
| Menu closes | On any click outside, and after a click inside unless the action opened another menu (2514, 2522-2524) | R21, R22 |
| Menu position | Once at open, below the anchor, right edge to the anchor's right (left edge with `left`), above when it does not fit, 8 px from the edges (2103-2111) | The same rule (R23), again on resize and scroll |
| Scroll lock | None (the page is a frame) | R14 |

### The overlay layer
Decided in this spec. The files are in `src/internal/overlays/`.
- Mount. Each open layer is rendered with `createPortal` into `document.body` and is its own last child, so a later layer is above an earlier one of the same `z-index` by order. There is no provider and no root element to add: the AppShell has nothing to mount. The reason: a provider is one more thing for every screen and every test to remember, and the layers need nothing that a provider would hold. The cost: React sends the events of a portal up the React tree, so a layer rendered inside a clickable row also sends its clicks and keys to that row. A screen renders its layer beside the clickable element, not inside it.
- `<dialog>` is not used. Decided: a `div` with `role="dialog"` and `aria-modal`, as the prototype writes it. The native element opens in the browser's top layer, which is above every `z-index`, so the toast (R28) could not show above a dialog; and jsdom does not implement `showModal`, which the tests need.
- The stack (`stack.ts`). A module-level list of `{ id, kind, close }`, where `close` calls the latest `onRequestClose` or `onClose` of the layer. A layer pushes itself when `open` turns `true` and removes itself when it turns `false` or unmounts. The Esc listener of R9 is added with the first entry and removed with the last. `isTop(id)` tells a dialog whether it traps (R12). The same file holds the `WeakSet` of handled presses (R10).
- Focus (`focus.ts`). Finds tabbable elements (R12) and moves focus. jsdom has no layout, so it does not test visibility other than `hidden` and `inert`; a browser also skips elements with `display: none` through its own rules, and the Tab wrap uses the tabbable list only to find the first and last, so a hidden element at an end is the one limit (concern 9).
- Scroll lock (`scrollLock.ts`). A counter: the first lock stores `body.style.overflow` and sets `hidden`; the last unlock restores it. The page of phase 1 does not scroll its body (the shell fills the window), so no scrollbar width is compensated.
- Isolation (`isolate.ts`). For `backdrop="opaque"`: sets `inert` and `aria-hidden="true"` on the other children of `body`, remembering what each had, with a counter per element so two opaque dialogs restore correctly.
- Why not `inert` every time. Decided in this spec. The toast region (TOKI-013 R21) is the one `aria-live` region of the toasts and sits beside the page, so making the page inert would also silence it, and a toast shown while a dialog is open would not be announced. A dim dialog relies on `aria-modal="true"`, which current screen readers honour, and on the trap. An opaque dialog is a case where nothing behind may be read (journey F07; requirement FR-46), so it isolates, at the cost that no toast is heard while it is open. The screen-reader behaviour is not tested in this spec (concern 5).
- A menu item that opens a dialog. Decided: R21 moves focus to the anchor before the item's `onClick` runs, so the dialog that the handler opens records the anchor as its opener (R13), not the item that is about to disappear. The dialog then returns focus to the button that opened the menu.
- No animation. The prototype's dialog and menu have none, and R26 (e) keeps it so; `base.css` already holds the reduced-motion rule.
- The Esc rule and IME. Vietnamese is typed with an input method that uses Esc to cancel a composition, so `isComposing` is checked (R9). Without it a person could lose a dialog by correcting a word.

### Sheet
Decided in this spec (the prototype draws no sheet). D-053 and the plan say "the More sheet" for narrow screens; the prototype draws it as a centred dialog (line 2155) with a class that has no rule, so a person on a phone sees a dialog in the middle of the screen, and at 360 px the dialog is as wide as the window less 24 px.
- A Sheet is a dialog placed against the bottom edge of the window: full width up to 520 px, rounded top corners, scroll inside when taller than the window less 48 px, safe-area padding at the bottom (Table B). Its header, body, footer, behaviour and props are those of Modal (R6), so the More sheet gets the title, the close button, the trap, Esc and focus return with no other rule.
- It is not tied to the width. The More tab exists only under 720 px (journey F38), and the Sheet is shown when the screen opens it; if the window grows past 720 px while it is open, it stays, at 520 px wide and centred at the bottom, and its owner closes it. This keeps the layer free of layout state.
- The Menu does not become a Sheet on a phone: the prototype opens the same popover at every width and makes its items 40 px tall (538), and a menu anchored to a button keeps its context. The prototype's `k.sheet` branch (line 2105) is never set by any caller (searched), so nothing is lost. Whether other dialogs become sheets on a phone is not decided (concern 3).
- On the soft keyboard: the Sheet and the Modal follow the layout viewport only, like the Toast (TOKI-013, concern 4). Not decided (concern 7).

### What the layer gives the AppShell
For TOKI-015, written from this side; TOKI-015's own spec is read at the end of this work.
1. Where overlays mount: in `document.body`, by themselves (above). The shell renders no container for them and needs no provider. The `ToastProvider` of TOKI-013 is separate and the shell mounts it, as TOKI-013 says.
2. Z-order, bottom to top: the shell's own panes, side panels and bottom tabs (the prototype keeps these at `z-index` 6 or less: lines 510, 515, 555), then a dialog's scrim (20), then a Menu (30), then the toast region (40). The shell must keep every pane below 20, and must not create a stacking context with a `z-index` on an ancestor of nothing that it portals (a portal is not its descendant). The Meet bar (`z-index: 25`, line 434) is phase 4 and not built.
3. Scroll lock: while a Modal or Sheet is open the body does not scroll and the scrollable panes of the shell behind the scrim keep their own scroll position, which the layer does not touch. The shell must not rely on the body for scrolling, which the prototype's frame does not either. A Menu does not lock; it follows its anchor on scroll (R23).
4. Side panels. Between 720 and 1099 px a side panel overlays the chat (D-068). A dialog or Menu over it is above it (scrim 20 against the panel's 6) and covers it with the rest of the window. The panel stays open and mounted, and is not closed by the layer opening or closing. Esc asks the layers first (R9), and the key does not reach the shell's own handler while a layer is open, so the first Esc closes the dialog and the next one can close the panel, as in the prototype's order (2565-2571). Closing a panel with Esc is the shell's rule; this ticket only guarantees it is second.
5. Focus. The More tab and the account card are the opening buttons of a Sheet and a Menu; the layer returns focus to them (R13, R22). A tab that is hidden or removed while the layer is open (the bottom tabs are hidden with `transform` while a chat is open in the prototype, line 515) is still in the document, so focus can return to it.
6. The toast anchor and `useToastAvoid`. Layers neither register as an anchor nor as an obstacle: a layer is not part of the layout. A toast shows above the scrim at the place TOKI-013 chooses (concern 4).
7. Press and Back. Pressing Back with a layer open is not handled by the layer (concern 2).
8. Narrow means the viewport (`max-width: 719px`), as in TOKI-012 R8; if the shell chooses a container, the media blocks of Table D follow it (TOKI-012 concern 8).

### What the layer gives the preview page and the screens
- TOKI-016 reads `componentExamples` and shows each entry. An overlay example is a button that opens the layer (R30), so the page is not covered when it loads. The entry names are `Menu`, `Modal` and `Sheet`.
- A screen that opens a layer keeps `open` in its own state, passes the translated texts, and decides each close request (R8, R22). A screen that wants the guard of D-070 uses the reason `"outside"` and `"close"`, which is TOKI-093's.
- A modal over a modal is allowed (a "discard?" dialog over a form). The stack puts the later on top, Esc and the trap act on it, and closing it returns focus into the first one (R13).

### Which tickets use which layer
Only as far as `plan.md` says. The plan lists TOKI-014 as a need of TOKI-023, TOKI-034, TOKI-071 and TOKI-093; the lines below name the layer in their text. Other plan lines name no layer or no need (concern 6).

| Layer | Plan lines that name it |
| :---- | :---- |
| Modal | TOKI-023 (the 'Your session has ended' screen; a Modal in the sign-in spec), TOKI-034 (Browse channels, the people picker), TOKI-098 (the Create channel dialog), TOKI-062 (the detail modal), TOKI-093 (the confirmation dialog and the form guard), the confirmations of TOKI-025, TOKI-035, TOKI-047, TOKI-100 and TOKI-101, TOKI-071 (the palette) |
| Menu | TOKI-099 (the account card's menu), TOKI-052 (the More menu of a message), TOKI-025 (the row menu of the Admin page) |
| Sheet | TOKI-092 (the More sheet), TOKI-099 ('Sign out' in the More sheet) |

### Layout
```
packages/ui-web/src/
├─ index.ts                 unchanged
├─ examples.ts              three imports and three entries added (R1, R30)
├─ internal/overlays/       stack.ts, focus.ts, scrollLock.ts, isolate.ts, tests next to them
└─ components/
   ├─ index.ts              three lines added
   ├─ Menu/                 Menu.tsx, MenuItem.tsx, MenuGroup.tsx, useMenuTrigger.ts, menuPlace.ts,
   │                        Menu.css, Menu.test.tsx, Menu.examples.tsx, index.ts
   ├─ Modal/                Modal.tsx, Dialog.tsx, Modal.css, Modal.test.tsx, Modal.examples.tsx, index.ts
   └─ Sheet/                Sheet.tsx, Sheet.css, Sheet.test.tsx, Sheet.examples.tsx, index.ts
```
`MenuSeparator` lives in `MenuGroup.tsx`. `menuPlace.ts` holds `computeMenuPosition`. `Dialog.tsx` holds the behaviour that `Modal` and `Sheet` share; each of the two is a thin wrapper that sets the scrim's class.

### Errors
- An owner leaves `open` as it is after a close request -> the layer stays open, with its content and focus unchanged (R8).
- The opener is no longer in the document when a dialog closes (a row that re-rendered) -> no focus is returned; the browser leaves focus on the `body` (concern 9).
- The anchor of a Menu is not in the document when it opens -> the Menu is placed at the top left, 8 px from the edges, and still closes by Esc, Tab and an outside press.
- A Menu or a dialog unmounts while open (the screen goes away) -> its listeners, lock and isolation are released (R4); no focus is returned.
- `Escape` during composition -> ignored (R9).

## Testing
- Behaviour in jsdom with Testing Library and `user-event` (set-up of TOKI-012 R27): R5 and R6 read the DOM; R8 presses Esc, clicks the close button, and presses and releases on the scrim, and presses inside the panel and releases on the scrim; R9 opens three layers and presses Esc three times, checks `preventDefault`, a `keydown` handler on `document` (bubble) and a React `onKeyDown` on a parent that must not be called, and one `Escape` with `isComposing: true`; R10 opens a Menu over a Modal and presses on the scrim; R11 builds one case for each of the four choices; R12 uses `user.tab()` and `user.tab({ shift: true })` with a panel of three buttons, of none, and a script `focus()` on a button outside; R13 opens from a button, closes by each reason and checks `document.activeElement`, plus `returnFocus={false}`, a removed opener, an owner that moves focus in the same commit, and stacked dialogs; R14 checks `body.style.overflow` through two dialogs and a Menu; R15 checks `inert` and `aria-hidden` on three sibling elements, their restoration, and that a Menu opened later is not inert; R16 builds the session-ended dialog; R17 to R22 render a Menu of groups, a separator, a danger, a disabled and an icon item, press the keys of R20 (including wrap, Home, End and a disabled item), and check the order of focus, `onClick` and `onClose` in R21, and R22 for each reason and for a press on the anchor; R24 renders a trigger and checks the attributes and the three ways to open.
- `computeMenuPosition` is a pure function, tested with the cases of R23: below and right-aligned, left-aligned, flipped above, clamped on the left and on the right, higher than the window. One DOM test mocks `getBoundingClientRect` and checks that the Menu's inline `left` and `top` equal the function's result and change after a `resize` event.
- CSS: one test for each file compares its rules with a copy of Tables A to D typed into the test (R25), and a test walks the three files for R26, R27 and R28. As in TOKI-012, these tests prove the CSS equals this spec; that the spec equals the prototype rests on the review of the tables against the lines named in them (concern 10).
- R4: render open, then closed and unmounted; count the children of `body`, the listeners (a spy on `document.addEventListener` and `removeEventListener`), `body.style.overflow` and the `inert` attributes.
- R3, R31, R32: the empty-text test; the import scan; `pnpm typecheck` with the `@ts-expect-error` lines.
- R29 by hand in a browser on the preview page (TOKI-016; before it exists, a throw-away page that imports the examples), at 360 x 560, 719, 720, 1099 and 1100 px, in Calm and Focus, with the keyboard only for one run of each layer and on a touch device or a touch emulation for one run. The result goes in the PR description. Screen readers: VoiceOver in Safari and NVDA in Firefox open a Modal, a Sheet and a Menu; the dialog's name and the menu items are read, and a toast shown over a dim dialog is announced or not; the result goes in the PR (concern 5).
- Fake data and demo words only.

## Data safety
- No layer reads, stores or sends what is typed in it. It holds no state about its content, writes nothing to storage and sends no request.
- The isolation of R15 changes attributes of page elements for the time a dialog is open and restores them; it reads no content.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Work area Design system, M1, size M; needs TOKI-012; needed by TOKI-023, TOKI-034, TOKI-071, TOKI-093 | Scope; R1; "Which tickets use which layer"; concern 6 (the plan's needs lists) |
| Agreed scope: Menu, Modal, Sheet; focus trapped and returned; Esc in order; menus usable with arrow keys (D-075) | R1, R5 to R7; R11 to R13 (focus); R9 and R10 (Esc in order); R17 to R22 (menu keys) |
| A modal traps focus and returns it to the opening button; menus work with arrow keys (D-075, NFR-03) | R12, R13, R20, R22 |
| No feature is hover-only or desktop-only (D-067, NFR-02) | R27; R29; Table C, the hover rule only sets a background and the focus rule shows the same place |
| A form with content does not close on an outside click; the guard is TOKI-093's (D-070, BR-21, FR-28) | R8: the layer reports `"outside"`, `"escape"` and `"close"` and never closes itself; Scope, "The line with TOKI-093"; concern 1 for Esc |
| Smallest size 360 x 560; side panels overlay the chat from 720 to 1099 px (D-068, NFR-01) | R29; Table D; Design, "What the layer gives the AppShell" (4) |
| Both looks; English default, every text translated (D-018, NFR-05) | R26 (tokens only, no look selectors), R3 (no text), R30 (examples in both looks on the preview page) |
| Looks, sizes and states from the prototype; Claude decides where it draws nothing (D-019) | Tables A to D with the line of each value, and "decided" where there is none; the table "What the prototype does and what this spec adds" |
| Shared conventions of the base components (TOKI-012 contract) | Scope, "Shared with TOKI-012 and TOKI-013"; R1, R2, R3, R30, R31 |
| The prototype's CSS on CSS variables; no Tailwind, no runtime styling library | R25 and R26: plain CSS files with the prototype's class names, tokens only |
| Toasts and floating bars never cover the composer or navigation (D-078) | R28 (the toast is above every layer); concern 4 for what a toast may cover while a dialog is open; the navigation and the composer are covered by the scrim only while a dialog is open and are not covered by a toast, which TOKI-013 R27 and R28 keep |
| TOKI-015 and TOKI-016 are written at the same time; TOKI-013 and TOKI-023 state what they expect | Design, "What the layer gives the AppShell", "What the layer gives the preview page and the screens"; R15 and R16 (TOKI-023); R28 (TOKI-013) |

## Open questions from the intent
- Does Esc on a form that has content ask whether to discard, like its close button? Not answered. D-070 names the outside click and the close button only. The layer reports `"escape"` (R8), so either rule needs no change here. Carried forward as concern 1.
- Does the browser's Back button close an open dialog or sheet? Not answered. D-089 covers side panels only. Not built here. Carried forward as concern 2.
- Is the Sheet used for anything on a phone besides the More sheet, and do other dialogs become sheets on narrow screens? Answered for what the plan says: the More sheet (TOKI-092, TOKI-099) is the only Sheet; every other dialog keeps the prototype's centred form at every width (Design, "Sheet"). Whether that is what is wanted is carried forward as concern 3.
- What happens when a toast appears while a dialog or sheet is open? Answered by decision: the toast is above the layer (R28) and nothing moves it. Whether that is acceptable is carried forward as concern 4.

## Areas of concern
1. Esc on a form with content is not decided. D-070 says an outside click does not close it and the close button asks. Proposal, not a decision: Esc acts as the close button (asks "discard?" when the form has content, closes at once when it has none), because Esc is the keyboard's way to the close button. Until TOKI-093 decides, a screen that wants the guard treats `"escape"` like `"close"`. Owner: Thanh Truong.
2. The browser's Back button and an open dialog or sheet. D-089 says Back closes the side panel first; it does not say what a dialog does, and a dialog has no address. On a phone, a swipe-back with a Sheet open would leave the screen behind the Sheet and keep the Sheet. Proposal, not a decision: Back closes the topmost dialog or sheet before the side panel. It needs the router (TOKI-006) and the shell (TOKI-015), and is not built here. Owner: Thanh Truong.
3. The plan and D-053 name one Sheet, the More sheet. The prototype opens every other dialog as a centred dialog at every width, including 360 px, and a Menu as a popover. Nothing says whether Browse channels, the people picker, Create channel or Set status should rise from the bottom on a phone, or whether a long Menu such as the account menu should be a Sheet. This spec keeps the prototype (Design, "Sheet"). Not decided. Owner: Thanh Truong.
4. A toast over a dialog. The toast region has `z-index` 40 and is placed by TOKI-013 from the registered composer and bars; a dialog registers nothing (Design, "What the layer gives the AppShell", 6). A toast shown while a Modal or Sheet is open, which the prototype does (line 2344), can cover the lower part of the dialog, including its footer buttons, for 2.8 to 5 seconds. This closes the question of TOKI-013 concern 13 on the order (scrim 20, menu 30, toast 40) and leaves the coverage open. D-104 puts form errors under the field, so phase 1 shows a toast after a dialog has closed, not while it is open; if a screen does otherwise, `useToastAvoid` on the panel is not a fix (a tall dialog would push the toast out of the window). Not decided. Owner: Thanh Truong.
5. Screen readers. A dim dialog is not isolated (R15, "Why not `inert` every time"), so it relies on `aria-modal` and the trap. Whether every target reader hides the page behind it, and whether a toast over it is announced, is untested until the manual check of Testing is done; if a reader reads the page behind, the dim dialog would isolate too and the toast would not be announced while a dialog is open. A keyboard user also cannot reach a toast's Undo button while a dialog is open, because the trap holds focus. Not decided by the log. Owner: Thanh Truong.
6. The plan lists TOKI-014 as a need of TOKI-023, TOKI-034, TOKI-071 and TOKI-093 only. Plan lines that name a layer and do not list the need: TOKI-025, TOKI-035, TOKI-047, TOKI-052, TOKI-062, TOKI-092, TOKI-098, TOKI-099, TOKI-100, TOKI-101, and TOKI-056, TOKI-066 and TOKI-067 whose prototype screens are a modal and menus. Proposal: the plan lists those needs. TOKI-014 itself needs TOKI-012 only, and through it TOKI-009, TOKI-010 and TOKI-011 (the `x` icon of the close button, `IconButton`). It does not need TOKI-013 (it imports nothing from it) or TOKI-018. TOKI-016 needs TOKI-014, because the preview page draws the three entries (the TOKI-016 spec says the same); TOKI-015 does not need it. Owner: Thanh Truong.
7. The on-screen keyboard. A dialog or sheet follows the layout viewport; on a phone whose keyboard covers the lower part of the window, a footer button of a tall dialog can be hidden. The prototype does nothing and no decision covers it. Not built; the same limit as the Toast. Owner: Thanh Truong.
8. The sign-in screens (TOKI-023 concern 14) asked for four things from the Modal: no dismissal, an opaque backdrop that hides the page, a chosen first focus and no focus return. This spec gives them (R15, R16) as a decision of this ticket; the plan line of TOKI-014 does not promise them. The sign-in spec should refer to R15 and R16. Owner: Thanh Truong.
9. Limits of the trap and of the focus return, accepted. The tabbable list does not know which elements a browser has hidden by CSS, so a hidden control at either end of a dialog can take the Tab wrap (R12); a screen should not leave one there. Focus is not returned to an opener that has left the document (a row that re-rendered), so a screen that opens a layer from a list row should keep the row's button mounted or move focus itself. Accepted. Owner: Thanh Truong.
10. The tests prove the CSS equals Tables A to D, not the prototype: the prototype is not in this repository. The match rests on the review of the tables against the lines they name, and on the preview page (TOKI-016). Table B is wholly decided and not drawn by the prototype, so the look of the Sheet (placement, corner radius, 48 px at the top) is a proposal for the product owner to look at on the preview page, not a copy. Owner: Thanh Truong.
11. The names `Dialog`, `onRequestClose`, `dialogCloseReasons` and the prop `backdrop` are this spec's, not the prototype's, which has no components; they are the ones TOKI-093 and the sign-in screens will call. Decided in this spec; a rename after they are used costs a change in each caller. Owner: Thanh Truong.
12. Size. The Blueprint says M. Three components, an overlay layer with four internal modules, one hook, three CSS files with their tables, the examples and the tests of 32 requirements are likely to take more than one working session. Proposal, not a decision: build in this order, the layer (stack, focus, scroll lock) with Modal, then Sheet, then Menu with its hook, then the examples. Owner: Thanh Truong.
