# Intent: Component preview page
Author: Thanh Truong

## Problem
The base components, the icons, the fonts and the tokens of Toki are built one ticket at a time, and each ticket checks its own look by eye against the prototype once, on a throwaway page that is then deleted. Nothing in the repository shows all of them together in Calm and in Focus, so nobody can say that the design system as a whole matches the prototype, and a later change to a token or a component can break the look without anyone noticing.
The milestone M1 ends only when "the component preview page matches the prototype in Calm and Focus at all three layouts". Today that sentence cannot be checked: there is no page, and "matches" has no meaning that a person other than its author could verify.

Source: Toki Blueprint, plan (ticket TOKI-016, milestone M1 and its done-when line, intent I02 design-system).

## Proposed outcome
The builder (Thanh and Claude) opens one page in development and sees every component, every icon, the fonts and the tokens, in Calm or Focus, in any accent and density, at the width of the browser window.
The page lists, for each component, the places in the prototype to compare it with, so that the comparison is done on named states and not on a general impression.
Some of the comparison is automatic and runs in CI: the page lists everything, nothing on it fails, and the colours, sizes and narrow-screen rules that the specs fix are the ones the browser draws. The rest is done by eye and recorded in the pull request. The spec says what each kind of check proves and what it does not.
Proposed, pending the first open question: the page is a tool for the builder and does not reach the people who use Toki.

## Affected users and systems
- The builder (one person building with Claude). Source: Toki Blueprint, intent I02 design-system ("The builder; indirectly every user").
- `apps/web` (a second page in development only) and its end-to-end test. No change to `packages/*`.
- Readers of the result: the tickets that build the app shell, the overlays and every screen, which assume that the components look like the prototype.

## Constraints
- One page that lists every component in both looks, for comparison with the prototype. Source: Toki Blueprint, ticket TOKI-016.
- Milestone M1 Foundation and design system. Its exit check includes "the component preview page matches the prototype in Calm and Focus at all three layouts". The three layouts are Calm, Focus and narrow under 720 px (technical design, Frontend, "Three layouts, one component set"; D-068 gives the widths: one pane under 720 px, side panels overlay the chat from 720 to 1099 px, three columns from 1100 px). Source: Toki Blueprint, plan, milestone M1 and intent I02.
- The prototype is the only design source (D-019). Where it draws nothing, Claude decides; those states cannot be compared with the prototype.
- Size: S (about half a working session with Claude). Source: Toki Blueprint, ticket TOKI-016.
- Needs TOKI-012 (base components, group 1); the spec of TOKI-013 (concern 9) says it also needs TOKI-013, and later TOKI-014 and TOKI-015; the spec of TOKI-012 only lists TOKI-016 under "Needed by". Source: Toki Blueprint, plan; specs of TOKI-012 and TOKI-013.
- English is the default interface language and every interface text goes through i18n (D-018, D-064).
- Demo-only controls never ship (D-145). That decision is about the prototype's demo bar; no decision says whether a builder's page ships.
- No component holds a text of its own; examples carry demo words that are test data. Source: spec of TOKI-012 (R3, Examples).
- Smallest supported window 360 by 560; under 720 px one pane and every control at least 40 px tall (D-068, journey F38). Source: Toki Blueprint, D-068.

## Open questions
- Does the page ship in the production build, or is it for development only?
- What does "matches the prototype" mean in a way that can be checked, when the prototype is not in the repository and no screenshot tool is set up?
- Which are the "three layouts" for a page of components, and is "both looks" two looks side by side or one look at a time?
- Which of the page's own words go through i18n?
