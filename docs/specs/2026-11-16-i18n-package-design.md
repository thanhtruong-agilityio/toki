# The i18n package design

Date: 2026-11-16 · Status: draft for review
Intent: docs/intents/i18n-package.md (Thanh Truong)
Ticket: TOKI-017

## Goal
The builder (Thanh and Claude) needs one place for the texts of the interface and one rule for naming them before the first screen is built. Today `packages/i18n` exports nothing, and the prototype keeps its texts as English literals with a Vietnamese version for 17 navigation labels only. After this change the package holds the texts once per language, gives a screen the text of a key in the active language (English when nothing else is chosen), follows a change of language without a reload, and has a check that fails when a text exists in one language and not in the other.

## Scope
- In: the content of `packages/i18n`:
  - the two language codes and the default;
  - the catalogs of texts, one folder per language, and the rule for naming keys;
  - a function that returns the text of a key in a language, with placeholders and plural forms;
  - a React provider and hook that give components the active language and that function;
  - the missing-translation check, its root script, and its job in the CI workflow;
  - the first namespace, `nav`: the 13 navigation labels of phase 1 that the prototype already holds in both languages;
  - tests for all of the above.
- Out (not now):
  - The texts of every screen in English and Vietnamese, and the review of each screen in both languages: TOKI-080. Each screen ticket adds its own keys in both languages when it builds the screen (the sign-in screens add `signIn.*` and `sessionEnded.*`), following R13 and R14.
  - Finding texts written as literals inside components: TOKI-080. This ticket adds no lint rule for it (concern 6).
  - The Language field in Preferences, saving the language to the account, passing the account's language to the provider of R10, and setting the `lang` attribute of the page: TOKI-078 (Preferences screen). Until then nothing passes a language, so every screen shows English (R10).
  - Which language a signed-out page shows: not decided (concern 3). This package shows English there.
  - Mail texts: TOKI-021 adds its keys and calls `translate` (R4) on the server with the language D-180 names.
  - Dates and times: `@toki/i18n` formats no date and no time and holds no month or weekday name. `packages/shared` (TOKI-094) builds the whole date or time string, month and weekday names included, and takes the language as an argument, one of the codes of R1. The weekday and month names stay in `names.ts` of `shared`, outside the catalogs, so the missing-translation check (R17) does not see them; the test of the date and time spec that counts 7 weekday and 12 month names per language stands in for that check there. This package supplies the language code, and the words around a date as ordinary keys. Decided in this spec: the three day words (Today, Tomorrow, Yesterday) are the keys `common.today`, `common.tomorrow` and `common.yesterday` (rule 3 of the naming rule: several screens show them, and the server needs them for dates in mail), added to both languages by TOKI-042 (Message component), the first screen with a day divider, which also creates the namespace `common`; the same ticket owns the small function that reads them with `t` and passes them to `shared` as `dayWords { today, tomorrow, yesterday }`, so a caller on the server builds the same object with `translate`. Whether the names follow the interface language is D-189 (Open, concern 2); either answer changes what the caller passes to `shared`, not this package.
  - Number formats by language: this package is the proposed owner, not built now, because D-189 is Open (concern 2). A number placed in a text is written as plain digits (R5); a caller that wants '1,204' passes the formatted string.
  - A third language, right-to-left text, loading a language on demand, texts with markup inside them, and a report of keys that no code uses.
  - The CI workflow itself and its five checks: TOKI-007. This ticket adds one job to it (R20).
  - The root `pnpm test` script: TOKI-008 (its R1 and R12) makes it run every package that has tests, this one included. Until then this package is tested with `pnpm --filter @toki/i18n test` (R23).

