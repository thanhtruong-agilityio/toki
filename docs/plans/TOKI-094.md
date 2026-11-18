# TOKI-094 Shared date and time rules - implementation plan

**Goal:** `packages/shared/src/datetime/` holds pure functions that write a time, a date and a date with a time, check a date or time a person entered, and offer the quick time choices; all of it is exported from `@toki/shared`.

**Spec:** `docs/specs/2026-11-16-date-time-rules-design.md` (R1 to R18, all concerns decided). Tier M.

## Design

The design is the merged spec, section "Design" (types, one format, layout, errors). It is not repeated here. Decisions taken at the plan stage, where the spec leaves the method open:

1. **One zone reader.** `zone.ts` builds `Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year, month, day, hour, minute, second, weekday })`, one instance per zone kept in a module-level `Map`, and reads only the numeric parts through `formatToParts`. The weekday part is mapped to 0 to 6 by a fixed table, so no text from `Intl` reaches a result (spec, Design). The `Map` is a cache, not an ambient setting (R17).
2. **Offset** = `Date.UTC(parts of the instant read in the zone) - (at truncated to the second)`, in minutes. No second formatter.
3. **`atLocalTime`.** Take the calendar day of `now` in the zone, add `dayOffset` days with `Date.UTC` arithmetic, build the wall time as a UTC millisecond value `w`. Two candidates: `w - offset(w - 1 day)` and `w - offset(w + 1 day)` (the zone's offset before and after any change that day). A candidate is valid when `zonedParts` of it shows the wall time. Both valid (clock set back): the earlier. One valid: that one. None valid (clock set forward): the first instant after the gap, found by bisection between the two candidates on "offset equals the later offset" (about 25 steps, no loop on days).
4. **`validateDateTime`** parses `YYYY-MM-DD` and `HH:mm` with a strict regex plus a real-calendar check (round trip through `Date.UTC`), then asks the same candidate logic whether the wall time exists; a gap is `invalid` with `field: "time"`, an overlap takes the earlier instant (R12, R13). The shared helper is `zone.ts`'s internal `resolveWallTime(w, timeZone)` returning `{ kind: "ok" | "gap", at }`; `atLocalTime` uses the `gap` instant, `validateDateTime` rejects it.
5. **`formatDay`** compares calendar dates (`Date.UTC(y, m - 1, d) / 86 400 000` rounded) of `at` and `now` in the zone, so 23:30 plus 40 minutes is Tomorrow (R4).
6. **Imports** follow the repo (`./error.js`, `./datetime/index.js`), not the extensionless form of the spec; `pnpm typecheck` accepts both under `Bundler`. Recorded in the PR.
7. **Range.** An instant that is finite but outside plus or minus 8 640 000 000 000 000 is treated like a bad instant: every function of R7 returns `null`, validation returns `invalid`. `zone.ts` checks it before any `Intl` call, so no `RangeError` reaches a screen (decided in the grilling round).
8. **R17 check** is run by hand at step 13, `TZ=UTC` and `TZ=Pacific/Auckland`, and the output goes in the PR; no script and no CI change (decided in the grilling round).
9. **Vitest** is already at the root (TOKI-008, `vitest@5.1.0`, project glob `packages/*`): nothing is added to `packages/shared/package.json` (spec, Layout).

## AC -> step -> test

Each step writes its test first, sees it fail for the right reason, then writes the code. Files are under `packages/shared/src/datetime/`.

| Requirement | Step | Test file: what it proves |
| :-- | :-- | :-- |
| R8 (table part) | 1. `names.ts` (Table B, `en` only, `namesFor(language)` falls back to `en`) | `names.test.ts`: 7 weekday and 12 month names; `'vi'` and `'fr'` give the English names |
| R7, R9 | 2. `zone.ts`: `isValidTimeZone`, `zonedParts`, `utcOffsetMinutes` | `zone.test.ts`: offsets 420, 330, -300 (January) and -240 (July); bad instant and bad zone give `null`; empty zone and `Mars/Phobos`; the limits 8.64e15 (valid) and 8.64e15 + 1 (`null`) |
| R10 | 3. `zone.ts`: `atLocalTime`, `resolveWallTime` | `zone.test.ts`: 09:00 today and tomorrow in `Asia/Ho_Chi_Minh`; `America/New_York` 02:30 on the spring-forward day (first instant after the gap, 03:00 local) and 01:30 on the fall-back day (earlier instant); bad `time` |
| R1, R6 | 4. `format.ts`: `formatTime`, `formatCountdown` | `format.test.ts`: midnight `00:00`, 23:59, Kolkata half hour, no `AM`, `PM`, `24:`; countdown values 0, negative, 999, 65 000, 3 599 000, 3 600 000, 3 725 000, `-Infinity` |
| R2, R3 | 5. `format.ts`: `formatDate` | the examples; year change in `Asia/Ho_Chi_Minh`; `weekday: false`; `year: "always"`; context with no `dayWords` |
| R4, R5 | 6. `format.ts`: `formatDay`, `formatDateTime` | Today, Tomorrow, Yesterday around midnight; the 23:30 case; the five examples of R5 |
| R7, R8 | 7. `format.test.ts` sweep | every function with `NaN`, `Infinity`, `-Infinity`, an ISO string cast, an empty zone, `Mars/Phobos`; every string result checked against `/Invalid Date\|NaN\|undefined/`; day words `T1 T2 T3` leave only digits, spaces, colons |
| R11, R12, R13 | 8. `validate.ts`: `validateDateTime` | each empty case and its `field`; `2026-02-30`, `2026-13-01`, `24:00`, `9:5`, `tomorrow`; one minute before, equal to, one minute after `now`; gap day (invalid, `time`), overlap day (earlier) |
| R14 | 9. `validate.ts`: `validateFutureInstant` | `null`, `undefined`, `NaN`, `now - 1`, `now`, `now + 1` |
| R15 | 10. `validate.ts`: `validateDateNotPast` | yesterday, today, tomorrow where the UTC date differs from the zone date; `2026-02-30`; empty string |
| R16 | 11. `quick-choices.ts` | now at 10:42, 14:59:59, 15:00:00 and 23:30 in `Asia/Ho_Chi_Minh`: three entries, order, every `at` after `now` |
| R18 | 12. `index.ts` for the module, one line in `packages/shared/src/index.ts` | a test imports every name from `@toki/shared`; `pnpm typecheck` exits 0; `packages/shared/package.json` gains no dependency |
| R17 | 13. Whole suite twice | `TZ=UTC` and `TZ=Pacific/Auckland` give the same results; `grep -rE "Date\.now\|new Date\(\)" packages/shared/src/datetime --include=*.ts --exclude=*.test.ts` finds nothing |

Also run at the end: `pnpm lint`, `pnpm test`, `pnpm typecheck` from the worktree root.

## Risks (riskiest step first)

- **Step 3, the gap and overlap rules.** Bisection and the two-candidate test are easy to get wrong near a change of offset. Tested on `America/New_York` and `Pacific/Auckland` (a southern zone, changes in a different season), plus `Asia/Ho_Chi_Minh` (no change).
- **Step 2, `Intl` quirks.** `hourCycle: "h23"` must give `00` for midnight (some runtimes print `24`); the test at midnight catches it. Years before 1000 and after 9999 are out of range and not tested.
- **R17.** `TZ` must not leak in: the zone is always passed to `Intl`, never defaulted.
- **Lint.** The allow list of TOKI-002 may forbid `Intl`; if lint fails, add it to the allow list in `eslint.config.js` (a built-in, spec R18) and say so in the PR.
- **Size.** Eighteen requirements in one PR: kept small by writing no code beyond the 13 steps.
