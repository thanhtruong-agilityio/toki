# Intent: The i18n package
Author: Thanh Truong

## Problem
Toki must be fully usable in English and in Vietnamese in its first release, with English as the default. The repository has an `i18n` package, but it is empty: it exports nothing.
The prototype translates only 17 navigation labels and keeps every other text as an English literal inside its code. If the screens of the next milestones are built the same way, each text has to be found and moved later, and nobody can tell which texts still lack a Vietnamese version.
Screens are about to be written (the sign-in screens already name their text keys), so they need one agreed place for texts and one agreed way to name them before the first one is built.

## Proposed outcome
Every text of the interface is kept in one place, once per language, under a name that the screens use instead of the text itself.
A screen shows its texts in the language that is active, English when nothing else is chosen, and follows a change of language at once, without a reload.
A text that exists in one language and not in the other is found automatically, and a pull request that contains one does not show as green.
The builder (Thanh and Claude) can add the texts of a new screen by following one written naming rule, without asking how.

## Affected users and systems
- Users: the builder (one person building with Claude). Indirectly every Member, Admin and Guest, who read the interface in English or Vietnamese. Source: Toki Blueprint, intent I02 design-system ("The builder; indirectly every user").
- Systems: `packages/i18n` (created empty by TOKI-001). Later readers of it: `packages/ui-web` and `apps/web` now, `apps/server` for mail text, `packages/ui-native` and `apps/mobile` in phase 3. Source: Toki Blueprint, technical design, "What each client shares".
- The CI workflow of TOKI-007 gains one check.
- The full translation (TOKI-080) and every screen ticket use the result of this ticket.

## Constraints
- Blueprint work area: Design system. Source: Toki Blueprint, ticket TOKI-017.
- Belongs to Blueprint intent I02 design-system. Source: Toki Blueprint, intent list.
- Milestone: M1, Foundation and design system. Source: Toki Blueprint, milestone M1.
- Size: S, about half a working session with Claude. Source: Toki Blueprint, ticket TOKI-017.
- Needs: TOKI-001 (Set up the pnpm monorepo and TypeScript). Source: Toki Blueprint, ticket TOKI-017, Needs column.
- Needed by: TOKI-080 (Full translation). Source: Toki Blueprint, ticket list, Needs column.
- Agreed scope: translation framework, English by default, automatic check for missing keys. Source: Toki Blueprint, ticket TOKI-017.
- The missing-translation check is added to the CI workflow of TOKI-007. Source: Toki Blueprint, ticket TOKI-017.
- Two languages, English and Vietnamese; English is the default. Source: D-018, NFR-05.
- CI fails when a string lacks a translation in either language. Source: D-064.
- A new account's interface is in English, also when the browser's language is Vietnamese. Source: FR-43, AC-121, TS-193.
- A change of language applies to the whole interface at once, without reloading. Source: FR-43, AC-121, TS-194.
- The language is saved to the account and is the same on every device. Source: D-175.
- The `i18n` package is shared by the web app, the phone app and the desktop app; the server uses it for mail text only. Source: Toki Blueprint, technical design, "What each client shares".
- The package runs without a DOM or a browser API, because `client-core` may import it. Source: lint, format and boundary rules spec (TOKI-002), R5 and concern 10.
- Translating every screen is TOKI-080, not this ticket. Source: Toki Blueprint, ticket TOKI-080.
- Dates and times are formatted by the shared date and time rules (TOKI-094), with one format and 24-hour time everywhere. Source: Toki Blueprint, ticket TOKI-094; D-073, D-123.
- The initial JavaScript of the web app stays under 200 KB compressed. Source: Toki Blueprint, phase 1 acceptance criteria; CI spec (TOKI-007), R7.

## Open questions
- Which form of address does the Vietnamese interface use? D-188 is Open.
- Do number formats and the names of days and months follow the interface language? D-189 is Open.
- Which language does a signed-out page show: always English, or a language remembered on the device? The language is saved to the account, which is unknown before sign-in.
- The Blueprint names no translation library. Which one, or none?
- The ticket needs only TOKI-001, but its check must be added to the workflow that TOKI-007 creates. What happens when this ticket is built before TOKI-007?
- The prototype holds Vietnamese texts for 17 navigation labels only. Does this ticket carry them over, and which of them?