## Requirements
- R1. `@toki/i18n` exports `LANGUAGES`, equal to `['en', 'vi']` in that order, `DEFAULT_LANGUAGE`, equal to `'en'`, and the type `Language` (`'en' | 'vi'`) (D-018).
- R2. `isLanguage(value)` returns `true` for `'en'` and `'vi'` and `false` for every other value. `resolveLanguage(value)` returns `value` when `isLanguage(value)` is true and `'en'` otherwise; checked with `undefined`, `null`, `''`, `'fr'`, `'VI'` and `'vi-VN'`, which all give `'en'`.
- R3. `LANGUAGE_NAMES` is `{ en: 'English', vi: 'Tiếng Việt' }`. These two names are not keys and read the same in both languages (FR-43; the prototype's Language field).
- R4. `translate(language, key, params?)` returns the text of `key` from the catalog of `language`. Example: `translate('en', 'nav.home')` is `'Home'` and `translate('vi', 'nav.home')` is `'Trang chủ'`.
- R5. A placeholder `{name}` in a text is replaced by `params.name`: a string as it is, a number as `String(number)` with no grouping (the prototype groups with `toLocaleString('en-GB')`; this package does not until D-189 is answered, concern 2). A placeholder with no matching parameter stays in the text as written; a parameter with no matching placeholder is ignored. Example with a test catalog: `'{count} tries left'` and `{ count: 2 }` give `'2 tries left'`.
- R6. A text may have plural forms (Design, "Catalogs"). `params.count`, typed as a number, chooses the form: in English `one` when `count` is exactly `1` and `other` for every other value; in Vietnamese always `other`. When `count` is missing or is not a number (a string `'1'` included), `other` is used. A type error stops a caller from passing a string as `count` (Design, "Public API"). Example with a test catalog: `{ one: '{count} try left', other: '{count} tries left' }` gives `'1 try left'` for 1 and `'0 tries left'` for 0.
- R7. `translate` never throws, and looks a key up only among the own properties of a catalog, so a key part such as `constructor`, `toString` or `valueOf` is not found and the English text, or the key, is returned as for any missing key. When the catalog of `language` has no text for `key`, it returns the English text; when English has none either, it returns `key` itself. Checked with a test catalog whose Vietnamese part lacks one key, and with the keys `nav.toString` and `nav.constructor` (cast to `MessageKey` in the test).
- R8. `key` has the type `MessageKey`, the set of keys of the English catalog. A call with any other string, for example `translate('en', 'nav.nope')`, fails `pnpm typecheck`.
- R9. `createTranslator(language)` returns a function `t(key, params?)` whose result equals `translate(language, key, params)` for every key and parameter set used in the tests of R4 to R7. It returns the same function every time it is called with the same language, so a component that keeps `t` in a dependency list does not run again for nothing.
- R10. `@toki/i18n/react` exports `I18nProvider` and `useTranslation`. `useTranslation()` returns `{ t, language }`. Under `<I18nProvider language="vi">`, `language` is `'vi'` and `t('nav.home')` is `'Trang chủ'`. Under a provider with no `language` property, and with no provider at all, `language` is `'en'` and `t('nav.home')` is `'Home'` (D-018; AC-121: a new account is in English).
- R11. When the `language` property of `I18nProvider` changes, every component that uses `useTranslation` shows the texts of the new language on the next render; the package asks for no reload and keeps no copy of the language of its own (AC-121). The provider's context value is built with `useMemo` on `language`, so consumers render again only when the language changes, and `t` stays the same function (R9).
- R12. No source file of the package reads the language of the device or the browser: the strings `navigator` and `Intl` appear in the code, comments left out, of no file under `packages/i18n/src` (test files excepted). So a browser set to Vietnamese still gets English (TS-193). Expect this requirement to be rewritten when D-189 is answered: a number function that calls `Intl.NumberFormat` with an explicit language code reads no browser setting (concern 2).
- R13. The texts live in `packages/i18n/src/messages/<language>/<namespace>.ts`, one file per namespace and language, and each language has an `index.ts` that lists its namespace files. The check command of R16 also compares the files of each `messages/<language>` folder with the namespaces that its `index.ts` lists, and exits 1 naming the file when one is not listed. A namespace listed in `en` and not in `vi` is reported key by key through R17 (a).
- R14. Every key follows the naming rule of Design, "Key naming rule". The check of R17 fails on a key that breaks it and names the key.
- R15. The package ships one namespace, `nav`, with exactly the 13 keys and the English and Vietnamese texts of Design, "First texts". A test compares both catalogs with a copy of that table.
- R16. `pnpm --filter @toki/i18n check` runs the missing-translation check on the committed catalogs, prints one line with the number of keys and the words `no problem`, and exits 0.
- R17. The check exits 1 and prints one line per problem, each naming the language, the key and the problem, when any of these holds (D-064): (a) a key of the English catalog is missing in Vietnamese; (b) a key of the Vietnamese catalog is missing in English; (c) a text or a plural form is empty or holds only white space; (d) the placeholder names of a key differ between the two languages, where the names of a key in a language are the union over all its plural forms (`{ one: 'One try left', other: '{count} tries left' }` against `{ other: '{count} lần thử còn lại' }` has `count` in both); (e) a key breaks the naming rule (R14); (f) a text with plural forms lacks `other`, or lacks `one` in English, or has a form other than `one` and `other` in English or other than `other` in Vietnamese. All problems are printed in one run, not only the first.
- R18. The check does not compare wordings: a Vietnamese text equal to the English one (for example 'Email') is not a problem.
- R19. The root `package.json` has the script `i18n:check`, which runs `pnpm --filter @toki/i18n check`. `pnpm i18n:check` at the root gives the same output and exit code as R16 and R17.
- R20. `.github/workflows/ci.yml`, the workflow that TOKI-007 creates, has one more job, named `i18n`. It runs `pnpm i18n:check` and nothing else, and is reported on the pull request as its own entry, as each check of that workflow is (R8 of the CI spec). A pull request that removes one Vietnamese text shows the `i18n` check failed and the run red; a pull request with no fault shows it passed.
- R21. The `exports` of `packages/i18n/package.json` holds exactly two entries: the existing `".": "./src/index.ts"` and the new `"./react": "./src/react.ts"`. `react` is listed under `peerDependencies`, the file has no `dependencies` entry, and no file under `src` other than `react.ts` and the test files imports `react`. So the server can import `@toki/i18n` without React.
- R22. No source file under `packages/i18n/src` (test files excepted) uses a browser or DOM global or a Node API, and `pnpm lint` passes on the package with the rules of TOKI-002 (its R5 and R6).
- R23. `pnpm --filter @toki/i18n test` runs the tests of this package and exits 0, and `pnpm typecheck` at the root exits 0. The type check of `packages/i18n` covers `src/` (the test files included) and `scripts/`.

## Design
### Public API
Decided in this spec. From `@toki/i18n`:

| Name | What it is |
| :---- | :---- |
| `LANGUAGES`, `DEFAULT_LANGUAGE`, `Language` | R1. The codes `en` and `vi` are also the values that other code stores and sends for a person's language |
| `LANGUAGE_NAMES` | R3 |
| `isLanguage(value)`, `resolveLanguage(value)` | R2. For a value read from an account or a request |
| `MessageKey` | R8 |
| `translate(language, key, params?)` | R4 to R7. Used where there is no React, for example mail text on the server |
| `createTranslator(language)` | R9 |

From `@toki/i18n/react`:

| Name | What it is |
| :---- | :---- |
| `I18nProvider` | Takes `language?: Language` and `children`. Holds no state: the caller owns the language; its context value is memoised on `language` (R11) |
| `useTranslation()` | Returns `{ t, language }` (R10, R11) |

- `params` is typed `{ count?: number } & Record<string, string | number>`: `count` must be a number, so `count: '1'` fails `pnpm typecheck` instead of silently giving the `other` form. The names of the parameters are not checked against the text at compile time; the check of R17 (d) keeps the two languages in step, and the tests of each screen cover the call.
- `MessageKey` is a union of string literal types derived from the English catalog (R8), and `translate` takes no plain `string`. Decided in this spec: a screen that picks a text from a value known only at run time, such as the `error.code` of the Sign-in screens, holds a map typed `Record<ErrorCode, MessageKey>` (for example `code_incorrect: 'signIn.error.wrongCode'`); each entry of the map is checked, and a wrong key fails `pnpm typecheck`. Template literal types are not used.
- `t` returns a plain string. A text holds no HTML and no markup; a sentence that contains a link or a bold part is put together by the component from separate keys.
- `translate` and `createTranslator` read the committed catalogs. Inside `translate.ts` they call one function that takes the catalogs as an argument; it is not exported from `index.ts`, and the tests use it with small test catalogs.
- The provider is built with `createElement`, so the package needs no JSX setting in its `tsconfig.json`.

### Catalogs
Decided in this spec.
- A namespace file exports one object. A value is a text, a group of values, or a text with plural forms. Groups nest so that the path to a text, joined with dots and put after the file name, is its key: in `messages/en/signIn.ts`, `{ email: { label: 'Email' } }` is the key `signIn.email.label`.
- A text with plural forms is an object whose only properties are plural form names: `{ one: '…', other: '…' }` in English, `{ other: '…' }` in Vietnamese. A key may be a plain text in one language and have plural forms in the other. English uses `one` and `other`; Vietnamese has one form, `other`. The two rules are written in the package (R6); `Intl.PluralRules` is not used, so the package behaves the same in the browser, in Node and in React Native.
- A plain text that holds `{count}` is allowed, for a number that is never 1 or whose English text reads the same. A number that can be 1 in a sentence needs plural forms. Decided in this spec: the two sign-in texts that take a number, `signIn.error.wrongCode` (4 tries left after the first wrong code, 1 after the fourth: D-137) and `signIn.error.tooMany` (the wait is rounded up to whole minutes, so 1 is possible), are texts with plural forms, and the placeholder of `tooMany` is `{count}`, not `{minutes}`, because only `count` chooses a form (rule 6). See Areas of concern, 8, for the change that the Sign-in screens ticket must make.
- `{` and `}` are used only for placeholders. A placeholder name is lowerCamelCase.
- The catalogs are TypeScript files, not JSON, so `MessageKey` is derived from the English catalog by the compiler and a wrong key is a type error (R8). The Vietnamese catalog is not typed against the English one: a missing text is reported by the check (R17), with the key named, not by the compiler.
- Both languages are imported statically. The texts of phase 1 are small, and loading on demand would make the first screen wait for a request; if the catalogs later weigh on the 200 KB limit of the CI spec (its R7), the Vietnamese catalog can be loaded on demand behind the same API.

### Key naming rule
Decided in this spec.
1. A key is `<namespace>.<name>` or `<namespace>.<group>.<name>`, with at most two groups: 2 to 4 parts joined by dots.
2. Every part is lowerCamelCase: it matches `^[a-z][A-Za-z0-9]*$`.
3. The namespace is the screen or feature the text belongs to and is the name of its file (`signIn`, `sessionEnded`, `nav`). A text used by several screens goes into the namespace `common`, created by the first ticket that needs it. Exception: the name of a place in the app lives in `nav` only, wherever it is shown (see "First texts").
4. A part names the role of the text (`email.label`, `code.submit`, `error.expired`), not its English wording, so the key stays when the wording changes.
5. `zero`, `one`, `two`, `few`, `many` and `other` are plural form names and are not used as a part.
6. The placeholder that chooses a plural form is named `count`.

The keys of the Sign-in screens spec (`signIn.email.label`, `signIn.error.wrongCode`, `sessionEnded.title` and the rest of its "Texts" table) all follow the naming rule. One difference follows from rules 5 and 6 and the "Catalogs" decision: its `{minutes}` placeholder in `signIn.error.tooMany` becomes `{count}`, and `wrongCode` and `tooMany` become texts with plural forms (Areas of concern, 8).

### First texts
The prototype's `I18N` table holds a Vietnamese text for 17 navigation labels. The 13 below belong to phase 1 (D-002 for Home, Activity, Later, Files, People, Preferences and Search; D-151, D-183 and D-065 for Admin, the page with the channel list; the conversation list's own headings for the rest) and become the namespace `nav`. Both wordings are the prototype's (D-019). The other four ('Mail', 'Meet', 'Tasks', 'Calendar') belong to later phases and are not carried over. AppShell (TOKI-015) uses these keys for its navigation. The prototype also uses the same labels as page titles (`secHead(t(title))` for Activity, Later, Files, People, Preferences and Admin) and as the headings of the conversation list (Starred, Channels, Direct messages, Conversations). Decided in this spec: a page title and a list heading use the same `nav` key as the navigation label, so no screen ticket makes a second copy in `common`.

