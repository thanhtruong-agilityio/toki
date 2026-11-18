# Intent: Self-hosted fonts
Author: Thanh Truong

## Problem
The prototype draws all its text in three fonts: Be Vietnam Pro for the interface and messages, Bricolage Grotesque for titles and the workspace name, and JetBrains Mono for times, counters, keys and code. It loads them from Google Fonts when the page opens.
The web app in the repository has no fonts of its own. Without them every screen falls back to whatever font the device has, so no component and no screen can match the prototype.
Loading the fonts from another company's server, as the prototype does, would make every first visit depend on that server and tell it about each visit, although Toki is hosted by the company itself (D-004).
Toki is used in English and in Vietnamese, both in full (D-018, D-064), and people write Vietnamese names and messages whatever the interface language is. A font that lacks a Vietnamese letter shows that letter in a different font in the middle of a word.

## Proposed outcome
The web app shows text in the same three fonts as the prototype, in the same weights, and the font files come from Toki's own address. Nothing is fetched from a font service.
Every Vietnamese letter, with every tone mark, is drawn in the same font as the letters around it.
Text in the main font appears quickly on the first visit: that font is fetched early, and the font files are small because they hold only the Latin and Vietnamese characters.
The builder (Thanh and Claude) can write the components and screens with the prototype's font names and get the prototype's look, without setting up a font again.

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every Member, Admin and Guest, who read all text in these fonts. Source: Toki Blueprint, intent I02 design-system.
- Systems: the web app (`apps/web`), created by TOKI-006.
- Later readers of the result: the base components, the app shell and the component preview page (TOKI-012 to TOKI-016), which use the three font names.

## Constraints
- Blueprint work area: Design system. Source: Toki Blueprint, ticket TOKI-010.
- Belongs to Blueprint intent I02 design-system, whose result is that every base component matches the prototype in Calm and Focus, in all three layouts. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: S, about half a working session with Claude. Source: Toki Blueprint, ticket TOKI-010.
- Needs: TOKI-006 (Web app skeleton). Source: Toki Blueprint, ticket TOKI-010, Needs column.
- Agreed scope: three fonts subset to Latin and Vietnamese, with the main one preloaded. Source: Toki Blueprint, ticket TOKI-010.
- The three fonts are Be Vietnam Pro, Bricolage Grotesque and JetBrains Mono, self-hosted. Source: Toki Blueprint, technical design (Frontend).
- The fonts, their weights and where each is used come from the prototype; none is invented. Source: Toki Blueprint, intent I02 ("matches the prototype"); the prototype's font link and CSS.
- English is the default language and Vietnamese is fully supported. Source: D-018, D-064, NFR-05.
- First load on 4G takes under 2 seconds, and the initial JavaScript stays under 200 KB compressed. Source: D-113, NFR-13.
- Supported browsers: the last two versions of Chrome, Edge, Safari and Firefox. Source: D-108, NFR-14.
- The service worker is used for push only, so it does not store the fonts. Source: D-030, NFR-06.
- The prototype's CSS is carried over almost intact, on CSS variables. Source: Toki Blueprint, technical design (Frontend).

## Open questions
- Are the three font names design tokens, and which ticket holds them? The technical design describes `tokens` as "colours, fonts, spacing", but the tokens ticket (TOKI-009) lists no fonts and leaves this open.
- Which weight of the main font is "the main one" to preload? The Blueprint says only "the main one".
- The prototype shows some text in a style it loads no font file for: italic text (a draft marker, the edited marker, `_italic_` in a message) and the unread counter in JetBrains Mono at weight 600. Does Toki add font files for these?
