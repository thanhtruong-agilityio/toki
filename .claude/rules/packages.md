---
paths:
  - "packages/**"
---

# Package rules

Each statement is followed by its source. Rules of this project come first; rules of the tool are kept apart in "External standard".

## This project

The three boundaries are enforced by lint in `eslint.config.js`; they are not opinions, and lint comments cannot switch them off (`noInlineConfig`).

- `client-core`, `shared`, `i18n` and `tokens` use no DOM or browser API: no global outside the allow list, no import of `react-dom` or other DOM packages, no ambient `declare` that hides a global. Test files are outside this rule.
  Source: lint rule `toki/client-core-globals` and the first block of `eslint.config.js`.
- A server module is used only through its `index.ts` (see `server.md`).
  Source: lint rule `toki/module-entry`.
- `ui-web` reaches notifications, storage, the service worker and audio only through `platform`.
  Source: lint rule `toki/platform-apis`.
- A boundary is changed in `eslint.config.js` only; do not add an exception in a file.
  Source: header comment of `eslint.config.js` ("A boundary is changed only here").

## External standard

- Data of type `unknown` is parsed with its Zod schema where it enters the system (`parse` or `safeParse`).
  Source: [Zod, Basics](https://zod.dev/basics).
- The type comes from the schema with `z.infer<typeof Schema>`; it is not written a second time.
  Source: same page.