| Key | English | Vietnamese |
| :---- | :---- | :---- |
| `nav.home` | Home | Trang chủ |
| `nav.activity` | Activity | Hoạt động |
| `nav.later` | Later | Để sau |
| `nav.files` | Files | Tệp |
| `nav.people` | People | Mọi người |
| `nav.preferences` | Preferences | Tùy chọn |
| `nav.more` | More | Thêm |
| `nav.directMessages` | Direct messages | Tin nhắn riêng |
| `nav.channels` | Channels | Kênh |
| `nav.starred` | Starred | Đã gắn sao |
| `nav.conversations` | Conversations | Hội thoại |
| `nav.search` | Search | Tìm kiếm |
| `nav.admin` | Admin | Quản trị |

### The check and CI
- `src/check.ts` holds the comparison as a function that takes the catalogs and returns the list of problems; it uses no Node API. `scripts/check.ts` passes it the committed catalogs, lists the files of the two `messages` folders for R13, prints the result and sets the exit code (R16, R17). The tests call the function with small test catalogs, one per problem kind.
- Output on success: `i18n check: <n> keys, 2 languages, no problem`. Output on failure: one line per problem in the form `<language> <key>: <problem>`, for example `vi nav.home: missing`, then a line with the number of problems.
- The root script `i18n:check` follows R10 of the CI spec: the workflow calls a root script and holds no check logic.
- The CI spec (TOKI-007) names the file `.github/workflows/ci.yml` and requires in its R8 that each check is a separate entry on the pull request; only a job is one (a step is not shown on its own), and the end-to-end addition of TOKI-008 is a job too. Decided in this spec: the check is a job named `i18n`, with no step form. It is a sixth entry beside the five of the CI spec; its R8 and R13 count five and need the change in concern 4.
- Order of work: R1 to R19, R21 and R22 need only TOKI-001, and R22 is fully checked once the rules of TOKI-002 exist. R20 needs the workflow file, so it is done when TOKI-007 is built. If this work is built first, R20 stays open on the ticket and is closed by a small change to `ci.yml` once it exists (concern 4). R23 asks only for `pnpm --filter @toki/i18n test`: the root `pnpm test` is made by TOKI-008, which runs this package's tests with the others (concern 7).
- The check is the only place where the two real catalogs are compared for missing texts. The unit tests do not repeat it, so one missing text gives one failed check with a clear name, not two.

