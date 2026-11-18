# Base components, group 1 design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/base-components-1.md (Thanh Truong)
Ticket: TOKI-012

## Goal
The builder (Thanh and Claude) needs the small controls of the prototype as components before the overlays, the app shell and the screens are built. Today `packages/ui-web` holds only the icons (TOKI-011), and the prototype keeps the look of its buttons, chips, switches, fields, drop-downs, labels and counters in one style sheet, with markup written as strings. After this change `ui-web` exports Button, IconButton, Chip, Switch, Field, Select, Tag and Badge, drawn as in the prototype in Calm and Focus, usable with a keyboard and a screen reader, and a lint rule fails when an icon-only button has no name (D-075).

## Scope
- In:
  - The eight components of the ticket, plus `ChipGroup` (the prototype's `.chips` row, which every chip sits in).
  - Their CSS, carried over from the prototype with the prototype's class names, and the base rules that the prototype puts on `body`, on form controls and on keyboard focus (`base.css`).
  - The lint rule for icon-only buttons, in the ESLint configuration of TOKI-002, with its fixtures, proved by `pnpm lint:boundaries`. This changes TOKI-002; the lines it changes are listed in Design, "The lint rule".
  - The test set-up of `packages/ui-web` for components (jsdom and Testing Library), for both groups, and one examples file per component for the preview page.
  - Two import lines and two dependencies in `apps/web` so that the tokens and the base rules are loaded.
- Decided in this spec: what group 1 and group 2 (TOKI-013: Avatar, PresenceDot, EmptyState, Toast) share. It is stated here once and listed again, one line each, in "Contract for TOKI-013"; TOKI-013 follows it.
  - Folder layout: one folder per component, `packages/ui-web/src/components/<Name>/`, holding `<Name>.tsx`, `<Name>.css`, `<Name>.test.tsx`, `<Name>.examples.tsx` and `index.ts`. This ticket creates `components/index.ts`; it holds one line `export * from "./<Name>"` for each component folder, and each folder's `index.ts` names its exports (`export { Button, buttonVariants, buttonSizes } from "./Button"`, `export type { ButtonProps } from "./Button"`). Named exports only, no default export. This ticket also adds the one line `export * from "./components"` to `src/index.ts`. TOKI-013 adds its four folders, its four lines to `components/index.ts` and nothing to `src/index.ts`.
  - Props: a prototype look that excludes the others is the prop `variant`; a prototype size that is a named step is the prop `size` as a string union (`"md"` is the default and `"sm"` the small one), and a size that the prototype sets in pixels is a number (group 2's Avatar); a state is the prop that has the name of the HTML or ARIA attribute it sets (`disabled`, `pressed`, `checked`); every component takes `className` and the other attributes of its root element except those it owns, and the owned attributes are applied after the spread (R2).
  - `ref`: every component of both groups is made with `forwardRef` and forwards `ref` to one element, the one named in the last column of Table B. For group 2 that is the root element: `Avatar` the root (the wrapper when `presence` is set), `PresenceDot`, `EmptyState` and `Toast` their root. No component of either group is without `ref`.
  - Handlers keep the native names (`onClick`, `onChange`). Two exceptions, each with its reason: `Switch.onChange(checked: boolean)`, because a `button` has no change event; and `onPress` in the `action` object of Toast, which is a field of a plain object and not a DOM prop. The overlays (TOKI-014) name their request handlers for what they do (`onRequestClose`, `onClose`) and say so in their own spec; the two exceptions here are those of groups 1 and 2.
  - Text: no component of either group holds a word. Every visible and every accessible text comes in as a prop or as children, already translated by the screen (R3).
  - Class names: the prototype's, so that the CSS of the screens, carried over by later tickets, still matches (Design, "Class names").
  - Look selectors: no CSS selector of a component mentions `data-eff`, `data-look`, `data-accent` or `data-density` (R6 d). Group 2 follows the same rule, except for a selector that the prototype has and that no pair of tokens can replace; its spec names each one.
  - Narrow screens: at a viewport width of 719 px or less every control of both groups, the Toast button included, is at least 40 px tall (R8).
  - Test set-up, complete (R27): Vitest with the `jsdom` environment for the whole package, no per-file environment line; `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `@testing-library/jest-dom` and `postcss`; `src/test/setup.ts` registers the jest-dom matchers, calls `cleanup` after each test and sets `IS_REACT_ACT_ENVIRONMENT`; `src/test/css.ts` reads a CSS file. This ticket adds `jsdom` to `ui-web`, at the version `packages/platform` pins (TOKI-018) when that package exists; TOKI-013 adds no dependency. A test of group 2 that used `// @vitest-environment jsdom` and `react-dom/client` still works, and TOKI-013 moves to Testing Library and `src/test/css.ts`.
  - Examples: each folder has `<Name>.examples.tsx` exporting `examples: Example[]` (the type `Example` of `src/internal/example.ts`); `src/examples.ts` exports `componentExamples`, one entry for each component, group 1 first and then group 2 in the order Avatar, PresenceDot, EmptyState, Toast. A group 2 component adds its examples file, one import and one entry (R26, R31). The preview page imports `@toki/ui-web/examples`.
  - Shared files, created by this ticket: `src/internal/cx.ts` (joins class names), `src/internal/example.ts`, `src/examples.ts`, `src/test/setup.ts`, `src/test/css.ts`, `src/styles/base.css`, `components/index.ts` and the Vitest configuration of the package. The page-wide rules are in `base.css` (Table J); no group 2 file repeats them.
  - Plan changes: TOKI-013 needs TOKI-012 (it relies on the shared files above), and its need on TOKI-018 can go, because nothing in it calls `platform`; the plan lists only TOKI-009 and TOKI-018 for both. TOKI-012 also needs TOKI-002, TOKI-010 and TOKI-011 (concern 5). Further plan changes are in the ownership tables below and in concern 9.
- Prototype pieces that sit between the groups, each given one owner (a piece that is not built is listed with the reason):

| Prototype piece | Owner | Why |
| :---- | :---- | :---- |
| `.btn` (default, primary, danger, ghost, small, wide) and `.linkbtn` | Button (this ticket) | Named in the ticket. `.linkbtn` is the text-looking button that sign-in needs ('Use a different email'), so it is a variant of Button |
| `.btn.live` | Not built | Its uses are Meet (D-006, phase 4) |
| `.ib` (normal, small, on) | IconButton (this ticket) | Named in the ticket. The stage variants (`.ib.mutedb`, `.cpanel .ib`) belong to Meet; the message action bar sizes (`.acts .ib`) belong to the message action bar (TOKI-052) |
| `.chip`, `.chips` | Chip, ChipGroup (this ticket) | The filter chips and the preset chips |
| `.rx` (reaction chip), the person chip of the people picker, the mention chip in a message | TOKI-046 (Reactions), TOKI-034 (picker), TOKI-050 (Mentions) | TOKI-034 builds its `PersonChip` as a component of `packages/ui-web` (folder `components/PersonChip/`, one line in `components/index.ts`, one entry in `src/examples.ts`, R31); this ticket adds nothing for it. They have their own size, content and remove or long-press behaviour, so they are not variants of Chip |
| `.sw` | Switch (this ticket) | Named in the ticket |
| `.seg` (segmented buttons: list or grid in Files, Density in Preferences, line 1650), `.sw-acc` (accent swatches), `.lookcards` (the Look choice in Preferences) | TOKI-063 builds the first `.seg` (Files list and grid); TOKI-078 (Preferences) reuses it and builds the swatches and look cards | Not in either group. A segmented control is a row of pressed-state buttons, so it can use Button. The `.seg` for Look on the demo bar (line 2057) never ships (D-145) |
| `.sel`, `.inp`, `.lbl`, `.field` | Select and Field (this ticket) | Named in the ticket |
| `.gerr` (error box) | Field and Select (this ticket) | The only error look the prototype draws; D-104 puts the error under the field |
| Native checkbox and radio (`.opt`, `.ck`, the Later rows) | Not built; TOKI-067 (Later checkbox) and TOKI-035 (notification level radios) use the native control | The prototype styles only the row around them |
| `.tag` | Tag (this ticket) | Named in the ticket. TOKI-079 uses it for the Admin label and TOKI-034 for the 'Archived' label of Browse channels; the prototype draws no Archived label, so that label has the one look of Tag (the word is the screen's) |
| `.tag.guest` | Not built | Guest is phase 5 (D-152) |
| `.cnt`, `.cnt.mute`, `.cnt.mn` | Badge (this ticket) | Named in the ticket. The position of a badge on a navigation item (`.ni .cnt`, `.nt .cnt`) belongs to the app shell (TOKI-015) |
| `.pill`, `.pill.idea`, `.offpill`, `.guestpill` | Not built | Used by the Calendar (phase 4), as the 'New' mark of proposed features (D-146) and by `.offpill` and `.guestpill` on the demo bar (lines 2060-2061; D-145 names the Look, Device, Clock, Guide and Reset controls of that bar, so that these two are demo-only is an inference); none ships in phase 1 |
| `.pd` (presence dot) | PresenceDot (TOKI-013) | Named in group 2 |
| `.kbd` (key hint), `.draft`, `.waiting`, `.srch` | TOKI-071 (palette), TOKI-051 (drafts), TOKI-042 (message states), TOKI-015 (search box) | Each belongs to the screen part that draws it |
| `.menu button` (menu item) | TOKI-014 (Menu) | A menu item is not a Button: it has its own focus and arrow-key behaviour |

- Prototype pieces that neither group draws and that the plan does not name. Decided in this spec: each has one owner, so that no ticket assumes group 1 or group 2 has it and no two tickets copy the same CSS. An owner is a ticket of the plan whose scope fits, or "later" (not built in phase 1). Where the owner is built after another ticket that uses the piece, the second ticket needs the first (plan change).

| Piece (prototype lines) | Used for | Owner | Why |
| :---- | :---- | :---- | :---- |
| `.strip`, `.strip.pause`, `.strip.off`, `.strip .btn` (224-226, 632) | The offline strip, the Pause and Focus strip, the update strip (lines 1269-1271) | TOKI-082 (Extra states) | It builds the offline strip and is the first ticket that needs the family. Plan change: TOKI-076 (pause strip) and TOKI-104 (update strip) need TOKI-082. The rule `.strip .btn` is a rule on Button (24 px, transparent) and belongs with `.strip` |
| `.banner`, `.banner.live`, `.banner.guest` (221-223, 633-634) | 'Meet in progress' and 'This channel has guests' (lines 1292-1293) | Later | Meet (phase 4) and guests (phase 5) only; the plain `.banner` has no phase 1 use. The offline notice of TOKI-082 is the `.strip` above |
| `.tabs`, `.tab` (215-218, 532) | The tab row of a conversation (line 1296) | TOKI-015 (AppShell) | Its plan line names 'the tab row'. `.tab` is in the 40 px rule of line 538, so the narrow rule goes with it |
| `.card`, `.fic` (276, 279-281) | Attachment cards, file rows (lines 1378-1391, 1583) | TOKI-062 (Attachment cards) | File, image and link cards. TOKI-063 (Files tab, needs TOKI-062) reuses `.fic` |
| `.fchip` (324) | A file waiting in the composer (line 1406) | TOKI-059 (Attachments in the composer) | The only use |
| `.lnk` (254) | A link in message text and in a link card (lines 1153, 1380) | TOKI-049 (Text formatting) | Links in messages. Plan change: TOKI-062 needs TOKI-049 for the link card |
| `.tlink` (263-266) | The thread link under a message (line 1368) | TOKI-045 (Threads) | The only use |
| `.copyrow` (660-661) | 'Email this channel' and the calendar feed (lines 1446, 1886) | Later | Neither is in phase 1 (no invite link: invitations go by email, TOKI-024) |
| `.note` (702-703) | The note in the guest invite dialog (line 2035) | Later | Guest is phase 5 (D-152) |

  Any other class of the prototype that appears in no table of either spec is carried over by the screen ticket that draws it.

- Out (not now):
  - Avatar, PresenceDot, EmptyState and Toast (TOKI-013); Menu, Modal and Sheet (TOKI-014); the app shell, the navigation, `#root`, `--tabh` and the position of a badge on a tab (TOKI-015); the preview page (TOKI-016); every screen.
  - The body text size of narrow screens (`body,.device{font-size:15px}`, line 503, inside the container block that opens at line 502): TOKI-015's, which defines what narrow means (concern 8). `base.css` keeps 14 px (Table J).
  - The utility classes of the prototype (`.muted`, `.sm`, `.xs`, `.grow`, `.row`, `.ell`, `.scroll`, `.title`, `.disp`, `.mono`): not part of a base component. The first ticket whose markup needs one adds it to `src/styles/utilities.css`, which this ticket does not create. TOKI-015 is expected to be first.
  - The three `font-family` lines that name a family (`.disp`, `.mono`, titles): the ticket that adds the class. This ticket writes the family only where its own components need it (Badge and the code field, both JetBrains Mono).
  - Any text. A label, a placeholder, an error message or a count is given by the screen through i18n (TOKI-017); the base components add none.
  - Date and time inputs, pickers and their checks: `packages/shared` (TOKI-094) holds the rules, and no phase 1 screen has a typed date field. Field passes `type="date"` and `type="time"` through like any other type and adds nothing.
  - Tooltips. See concern 3.
  - `packages/ui-native` and any React Native version of these components: phase 3.
  - The hiding of row actions until hover (the prototype's `.item .ib{opacity:0}`): not carried over; see Design, "No hover-only".

## Requirements
- R1. `@toki/ui-web` exports at least these components (group 2 adds its own, Scope), each as a named export of `packages/ui-web/src/components/<Name>/` and re-exported by `src/components/index.ts` and `src/index.ts`: `Button`, `IconButton`, `Chip`, `ChipGroup`, `Switch`, `Field`, `Select`, `Tag`, `Badge`. Each folder holds `<Name>.tsx`, `<Name>.css`, `<Name>.test.tsx`, `<Name>.examples.tsx` and `index.ts`, with two exceptions: `ChipGroup` lives in the folder `Chip/` and its one rule is in `Chip.css`, and `Select` has no CSS file of its own and imports `Field.css`. The test of R1 checks that each of these names, and the constants and types that R2 names, is exported, and that no export of the package ends in `Icon` except those of TOKI-011 (R16 of that spec); it does not require that nothing else is exported.
- R2. Every component follows one prop convention. (a) `variant` and `size` are string unions; the exported constants list their values in this order: `buttonVariants` (R10), `buttonSizes`, `iconButtonSizes`, `chipSizes` (`md`, `sm`), `fieldVariants` (R15) and `badgeVariants` (R20). (b) A state prop has the name of the attribute it sets. (c) Every component accepts `className`, added after the component's own classes, and a `ref` (through `forwardRef`) that points at the element named in the last column of Table B; every component of both groups does the same (Scope). (d) Every other attribute of the underlying element passes through, except the ones the component owns; the owned attributes are applied after the spread, so a caller cannot replace them even by a cast. The one exception is the `type` of `Button`, which is a prop (R10) and is placed before the spread. The props types of `IconButton`, `Chip` and `Switch` omit `type`, and `SwitchProps` omits the native `onChange` and `onClick` too, because the component owns the click and `Switch.onChange(checked)` has another signature. (e) The props types are exported (`ButtonProps`, `IconButtonProps`, `ChipProps`, `ChipGroupProps`, `SwitchProps`, `FieldProps`, `SelectProps`, `TagProps`, `BadgeProps`).
- R3. No component source file under `src/components` holds a word of its own: the text a component outputs is only what it receives in its props and children. Rendering each component with no text props and no children gives `textContent` equal to the empty string, and no source file (test and examples files excepted) imports `@toki/i18n`.
- R4. Each component renders the element, classes and attributes of Table B, and a class is present only when its prop asks for it. The class names are the prototype's.
- R5. Each CSS file of Tables C to H holds exactly the selectors of its table, with exactly the declarations listed (value for value, in any order and any white space), and no other rule except the media block of R8. Each component's `.tsx` imports its own CSS file. The `sideEffects` setting of `ui-web` (TOKI-011 R11) keeps the CSS.
- R6. The CSS of the eight components uses only the design system's names and values. (a) A colour is always `var(--…)` and never a literal: the check fails on `#`, `rgb(`, `rgba(`, `hsl(`, `hsla(`, `color-mix(` and a named colour; the word `transparent` is allowed, because Tables C and E use it. (b) Every `var(--name)` names one of the 32 properties of `tokens.css` (TOKI-009 R10). (c) No file uses `--row`, `--gap` or `--av`: none of the eight components changes with density. (d) No selector contains `data-eff`, `data-look`, `data-accent` or `data-density`: Calm and Focus differ only through the tokens. (e) A `font-family` appears only in `.cnt` and `.inp.code`, with the value of Tables G and H.
- R7. Nothing is hover-only (D-067). In the CSS of the eight components, every `:hover` rule declares only some of `background`, `color`, `border-color` and `filter`; no rule sets `opacity: 0`, `visibility: hidden` or `display: none` on a component; and no component reads `title` or `onMouseEnter` for anything that a touch screen needs.
- R8. At a viewport width of 719 px or less, every control is at least 40 px tall (journey F38, accepted as the baseline in D-091). Each CSS file holds one `@media (max-width: 719px)` block with the declarations of Table I for its selectors. Only a width of 720 px or more shows the normal sizes. Two limits, both in concern 2: a `Switch` keeps its drawn height and gets a 40 px touch area, and a link button (`variant="link"`) stays inline text, so that a link in a sentence does not change the height of its line.
- R9. `packages/ui-web/src/styles/base.css` holds exactly the rules of Table J. `packages/ui-web/package.json` adds the `exports` entry `"./base.css": "./src/styles/base.css"` and `"./examples": "./src/examples.ts"` beside the existing `"."`. `src/index.ts` imports no CSS file other than through the components, so importing `@toki/ui-web` does not load `base.css` by itself.
- R10. `Button` renders a `button` with `type="button"` unless the caller passes the prop `type` (the sign-in forms pass `type="submit"`). `variant` is one of `default`, `primary`, `danger`, `ghost`, `link` (default `default`); `type` is `button`, `submit` or `reset` (default `button`) and is a prop, the one attribute of Button's own that the caller sets; `size` is `md` or `sm` (default `md`); `fullWidth` adds `wide`. `disabled` sets the `disabled` attribute and the control receives no click. Children are free: text, an icon, or both. Passing `size` or `fullWidth` together with `variant="link"` is a type error.
- R11. `Button` with `variant="link"` renders the class `linkbtn` and not `btn`, as the prototype's `.linkbtn` does, with no height, border or padding. A `disabled` link button looks as Table F says and is skipped by the Tab key.
- R12. `IconButton` takes `icon` (an `IconName` of TOKI-011) and `label` (a string), both required, and renders one `button` with `type="button"`, `aria-label` equal to `label`, and one `Icon` of `icon` as its only child. `size` is `md` or `sm`. `pressed` set to `true` or `false` sets `aria-pressed` to that value, and `true` adds the class `on`; when `pressed` is left out there is no `aria-pressed`. The component sets no `title`. `label` is the only name: an `aria-label` passed by the caller is a type error.
- R13. `Chip` renders a `button` with `type="button"`; `pressed` sets `aria-pressed` as in R12 and adds no class: the chip is styled through `aria-pressed="true"` only (no markup of the prototype emits `chip on`); `size` is `md` or `sm`. `ChipGroup` renders a `div` with the class `chips` and `role="group"` and takes `aria-label` or `aria-labelledby` as an optional pass-through.
- R14. `Switch` renders a `button` with `type="button"`, `role="switch"`, `aria-checked` equal to `checked`, and no children. `checked` is required. A name is required in one of two forms: `label` (becomes `aria-label`) or `labelledBy` (becomes `aria-labelledby`); a `Switch` with neither is a type error. A click calls `onChange(!checked)` once; `SwitchProps` has no native `onChange` or `onClick` (R2 d). With `disabled` nothing is called. The component holds no state: `checked` is always the caller's.
- R15. `Field` has the prop `variant`, one of `default`, `code` and `search` (the exported `fieldVariants`; default `default`), and renders in one of three forms. (a) With `label` and `variant` `default` or `code`: a `label` with the class `lbl` and `htmlFor` set to the id of the control, then an `input` (or a `textarea` when `multiline` is `true`) with the class `inp`; `variant="code"` adds the class `code`. (b) With `variant="search"`: a `label` with the class `field` that wraps an optional `Icon` (the prop `icon`, an `IconName`) and an `input`, named by `aria-label` or `aria-labelledby`, with no `label` prop. The prototype has five of these boxes, three with an icon (the conversation search, Files, People) and two without (the people picker, line 2142, TOKI-034; Browse channels, line 2158, TOKI-034). (c) With no visible label, `variant` `default` or `code`, and `aria-label` or `aria-labelledby`: the control of form (a) alone, with no `label` element: an `input.inp` or, with `multiline`, a `textarea.inp`. The prototype has it for the custom status input (lines 1653 and 2152, TOKI-056) and for the textarea of Edit message (line 1361, `aria-label="Edit message"`, TOKI-047). The type system accepts these three forms only: a `Field` with neither a visible `label` nor an `aria-label` or `aria-labelledby` is a type error, and so are `label` together with `variant="search"`, `multiline` together with `variant="search"`, and `icon` without `variant="search"`. The id comes from `useId` unless the caller passes `id`. Every other attribute of the control (`type`, `value`, `onChange`, `placeholder`, `maxLength`, `inputMode`, `autoComplete`, `readOnly`, `disabled`, `rows`) passes through, and `ref` points at the control. A textarea that grows with its text (the prototype's `autogrow`) is the screen's: Field adds no script.
- R16. `Select` takes `options`, an array of `{ value, label, disabled? }`, and renders a `select` with the class `sel` holding one `option` for each. `fullWidth` adds `wide`. `label` renders a `label` with the class `lbl` before it, linked as in R15 (a); without `label` an `aria-label` or `aria-labelledby` is required. `value`, `defaultValue`, `onChange` (the native change event), `disabled` and `ref` pass through to the `select`. The control is the browser's own `select`.
- R17. `error` (a string) on `Field` or `Select` renders, directly after the control and its label, one `div` with the class `gerr`, `role="alert"` and the id `<id>-error` (where `<id>` is the id of the control, R15), holding the string; the control gets `aria-invalid="true"`, `aria-describedby` that lists the error id (after any `aria-describedby` the caller passed) and the class `invalid` (on the `label.field` in form (b)). An `error` that is missing, empty or only white space renders nothing and sets none of these. A new `error` replaces the old one; there is never more than one message under a field (D-104). Decided in this spec: `error` is a string and not a node, and the box holds nothing else. `Field` and `Select` return a fragment, so a screen that needs a button beside the message (the sign-in step 'Send a new code', TOKI-023 R18) renders its own `Button` as the next sibling after the field, and a text that changes (the countdown of TOKI-023 R19) is a new `error` string; the `role="alert"` box is the live region, and `<id>-error` lets the screen refer to the message.
- R18. A `disabled` field or select is dimmed and shows `cursor: not-allowed`; a `readOnly` field has the `surface-2` background; both are set as in Table H and can be focused or not as the browser does for the attribute. `disabled` on form (b) (`variant="search"`) adds the class `disabled` and `readOnly` adds the class `readonly` to the label.
- R19. `Tag` renders a `span` with the class `tag` around its children and nothing else; the capitals come from CSS (`text-transform: uppercase`), not from the text.
- R20. `Badge` renders a `span` with the class `cnt`; `variant` is `default`, `mute` (class `mute`) or `mention` (class `mn`). The visible content is `children`, shown as given: no cap, no grouping, and no hiding of `0` (concern 4). With `label` the visible content is `aria-hidden="true"` and a `span` with the class `sr` holds the label, so a screen reader reads the label and not the digits; without `label` the content is read as it is. `Badge.css` holds its own `.cnt .sr` rule (Table G), so the label stays hidden for a consumer that imports only the package and not `base.css` (R9).
- R21. Keyboard and focus. Every component that takes input is a native control (`button`, `input`, `textarea`, `select`) and so is in the Tab order and is skipped when `disabled`. A `Switch`, a `Chip`, a `Button` and an `IconButton` act on Space and Enter. A `Field` or `Select` shows the focus look of Table H, and every other control shows the `:focus-visible` outline of Table J. No component sets `tabindex`, and none sets `outline: none` except the controls that Table H gives a focus ring instead, and except the overlays (TOKI-014): the dialog panel and each menu item set `tabindex="-1"` (roving focus and focus held by the layer), and the dialog panel sets `outline:0` on `:focus-visible` (TOKI-014 R5, R18, Table A). The checks of this requirement cover the components of groups 1 and 2 and not the folders `Menu/`, `Modal/` and `Sheet/`. These Table H rules win over the shared `:focus-visible` rule of Table J only if `base.css` is loaded first (R29).
- R22. The ESLint configuration of TOKI-002 holds the rule `toki/icon-only-button-name`. It reports a JSX element that is a button and holds only icons, when it has no name. A button is the host element `button`, or an element whose local name is bound by an import of `Button` (the imported name, whatever the local name) from `@toki/ui-web` or from a relative path that resolves into `packages/ui-web/src`. An icon is an element whose local name is bound by an import of `Icon`, or of a name ending in `Icon`, from the same sources (R16 of TOKI-011), under another local name (`import { XIcon as Close }`) too, and a member of a namespace import (`<Icons.XIcon />`). A child is an icon child when it is an icon, or a conditional that is an icon child itself: `a ? b : c` whose two branches are each an icon, `null` or `false` with at least one icon, or `a && b` whose right side `b` is an icon (the left side is a condition, not a branch; `a || b` and `a ?? b` are not icon children, because their left side may be text). "Holds only icons" means: at least one child is an icon child, and every other child is white space, an element of a lower-case tag or a fragment that itself holds only icons, or an icon child. Any other child (text, a string, a call, a component that is not an icon) is possible text, and the button is not reported. A name is an `aria-label` or `aria-labelledby` attribute whose value is not an empty or white-space string literal; an attribute with an expression value counts as a name. A spread attribute counts as possibly carrying a name. `title` is not a name.
- R23. The same rule reports an element whose local name is bound by an import of `IconButton` from `@toki/ui-web` (or from a relative path into `packages/ui-web/src`) that has no `label` attribute, or whose `label` is an empty or white-space string literal, unless it has a spread attribute. The message names the rule and says to add `aria-label`, `aria-labelledby` or `label`.
- R24. The rule is set at severity `error` for the non-test `.tsx` files of `packages/ui-web/src` and `apps/web/src`, in one block of `eslint.config.js` that also switches inline configuration off, as TOKI-002 R16 does for its three rules: an `eslint-disable` comment in these files has no effect and is itself reported (the cost is in concern 18). The rule is a local plugin, `tools/eslint-rules/index.js`, registered under the name `toki`. `pnpm lint` exits non-zero when the rule reports.
- R25. `tools/lint-fixtures/icon-button-name/` holds `violates.tsx`, `allowed.tsx` and `disabled.tsx`, and `tools/lint-fixtures/check.mjs` (TOKI-002 R11) runs them: every line of Table K marked as violating is reported by `toki/icon-only-button-name`, the file has no other report, `allowed.tsx` has none, and `disabled.tsx` still reports its line and reports the disable comment. Table K has 36 cases, 21 violating and 15 allowed, and gives one for each case that R22 and R23 define. The check also proves, in the list of real paths that TOKI-002 R15 keeps, that the configuration computed for `packages/ui-web/src/components/IconButton/IconButton.tsx` and for `apps/web/src/main.tsx` (a file need not exist) holds the rule at `error` with inline configuration off. `pnpm lint:boundaries` runs it, and exits non-zero and names the fixture and the line when a case is not reported or the block is removed. What this changes in TOKI-002 is listed in Design, "The lint rule".
- R26. Each `<Name>.examples.tsx` exports `examples`, a list of `Example` (`{ id: string, title: string, element: ReactElement }`, the type of `src/internal/example.ts`, which group 2 uses too). Together the examples of a component show every value of its `variant` and `size` lists (R2), each state of its state props (`disabled`, `pressed` true and false, `checked` true and false, `error`, `readOnly`), and the three forms of R15 (the search box with and without an icon, the input without a visible label, the textarea). They also show nine items that the preview page checks by selector (TOKI-016 R8, Table B2): a `Button` with an icon next to its text (`.btn .ic`), a `Button` with `fullWidth` (`.btn.wide`), a disabled link button (`.linkbtn[disabled]`), a `Select` with `fullWidth` (`.sel.wide`), a `Select` with a `label` (`.lbl + .sel`), a `Badge` with `label` (`.cnt .sr`), and the search form of R15 (b) with `error`, with `readOnly` and with `disabled` (`.field.invalid`, `.field.readonly`, `.field.disabled`). The `id`s are unique within a component. `src/examples.ts` exports `componentExamples`, a list of `{ component: string, examples: Example[] }`. It holds at least one entry for each of the eight components of this group, in the order Button, IconButton, Chip, Switch, Field, Select, Tag, Badge (the examples of `ChipGroup` are in the Chip entry), and after them the entries of group 2. No file under `src/` other than `examples.ts` and the examples files imports an examples file. A test fails when a value of a list in R2 has no example in the entry of its component, or when one of the nine selectors above matches nothing in the rendered examples of its component.
- R27. `pnpm --filter @toki/ui-web test` runs the tests of the package and exits 0. The package's Vitest configuration uses the `jsdom` environment for every file (`globals` stays off) and the setup file `src/test/setup.ts`. The setup file imports `@testing-library/jest-dom/vitest`, calls `cleanup` from `@testing-library/react` in an `afterEach`, and sets `globalThis.IS_REACT_ACT_ENVIRONMENT` to `true` (with Vitest's `globals` off, Testing Library registers neither its cleanup nor the act flag itself). `src/test/css.ts` exports `readCss(path)`, which parses a CSS file with `postcss` and returns its rules as `{ selector, media, declarations }`, with the property names as written and the values trimmed, so that a CSS test compares declarations and not text. The tests use `@testing-library/react`, `@testing-library/user-event` and `@testing-library/jest-dom`. These three packages, `@testing-library/dom` (the peer dependency of the first two) and `postcss`, and `jsdom`, are `devDependencies` of `ui-web`, each pinned to one exact version; `jsdom` has the version that `packages/platform` pins (TOKI-018), and Vitest the one that `packages/tokens` and the icon work use, so that the workspace holds one version of each. If `packages/platform` does not exist when this is built, this ticket pins `jsdom` and TOKI-018 uses the same version. The icon tests of TOKI-011 still pass under this configuration. A test renders a component in two tests in a row and finds it once with `getByRole` (proof that `cleanup` runs).
- R28. `packages/ui-web/src/components` and `src/styles` import nothing from `@toki/platform`, `@toki/i18n`, `@toki/tokens`, `@toki/client-core` or `@toki/shared`, and use none of the APIs that TOKI-002 R9 bans. `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check` and `pnpm typecheck` exit 0 with the new files.
- R29. `apps/web/package.json` lists `@toki/tokens` and `@toki/ui-web` under `dependencies`, in the form TOKI-001 uses for workspace packages. `apps/web/src/main.tsx` imports, after the `fonts.css` import of TOKI-010, `@toki/tokens/tokens.css` and then `@toki/ui-web/base.css`, and these three imports come before every import of the router, of the app and of `@toki/ui-web` itself, so that `base.css` is the first style sheet that can reach a component (its `:focus-visible` rule must lose to Table H and to the component classes, which have the same specificity and win by coming later). A test in `packages/ui-web/src/styles/order.test.ts` reads `apps/web/src/main.tsx` as text and fails when a non-CSS import precedes one of the three. No other file of `apps/web` changes. `pnpm --filter ./apps/web build` (which runs `check:fonts`) and `pnpm --filter ./apps/web typecheck` still exit 0, and the initial JavaScript is still under the limit of TOKI-006 R10.
- R30. The prop types turn the mistakes of the rules above into type errors that `pnpm typecheck` finds, and the tests mark each with `// @ts-expect-error`: `IconButton` without `label`; `IconButton` with `aria-label`; `Switch` with neither `label` nor `labelledBy`; `Field` with neither `label` nor `aria-label`; `Field` with `variant="search"` and `label`; `Field` with `icon` and no `variant="search"`; `Field` with `multiline` and `variant="search"`; `Button` with `variant="link"` and `size`; `Button` with `type="loud"`; `Switch` with the native `onChange`; `Badge` with `variant="loud"`; `Button` with `variant="live"`.
- R31. Adding a component to `ui-web` takes its folder (R1), one line in `components/index.ts`, and one import and one entry in `src/examples.ts`, and no other shared file. A test lists the folders of `src/components` and fails when a folder has no line in `components/index.ts`, no `<Name>.examples.tsx`, or no entry in `componentExamples` (`ChipGroup` lives in `Chip/` and has no folder of its own).

## Contract for TOKI-013
What TOKI-013 relies on in this spec, one line each (the statements are in Scope, "Decided in this spec"):
1. Folder layout, and who creates `components/index.ts` and the `src/index.ts` line (R1, R31): this ticket; TOKI-013 adds four folders and four lines.
2. `forwardRef` on every component of both groups, owned attributes after the spread (R2 c, d).
3. Handlers keep native names; the two exceptions are `Switch.onChange` and Toast's `action.onPress` (the overlays of TOKI-014 state their own, Scope).
4. No text in a component (R3); no look selector unless the prototype has one that tokens cannot replace (R6 d).
5. Every control at least 40 px tall at 719 px and below (R8), the Toast button too.
6. Test set-up: jsdom package-wide, Testing Library with `@testing-library/dom`, `setup.ts` with cleanup and the act flag, `src/test/css.ts` with `readCss`, `jsdom` and Vitest at the workspace's versions (R27); TOKI-013 adds no dependency.
7. `Example`, `componentExamples` and how an entry is added; the preview page imports `@toki/ui-web/examples` (R26, R31).
8. The export lists are "at least" (R1, R26): TOKI-013 adds its names and entries without a change to this ticket's tests.
9. Plan: TOKI-013 needs TOKI-012 and does not need TOKI-018; the base rules (`*`, the button reset, `:focus-visible`, `.sr`, reduced motion) are in `base.css` and are not repeated (R9).


## Design
### Source of the values
Every size, colour and state comes from the prototype's style sheet (`docs/blueprint/prototype/index.html` of the Toki Blueprint; the line numbers below are those of that file). Where the prototype draws nothing, the row says "Decided in this spec" (D-019 leaves it to Claude). Copy the declarations, with the same white space or not; the tests compare declarations, not text.

Table A. What the prototype uses and what is built.

| Component | Prototype class | Variants and sizes in phase 1 | Left out, with the reason |
| :---- | :---- | :---- | :---- |
| Button | `.btn` (82-93), `.linkbtn` (309) | default, primary, danger, ghost, link; md 34 px, sm 28 px; wide 40 px | live (Meet, D-006) |
| IconButton | `.ib` (94-97) | md 34 px, sm 28 px, on | mutedb (Meet) |
| Chip | `.chip` (98-100), `.chips` (101) | md 28 px, sm 26 px (the conversation filter, line 185); pressed | none |
| Switch | `.sw` (338-341) | off, on | none |
| Field | `.inp` (345-347), `.lbl` (348), `.field` (186-189), `.inp.code` (715) | text and textarea with a label or with a name only; code; search with or without an icon | none |
| Select | `.sel` (344), `.sel.wide` (701) | normal, wide | none |
| Tag | `.tag` (121) | one look | guest (phase 5, D-152) |
| Badge | `.cnt` (102-104, 586) | default, mute, mention | none |

Table B. Props, element and classes.

| Component | Element | Classes, in order | Owned attributes | `ref` points at |
| :---- | :---- | :---- | :---- | :---- |
| `Button` | `button` | `btn`, then `primary`, `danger` or `ghost`, then `sm`, then `wide`, then `className`. `variant="link"`: `linkbtn`, then `className` | none; `type` is a prop (default `button`), placed before the spread | the `button` |
| `IconButton` | `button` | `ib`, then `sm`, then `on`, then `className`; child `Icon` | `type`, `aria-label`, `aria-pressed` | the `button` |
| `Chip` | `button` | `chip`, then `sm`, then `className` | `type`, `aria-pressed` | the `button` |
| `ChipGroup` | `div` | `chips`, then `className` | `role="group"` | the `div` |
| `Switch` | `button` | `sw`, then `className` | `type`, `role="switch"`, `aria-checked`, `aria-label` or `aria-labelledby`, `onClick` | the `button` |
| `Field`, form (a) | `label.lbl` + `input.inp` or `textarea.inp` | `inp`, then `code`, then `invalid`, then `className` | `id`, `aria-invalid`, `aria-describedby` | the `input` or `textarea` |
| `Field`, form (b) (`variant="search"`) | `label.field` > optional `Icon` + `input` | `field`, then `invalid`, `disabled`, `readonly`, then `className` (on the label) | `id` on the input, `aria-invalid`, `aria-describedby` | the `input` |
| `Field`, form (c) | `input.inp` or `textarea.inp` alone | as form (a) | as form (a) | the `input` or `textarea` |
| `Select` | `label.lbl` + `select.sel` | `sel`, then `wide`, then `invalid`, then `className` | `id`, `aria-invalid`, `aria-describedby` | the `select` |
| error | `div` | `gerr` | `id` (`<id>-error`), `role="alert"` | not a component |
| `Tag` | `span` | `tag`, then `className` | none | the `span` |
| `Badge` | `span` | `cnt`, then `mute` or `mn`, then `className`; with `label`, an inner `span.sr` | none | the outer `span` |

The exported value lists, in order, are in R2: `buttonVariants` and the other lists take their values from R10, R15 and R20.

Tables C to H. The CSS of each file. A `Source` of a number is a line of the prototype; "decided" is a rule the prototype does not have.

Table C. `Button.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.btn` | `display:inline-flex; align-items:center; gap:7px; padding:0 14px; height:34px; border-radius:var(--radius-sm); font-weight:600; border:1px solid var(--line); background:var(--surface); color:var(--ink); white-space:nowrap; transition:background .15s,border-color .15s,transform .1s` | 82 |
| `.btn:hover:where(:not([disabled]))` | `background:var(--hover); border-color:var(--muted)` | 83; the `:where(:not([disabled]))` is decided (a disabled button must not look pressable) and adds no specificity |
| `.btn:active:where(:not([disabled]))` | `transform:translateY(1px)` | 84; decided as above |
| `.btn.primary` | `background:var(--accent); color:var(--on-accent); border-color:var(--accent)` | 85 |
| `.btn.primary:hover:where(:not([disabled]))` | `filter:brightness(1.07); background:var(--accent)` | 86 |
| `.btn.danger` | `background:var(--danger); color:var(--surface); border-color:var(--danger)` | 87 |
| `.btn.danger:hover:where(:not([disabled]))` | `background:var(--danger); filter:brightness(1.08)` | 88 |
| `.btn.ghost` | `border-color:transparent; background:transparent` | 90 |
| `.btn.ghost:hover:where(:not([disabled]))` | `background:var(--hover)` | 91 |
| `.btn.sm` | `height:28px; padding:0 10px; font-size:12.5px` | 92 |
| `.btn.wide` | `width:100%; justify-content:center; margin-top:14px; height:40px` | 714 |
| `.btn[disabled]` | `opacity:.5; cursor:not-allowed` | 93 |
| `.linkbtn` | `color:var(--accent-text); font-weight:600; text-decoration:underline; text-underline-offset:2px; font-size:12.5px; display:inline` | 309 |
| `.linkbtn[disabled]` | `opacity:.5; cursor:not-allowed` | decided: the sign-in steps disable the link while a request runs |

Table D. `IconButton.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.ib` | `display:inline-grid; place-items:center; width:34px; height:34px; border-radius:var(--radius-sm); color:var(--ink-2); transition:background .15s,color .15s` | 94 |
| `.ib:hover:where(:not([disabled]))` | `background:var(--hover); color:var(--ink)` | 95; `:where` decided as in Table C |
| `.ib.on` | `background:var(--accent-soft); color:var(--accent-text)` | 96 |
| `.ib.sm` | `width:28px; height:28px` | 97 |
| `.ib[disabled]` | `opacity:.5; cursor:not-allowed` | decided, as `.btn[disabled]` |

Table E. `Chip.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.chip` | `display:inline-flex; align-items:center; gap:6px; height:28px; padding:0 12px; border-radius:99px; font-size:12.5px; font-weight:500; color:var(--ink-2); border:1px solid var(--line); background:var(--surface); transition:background .15s,color .15s,border-color .15s; white-space:nowrap` | 98 |
| `.chip:hover:where(:not([disabled]))` | `background:var(--hover)` | 99; `:where` decided |
| `.chip[aria-pressed="true"]` | `background:var(--accent-soft); color:var(--accent-text); border-color:transparent` | 100; the prototype's `.chip.on` is left out, because no markup of the prototype emits it and Chip adds no class for `pressed` (R13) |
| `.chip.sm` | `height:26px` | 185 (`.cfilter .chip`), made a size so that the component, not its place, decides |
| `.chip[disabled]` | `opacity:.5; cursor:not-allowed` | decided |
| `.chips` | `display:flex; gap:6px; flex-wrap:wrap` | 101 |

Table F. `Switch.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.sw` | `position:relative; width:38px; height:22px; border-radius:99px; background:var(--line); flex:none; transition:background .15s; cursor:pointer` | 338 |
| `.sw::after` | `content:""; position:absolute; left:3px; top:3px; width:16px; height:16px; border-radius:50%; background:var(--surface); transition:transform .15s` | 339 |
| `.sw[aria-checked="true"]` | `background:var(--accent)` | 340 |
| `.sw[aria-checked="true"]::after` | `transform:translateX(16px); background:var(--on-accent)` | 341 |
| `.sw[disabled]` | `opacity:.5; cursor:not-allowed` | decided |

Table G. `Badge.css` and `Tag.css`.

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.cnt` | `font-family:"JetBrains Mono",monospace; font-size:11px; font-weight:600; background:var(--accent); color:var(--on-accent); border-radius:99px; min-width:18px; height:18px; padding:0 5px; display:inline-grid; place-items:center; font-variant-numeric:tabular-nums; line-height:1` | 102, 586 |
| `.cnt.mute` | `background:var(--hover); color:var(--ink-2)` | 103 |
| `.cnt.mn` | `background:var(--danger); color:var(--surface)` | 104 |
| `.cnt .sr` | `position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0)` | decided: the same declarations as `.sr` of Table J, so that a Badge with `label` stays correct when `base.css` is not loaded (R20) |
| `.tag` | `font-size:10.5px; font-weight:600; border-radius:5px; padding:0 6px; background:var(--hover); color:var(--ink-2); text-transform:uppercase; letter-spacing:.04em; line-height:17px; display:inline-block` | 121 |

Table H. `Field.css` (also used by `Select`, which imports it).

| Selector | Declarations | Source |
| :---- | :---- | :---- |
| `.lbl` | `display:block; font-size:12px; font-weight:600; color:var(--ink-2); margin:12px 0 4px` | 348 |
| `.inp` | `height:36px; width:100%; border:1px solid var(--line); border-radius:var(--radius-sm); background:var(--surface); padding:0 10px; color:var(--ink); outline:0` | 345 |
| `.inp:focus, .sel:focus, textarea.inp:focus` | `border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft)` | 346 |
| `textarea.inp` | `height:auto; padding:8px 10px; resize:vertical` | 347 |
| `.inp.code` | `font-family:"JetBrains Mono",monospace; font-size:20px; letter-spacing:.4em; height:46px; text-align:center` | 715 |
| `.inp::placeholder` | `color:var(--muted)` | decided (the prototype sets it for `.field` only, 189; the browser default is not themed) |
| `.sel` | `height:34px; border:1px solid var(--line); border-radius:var(--radius-sm); background:var(--surface); padding:0 10px; color:var(--ink)` | 344 |
| `.sel.wide` | `width:100%` | 701 |
| `.field` | `display:flex; align-items:center; gap:8px; height:36px; border:1px solid var(--line); background:var(--surface); border-radius:var(--radius-sm); padding:0 10px; color:var(--muted); transition:border-color .15s,box-shadow .15s` | 186 |
| `.field:focus-within` | `border-color:var(--accent); box-shadow:0 0 0 3px var(--accent-soft)` | 187 |
| `.field input` | `flex:1; min-width:0; border:0; background:transparent; outline:0; color:var(--ink)` | 188 |
| `.field input::placeholder` | `color:var(--muted)` | 189 |
| `.gerr` | `margin-top:12px; padding:8px 10px; border-radius:var(--radius-sm); background:var(--danger-soft); color:var(--danger); font-size:12.5px` | 716 |
| `.inp.invalid, .sel.invalid, .field.invalid` | `border-color:var(--danger)` | decided |
| `.inp.invalid:focus, .sel.invalid:focus, .field.invalid:focus-within` | `border-color:var(--danger); box-shadow:0 0 0 3px var(--danger-soft)` | decided |
| `.inp[disabled], .sel[disabled], .field.disabled` | `opacity:.5; cursor:not-allowed` | decided, as `.btn[disabled]` (93) |
| `.inp[readonly], .field.readonly` | `background:var(--surface-2)` | decided: a read-only field is on screen while a request runs (sign-in) and must look unlike an editable one |

Table I. Narrow screens: one `@media (max-width: 719px)` block in each file.

| File | Selector | Declarations | Source |
| :---- | :---- | :---- | :---- |
| `Button.css` | `.btn` | `min-height:40px` | 538 |
| `IconButton.css` | `.ib` | `min-height:40px; width:40px; height:40px` | 538, 539 |
| `IconButton.css` | `.ib.sm` | `width:36px; height:36px` | 539 |
| `Chip.css` | `.chip` | `min-height:40px; height:36px` | 538, 540 |
| `Field.css` | `.inp, .sel, .field` | `min-height:40px` | decided (F38: every control) |
| `Switch.css` | `.sw::before` | `content:""; position:absolute; inset:-9px 0` | decided (F38): the switch stays 22 px tall and its touch area becomes 40 px. Concern 2 says whether a touch area is what F38 asks |

The prototype switches to the narrow sizes with a container query on its demo frame (`@container app (max-width:720px)`, the block that opens at line 502). The product has no demo frame, and D-068 says "under 720px", so the files use the viewport (`max-width: 719px`). The prototype's one viewport block (line 571, `max-width:719px`) changes only the demo bar, which never ships (D-145), so it is no model for this choice. See concern 8.

The prototype's narrow block also makes the body text 15 px (line 503). That is not in Table I or in `base.css`: it is TOKI-015's (Scope, Out).

`.linkbtn` has no narrow row. A link button is text inside a sentence in the prototype's uses (lines 1391, 1506, 1531) and standing alone only on the sign-in step; a 40 px line box would change the height of every line that holds one. A standalone link button gets its 40 px from the screen's own rule (TOKI-023, concern 2).

Table J. `base.css`. The prototype's rules on the root, on form controls and on focus (57-68, 575).

| Selector | Declarations |
| :---- | :---- |
| `html, body` | `height:100%` |
| `*` | `box-sizing:border-box` |
| `body` | `background:var(--bg); color:var(--ink); font-size:14px; line-height:1.45; -webkit-font-smoothing:antialiased` |
| `button, input, select, textarea` | `font:inherit; color:inherit` |
| `button` | `background:none; border:0; padding:0; cursor:pointer; text-align:left` |
| `a` | `color:var(--accent-text)` |
| `.ic` | `flex:none` |
| `:focus-visible` | `outline:2px solid var(--accent); outline-offset:2px; border-radius:6px` |
| `.sr` | `position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0)` |
| `@media (prefers-reduced-motion:reduce)`, selector `*, *::before, *::after` | `animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important` |

`body{font-family}` is TOKI-010's (R7 of that spec) and is not repeated. The 15 px body size of narrow screens is TOKI-015's (Scope, Out). The prototype's `.mono`, `.disp`, `#root`, `.muted` and the other rules between lines 57 and 69 are out (Scope).

Table K. Fixture cases of the lint rule: 36 cases, 21 reported (V) and 15 not reported (A). Each violating line is marked in `violates.tsx` with the rule id (TOKI-002 R11); the allowed cases are in `allowed.tsx`. Names `XIcon`, `CheckIcon`, `Icon`, `Button` and `IconButton` are imported from `@toki/ui-web` unless a row says otherwise.

| Case | Line | Result |
| :---- | :---- | :---- |
| V1 | `<button><XIcon /></button>` | reported |
| V2 | `<Button><XIcon /></Button>` | reported |
| V3 | `<button><Icon name="x" /></button>` | reported |
| V4 | `<IconButton icon="x" />` | reported |
| V5 | `<IconButton icon="x" label="" />` | reported |
| V6 | `<button aria-label=""><XIcon /></button>` | reported |
| V7 | `<button title="Close"><XIcon /></button>` | reported |
| V8 | `import { XIcon as Close }` then `<button><Close /></button>` | reported |
| V9 | `<button>{open ? <XIcon /> : <CheckIcon />}</button>` | reported |
| V10 | `import * as Icons` then `<button><Icons.XIcon /></button>` | reported |
| V11 | `<button><span><XIcon /></span></button>` | reported |
| V12 | `<button><XIcon /><CheckIcon /></button>` | reported |
| V13 | `XIcon` imported with a relative path that resolves into `packages/ui-web/src/icons`, then `<button><XIcon /></button>` | reported |
| V14 | `<button aria-label="   "><XIcon /></button>` (white space only) | reported |
| V15 | `<button aria-labelledby=""><XIcon /></button>` | reported |
| V16 | `<button><><XIcon /></></button>` (a fragment child) | reported |
| V17 | `import { Button as Btn }` then `<Btn><XIcon /></Btn>` | reported |
| V18 | `<button>{cond && <XIcon />}</button>` (`&&` with an icon on the right counts as an icon child, R22) | reported |
| V19 | `<button>{cond ? <XIcon /> : null}</button>` | reported |
| V20 | `<IconButton icon="x" label="   " />` | reported |
| V21 | `IconButton` imported with a relative path that resolves into `packages/ui-web/src/components/IconButton`, then `<IconButton icon="x" />` | reported |
| A1 | `<button aria-label="Close"><XIcon /></button>` | not reported |
| A2 | `<button aria-labelledby="t"><XIcon /></button>` | not reported |
| A3 | `<button aria-label={t("x")}><XIcon /></button>` | not reported |
| A4 | `<button><XIcon />Close</button>` | not reported |
| A5 | `<button><XIcon />{label}</button>` | not reported |
| A6 | `<button><XIcon /><span className="sr">Close</span></button>` | not reported |
| A7 | `<IconButton icon="x" label="Close" />` | not reported |
| A8 | `<IconButton icon="x" label={t("x")} />` | not reported |
| A9 | `<button {...props}><XIcon /></button>` | not reported |
| A10 | `<button><MyIcon /></button>` (`MyIcon` from another package) | not reported |
| A11 | `<button type="button" />` (no children) | not reported |
| A12 | `<IconButton icon="x" {...props} />` (the escape of R23) | not reported |
| A13 | `<button>{cond || <XIcon />}</button>` (the left side may be text) | not reported |
| A14 | `<button><XIcon />{cond && "Close"}</button>` (possible text) | not reported |
| A15 | `import { Button } from "other-lib"` then `<Button><XIcon /></Button>` (not the Button of `ui-web`) | not reported |

### Look in Calm and Focus, and density
Nothing in the CSS of the eight components depends on the look: the rules are the same in Calm and Focus (R6 d), and the two looks differ through the variables they get from `tokens.css` (TOKI-009). The values below are resolved from TOKI-009's Tables A, B, D with the teal accent; they are what the preview page shows when it is compared with the prototype.

| Piece | Calm | Focus |
| :---- | :---- | :---- |
| Corner of Button, IconButton, Field, Select (`--radius-sm`) | 10 px | 8 px |
| Button default: fill, text, border | `#FFFFFF`, `#16201D`, `#E0E5DF`; hover fill `rgba(22,32,29,0.055)`, border `#5A6662` | `#161B1E`, `#E8EDEB`, `#283035`; hover fill `rgba(232,237,235,0.07)`, border `#96A29D` |
| Button primary: fill, text | `#0F766E`, `#FFFFFF` | `#5EEAD4`, `#04201C` |
| Button danger: fill, text | `#B42318`, `#FFFFFF` | `#F97066`, `#161B1E` |
| IconButton: text, on (fill, text) | `#3A4541`, (`#DCEFEA`, `#0B5D56`) | `#C9D1CE`, (`#123B36`, `#7EF0DE`) |
| Chip pressed: fill, text | `#DCEFEA`, `#0B5D56` | `#123B36`, `#7EF0DE` |
| Switch: off track, on track | `#E0E5DF`, `#0F766E` | `#283035`, `#5EEAD4` |
| Field: border, focus border, focus ring | `#E0E5DF`, `#0F766E`, `#DCEFEA` | `#283035`, `#5EEAD4`, `#123B36` |
| Error box: fill, text | `#FCE8E6`, `#B42318` | `#3A1614`, `#F97066` |
| Badge default: fill, text | `#0F766E`, `#FFFFFF` | `#5EEAD4`, `#04201C` |
| Badge mention: fill, text | `#B42318`, `#FFFFFF` | `#F97066`, `#161B1E` |
| Tag: fill, text | `rgba(22,32,29,0.055)`, `#3A4541` | `rgba(232,237,235,0.07)`, `#C9D1CE` |

The other three accents change only the accent values of these rows (TOKI-009 Table B). Density (`--av`, `--gap`, `--row`) changes none of the eight components: no rule of Tables C to J reads it (R6 c). The sizes in the tables are the same at Comfortable and Compact.

### Class names
Decided in this spec: the components keep the prototype's class names (`btn`, `primary`, `ib`, `chip`, `sw`, `inp`, `sel`, `lbl`, `field`, `tag`, `cnt`, `gerr`). The technical design says the prototype's CSS is carried over almost intact, and the screens' own rules refer to these names (`.sendg .btn span`, `.mh .btn`, `.ni .cnt`, `.strip .btn`). Renaming them would force every later ticket to rewrite those rules. The cost is global short names that can collide (`.field`, `.sm`); a later ticket that adds a class must check the existing ones (concern 7).

Decided in this spec: a `size` is a class on the component (`btn sm`, `chip sm`), not a rule of the place it sits in. The prototype's `.cfilter .chip{height:26px}` becomes `.chip.sm`. Where a later row needs another size (`.acts .ib` at 30 px), that row writes its own rule, as the prototype does.

### Props
Decided in this spec.
- `variant` is used where the prototype's classes exclude each other (`primary`, `danger`, `ghost`, `mute`, `mn`). A boolean is used only for a layout flag (`fullWidth`) or a state. A component has no prop named `tone` or `color`: the prototype has none, and the colour comes from the variant.
- Names of states follow the platform: `disabled`, `readOnly`, `checked`, `pressed` (it sets `aria-pressed`), `error`. `invalid` is not a prop: an `error` text makes the control invalid, so the message and the mark cannot disagree (D-104).
- Event handlers keep the native signature of the element (`onClick`, `onChange` on `Field` and `Select` receive the native event). The exceptions are `Switch.onChange(checked: boolean)`, because a `button` has no change event and the caller needs the new value, and Toast's `action.onPress` (group 2), which is a field of an object and not a DOM prop.
- Every component of both groups takes `ref` (through `forwardRef`, which works in React 18 and 19, so `ui-web` does not depend on the React major version that TOKI-006 chooses), pointing at the element of the last column of Table B. Decided in this spec: one convention for the whole package, because adding `forwardRef` now costs one wrapper per component and retrofitting it later changes every caller. Overlays move focus to and back to buttons (TOKI-014), a form moves focus to a field, and group 2's `useToastAvoid` takes the caller's element; Tag, Badge and ChipGroup take it for the same convention and no more.
- Option lists are exported as constants, so a test and the examples file read the same list as the type (R2, R26).
- `Button` takes its icon as a child (`<Button variant="primary"><SendIcon />Send</Button>`), as the prototype writes it, because the icon can come before or after the text (`Move to` then `down`). This is also why the lint rule must look at children (R22). `IconButton` takes `icon` and `label` as props, so an icon-only button made with it cannot lack a name (R12), and the lint rule only has to catch the hand-made ones.

### Button, IconButton, Chip, Switch
- `Button` sets `type="button"` by default. Decided in this spec: the prototype's buttons have no `type`, so in a form they would submit it; the forms of the sign-in and channel dialogs submit with Enter on purpose and pass `type="submit"` on their one primary button. `type` is therefore a prop of Button (`button`, `submit`, `reset`) and the one attribute of Button that the caller sets and that is placed before the spread; `IconButton`, `Chip` and `Switch` keep `type="button"` fixed. `SwitchProps` omits the native `onChange` and `onClick`: the component owns the click, and `onChange(checked)` has another signature.
- A button that is working (D-111) is `disabled`; the prototype draws no spinner and none is added. A `disabled` button is skipped by Tab and announced as unavailable (as the sign-in spec assumes).
- `Button` `fullWidth` keeps the prototype's `margin-top:14px` (line 714) because the sign-in card and the guest card both rely on it. See concern 7.
- `IconButton` sets no `title`. Decided in this spec: a tooltip shows on hover only, and D-067 says nothing may be hover-only; the name for screen readers is `aria-label`. Concern 3 asks whether a visible tooltip is wanted.
- `IconButton` `pressed` also adds `on`. The prototype adds `on` and `aria-pressed` for the Save for Later button (line 1371) and only `aria-pressed` for the in-conversation search button (line 1288); one rule for both keeps a pressed button looking pressed.
- `Chip` is always a button. The prototype's chips are filter toggles (with `aria-pressed`) or one-time actions (the preset statuses in the Set status dialog, line 2152, carry no `aria-pressed`, while those in Preferences, line 1653, do), and `pressed` left out gives the second kind. A count on a chip is part of its children and is given by the screen; D-074 says it must equal the rows shown, which only the screen can know.
- `Switch` is a `button` with `role="switch"`, as the prototype writes it (the prototype names each one with `aria-label`). It is controlled only: the screens keep their value on the server, and a switch that flipped before the server answered would lie (D-111). The visible words next to a switch belong to the row, and `labelledBy` lets the row's text name the switch.

### Field and Select
- The prototype has two kinds of text box: `.inp`, a bordered input or textarea, usually under a `.lbl` but sometimes named by `aria-label` alone (the custom status, line 1653; the Edit message textarea, line 1361), and `.field`, a bordered row used for searching with the name given by `aria-label`, with an icon (conversation search, Files, People) or without one (the people picker and Browse channels). Decided in this spec: `variant` chooses the look, `default`, `code` or `search`, and `Field` offers the three forms of R15; the search look is the `.field` box, its icon is optional, and the two looks that need no visible label are the ones named by `aria-label` or `aria-labelledby`. In form (b) the `label` element wraps the input, so a click on the icon focuses the field, as in the prototype.
- `Field` and `Select` return a fragment (label, control, error), not a wrapper `div`, as the prototype's markup does. The caller's layout (`.formgrid` columns, `.statusrow`) stays the caller's. `className` goes on the control; on form (b) it goes on the `label.field`, which is the bordered box.
- The code field of the sign-in steps is `Field` with `variant="code"` (the prototype's `.inp.code`, line 715). The sign-in screens (TOKI-023) wrap it in their own `CodeField` that limits the digits; no base component is added there.
- Select is the browser's `select`, not a custom list. Decided in this spec: it is the prototype's element, works with every keyboard and screen reader, and opens the phone's own picker. Its arrow and its open list look as the browser draws them, as in the prototype.
- Errors. The prototype's only error look is the `.gerr` box (`role="alert"`, line 2018), placed after the button of its guest card. D-104 says the error goes under the field, so `Field` and `Select` render the same `.gerr` box directly after the control, with the id `<id>-error` (R17). Decided in this spec: the box keeps its `role="alert"` so that it is read out when it appears; it is rendered only while there is a message, and the control gets `aria-invalid` and `aria-describedby` so the message is also read with the field. The wording is the screen's.
- Disabled, read-only and invalid looks are decided (Tables H and C): the prototype has no rule for any of them. They use only existing tokens (`--danger`, `--danger-soft`, `--surface-2`, and the 0.5 opacity of `.btn[disabled]`).
- A field has no required mark. The prototype draws none, and D-104 keeps the button disabled until the form is valid, so the person is not left guessing.

### Tag and Badge
- `Tag` is a small capitalised label. Phase 1 uses it for the Admin label on a person (TOKI-079; there is no Owner label, D-152) and for the 'Archived' label of Browse channels (TOKI-034), which the prototype does not draw and which therefore has the one look of Tag.
- `Badge` is the counter. The prototype renders it only when the count is above zero and sets no cap; the screen does the same (TOKI-054). The mention badge shows `@` and has `aria-label="mention"` in the prototype; `Badge` does it with the `label` prop and a hidden text (R20), because `aria-label` on a plain `span` is not reliably read. The count is read with the row's name, so a row announces its unread count when the screen gives `label`.
- The position of a badge on a navigation item or a bottom tab (`.ni .cnt`, `.nt .cnt`, and their Focus-look variants at lines 172, 523, 595, 596, 795) belongs to the item that holds it (TOKI-015).

### No hover-only
The prototype hides the row actions of its lists until hover (`.item .ib{opacity:0}`, lines 361-362). D-067 and AC-115 forbid it, and D-154 says the '+' on Direct messages shows on hover on a desktop and always on touch screens. These rules are in the list rows, not in a base component, so they are not carried over. IconButton and the others never hide themselves (R7); the ticket that builds the row decides when it shows (Activity: TOKI-066; the Direct messages heading: TOKI-033, the conversation list) and must keep the button reachable by keyboard and visible on touch.

### The lint rule
- Decided in this spec: the rule is a small local ESLint rule, `tools/eslint-rules/icon-only-button-name.js`, exported through `tools/eslint-rules/index.js` as the plugin `toki`. `eslint-plugin-jsx-a11y` was not chosen: it cannot know that an `Icon` component draws a hidden image, so it would pass `<button><XIcon /></button>` (TOKI-011 R7 says an icon has no name) or report every button whose child it does not know.
- Decided in this spec: the rule knows an icon by where its name was imported from, not by its spelling alone. The sources are `@toki/ui-web` and a relative path that resolves, from the file being linted (`context.cwd`, `context.filename`), into `packages/ui-web/src`. A component of another package that ends in `Icon` is not an icon for the rule (case A10). TOKI-011 R16 guarantees that no other export of `ui-web` ends in `Icon`.
- Decided in this spec: when the rule cannot tell, it does not report. Any child that could be text, a spread attribute, and an expression value of `aria-label` pass. The reason is that a false report on a correct button teaches people to disable the rule, which the configuration forbids (R24), while the cases it misses are caught by the types: `IconButton` needs `label` (R12, R30), and a hand-made button is rare. The two limits are written in the rule file's header comment.
- Decided in this spec: `title` is not a name. A `title` shows on hover only (D-067) and not on touch.
- Decided in this spec: the block covers `packages/ui-web/src` and `apps/web/src`, the two places JSX is written in phase 1. A new app that writes JSX adds its path to the block.
- Decided in this spec: a child of the form `{cond && <XIcon />}` is an icon child (R22): its branches are the icon and the value of `cond`, and a condition is not text, so the button is reported. `{a || <XIcon />}` and `{a ?? <XIcon />}` are not, because their left side may be text. `{cond ? <XIcon /> : null}` is the case V19.
- Decided in this spec: placement. The rule is proved by `pnpm lint:boundaries`, with its fixtures in the same check script, and not by a new script. The reason is that TOKI-007 R2 runs the three scripts of TOKI-002 and CI is red when one fails, so a removed rule turns CI red with no change to CI or to a script name, while a fourth script would change TOKI-007 R2 and the CI file. This changes TOKI-002, which is merged. The lines it changes, and what the other specs must know, are:

| Where | What TOKI-002 says | What changes |
| :---- | :---- | :---- |
| Goal, and the constraint row 'Three boundary rules are fixed' | `lint:boundaries` proves the three boundary rules | The three boundary rules stay three. The script also proves the rule `toki/icon-only-button-name`, so the name now means 'rules that lint cannot be trusted to keep unless fixtures prove them' |
| R11 | One fixture folder for each boundary rule | One more folder, `tools/lint-fixtures/icon-button-name/`, with `violates.tsx`, `allowed.tsx` and `disabled.tsx` |
| R15 | The list of real paths whose configuration `check.mjs` checks | Two more paths: `packages/ui-web/src/components/IconButton/IconButton.tsx` and `apps/web/src/main.tsx` |
| Design, Layout and the path override | `check.mjs` maps each fixture folder to the block it tests | One more mapping, to the block of R24 |
| R16 | Inline configuration is off in every block a boundary rule covers | The block of R24 is a fourth block with the same setting (concern 18) |

  TOKI-007 R2 is not changed. The platform spec (TOKI-018, R23 and R24) adds its own fixture lines and a real path to the same script; the changes are separate lines of one list and either can be built first. TOKI-095 (`CLAUDE.md`, boundary rules and common commands) should say that `pnpm lint:boundaries` also proves the icon-button rule.
- The block follows TOKI-002's structure: one object in the root `eslint.config.js` with `files`, `plugins`, `rules` and `linterOptions.noInlineConfig`; the fixture folder is mapped to it in the same path override that maps the other three folders; `check.mjs` gets the folder and the two real paths.

### Loading the styles
Decided in this spec: this ticket wires the tokens and the base rules into `apps/web`, because it is the first ticket that owns CSS meant for the whole page (the font spec gives it the `body` text rule and the form-control rule) and TOKI-009 leaves the loading to "the tickets that build components". The order in `main.tsx` is fonts, tokens, base, and then every other import (R29): `base.css` has the page-wide `:focus-visible{outline; border-radius:6px}`, and Table H (`outline:0` on `.inp`) and the component classes (`border-radius`) have the same specificity, so they win only by coming later; an import of the app above `base.css` would give every input a double ring and every button a 6 px corner on focus. A component's own CSS is loaded by the component's module, when a screen imports it. The page of the skeleton changes its background and text colour (`--bg`, `--ink`), which is intended; it shows Calm on a light device and Focus on a dark one until a script sets `data-eff` (TOKI-009 concern 10).

### Tests and examples
- Component tests: Vitest with Testing Library in jsdom (the technical design lists "Vitest and Testing Library" for components). Decided in this spec: `jsdom`, not `happy-dom`, because it is the environment Testing Library documents and `user-event` is tested against; the tests need `userEvent.keyboard`, `tab` and `click`. jsdom does not apply CSS variables, so a test never reads a colour from the DOM. The set-up is complete in R27 and is the one both groups use (Contract for TOKI-013).
- CSS tests: `src/test/css.ts` (`readCss`, R27) reads a CSS file and parses it with `postcss`, so Prettier (TOKI-002) may reformat the file. Each CSS file has a test with its own copy of its table, typed in from this spec, as TOKI-009 does for its tables. The tests prove the CSS equals this spec; that this spec equals the prototype rests on the review of the tables against the lines named in them (concern 11).
- Examples: `<Name>.examples.tsx` is the component's "story". There is no Storybook (the technical design has none and the plan has a preview page, TOKI-016). Each file lists each variant, size and state with demo words, which are test data and not interface text (they are outside R3, and `examples.ts` is not imported by the app). TOKI-016 imports `@toki/ui-web/examples`, shows each example in a look and a density chosen on the page, and compares with the prototype.
- Decided in this spec: the examples files sit next to the component and are listed in one file, so that adding a component means adding one folder, one line in `components/index.ts`, and one import and one entry in `src/examples.ts`; a test (R26, R31) reminds the builder of any variant or entry left out. The page imports one name, `@toki/ui-web/examples`, instead of every folder, and the examples stay out of the components' own exports. A group 2 component adds an entry like this: `{ component: "Avatar", examples }` after the entries of group 1, with `examples` from `../components/Avatar/Avatar.examples`.

### Layout
```
packages/ui-web/
├─ package.json          adds exports "./base.css" and "./examples"; devDependencies jsdom, @testing-library/react, /dom, /user-event, /jest-dom, postcss
├─ vitest.config.ts      environment jsdom, setupFiles
└─ src/
   ├─ index.ts           adds: export * from "./components"
   ├─ examples.ts        the list of examples of every component
   ├─ internal/example.ts   the type Example
   ├─ internal/cx.ts     joins class names
   ├─ styles/base.css    Table J
   ├─ test/              setup.ts (jest-dom, cleanup, act flag), css.ts (readCss)
   ├─ styles/order.test.ts   reads apps/web/src/main.tsx for the import order (R29)
   └─ components/
      ├─ index.ts        one export * line for each folder; group 2 adds its four
      ├─ Button/    Button.tsx Button.css Button.test.tsx Button.examples.tsx index.ts
      ├─ IconButton/  Chip/ (with ChipGroup)  Switch/  Field/  Select/  Tag/  Badge/
tools/
├─ eslint-rules/       index.js, icon-only-button-name.js
└─ lint-fixtures/icon-button-name/   violates.tsx, allowed.tsx, disabled.tsx
eslint.config.js       adds one block (R24)
apps/web/              package.json (two dependencies), src/main.tsx (two imports)
```
`Select` imports `../Field/Field.css` and the error part of `Field` from `../Field/FieldFrame.tsx` (label, id and error, shared by the two). Nothing else is shared between component folders except `internal/cx.ts`.

### Errors
- A required prop is missing or a variant is outside its list -> a type error at `pnpm typecheck` (R30); nothing is checked while running.
- An icon-only button without a name -> `pnpm lint` fails and names the file, the line and the rule (R22, R23, R24).
- A CSS file differs from its table -> the CSS test fails and names the selector and the property (R5).
- A variant, size or state with no example -> the examples test fails and names the component and the value (R26).

## Testing
- Written first and seen to fail, in `packages/ui-web/src/components/<Name>/<Name>.test.tsx`, run with `pnpm --filter @toki/ui-web test`. No data is used; every text in the tests is made up.
- R1, R2: a test lists the exports of `components/index.ts` and checks that each name of R1 and R2 is there and that no export ends in `Icon` (it does not fail on names of group 2); for each component it renders with and without `className`, and with an owned attribute passed by a cast, and checks the order of classes and that the owned attribute wins; a `ref` test checks the element.
- R3: each component is rendered with no text props and no children and `textContent` is `""`; a test reads the non-test, non-examples sources under `src/components` and fails on an import of `@toki/i18n`.
- R4, R10 to R16, R19, R20: render and read the DOM: element, classes, attributes, and the children for each row of Table B and each value of a union. Clicks and keys by `user-event`: Button (click, Space, Enter, disabled), Chip, IconButton (`pressed` true, false, absent), Switch (click calls `onChange(true)` from false and `onChange(false)` from true, once; Space and Enter; `disabled` calls nothing; `labelledBy` sets `aria-labelledby`), Field (all three forms, form (b) with and without an icon, form (c) as an input and as a textarea; `label` and `htmlFor` match the id; a click on the icon of form (b) focuses the input; the error id is `<id>-error`), Select (options, `onChange`, `value`), Badge (`label` hides the digits and shows the text; no `label` leaves them; `0` is shown), Tag.
- R17, R18: render with `error`, with an empty `error` and with white space; check `role="alert"`, `aria-invalid`, `aria-describedby` (caller's id first, then the error's), the class `invalid`, one message only after a rerender with another `error`, and the classes `disabled` and `readonly` on form (b).
- R5 to R9: one CSS test per file, with the table of this spec typed in, compares the selectors and declarations and the media block; further tests walk all eight CSS files for R6 (a to e) and R7. The test of R9 compares `base.css` with Table J and reads `package.json`'s `exports`; it also checks that `src/index.ts` and the components import no CSS other than their own (R9, R5).
- R8: the CSS test reads the media block of each file; the 40 px result is the declarations of Table I, not a measured size (jsdom has no layout).
- R21: the keyboard tests above, plus a test that no source of a group 1 or group 2 component sets `tabindex` and that `outline: 0`/`none` is only on `.inp` and `.field input` (Table H); the test skips the folders `Menu/`, `Modal/` and `Sheet/` (TOKI-014).
- R22 to R25: the fixtures are the tests. Write the fixtures first and see `pnpm lint:boundaries` fail, then add the rule and see it pass. Checked once by hand, as TOKI-002 does: switch the rule off in the block and see `pnpm lint:boundaries` fail and name the fixture and line; narrow the `files` glob so it misses `packages/ui-web/src` and see it fail on the real path; add `<button><XIcon /></button>` to a real file under `packages/ui-web/src` and see `pnpm lint` fail, then remove it.
- R26, R31: a test imports `componentExamples` and checks, for each group 1 component, that each value of its exported lists has an example in its entry, that ids are unique, and that nothing but `examples.ts` imports an examples file; another lists the folders of `src/components` and checks the line in `components/index.ts`, the examples file and the entry of each.
- R27: besides the commands below, a test renders a component in two tests in a row and finds it once with `getByRole` (the cleanup of `setup.ts`), and `pnpm install` shows one version of `jsdom` and one of Vitest in the workspace.
- R27, R28, R30: `pnpm --filter @toki/ui-web test`, `pnpm lint`, `pnpm lint:boundaries`, `pnpm format:check` and `pnpm typecheck` run on the finished branch and exit 0; the `@ts-expect-error` lines of R30 are the type tests (an unused one is itself an error).
- R29: build `apps/web`, read the exit codes, and read `dist/index.html` and the built CSS for the two sheets; `order.test.ts` fails when a non-CSS import of `main.tsx` precedes the three style imports.
- Look against the prototype, by hand, once (the preview page does not exist yet): add for the test only a throwaway route in `apps/web` that renders `componentExamples` with `data-eff="calm"` and then `"focus"`, put the prototype beside it in the same size, and compare each state of Tables C to H, at 1280 px and at 360 px wide, with density Comfortable and Compact; look at the invalid, disabled and read-only states in both looks by eye, in particular the error box and the invalid focus ring in Focus (concern 1). Then remove the route. The comparison that stays is the preview page (TOKI-016).
- Screen reader and keyboard: by hand once, with the throwaway route and a screen reader, Tab through every state and listen to the name of each icon-only button, the switch, a field with an error, and the badge with and without `label`.

## Data safety
- The components keep no state, call no storage or network API, and put no value in a URL or the console.
- Fixtures and tests hold no real name, address or key.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Design system | Planning fact; no design impact. |
| Belongs to Blueprint intent I02 design-system: every base component matches the prototype in Calm and Focus, in all three layouts | The CSS is the prototype's (Tables C to J, R5), the two looks differ only through the tokens (R6 d, "Look in Calm and Focus"), and the narrow rules are in R8. The three layouts themselves are TOKI-015. |
| Milestone: M1, Foundation and design system | Planning fact; no design impact. |
| Size: M, about one working session with Claude | Eight small components, a CSS file each, one lint rule with fixtures, and tests; no screen, no overlay, no preview page. Concern 12 says the size is larger than one session. |
| Needs: TOKI-009 and TOKI-018 | The CSS uses the 32 property names of TOKI-009 (R6 b). TOKI-018 is the entry for platform features; no component of this group needs one (R28); the `jsdom` version of its package is reused (R27). The specs of TOKI-010, TOKI-011 and TOKI-002 add three needs (concern 5). |
| Needed by: TOKI-014, TOKI-015 and TOKI-016 | The components, their `ref`s, the examples and `@toki/ui-web/examples` (R1, R2, R26). |
| Agreed scope: Button, IconButton, Chip, Switch, Field, Select, Tag, Badge; icon-only buttons must have a name, checked by lint (D-075); the rule goes into the ESLint configuration of TOKI-002 | The eight components (R1, R10 to R20); the rule and its fixtures in `eslint.config.js` and `check.mjs` (R22 to R25), with the lines it changes in TOKI-002 listed in Design, "The lint rule". |
| Looks, sizes, states, variants and texts come from the prototype; none is invented; Claude decides what the prototype does not draw (D-019) | Tables A to J give the line of each rule; every decided addition is marked "decided"; no text is held by a component (R3). |
| Every icon-only button has a name; lint checks it (D-075, NFR-03) | `IconButton` requires `label` (R12, R30); the lint rule reports a hand-made one (R22, R23); `title` is not a name. |
| No feature is hover-only or desktop-only (D-067, NFR-02) | R7 and "No hover-only"; every control is a native element that works by touch and keyboard (R21). |
| Form errors show under the field and the button stays disabled until the form is valid; a button is disabled while its request runs (D-104, D-111, BR-40) | `error` renders under the control (R17); `disabled` on Button and Field (R10, R18). Which message and when the button is disabled is each screen's. |
| Every control is at least 40 px tall on a narrow screen (F38) | R8 and Table I. |
| Both looks are built, English is the default language and every text is translated (D-018, D-064, NFR-05) | Both looks through the tokens (R6 d); no component holds text (R3), so every word goes through i18n in the screen that uses it. |
| Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web` | The group uses none (R28). |
| The web styling is the prototype's CSS on CSS variables; no Tailwind and no runtime styling library | Plain CSS files with the prototype's class names and `var(--…)` only (R5, R6). |
| TOKI-013 is written at the same time and shares the folder layout and the conventions | Scope states the shared rules once ("Decided in this spec") and "Contract for TOKI-013" lists them; R1, R2, R26, R27 and R31 are their form. |
| M1 exit check: the preview page matches the prototype in Calm and Focus at all three layouts | This work supplies the components, the examples files and `@toki/ui-web/examples` (R26); the page is TOKI-016. |

## Open questions from the intent
- Which prototype controls that are not named in this group or in group 2 are built, by which ticket, and which are left out? Answered: the two tables in Scope give one owner to each piece or say it is not built, with the reason. Decided in this spec. See concerns 6 and 9.
- What does an error under a field, a disabled field and a read-only field look like, given that the prototype draws none of them? Answered: Tables C and H (the `.gerr` box under the control, a red border, the 0.5 opacity of a disabled button, the `surface-2` fill). Decided in this spec. See concern 1.
- Where does the lint rule for icon-only buttons live, and what counts as a name? Answered: a local rule in the root ESLint configuration, proved by fixtures in `pnpm lint:boundaries` (which amends TOKI-002 in the lines listed in Design, "The lint rule"); `aria-label`, `aria-labelledby` or text (R22, R23). Decided in this spec. See concerns 10 and 18.
- Which text does a base component hold itself, if any? Answered: none (R3). Decided in this spec.

## Areas of concern
1. The look of an error under a field, of an invalid, disabled and read-only control is not in the prototype and no decision draws it (D-104 fixes only the place and D-019 leaves the rest to Claude). This spec reuses the `.gerr` box and existing tokens (Tables C and H). Not confirmed by the product owner, and the red border and the `surface-2` fill are choices. Two colour pairs are also unchecked for contrast: the error text `--danger` on `--danger-soft`, and the invalid focus ring `--danger-soft` on the Focus field fill; TOKI-009 sets no contrast target (its concern 5). The owner should look at Calm and Focus once on the preview page (Testing). Owner: Thanh Truong.
2. The prototype's `.inp`, `.sel`, `.field`, `.linkbtn` and `.sw` are shorter than 40 px on a narrow screen, while journey F38 (accepted as the baseline, D-091) says every control is at least 40 px. Decided in this spec: the narrow rules of Table I add `min-height:40px` to `.inp`, `.sel` and `.field`, and a 40 px touch area to the switch (its drawn height stays 22 px). These are changes to the prototype's look at 719 px and below. Not decided by the log, so a proposal for the product owner: (a) whether a 40 px touch area meets F38, which says every control is at least 40 px tall (the proposal is yes; if not, the switch grows to 40 px). A row that holds a switch must then be at least 40 px tall, or two touch areas overlap; that is the screen's. (b) `.linkbtn` has no narrow rule, because its prototype uses are links in sentences; the proposal is that a link button that stands alone (the sign-in 'Use a different email', TOKI-023) is given its 40 px by that screen's own rule. Owner: Thanh Truong.
3. Tooltips. The prototype gives a `title` to a few icon-only buttons and not to most. `IconButton` sets none (a `title` is hover-only, D-067), so a sighted desktop user sees no tooltip on any of them. No decision says whether a visible name is wanted. Proposal, not a decision: no tooltip in phase 1; if one is wanted, a touch-friendly label belongs to the toolbar that holds the buttons. Owner: Thanh Truong.
4. `Badge` shows its text as given. The decision log sets no cap on a count (no `99+`) and does not say whether a zero is shown; the prototype shows a badge only above zero and never caps. Not decided. Proposal, not a decision: no cap and no zero, as the prototype, decided by the screen. A cap would change the screen's text, not the component. Owner: Thanh Truong.
5. The plan lists only TOKI-009 and TOKI-018 as needs of TOKI-012. Decided in this spec, and the plan should change: TOKI-012 also needs TOKI-010 (the font spec gives it the rest of the `body` rule and the form-control rule), TOKI-011 (icons, `.ic{flex:none}`, the names for the lint rule) and TOKI-002 (the lint set-up it extends). TOKI-013 should also need TOKI-012 and drop its need on TOKI-018, because the shared files of Scope are created here and nothing in it calls `platform`; without that, two tickets would create the same files. TOKI-013's spec is to state the same plan change (Contract for TOKI-013, item 9). Owner: Thanh Truong.
6. Variants left out by the rule "a variant is built when one place that uses it is in phase 1" (the same rule as TOKI-011): `.btn.live` (Meet), `.tag.guest` (Guest, D-152) and the `.pill` family (Calendar, the demo bar, and the 'New' mark of D-146). If any is brought forward, it is a new variant with its own preview state and CSS rule. Owner: Thanh Truong.
7. Two components keep outer margins of the prototype (`.lbl{margin:12px 0 4px}` and `.btn.wide{margin-top:14px}`), and the class names are the prototype's global short names. Decided in this spec so that the screens' carried-over CSS keeps working and the preview matches. The cost is spacing set inside a component, and possible name collisions (`.field`, `.sm`, `.cnt`). Proposal, not a decision: revisit when the phone app (phase 3) needs its own components, or if a collision appears. Owner: Thanh Truong.
8. The narrow sizes use the viewport (`max-width: 719px`), as D-068 says; the prototype uses a container query on its demo frame (720 px included). If the app shell (TOKI-015) defines "narrow" by a container instead of the viewport, the media blocks of Table I must follow it. TOKI-015 (its concern 3) takes the window, as this spec does, so Table I stands. Owner: Thanh Truong.
9. Pieces left to other tickets (Scope table) are an assignment by this spec, not by the plan: `.rx`, the person chip and the mention chip to TOKI-046, TOKI-034 and TOKI-050; the segmented control to TOKI-063; the native checkbox and radio to TOKI-067 and TOKI-035; the utility classes to the first ticket that needs one (TOKI-015 expected); and the pieces of the second ownership table: `.strip` to TOKI-082, `.tab` to TOKI-015, `.card` and `.fic` to TOKI-062, `.fchip` to TOKI-059, `.lnk` to TOKI-049, `.tlink` to TOKI-045, and `.banner`, `.copyrow` and `.note` later. The plan lines of those tickets do not name them, and three plan changes follow: TOKI-076 and TOKI-104 need TOKI-082, and TOKI-062 needs TOKI-049. Owner: Thanh Truong.
10. The lint rule has limits that are written in its header and accepted: it does not report a button whose child may be text or whose attributes are spread, it recognises icons only from `@toki/ui-web`, and it counts an expression `aria-label` as a name without evaluating it. `Switch` and a button with no children are not covered by it; the types cover `Switch` (R14). TOKI-080 may add a rule against literal text in `ui-web` (the i18n spec's concern 6); it is not part of this rule. Owner: Thanh Truong.
11. The tests prove the CSS equals the tables of this spec, not the prototype: the prototype is not in this repository. The match with the prototype rests on the review of the tables against the lines named in them, and on the preview page (TOKI-016). The look check in Testing is by hand. Owner: Thanh Truong.
12. The size. The Blueprint says M, about one session. This ticket holds eight components, seven component CSS files with their tables, a lint rule with 36 fixture cases, a test set-up and the examples files, so it is likely to take more than one session. Proposal, not a decision: build in this order and stop after any step if needed: base CSS and Button and IconButton; Chip, Switch, Tag, Badge; Field and Select; the lint rule. Owner: Thanh Truong.
13. Test tools are not in the Blueprint beyond "Vitest and Testing Library". Decided in this spec: `jsdom`, Testing Library (`react`, `user-event`, `jest-dom`), `postcss`, `@testing-library/dom` (the peer dependency of the first two) and `jsdom`, each pinned to one exact version: the version already in the repository if there is one (for `jsdom`, the one of `packages/platform`; for Vitest, the one of `packages/tokens` and the icon work), otherwise the stable release when this work is built, as TOKI-009 and TOKI-011 do for Vitest. TOKI-008 keeps a list of packages that have tests; `ui-web` must be in it (the icon spec already says so). Owner: Thanh Truong.
14. The Badge draws its digits in JetBrains Mono at weight 600, and the fonts spec ships that family only at weight 500 (its concern 3): the browser thickens the 500 face, as it does in the prototype. The code field is the same at weight 400. Accepted. Owner: Thanh Truong.
15. The `select` keeps the browser's own arrow and list. They look different in each browser and on each phone, so the preview cannot match the prototype pixel for pixel in a different browser. Accepted: it is the prototype's element. Owner: Thanh Truong.
16. Loading `tokens.css` and `base.css` in `apps/web` (R29) changes the look of the skeleton page and, until `data-eff` is set by a later ticket, shows the look that the device asks for rather than the look saved to the account (TOKI-009 concern 10). Accepted for the skeleton. Owner: Thanh Truong.
17. This spec and the group 2 spec (TOKI-013) were written at the same time and differed in three points: `ref`, the test set-up, and the examples aggregate. Decided in this spec, and TOKI-013 is to follow it (Scope, "Decided in this spec", and "Contract for TOKI-013"): (a) every component of both groups forwards `ref` with `forwardRef`; (b) one Vitest configuration with jsdom for the package, Testing Library with `@testing-library/dom`, `setup.ts` and `src/test/css.ts`, and no dependency added by TOKI-013; (c) the aggregate `componentExamples` and the type `Example`, to which TOKI-013 adds four entries, with "at least" wording for the export lists and the entries (R1, R26). Whether TOKI-013's reviewer agrees is for that review. Owner: Thanh Truong.
18. The block of R24 switches inline configuration off in the non-test `.tsx` files of `apps/web/src` as well as in `packages/ui-web/src`. TOKI-002 left `apps/web` to its review for the boundary rules (its concern 5), and no decision asks for it. The cost: any later `eslint-disable` comment in those files (for example for a hooks rule) becomes a lint failure, and an exception is made by editing `eslint.config.js`. Decided in this spec to keep it, because a person who can disable the rule in `apps/web` can leave an icon-only button without a name, which is what D-075 forbids; narrowing the block to `ui-web` is the alternative. Owner: Thanh Truong.
19. The 15 px body text of narrow screens (line 503) is handed to TOKI-015 in Scope, Out; the plan line of TOKI-015 does not say so. Until it is built, `base.css` keeps 14 px at every width. Owner: Thanh Truong.
