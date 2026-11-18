# Intent: Icon set
Author: Thanh Truong

## Problem
The prototype draws every icon of the app (navigation, message actions, composer, menus, empty states) from one table of line drawings inside its single HTML file. The repository has a `ui-web` package, but it is empty: it exports nothing.
Every base component and every screen needs icons. If each one copies a drawing by hand from the prototype, the same icon ends up in several versions with different size, stroke and colour, and the component preview page can no longer match the prototype.
Screen readers must not hear an icon as a control: icon-only buttons get their name from the button (D-075).

## Proposed outcome
The icons of the prototype that phase 1 needs are available as React components in `ui-web`, drawn exactly as in the prototype, in the colour of the surrounding text and in any size. A component can use an icon by importing it, or by naming it.
The builder (Thanh and Claude) can build the base components and the screens without opening the prototype to look up a drawing.
The plan says "roughly 60 icons"; the exact list and count are taken from the prototype and stated in the spec.

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every Member and Admin, who see the icons. Source: Toki Blueprint, intent I02 design-system ("The builder; indirectly every user").
- Systems: `packages/ui-web` (created empty by TOKI-001). Later readers: the base components (TOKI-012 and after), the app shell and the screens in `apps/web`.

## Constraints
- Blueprint work area: Design system. Source: Toki Blueprint, ticket TOKI-011.
- Belongs to Blueprint intent I02 design-system, whose result is that every base component matches the prototype in Calm and Focus, in all three layouts. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: S, about half a working session with Claude. Source: Toki Blueprint, ticket TOKI-011.
- Needs: TOKI-006 (Web app skeleton). Source: Toki Blueprint, ticket TOKI-011, Needs column. No ticket lists TOKI-011 in its own Needs column.
- Agreed scope: "The prototype's roughly 60 icons as components". Source: Toki Blueprint, ticket TOKI-011.
- The drawings come from the prototype; none is invented. Derived from intent I02, which asks that every base component "matches the prototype". I02 does not state this rule in these words.
- Every icon-only button has a name for screen readers. Source: D-075, requirement NFR-03.
- Components live in `ui-web`; `ui-native` for the phone app comes in phase 3. Source: Toki Blueprint, technical design, code structure and reuse table.
- Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web`. Source: Toki Blueprint, technical design.
- Only the features of phase 1 are built now; the prototype's demo-only controls never ship. Source: D-002, D-145.
- Every text shown to a person goes through i18n; English is the default. Source: Toki Blueprint, technical design and decision log.
- M1 exit check that this ticket supports: the component preview page matches the prototype in Calm and Focus at all three layouts. Source: Toki Blueprint, milestone M1.

## Open questions
- How many icons are there really, and which of them does phase 1 use? The plan says "roughly 60".
- Which prototype icons belong to features that are not in phase 1?
- How does an icon get its size and colour, given that the prototype sets sizes from the CSS of each place?
- Do the prototype's icon drawings come from an open-source set with a licence?
