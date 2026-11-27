# Intent: Check the date and time rules on the phone's JavaScript engine

Author: Huy Nguyen

## Problem

The shared date and time rules (TOKI-094) decide every time and date a member sees: `15:05`, `Tue 10 Nov`, `Today 09:00`, the reminder choices, and whether a typed date is in the past. They work out the time in a member's zone with `Intl.DateTimeFormat` and a named IANA zone, in `packages/shared/src/datetime/zone.ts`. `packages/i18n/src/format.ts` formats numbers with `Intl.NumberFormat` for `en-GB` and `vi`. Their tests run only under Node, which ships full ICU data.

The phone app runs this code on Hermes, the JavaScript engine of React Native. How much of `Intl` Hermes offers, and which time zones and languages it knows, depends on the platform and its version. Nothing in the repository has run these rules on Hermes yet. If a zone is unknown there, the rules return `null`, and the app shows no time at all. A wrong offset shows the wrong time with no error.

The Mobile App Plan asks for this check early in MM1, because a gap could add a polyfill or change a tool choice for the tickets after it.
Source: `packages/shared/src/datetime/zone.ts`, `packages/i18n/src/format.ts` and `docs/specs/2026-11-16-date-time-rules-design.md` on `main`, 2026-11-27; Toki Blueprint, Mobile App Plan, gap check and notes on the order of work.

## Proposed outcome

- The date and time tests of `@toki/shared`, and the number format tests of `@toki/i18n`, run on Hermes on iOS and on Android, and their results are recorded.
- Every requirement of the date and time rules gives the same result on Hermes as under Node, or the gap is closed so that it does.
- Engineers know, before they build screens, whether the app needs an `Intl` polyfill, and if so which one and what it costs in app size.

## Affected users and systems

- Users: the engineers who build the app. Members see the result later, as correct times and dates in the app. Source: Toki Blueprint, Mobile App Plan, intent IM02.
- Systems: `packages/shared` (date and time rules) and `packages/i18n` (number format), as they run in `apps/mobile`; the development build of `apps/mobile`. Source: Toki Blueprint, Mobile App Plan, MOB-19.

## Constraints

- Blueprint ticket MOB-19 "Date and time rules on Hermes", from web ticket TOKI-094. Scope: the shared date and time tests run on the phone's JavaScript engine; an `Intl` polyfill if one fails. Size S. Source: Toki Blueprint, Mobile App Plan, MM1, area Design system.
- Milestone: MM1 "Mobile foundation and design system". Outcome: IM02, "Native components that match the prototype, so later screens are assembled rather than invented". Source: Toki Blueprint, Mobile App Plan.
- Start MM1 with a short spike on this ticket and on MOB-03, since both can change the tool choices of the rest. Source: Toki Blueprint, Mobile App Plan, notes on the order of work.
- Needs: the `apps/mobile` skeleton, TOKI-146 (MOB-03), to run code on Hermes. Source: Toki Blueprint, Mobile App Plan, MM1.
- The date and time rules read no clock and no ambient setting, and give the same result on any machine. Source: `docs/specs/2026-11-16-date-time-rules-design.md`, R17.
- The rules add no runtime dependency to `packages/shared/package.json`, and use no global outside the allow list (`Intl` and `Date` are language built-ins). Source: the same spec, R18; lint rule `toki/client-core-globals`.
- Times show as `HH:mm` on 24 hours; dates use the module's own name tables, not the runtime's. Source: the same spec, R1 and R2; D-123.
- The web app's behaviour and its tests do not change: a change to shared code keeps the web tests green in the same pull request. Source: Toki Blueprint, Mobile App Plan, notes on the order of work (stated for MOB-21 and MOB-22, which also change shared code).
- The app runs as a development build, not in Expo Go. Source: the mobile-app-skeleton spec (TOKI-146), R12.
- Not in this ticket: the mobile test harness (MOB-07), mobile CI (MOB-06), i18n on native (MOB-17), and any screen. Source: Toki Blueprint, Mobile App Plan, MM1.

## Open questions

- Where do the tests run on Hermes: inside the development build on a simulator and an emulator, or in the Hermes command-line engine, which may not carry the same `Intl` data as a phone?
- Which tests count: every test of `packages/shared/tests/datetime/` and the number format tests of `@toki/i18n`, or a chosen subset?
- If a test fails, is the fix an `Intl` polyfill loaded only in `apps/mobile`, or a change in the shared module? A polyfill must not reach `packages/shared` (no runtime dependency) or the web bundle.
- Is a polyfill's added app size acceptable, and up to what size?
- Does the check stay as a test that later runs in mobile CI (MOB-06, MOB-07), or is it a one-time record?