### Errors
- A text is missing in one language -> the check exits 1 and names the language and the key (R17); at run time the English text is shown (R7).
- A key is used in code that the English catalog does not have -> `pnpm typecheck` fails and names the file (R8).
- An unknown language value reaches the package -> English is used (R2, R10).
- A parameter is missing -> the placeholder stays visible in the text; nothing throws (R5, R7).

### Layout
```
packages/i18n/
├─ package.json          adds exports "./react", peerDependencies react, scripts check and test, devDependencies
├─ tsconfig.json         adds scripts/ to the type check and Node's types
├─ scripts/
│  └─ check.ts           runs the check on the committed catalogs (R16, R17)
└─ src/
   ├─ index.ts           the exports of "Public API"; imports no React
   ├─ languages.ts       LANGUAGES, DEFAULT_LANGUAGE, LANGUAGE_NAMES, isLanguage, resolveLanguage
   ├─ translate.ts       translate, createTranslator, the plural rules
   ├─ check.ts           the comparison of the catalogs; not exported from index.ts
   ├─ react.ts           I18nProvider, useTranslation
   ├─ messages/
   │  ├─ en/index.ts  en/nav.ts
   │  └─ vi/index.ts  vi/nav.ts
   └─ *.test.ts          the tests (test files: outside the boundary rule)
package.json             root: adds the script i18n:check (R19)
.github/workflows/ci.yml adds the job i18n (R20)
```
- Decided in this spec: no translation library is added. The package needs a lookup, named placeholders and two plural rules, which is about a hundred lines; it then has no runtime dependency, adds almost nothing to the 200 KB limit, and runs unchanged in the browser, in Node and in React Native under the global allow list of TOKI-002. The public API above hides the choice: a library can be put behind `translate` later without touching a screen.
- Decided in this spec: the React part lives in this package under `@toki/i18n/react`, not in `ui-web`, so the phone app of phase 3 uses the same provider and hook. TOKI-002 bans `react-dom` in this package, not `react`.
- Test tools: Vitest for the tests and `tsx` to run `scripts/check.ts`, with `@types/node`, `react`, `react-dom` and their types as `devDependencies` of `packages/i18n` (`react-dom` only for the test of R10 and R11, which renders to a string). Each is pinned to one exact version; when the root or another workspace project already has one of them, the package uses the same exact version. This is the rule the tokens package (TOKI-009) uses.
- `packages/i18n/tsconfig.json` gets `include` covering `src` and `scripts`, and `compilerOptions.types` `["node"]`. It still extends `tsconfig.base.json` and sets none of the options TOKI-001 keeps in the base file.

