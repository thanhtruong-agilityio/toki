# Shared date and time rules design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/date-time-rules.md (Thanh Truong)
Ticket: TOKI-094

## Goal
The builder (Thanh and Claude) needs one place that knows how Toki writes a time, a date and a date with a time, and how it checks a date or time that a person entered. Today `packages/shared` holds no such code, and the prototype writes dates with six helper functions and one direct browser call that do not agree with each other.
After this change `packages/shared` holds a small module of pure functions that the server, `client-core` and `ui-web` all call, so every screen follows D-073 and D-123 and a time refused on the screen is refused by the server for the same reason.

## Scope
- In: a module `packages/shared/src/datetime/` of pure functions, exported from `@toki/shared`:
  - formatting: a time, a date, a day (with Today, Tomorrow, Yesterday), a date with a time, a countdown;
  - time zones: the calendar parts of an instant in a named zone, the instant of a local time in a named zone, the UTC offset of a zone;
  - validation: a required date and time, a real date and time, a future instant, a date that is not past;
  - the quick time choices of the reminder and snooze menus (D-114);
  - unit tests for all of the above; Vitest in `packages/shared` if it is not there yet.
- Out (not now):
  - The clock. `packages/shared/src/clock` (`now()`, system and test implementations) is built by TOKI-008. This module never reads a clock: every function receives "now" as a value, and the caller takes that value from the TOKI-008 clock.
  - The line with `packages/i18n` (TOKI-017), stated once: `shared` builds the whole date or time string. It holds the short weekday and month names itself, as a table per language code, and takes the language code (`'en'` or `'vi'`, the codes of TOKI-017) as an argument. `i18n` formats no date and holds no weekday or month name; it supplies the language code and every other word. The three day words (Today, Tomorrow, Yesterday) are ordinary `i18n` keys: the caller reads them from `i18n` and passes them to the formatter as `dayWords`. Their keys are added by TOKI-042 (Message component), the first screen that shows a day divider. Neither package imports the other.
  - The labels of the quick time choices ('In 1 hour', 'Today 15:00', 'Tomorrow 09:00', 'In 3 hours'): texts in the `i18n` catalogue, added by TOKI-066 (Activity screen), which is the first screen that shows them; TOKI-067 (Later) reuses them. This module returns only an id and an instant for each choice.
  - Number formats (thousands separators, as in the prototype's `fmtN`): not dates or times; `packages/i18n` owns them and builds them when D-189 is decided (spec of TOKI-017, Scope).
  - The message a screen shows when a check fails, and the error `code` a server route returns: each ticket that has the field (TOKI-067 for a reminder, TOKI-066 for a snooze, TOKI-056 for a status). This module returns only the reason (`required`, `invalid`, `past`).
  - The date and time input components (pickers): the ticket of the screen that has one. No phase 1 screen in the plan has a typed date field; reminder and snooze use the quick choices.
  - The text of a UTC offset on the profile ("UTC+7" or another form): TOKI-057 (Profile panel). This module returns the offset as a number of minutes.
  - Relative times ("just now", "5 min ago"), durations of voice clips (`0:42`) and time left in words ("12 min"): the prototype has them (Table A, forms 9 to 11) on screens outside phase 1 or in no screen at all; no phase 1 ticket asks for them. The ticket that first needs one adds it to this module.
  - Storing a person's time zone and the Preferences field for it: TOKI-078 (Preferences screen) and the accounts tickets.
  - A lint rule that forbids other date formatting calls outside this module: see concern 6.

## Requirements
- R1. `formatTime(at, timeZone)` returns the time of the instant `at` in the zone `timeZone` as `HH:mm`: two digits for the hour from `00` to `23`, a colon, two digits for the minute. Midnight is `00:00`, never `24:00`; the result never holds `AM` or `PM` (D-123). Example: 2026-11-10T08:05:00Z in `Asia/Ho_Chi_Minh` gives `15:05`.
- R2. `formatDate(at, ctx)` returns the date as the short weekday name, the day of the month without a leading zero, and the short month name, separated by single spaces. The two names come from the module's own name table for `ctx.language`; for `'en'` they are the values of Table B. Example: `Tue 10 Nov`. With the option `weekday: false` the weekday and its space are left out: `10 Nov`.
- R3. `formatDate` adds a space and the four-digit year after the month when the year of `at` differs from the year of `ctx.now`, both read in `ctx.timeZone`: `Thu 31 Dec 2026` seen from 2027, and `Fri 1 Jan 2027` seen from 2026 (D-073). In the same year no year is shown. With the option `year: "always"` the year is shown in every case (D-056).
- R4. `formatDay(at, ctx)` returns `ctx.dayWords.today`, `ctx.dayWords.tomorrow` or `ctx.dayWords.yesterday` when `at` falls on the calendar day of `ctx.now`, the day after or the day before, counted in `ctx.timeZone`; for any other day it returns the same text as `formatDate(at, ctx)`. The day is compared by calendar date, not by a difference of 24 hours: with now at 23:30, an instant 40 minutes later is Tomorrow.
- R5. `formatDateTime(at, ctx)` returns `formatDay(at, ctx)`, one space, then `formatTime(at, ctx.timeZone)`. Examples with now on Tue 10 Nov 2026: `Today 15:00`, `Tomorrow 09:00`, `Yesterday 18:20`, `Mon 16 Nov 09:00`, `Fri 1 Jan 2027 09:00`.
- R6. `formatCountdown(ms)` returns the whole seconds of a length of time as `mm:ss` below one hour and `h:mm:ss` from one hour, where `mm` and `ss` always have two digits and `h` has no leading zero. Examples: 65 000 gives `01:05`; 3 725 000 gives `1:02:05`. A value of zero or below gives `00:00`.
- R7. Every formatter of R1 to R6 returns `null`, and no text, when an instant it is given is not a finite number or the zone it is given is not known to the runtime. No function of this module ever returns a string that contains `Invalid Date`, `NaN` or `undefined` (D-073, NFR-08). A test calls each formatter with `NaN`, `Infinity`, `undefined` cast to a number, an empty zone and the zone `"Mars/Phobos"` and checks both statements.
- R8. The only words in a result of R2 to R5 are the weekday and month names of the name table and the three words of `ctx.dayWords`. A test passes the day words `T1`, `T2`, `T3` and finds, in every result, only those three, names of Table B, the digits `0` to `9`, spaces and colons. The name table has exactly 7 weekday names and 12 month names for every language it lists, and a language code it does not list (including `'vi'` until concern 1 is closed) gets the English names.
- R9. `zonedParts(at, timeZone)` returns the year, month (1 to 12), day, hour (0 to 23), minute, second and weekday (0 = Sunday to 6 = Saturday) of the instant in the zone, or `null` under the conditions of R7. `utcOffsetMinutes(at, timeZone)` returns the offset of the zone from UTC at that instant in minutes, east positive: `420` for `Asia/Ho_Chi_Minh`, `330` for `Asia/Kolkata`, and `-300` or `-240` for `America/New_York` depending on the date. `isValidTimeZone(timeZone)` returns `true` for a zone name the runtime knows and `false` for anything else, without throwing.
- R10. `atLocalTime(now, timeZone, dayOffset, time)` returns the instant at which the wall clock in `timeZone` shows `time` (`HH:mm`) on the calendar day `dayOffset` days after the day of `now` (0 = today, 1 = tomorrow). When that wall-clock time occurs twice on that day (a clock set back), the earlier instant is returned; when it does not occur (a clock set forward), the first instant after the gap is returned. It returns `null` for a `time` that is not a real `HH:mm` or under the conditions of R7.
- R11. `validateDateTime({ date, time }, { now, timeZone })` checks a date typed as `YYYY-MM-DD` and a time typed as `HH:mm`, both as strings. It returns `{ ok: false, reason: "required", field }` when `date` or `time` is missing, empty or only spaces, where `field` names the first empty one (`"date"` before `"time"`) (D-073).
- R12. `validateDateTime` returns `{ ok: false, reason: "invalid", field }` when a filled field does not have its form or does not name a real date or time: `2026-02-30`, `2026-13-01`, `24:00`, `9:5` and `tomorrow` are all invalid. A local time that does not exist on that day in that zone (a clock set forward) is invalid with `field: "time"`.
- R13. `validateDateTime` returns `{ ok: false, reason: "past" }` when the instant of that date and time in `timeZone` is equal to or earlier than `now`, and `{ ok: true, at }` with that instant when it is later than `now` (D-073, D-055). A time that occurs twice on that day resolves to the earlier instant.
- R14. `validateFutureInstant(at, now)` is the same rule for a value that is already an instant, as a server route receives it: `required` when `at` is `null` or `undefined`, `invalid` when it is not a finite number, `past` when `at <= now`, otherwise `{ ok: true, at }`.
- R15. `validateDateNotPast(date, { now, timeZone })` checks a date without a time (`YYYY-MM-DD`): `required` and `invalid` as in R11 and R12; `past` when the date is before the calendar day of `now` in `timeZone`; otherwise `{ ok: true, date }`. The day of `now` itself is accepted, because it is not in the past (D-056).
- R16. `quickTimeChoices(now, timeZone)` returns the choices of the reminder and snooze menus, in this order, each as `{ id, at }`: `in1Hour` (`now` plus 3 600 000 ms); `today1500` (15:00 today in `timeZone`); `tomorrow0900` (09:00 tomorrow in `timeZone`). When 15:00 today is equal to or earlier than `now`, `today1500` is not in the list and `in3Hours` (`now` plus 10 800 000 ms) stands at its position (D-114). Every `at` in the result is later than `now`, and the list always has exactly three entries.
- R17. The module reads no clock and no ambient setting: no call to `Date.now()`, no `new Date()` without an argument, no use of the runtime's own time zone or language. The same arguments give the same result on any machine. A test runs the suite with the environment variable `TZ` set to `UTC` and again to `Pacific/Auckland` and gets the same results; `grep` finds no `Date.now` and no `new Date()` in the module's source files (test files excepted).
- R18. Everything above is exported from `@toki/shared` (`packages/shared/src/index.ts`), and `pnpm typecheck` at the root exits 0. The module adds no runtime dependency to `packages/shared/package.json`, and its source files use no global outside the allow list of TOKI-002 (`Intl` and `Date` are language built-ins).

## Design
### What the prototype shows today
Found by searching the prototype (`docs/blueprint/prototype/index.html`) for its date functions and for every use of `Date`, `toLocale` and `padStart`. The string 'Invalid Date' and the text 'In 3 hours' do not occur in it.

Table A. Forms in the prototype.

| # | Form | Example | Prototype function (line) | Where it is shown | In this module |
|---|---|---|---|---|---|
| 1 | Time, 24-hour | `15:05` | `hm` (1132), `nowStr` (1133), `localTime` (1152) | Message time, Activity item time, "Focus time until", "Notifications paused until", profile local time, People cards | R1 |
| 2 | Day word | `Today`, `Yesterday` | `dayLabel` (1324) | Day divider in a conversation | R4 |
| 3 | Day word or weekday, then time | `Today 15:00`, `Tomorrow 09:00`, `Mon 09:00` | `fmtAt` (1129) | Snooze "back …" (1560), reminder (1569), "Clears …" for a status (1653), the toasts 'Snoozed until', 'Reminder set for', 'Scheduled for' | R5, with the full date in place of the bare weekday (concern 3) |
| 4 | Weekday, day, month | `Wed 12 Nov` | `dayName(d, true)` (1128), `dl` (1851) | Calendar and Meets | R2 |
| 5 | Day, month | `10 Nov` | `dl` (1976) | Admin chart | R2 with `weekday: false` |
| 6 | Weekday, day, month through the browser, en-GB | `Thu, 31 Dec` | `dueLabel` (2223) | Guest "access until", task due date | R2, R3 (the year is missing in the prototype) |
| 7 | Count up or down | `12:41`, `1:02:05` | `mmss` (1134) | Time left in Pause and Focus (1270, 1271), status clear countdown, Meet timer | R6 |
| 8 | Time with seconds | `10:42:20` | `hms` (1766) | Demo choices only ("In 20 seconds (demo)") | Not built: a prototype device |
| 9 | Relative | `just now`, `5 min ago` | `ago` (1131) | Notes "Last edited by" | Out |
| 10 | Time left in words | `45 s`, `12 min`, `2 h 5 min` | `fmtLeft` (1130) | Defined, used nowhere | Out |
| 11 | Clip length | `0:42` | `fmtDur` (1375) | Voice clip | Out |
| 12 | Field values | `2026-11-10`, `09:15` | `isoDay` (1859), `dayFromIso` (1860) | `type="date"` and `type="time"` inputs (Meet form, guest invite, task) | R11, R12, R15 (the same two string forms) |
| 13 | Quick choices | 'In 1 hour', 'Today 15:00', 'Tomorrow 09:00' | `timeChoices` (1754) | Reminder and snooze menus | R16 (ids and instants only) |

What the prototype does not do: it never shows a year; it never reads a time zone (its clock is a fixed day, and `localTime` adds whole hours to it); its only checks are 'Add a title' and 'Pick a date and a start time' in the Meet form (1873, 1874), and it accepts a past time.

Table B. The English names, from the prototype (`WD` and `MO`, line 1127). They are the `'en'` entry of the name table in `names.ts`.

| Names | Values |
|---|---|
| Short weekday names (Sunday first) | Sun, Mon, Tue, Wed, Thu, Fri, Sat |
| Short month names | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec |

The day words in the prototype are Today, Tomorrow and Yesterday (`dayName`, line 1128). They are not in this module (Scope).

### The one format
- Time: `HH:mm` (R1). From the prototype (form 1) and D-123.
- Date: weekday, day, month, and the year only when it differs: `Tue 10 Nov`, `Tue 10 Nov 2027` (R2, R3). The order weekday, day, month is the prototype's (form 4). The position of the year, after the month, is decided in this spec: the prototype never shows one, and this keeps the day-month-year order of its dates.
- Day: Today, Tomorrow, Yesterday, otherwise the date (R4). From the prototype (forms 2 and 3).
- Date with time: the day, a space, the time (R5). From the prototype (form 3), except that a day other than Today, Tomorrow and Yesterday is written as the full date, not as a bare weekday. Decided in this spec: a bare weekday cannot tell next Monday from the Monday after, and D-073 asks for one format (concern 3).
- No comma, no "at", no dot: the parts are separated by single spaces. Decided in this spec, following `fmtAt` and `dayName` in the prototype; the comma of form 6 comes from the browser's formatter, which this module replaces.
- The order of the parts is the same in every language; only the names and the day words change (concern 1).

### Types and functions
```ts
type Instant = number;                    // milliseconds since 1970-01-01T00:00:00Z

interface DayWords { today: string; tomorrow: string; yesterday: string }
interface FormatContext {
  now: Instant;
  timeZone: string;                       // IANA name
  language: string;                       // 'en' or 'vi'; an unknown code gets the English names
  dayWords: DayWords;                     // read from i18n by the caller
}

formatTime(at: Instant, timeZone: string): string | null
formatDate(at: Instant, ctx: FormatContext, opts?: { weekday?: boolean; year?: "whenDifferent" | "always" }): string | null
formatDay(at: Instant, ctx: FormatContext): string | null
formatDateTime(at: Instant, ctx: FormatContext): string | null
formatCountdown(ms: number): string | null

zonedParts(at: Instant, timeZone: string): ZonedParts | null
utcOffsetMinutes(at: Instant, timeZone: string): number | null
isValidTimeZone(timeZone: string): boolean
atLocalTime(now: Instant, timeZone: string, dayOffset: number, time: string): Instant | null

type Reason = "required" | "invalid" | "past";
validateDateTime(input: { date?: string | null; time?: string | null }, env: { now: Instant; timeZone: string }):
  { ok: true; at: Instant } | { ok: false; reason: Reason; field?: "date" | "time" }
validateFutureInstant(at: number | null | undefined, now: Instant):
  { ok: true; at: Instant } | { ok: false; reason: Reason }
validateDateNotPast(date: string | null | undefined, env: { now: Instant; timeZone: string }):
  { ok: true; date: string } | { ok: false; reason: Reason }

type QuickTimeId = "in1Hour" | "today1500" | "in3Hours" | "tomorrow0900";
quickTimeChoices(now: Instant, timeZone: string): { id: QuickTimeId; at: Instant }[]
```
- An instant is a number of milliseconds since the epoch. Decided in this spec: a number cannot be mutated, compares with `<`, and is what the prototype uses. A caller that holds a `Date` (for example from the clock of TOKI-008) passes `date.getTime()`; a caller that holds an ISO string from the API passes `Date.parse(text)`. A value that fails to parse is `NaN`, which R7 and R14 handle.
- Time zones are IANA names (`Asia/Ho_Chi_Minh`). Every function that depends on a zone takes it as an argument, so the question of which zone a screen uses (concern 2) is answered by the caller, not here. D-144 is met by passing the zone the person set: `formatTime(now, person.timeZone)`.
- The weekday and month names are a fixed table in `names.ts`, keyed by language code, not the output of `Intl`. Decided in this spec: the names `Intl` gives differ between runtimes and versions (for example `Sep` and `Sept`), and a fixed table gives the same text on the server, in the browser and in React Native. The table has one entry, `en` (Table B). No Vietnamese names are written now: the prototype has none and D-189 is Open, so `'vi'` gets the English names until concern 1 is closed. `language` is typed as `string` so that `shared` does not import `@toki/i18n`.
- Zone arithmetic uses `Intl.DateTimeFormat` with the `timeZone` option, a fixed locale and `hourCycle: "h23"`, and reads only the numeric parts through `formatToParts`; no text produced by `Intl` reaches a result. Decided in this spec: no date library is added. The module is small, `Intl` already knows every zone and its clock changes on Node 22 and in browsers, and a library would add to the 200 KB limit on the first JavaScript of the web app (TOKI-006).
- `atLocalTime` and `validateDateTime` find the instant of a wall-clock time by guessing with the zone's offset and correcting once or twice. The gap and overlap rules of R10, R12 and R13 are decided in this spec: for a reminder, firing at the first real moment is safer than failing, while a time a person typed that does not exist is reported to them.
- A formatter returns `null` for a bad instant or zone (R7). Decided in this spec: a thrown error would blank a whole screen for one bad value, and an empty string would hide the fault from the type checker; `string | null` makes each caller decide what to show. What a screen shows in that case belongs to the screen.
- Validation is plain functions that return a reason, not Zod schemas. Decided in this spec: the functions need "now" and a zone, which a static schema does not have; a ticket that wants the rule inside a Zod schema wraps the function in a refinement.
- "Later than now" is strict: an instant equal to `now` is past (R13, R14, R16), as in the prototype's `at(d,'15:00')>n`.

### Layout
```
packages/shared/
├─ package.json                  + vitest (devDependency) and a "test" script, if not there yet
└─ src/
   ├─ index.ts                   + export * from "./datetime/index.ts"
   ├─ clock/                     TOKI-008, not touched
   └─ datetime/
      ├─ index.ts                the public names of this module
      ├─ zone.ts                 zonedParts, utcOffsetMinutes, isValidTimeZone, atLocalTime
      ├─ format.ts               formatTime, formatDate, formatDay, formatDateTime, formatCountdown
      ├─ validate.ts             validateDateTime, validateFutureInstant, validateDateNotPast
      ├─ quick-choices.ts        quickTimeChoices
      ├─ names.ts                the weekday and month names per language code (Table B)
      └─ *.test.ts               one test file beside each source file
```
- Vitest: this ticket needs only TOKI-001, which has no test runner. If `packages/shared` has no Vitest when this ticket is built, it adds `vitest` to the package's `devDependencies`, pinned exactly, with the script `"test": "vitest run"`; if TOKI-004 or TOKI-008 has already added Vitest to the repository, it uses the same version and adds nothing else. Either way the tests are files under `src/`, which the root `pnpm test` of TOKI-008 picks up with no configuration change (its R12).

### Errors
- Bad instant or unknown zone given to a formatter or a zone function -> `null` (R7, R9, R10).
- Empty field -> `{ ok: false, reason: "required" }` (R11, R14, R15).
- Field that is not a real date or time -> `{ ok: false, reason: "invalid" }` (R12, R14, R15).
- Time not later than now, or date before today -> `{ ok: false, reason: "past" }` (R13, R14, R15).
- A validation function given an unknown zone -> it throws a `RangeError` that names the zone. This is a fault of the calling code, not of the person's input, so it is not one of the three reasons.

## Testing
- Unit tests with Vitest, written before the code, one file beside each source file. All instants in the tests are fixed numbers; no test reads the real time. The language is `'en'` and the day words are `Today`, `Tomorrow`, `Yesterday`, except in the R8 test.
- R1: a table of instants and zones, including midnight (`00:00`), 23:59, and `Asia/Kolkata` for a half-hour offset; no result matches `/AM|PM|24:/`.
- R2, R3: the examples of the requirements; the two sides of a year change in `Asia/Ho_Chi_Minh` (an instant that is 31 Dec in UTC and 1 Jan in the zone); `weekday: false`; `year: "always"`.
- R4, R5: Today, Tomorrow and Yesterday around midnight in the zone, including the 23:30 case of R4; the five examples of R5.
- R6: 0, a negative value, 999, 65 000, 3 599 000, 3 600 000, 3 725 000.
- R7: every formatter and zone function with each bad value listed in R7; then every result of the whole suite that is a string is checked against `/Invalid Date|NaN|undefined/`.
- R8: the day words `T1`, `T2`, `T3`; every result, with those three and the names of Table B removed, matches `/^[0-9 :]*$/`. The table is checked for 7 and 12 names per language; `'vi'` and `'fr'` give the same results as `'en'`.
- R9: the offsets named in R9, with a winter and a summer date for `America/New_York`; `isValidTimeZone` with `"Asia/Ho_Chi_Minh"`, `""`, `"Mars/Phobos"`.
- R10: today and tomorrow at 09:00 in `Asia/Ho_Chi_Minh`; in `America/New_York`, 02:30 on a day the clock is set forward and 01:30 on a day it is set back; a bad `time`.
- R11 to R13: each empty case and its `field`; each invalid example of R12; a time one minute before now, equal to now and one minute after now; the set-forward and set-back days.
- R14: `null`, `undefined`, `NaN`, `now - 1`, `now`, `now + 1`.
- R15: yesterday, today and tomorrow in the zone, at an instant where the UTC date and the zone's date differ; `2026-02-30`; an empty string.
- R16: now at 10:42, 14:59:59, 15:00:00 and 23:30 in `Asia/Ho_Chi_Minh`; in each case three entries, the order of R16, and every `at` later than `now`.
- R17: the package's test script is run twice in the check for this requirement, with `TZ=UTC` and with `TZ=Pacific/Auckland`; plus the `grep` of R17.
- R18: `pnpm typecheck`; `pnpm lint` once TOKI-002 is built; a look at `packages/shared/package.json` for `dependencies`.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Belongs to Blueprint intent I02 design-system, whose "done when" includes "the Undo, confirmation and date-rule patterns exist" | The module of R1 to R18 is the date-rule pattern. |
| Milestone: M1, Foundation and design system. Size: S. Needs: TOKI-001 | Scope: one module in `packages/shared`, no screen, no server route. Layout: Vitest is added here when it is missing, so nothing beyond TOKI-001 is needed. |
| Agreed scope: validation and formatting in `shared`: required fields, no past where a future time is needed, the year shown when it differs, one format with 24-hour time everywhere | R11 (required), R13 to R15 (no past), R3 (year), R1, R2, R4, R5 (one format, 24-hour). |
| Required date and time fields cannot be left empty | R11, R14, R15. |
| Where a future time is needed, the past is rejected | R13, R14, R15. |
| The year is shown whenever it is not the current year | R3. |
| One format across the app | Design, "The one format"; R1 to R6. Keeping other code from formatting dates by itself is concern 6. |
| 'Invalid Date' never appears | R7. |
| Time is 24-hour everywhere, for every language | R1: `formatTime` takes no language, so no language can change it. |
| In the reminder and snooze menus, a choice whose time has already passed is hidden; 'In 3 hours' takes the place of 'Today 15:00' | R16. |
| The local time on a profile comes from the time zone the person set, not from where they are now | R1 and R9 take the zone as an argument; R17 keeps the device's zone out. |
| `packages/shared` may use only the globals on the allow list of the lint rules | R18. |
| "Now" comes from the clock in `packages/shared/src/clock` built by TOKI-008; no second clock is built | R17; Scope, Out: the clock. |
| English is the default interface language and every text goes through i18n | R8: an unknown language gets English; the day words come from `i18n` through the caller. The weekday and month names are the one agreed exception and live here (Scope, the line with `packages/i18n`). |

## Open questions from the intent
- Do the names of days and months, and number formats, follow the interface language? Not answered. Carried forward as concern 1.
- In which time zone does a person see the times on their own screens? Not answered. Carried forward as concern 2.
- Which written form is "the one format"? Answered for this spec in Design, "The one format": the parts taken from the prototype are named there, and the two parts decided in this spec (the position of the year, the full date in place of a bare weekday) are carried forward as concern 3 for confirmation.

## Areas of concern
1. D-189 is Open: whether number formats and the names of days and months follow the interface language is not decided. This module takes the language code as an argument and today has English names only, so both languages show `Tue 10 Nov`. If the names follow the language, a `vi` entry is added to the name table; its 19 Vietnamese names are not in the prototype and must be supplied with the decision. If they do not follow it, nothing changes. Neither answer covers the order of the parts, which this spec keeps the same in every language (weekday, day, month, year). Proposal, not decided: the names follow the interface language, as D-189 proposes, and the order stays fixed. TOKI-080 is the latest ticket that can take the answer (spec of TOKI-017, concern 2). Owner: Thanh Truong.
2. No decision says in which time zone a person sees message times, reminder times and the other times on their own screens. D-144 covers only the local time shown on a profile. A person has a time zone setting (Preferences, Profile), and the device also has a zone; they can differ when the person travels. The answer changes what 'Today 15:00' and 'Tomorrow 09:00' mean in the reminder and snooze menus (R16) and what the server uses when it has to compute them. This module takes the zone as an argument, so it does not block this ticket; it blocks TOKI-066 and TOKI-067. Proposal, not decided: the zone of the device for everything a person sees on their own screen, and the zone set in the profile only for the local time that others see. Owner: Thanh Truong.
3. D-073 asks for one format but does not write it out, and the prototype has no year and no date for a day further away than tomorrow ("Mon 09:00"). Decided in this spec: the year comes after the month (`Tue 10 Nov 2027`), and a date with a time uses the full date for any day other than Today, Tomorrow and Yesterday (`Mon 16 Nov 09:00`). Both change what the prototype shows, so the product owner should confirm them. Owner: Thanh Truong.
4. D-056 says a past expiry date is rejected but not whether today is accepted. R15 accepts today, because today is not in the past. Until which moment of that day access lasts is not decided and belongs to the guest tickets, which are outside phase 1. Owner: Thanh Truong.
5. The plan lists only TOKI-001 as needed, but the tests need a test runner. Decided in this spec: this ticket adds Vitest to `packages/shared` when it is not there yet (Layout). If TOKI-008 is built first, nothing is added. The two tickets must end with one Vitest version in the repository; whichever is built second aligns it. Owner: Thanh Truong.
6. "One format across the app" holds only if no other code formats a date by itself (for example with `toLocaleDateString`, as the prototype's `dueLabel` does). Nothing in this ticket stops that; NFR-08 is measured by searching the screens. Proposal, not decided: add a lint rule to the configuration of TOKI-002 that forbids `toLocaleString`, `toLocaleDateString`, `toLocaleTimeString` and `Intl.DateTimeFormat` outside `packages/shared/src/datetime/`. No ticket owns this yet. Owner: Thanh Truong.
7. The module relies on `Intl.DateTimeFormat` with named time zones. Node 22 and current browsers have it. The React Native runtime of phase 3 must be checked for it when `apps/mobile` is created; if it lacks zone data, a polyfill is added there, and this module does not change. Owner: Thanh Truong.
8. The weekday and month names are texts that do not go through the `i18n` catalogue, so its missing-translation check does not see them. Decided in this spec, in agreement with the spec of TOKI-017: they stay in `names.ts`, and the test of R8 (7 and 12 names for every language in the table) stands in for that check. Owner: Thanh Truong.
