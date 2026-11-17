---
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript rules

Each statement is followed by its source. Rules of this project come first; rules of the tool are kept apart in "External standard".

## This project

- `strict` is on for every package; it is set in `tsconfig.base.json`, and a package extends that file. Do not turn it off in a package.
  Source: `tsconfig.base.json`.
- The base file sets only `strict`, `target`, `module`, `moduleResolution` and `noEmit`; `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are not turned on here.
  Source: `tsconfig.base.json`.

## External standard

- `strict` turns on a fixed family of flags (`strictNullChecks`, `noImplicitAny`, `useUnknownInCatchVariables` and others). `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` are separate options and are not part of it.
  Source: [TypeScript, TSConfig Reference](https://www.typescriptlang.org/tsconfig/).
