# Intent: Base components, group 1
Author: Thanh Truong

## Problem
The prototype draws every button, filter chip, switch, text field, drop-down, label and counter from one style sheet inside its single HTML file, and most of them have no component: the markup is a string with a class name. The repository has a `ui-web` package, but it holds no component yet.
Every screen needs these controls. If each screen copies the markup and the CSS by hand, the same button ends up in several versions with different sizes, states and names, and the component preview page can no longer match the prototype.
Two accessibility rules apply to all of them. An icon-only button must have a name for screen readers (D-075), and nothing checks it today. A form error must show under its field, with the button disabled until the form is valid (D-104).
The prototype also leaves gaps: it draws no error under a field, no disabled or read-only field, and no keyboard focus on some controls. Some of its small controls are shorter than the 40 px that the narrow-screen journey asks for (F38).

## Proposed outcome
The first group of base components exists in `ui-web`: Button, IconButton, Chip, Switch, Field, Select, Tag and Badge. Each looks as the prototype does in Calm and Focus, in every size and state the prototype draws, and works with a keyboard and a screen reader.
A lint rule fails the build when an icon-only button has no name.
The builder (Thanh and Claude) can assemble screens from these components without reading the prototype's CSS.
The spec says which prototype controls that sit between this group and the next one (Avatar, PresenceDot, EmptyState, Toast) belong to which ticket, and which controls no base component covers.

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every Member and Admin, who use these controls on every screen, and people who use a screen reader or a keyboard. Source: Toki Blueprint, intent I02 design-system ("The builder; indirectly every user").
- Systems: `packages/ui-web`; the ESLint configuration and the lint check script of TOKI-002; `apps/web` (loads the styles). Readers later: Overlays (TOKI-014), AppShell (TOKI-015), the component preview page (TOKI-016) and every screen.

## Constraints
- Blueprint work area: Design system. Source: Toki Blueprint, ticket TOKI-012.
- Belongs to Blueprint intent I02 design-system, whose result is that every base component matches the prototype in Calm and Focus, in all three layouts. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: M, about one working session with Claude. Source: Toki Blueprint, ticket TOKI-012.
- Needs: TOKI-009 (tokens) and TOKI-018 (platform). Source: Toki Blueprint, ticket TOKI-012, Needs column. The specs of TOKI-010 (fonts) and TOKI-011 (icons) add TOKI-010 and TOKI-011 as needs, and the lint rule needs the lint set-up of TOKI-002.
- Needed by: TOKI-014, TOKI-015 and TOKI-016. Source: Toki Blueprint, Needs column.
- Agreed scope: Button, IconButton, Chip, Switch, Field, Select, Tag, Badge; icon-only buttons must have a name, checked by lint (D-075); the lint rule goes into the ESLint configuration of TOKI-002. Source: Toki Blueprint, ticket TOKI-012.
- Looks, sizes, states, variants and texts come from the prototype; none is invented. Where the prototype draws nothing (for example an error under a field), Claude decides (D-019). Derived from intent I02, which asks that every base component "matches the prototype"; I02 does not say this in these words.
- Every icon-only button has a name for screen readers; lint checks it. Source: D-075, requirement NFR-03.
- No feature is hover-only or desktop-only. Source: D-067, requirement NFR-02.
- Form errors show under the field, and the button stays disabled until the form is valid. A button is disabled while its request runs. Source: D-104, D-111, business rule BR-40.
- Every control is at least 40 px tall on a narrow screen. Source: journey F38, accepted as the baseline in D-091.
- Both looks, Calm and Focus, are built, and English is the default language with every text translated. Source: D-018, D-064, requirement NFR-05.
- Components reach platform features only through `platform`; lint bans direct use of the notification, storage, service worker and audio APIs in `ui-web`. Source: Toki Blueprint, technical design.
- The web styling is the prototype's CSS on CSS variables; no Tailwind and no runtime styling library. Source: Toki Blueprint, technical design, Frontend.
- Another ticket, TOKI-013 (Base components, group 2: Avatar, PresenceDot, EmptyState, Toast), is written at the same time and shares the folder layout and the conventions of this one.
- M1 exit check that this ticket supports: the component preview page matches the prototype in Calm and Focus at all three layouts. Source: Toki Blueprint, milestone M1.

## Open questions
- Which prototype controls that are not named in this group or in group 2 (the "Guest" tag, the soft "pill", the reaction chip, the segmented control, checkboxes) are built, by which ticket, and which are left out?
- What does an error under a field, a disabled field and a read-only field look like, given that the prototype draws none of them?
- Where does the lint rule for icon-only buttons live, and what counts as a name?
- Which text does a base component hold itself, if any?