## Testing
- Tests live in `packages/i18n/src/*.test.ts` and run with `pnpm --filter @toki/i18n test`. They are written first and seen to fail on the empty package.
- R1 to R3: value tests on the exports, with the six inputs of R2.
- R4, R15: a test holds a copy of the table of "First texts" and compares every key in both languages through `translate`.
- R5 to R7, R9: tests on a small test catalog passed to the internal lookup: the two examples of R5 and R6, a missing parameter, an extra parameter, `count` of 0, 1, 2 and 1.5 in English and in Vietnamese, a missing `count`, a `count` that is the string `'1'` (cast in the test), a key missing in Vietnamese, a key missing in both, and the keys `toString` and `constructor` (R7). The same cases run through `createTranslator`; `createTranslator('en') === createTranslator('en')`. A type test with `// @ts-expect-error` shows that `count: '1'` is rejected.
- R8: a test file holds a call with an unknown key under `// @ts-expect-error`, and a map typed `Record<…, MessageKey>` with a wrong entry under the same marker; `pnpm typecheck` fails if the line stops being an error. Checked once by hand: remove the comment and see `pnpm typecheck` fail and name the file.
- R10, R11: a test renders a small component that shows `t('nav.home')` and `language` to a string with `react-dom/server`: under `language="vi"`, under a provider with no property, and with no provider; then the same tree with `en` and with `vi` in turn, comparing the two results.
- R12, R21, R22: a test reads every file under `packages/i18n/src` except the test files, removes the comments, and fails when `navigator` or `Intl` appears, or when a file other than `react.ts` imports `react`; it reads `package.json` and checks the two `exports` entries, `peerDependencies` and the absence of `dependencies`. The globals of R22 are checked by `pnpm lint` once the rules of TOKI-002 exist.
- R13: checked once by hand: add `messages/en/extra.ts` without listing it, see the check exit 1 and name the file, then remove it.
- R13, R14, R17, R18: tests call the function of `src/check.ts` with one test catalog per problem kind (a) to (f), each expecting exactly one problem with the right language and key; one catalog with three problems expects three; one where a Vietnamese text equals the English one expects none; one with a namespace present in English only expects every key of it reported; one where English has `{ one: 'One try left', other: '{count} tries left' }` and Vietnamese has `{ other: '{count} lần thử còn lại' }` expects none (R17 (d)), and one where the Vietnamese form lacks `{count}` expects one.
- R16, R19: run `pnpm --filter @toki/i18n check` and `pnpm i18n:check` on a clean clone and read the output and the exit code. Checked once by hand: delete `home` from `messages/vi/nav.ts`, see both commands exit 1 with `vi nav.home: missing`, then undo.
- R20: one throwaway pull request that removes a Vietnamese text must show the `i18n` job red as its own entry in the checks list; one clean pull request must show it green. Done when `ci.yml` exists.
- R23: run both commands on a clean clone and read the exit codes.
- No data is used. The tests hold interface texts only.

