# Intent: The tokens package
Author: Thanh Truong

## Problem
The prototype defines Toki's two looks, four accent colours, two densities, its corner radii and its shadows as CSS variables inside one HTML file. The repository has a `tokens` package, but it is empty: it exports nothing.
Every base component (TOKI-012, TOKI-013) needs these values before it can be drawn. If each component copies the values from the prototype by hand, they drift apart, and the component preview page can no longer match the prototype in Calm and Focus.
The phone app of phase 3 needs the same values, and React Native cannot read a CSS file.

## Proposed outcome
The design values of the prototype live in one place in the repository. The web components read them as CSS variables, and the same values are available as plain objects that React Native can use in phase 3.
A person's choice of look (Calm or Focus), accent (teal, indigo, clay, violet) and density (Comfortable or Compact) can each be applied without any component knowing a colour or a size itself.
The builder (Thanh and Claude) can start the base components without opening the prototype to look up a value.

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every user, who sees the two looks. Source: Toki Blueprint, intent I02 design-system ("The builder; indirectly every user").
- Systems: `packages/tokens` (created empty by TOKI-001). Later readers of it: `packages/ui-web` and `apps/web` now, `packages/ui-native` and `apps/mobile` in phase 3.
- The base components (TOKI-012, TOKI-013) use the result of this ticket.

## Constraints
- Blueprint work area: Design system. Source: Toki Blueprint, ticket TOKI-009.
- Belongs to Blueprint intent I02 design-system, whose result is that every base component matches the prototype in Calm and Focus, in all three layouts. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: M, about one working session with Claude. Source: Toki Blueprint, ticket TOKI-009.
- Needs: TOKI-001 (Set up the pnpm monorepo and TypeScript). Source: Toki Blueprint, ticket TOKI-009, Needs column.
- Needed by: TOKI-012 and TOKI-013 (base components) directly. Source: Toki Blueprint, ticket list, Needs column.
- Agreed scope: Calm and Focus palettes, 4 accents, density, radii, shadows; exported as CSS variables and as objects for React Native. Source: Toki Blueprint, ticket TOKI-009.
- The values come from the prototype; none is invented. Derived from Toki Blueprint, intent I02: it asks that every base component "matches the prototype", which a changed or added value would break. I02 does not state this rule in these words.
- Phase 1 builds both looks, Calm and Focus. Source: D-018, NFR-05.
- The accents are teal, indigo, clay and violet; the densities are Comfortable and Compact; each applies at once (Source: FR-43, AC-122) and without a reload of the page (Source: TS-195). The look also changes at once without a reload (Source: AC-120).
- "Match my device" shows Focus when the device is set to dark and Calm when it is set to light. Source: FR-43, AC-120, D-175.
- The web styling is the prototype's CSS carried over almost intact, on CSS variables; no Tailwind and no runtime styling library. Source: Toki Blueprint, technical design, Frontend.
- The `tokens` package is shared by the web app, the phone app and the desktop app. Source: Toki Blueprint, technical design, code structure and reuse table.
- M1 exit check that this ticket supports: the component preview page matches the prototype in Calm and Focus at all three layouts. Source: Toki Blueprint, milestone M1.

## Open questions
- Which density does a new account start with? The prototype starts with none chosen: Calm then uses the Comfortable sizes and Focus the Compact sizes. The decision log does not say.
- Which accent does a new account start with? The prototype starts with teal. The decision log does not say.
- The technical design describes `tokens` as "colours, fonts, spacing", but the scope of this ticket names no fonts. Do the three font families become tokens, and in which ticket?
- The prototype also defines colours used only by the Meet call screen, and Meet is not in phase 1. Do they belong in the package now?
- The decision log sets no colour contrast target. Are the prototype's colours taken as they are?
