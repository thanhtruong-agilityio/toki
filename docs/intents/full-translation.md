# Intent: Full translation
Author: Thanh Truong

## Problem
Toki must be fully usable in English and in Vietnamese in its first release (D-018, D-064). The i18n package (TOKI-017) holds the catalogs, the lookup and the missing-translation check, and every screen ticket adds its own texts in both languages. Three things are still nobody's:
- Nothing stops a component from holding an English literal. The i18n spec left the lint rule against literal text to this ticket, and `apps/web` already has one (`Page not found`).
- Dates and times are written by `@toki/shared`, but its table of weekday and month names holds English only, so a Vietnamese interface shows `Tue 10 Nov`. Three screens have each built their own copy of the hook that gives a formatter its context, each reads the time zone of the device, and the Preferences zone of the profile is not read by any of them. Nothing stops a screen from formatting a date with the browser (`toLocaleDateString`, `hour12`).
- Almost every Vietnamese text is a draft written by the ticket that added its key. The merged specs hand the review of these drafts to this ticket, and no spec says who reads them or how.

## Proposed outcome
Every text a person reads is in English (the default) and in Vietnamese, and CI shows it: a text that lacks a language, a literal in a component and an English text on a Vietnamese screen each turn a check red. Every date and time on every screen is written by the one shared module, in 24-hour time, with the year when it is not the current year, in the person's time zone, with Vietnamese weekday and month names in the Vietnamese interface. The Vietnamese drafts are reviewed once, against one glossary, and the way they are sourced and reviewed is written down.

## Affected users and systems
- Users: every Member and Admin who reads the interface in Vietnamese; the builder, who adds texts.
- Systems: `packages/i18n` (a report command, a glossary test), `packages/shared` (`datetime/names.ts`), `apps/web` (the date context hook, literals moved to the catalog), `packages/ui-web` (literals found by the rule, if any), `tools/lint-rules` and `eslint.config.js` (two rules), `e2e` (one browser check), and the catalogs of every namespace (Vietnamese values only).

## Constraints
- Blueprint work area: Design system / Translation. Source: Toki Blueprint, ticket TOKI-080.
- Size: M. Source: Toki Blueprint, ticket TOKI-080.
- Needs: TOKI-017 (i18n package). Source: Toki Blueprint, ticket TOKI-080, Needs column.
- Every string in English (the default) and Vietnamese. Source: D-018.
- CI fails when a string lacks a translation in either language. Source: D-064.
- 24-hour time everywhere, for every language. Source: D-123.
- One date format across the app; the year is shown whenever it is not the current year; 'Invalid Date' never appears. Source: D-073.
- Times are shown in the person's time zone. Source: Toki Blueprint, ticket TOKI-080; spec of TOKI-094, concern 2.
- Numbers and the names of days and months follow the interface language. Source: D-189; spec of TOKI-017, concern 2.
- The Vietnamese interface addresses the reader as 'bạn'. Source: D-188; spec of TOKI-017, concern 1.
- Every wording in quotes that the prototype does not contain, and every Vietnamese text except the navigation labels, is a proposal. Source: D-139.
- `ui-web` holds no text; every text reaches it as a prop. Source: specs of TOKI-012 and TOKI-013.
- The `notifications` namespace is written by two tickets (TOKI-075 and TOKI-102). Source: their specs, R13 and R14.

## Open questions
- Which time zone does a person see when no zone is set in their profile?
- Who reviews the Vietnamese drafts, and how is the review recorded?
- Does the lint rule against date formatting calls, which the date spec gave to "its own small ticket", belong to this ticket?
- Which of TOKI-075 and TOKI-102 owns the file of the shared `notifications` namespace?
- What does the CI check for a missing translation cover beyond TOKI-017's check?