## How each constraint in the intent is met
| Constraint | Met by |
| :---- | :---- |
| Blueprint work area: Design system | Planning fact; no design impact. |
| Belongs to Blueprint intent I02 design-system | Planning fact; no design impact. |
| Milestone: M1, Foundation and design system | Planning fact; no design impact. |
| Size: S, about half a working session with Claude | Scope: one package with no library, 13 texts, one check; the texts of the screens are left to their tickets and to TOKI-080. The size is carried by concern 7. |
| Needs: TOKI-001 | The package, its `exports` and `tsconfig.json` from TOKI-001 are extended, not re-created (R21, Layout). R20 also needs TOKI-007, and R22 the rules of TOKI-002: concern 4. |
| Needed by: TOKI-080 | R13, R14 and R17 give TOKI-080 the place, the naming rule and the check it relies on. |
| Agreed scope: translation framework, English by default, automatic check for missing keys | R4 to R11 (framework), R1, R2, R10 (English by default), R16, R17 (check). |
| The missing-translation check is added to the CI workflow of TOKI-007 | R19, R20 (the job `i18n`). |
| Two languages, English and Vietnamese; English is the default | R1, R2, R10. |
| CI fails when a string lacks a translation in either language | R17 (a) and (b), R20. The weekday and month names are outside the check (Scope, Out, Dates and times; concern 2). |
| A new account's interface is in English, also when the browser's language is Vietnamese | R10, R12. |
| A change of language applies to the whole interface at once, without reloading | R11. The switch itself is TOKI-078 (Scope, Out). |
| The language is saved to the account and is the same on every device | The package keeps no language of its own (R11); the caller passes the account's value, checked with `resolveLanguage` (R2). Saving it is TOKI-078. |
| Shared by the web app, the phone app and the desktop app; the server uses it for mail text only | R21 (no React on the main entry), R22, `translate` (R4). |
| The package runs without a DOM or a browser API | R12, R22. |
| Translating every screen is TOKI-080, not this ticket | Scope, Out; R15 ships the `nav` namespace only. |
| Dates and times are formatted by the shared date and time rules (TOKI-094) | Scope, Out: this package formats no date or time and holds no month or weekday name; the day words are `common` keys added by TOKI-042. |
| The initial JavaScript of the web app stays under 200 KB compressed | No library is added (Layout); "Catalogs" says what to do if the texts grow. |

