# Intent: Base components, group 2
Author: Thanh Truong

## Problem
The prototype draws four small pieces again and again: the round avatar with a person's initials, the dot that shows whether a person is active, away or busy, the message that fills a list with nothing in it, and the short message that pops up after an action, often with an Undo button. The repository has a `ui-web` package, but it holds only icons. Every screen that shows a person, an empty list or the result of an action would have to copy these four pieces from the prototype by hand, and the copies would drift apart.
Two rules of the decision log also need one shared home. An empty list shows a message in the middle of the content area (D-074). A toast never covers the composer or the navigation (D-078), and a reversible action shows a toast with Undo for 5 seconds (D-069). The prototype's toast sits over the composer on a wide screen, so copying it would break D-078.

## Proposed outcome
`ui-web` offers four components that look like the prototype in Calm and Focus: Avatar (initials on a colour, no picture), PresenceDot, EmptyState and Toast. A screen puts one on the page without knowing a colour, a size or a position. An empty list is centred in the content area, and a toast always stays above the composer and the navigation.
The builder (Thanh and Claude) can build the shell, the lists, the profile and the Undo pattern on these four pieces.

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every Member and Admin, who see avatars, presence, empty lists and toasts on every screen. Source: Toki Blueprint, intent I02 design-system.
- Systems: `packages/ui-web` (holds the icons after TOKI-011). Readers of it: `apps/web` and the screens built later.
- The tickets that build on this one: see Constraints.

## Constraints
- Blueprint work area: Design system. Source: Toki Blueprint, ticket TOKI-013.
- Belongs to Blueprint intent I02 design-system, whose result is that every base component matches the prototype in Calm and Focus, in all three layouts. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: M, about one working session with Claude. Source: Toki Blueprint, ticket TOKI-013.
- Needs: TOKI-009 (tokens) and TOKI-018 (platform). Source: Toki Blueprint, ticket TOKI-013, Needs column. It also builds on the icons of TOKI-011 and the fonts of TOKI-010.
- Needed by: TOKI-015 (AppShell) and TOKI-093 (Destructive-action and unsaved-form patterns) directly. Source: Toki Blueprint, ticket list, Needs column.
- Agreed scope: Avatar, PresenceDot, EmptyState centred in the content area, Toast placed above the composer with an Undo button. Source: Toki Blueprint, ticket TOKI-013.
- An empty list shows a message written for its context, centred in the content area. Source: D-074, FR-30, AC-079.
- Toasts and floating bars never cover the composer or the navigation. Source: D-078, NFR-09, BR-33.
- A reversible action shows a toast with Undo for 5 seconds; an irreversible one asks for confirmation; never both. Source: D-069, FR-29, BR-20.
- Initials on a colour in phase 1; no profile picture. Source: D-118.
- Presence turns to Away after 5 minutes without activity; there is no separate Offline state. Source: D-036, FR-32.
- No feature is hover-only or desktop-only. Source: D-067, NFR-02.
- Every icon-only button has a name for screen readers. Source: D-075, NFR-03.
- English is the default interface language and every text goes through i18n. Source: D-018, NFR-05.
- Every component looks like the prototype in Calm and Focus, at both densities. Source: Toki Blueprint, intent I02; D-018.
- The web styling is the prototype's CSS carried over almost intact, on CSS variables; no Tailwind and no runtime styling library. Source: Toki Blueprint, technical design, Frontend.
- M1 exit check that this ticket supports: the component preview page matches the prototype in Calm and Focus at all three layouts. Source: Toki Blueprint, milestone M1.

## Open questions
- Where does the presence data (Active, Away, Do not disturb) come from, and which rules give the dot its colours?
- What is the line between the Toast here and the Undo pattern of TOKI-093?
- How long does a toast stay when it has no Undo button, how do several toasts stack, and what happens at narrow width and with the on-screen keyboard?
- Where does the colour (hue) of a person's avatar come from?
- How does the toast know where the composer is, when the composer is built by another ticket?