## Open questions from the intent
- Which form of address does the Vietnamese interface use? Not answered: D-188 is Open. The 13 texts of this ticket address nobody, so nothing here waits for it. Carried forward as concern 1.
- Do number formats and the names of days and months follow the interface language? Not answered: D-189 is Open. Carried forward as concern 2.
- Which language does a signed-out page show? Answered in part: English is the default (D-018) and is what this package gives when no language is passed (R10). Whether a language remembered on the device is used is not decided. Carried forward as concern 3.
- Which translation library, or none? Answered: none. Decided in this spec, see Layout.
- What happens when this ticket is built before TOKI-007? Answered: everything except R20 is built; R20 is closed when `ci.yml` exists. The plan's needs list is concern 4.
- Does this ticket carry over the prototype's 17 Vietnamese labels, and which? Answered: the 13 that belong to phase 1 (D-002), as the namespace `nav` (R15). Decided in this spec.

## Areas of concern
1. The Vietnamese form of address is not decided (D-188, Open). The check makes every later key need a Vietnamese text (D-064), so the first screen with a sentence that addresses the reader needs the answer. Proposal, not a decision: 'bạn' everywhere, as D-188 proposes. Owner: Thanh Truong.
2. Whether number formats and the names of days and months follow the interface language is not decided (D-189, Open). Until it is, a number in a text is plain digits (R5) and this package has no number function; the prototype groups numbers the British way in both languages (`toLocaleString('en-GB')`). Proposal, not a decision: they follow the language, as D-189 proposes; this package then gains one function that formats a number for a language, and the caller passes the active language to the date functions of `shared`. If they do not follow it, the caller passes `'en'`; until a Vietnamese name table exists, `shared` gives English names for `'vi'`, so nothing needs to change on either side. The weekday and month names stay in `shared` and are outside the missing-translation check either way (Scope, Out, Dates and times). R12 is rewritten when this is answered, because a number function would call `Intl.NumberFormat` with an explicit language code. TOKI-080 is the latest ticket that can take the answer. Owner: Thanh Truong.
3. The language of a signed-out page is not decided. The language is saved to the account (D-175), which is unknown before sign-in, and TS-193 rules out the browser's language for a new account. This package shows English when no language is passed. Proposal, not a decision: the language last used on the device, else English; the web app would then read it through `platform` storage and pass it to `I18nProvider`, with no change here. The Sign-in screens spec lists the same question as its concern 3. Owner: Thanh Truong.
4. The plan lists only TOKI-001 as a need of TOKI-017. R20 edits the workflow file that TOKI-007 creates, and the CI spec is still in review; R22 uses the lint rules of TOKI-002. Proposal, plan change: TOKI-017 also needs TOKI-007 (for R20 only) and TOKI-002 (for R22 only), and the CI spec's R8 and R13 count six checks once this job is in. In the other direction, the tickets that use this package should list TOKI-017 as a need: TOKI-015 (AppShell, `nav`), TOKI-021 (mail, `translate`), TOKI-023 (Sign-in screens), TOKI-042 (day words), TOKI-066 (quick time labels), TOKI-078 (Preferences, the language) and, already, TOKI-080. Until the plan is updated the package can be built and used. Owner: Thanh Truong.
5. Decided in this spec: no translation library; texts with plural forms are objects, not ICU message strings. The cost: a text with two numbers that both need plural forms cannot be written as one key and has to be split or reworded. No text known so far needs it. If one appears, `translate` can take a library behind the same API. Owner: Thanh Truong.
6. Nothing checks automatically that a component holds no literal text; the check of this ticket only compares the two catalogs. The Sign-in screens spec (its R28) searches its own folder by hand. Proposal: TOKI-080 adds a lint rule against literal text in `packages/ui-web` to the ESLint configuration of TOKI-002. Owner: Thanh Truong.
7. This work adds Vitest to `packages/i18n` before the test harness (TOKI-008) sets up testing for the whole repository, because it needs only TOKI-001. Decided in this spec: the package uses the exact versions already in the repository when there are any, as the tokens package does; the harness work may later move them to the root. The root `pnpm test` script does not exist yet: TOKI-008 (its R1) creates it with a `vitest.workspace.ts` that lists the packages with tests, and TOKI-007 only assumes the name. Decided in this spec: TOKI-008 makes the root script run this package's tests (its R12), and, until then, the tests of this package run with `pnpm --filter @toki/i18n test` (R23) and are not in the CI `tests` check. If TOKI-008 pins a different Vitest, `tsx` or `@types/node`, that exact version wins and the pins here are changed to match. Size: the ticket is S and carries 23 requirements. Not split: the provider is what makes AC-121 testable and is what TOKI-015 needs, and the scans are small; if the half session proves too short, the provider (R10, R11, R21) can be built second without touching the rest. Owner: Thanh Truong.
8. Change that the Sign-in screens ticket (TOKI-023, spec in review) must make; this spec does not edit it. In its "Texts" table, `signIn.error.wrongCode` and `signIn.error.tooMany` become texts with plural forms, for example English `{ one: 'That code is not right. {count} try left.', other: 'That code is not right. {count} tries left.' }` and `{ one: '… Try again in {count} minute.', other: '… Try again in {count} minutes.' }`, and the Vietnamese text is one `other` form; its R19 and the texts in its concerns use `{count}` where they now say `{minutes}`. The wordings are the Sign-in screens spec's, not decided here (the shown texts are proposals there). If the Sign-in screens spec keeps the plain texts, "1 tries left" and "1 minutes" will show. Owner: Thanh Truong.
