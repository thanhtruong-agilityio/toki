# @toki/i18n

The texts of the interface, once per language (`en`, `vi`; English is the default), and the way a screen reads them. The source of truth is `docs/specs/2026-11-16-i18n-package-design.md`.

## Use

```ts
import { translate, createTranslator, formatNumber } from "@toki/i18n";
import { I18nProvider, useTranslation } from "@toki/i18n/react";

translate("vi", "nav.home"); // "Trang chủ"
const { t, language } = useTranslation(); // under <I18nProvider language={…}>; English when none is given
t("nav.home");
```

`MessageKey` is the set of keys of the English catalog; a key that does not exist fails `pnpm typecheck`. A text that is missing in the active language shows in English, and the check below catches it before that happens.

## Add the texts of a new screen

1. Create `src/messages/en/<namespace>.ts` and `src/messages/vi/<namespace>.ts`. The namespace is the screen or feature (`signIn`, `sessionEnded`); a text used by several screens goes in `common`; the name of a place in the app lives in `nav`.
2. Export one object from each file. Groups nest, so `{ email: { label: "Email" } }` in `signIn.ts` is the key `signIn.email.label`.
3. List the file in both `src/messages/en/index.ts` and `src/messages/vi/index.ts`.
4. Run `pnpm i18n:check`. It fails when a key exists in one language and not in the other, when a text is empty, when the placeholders differ, or when a key breaks the naming rule.

## Naming rule

1. A key is `<namespace>.<name>` or `<namespace>.<group>.<name>`, with at most two groups: 2 to 4 parts.
2. Every part is lowerCamelCase (`^[a-z][A-Za-z0-9]*$`).
3. The namespace is the name of the file.
4. A part names the role of the text (`email.label`, `error.expired`), not its English wording.
5. `zero`, `one`, `two`, `few`, `many` and `other` are plural form names, not parts.
6. The placeholder that chooses a plural form is `count`.

Placeholders are written `{name}`. A text with plural forms is an object: `{ one: "{count} try left", other: "{count} tries left" }` in English, `{ other: "…" }` in Vietnamese. A number placed in a text is plain digits; for a grouped number pass `formatNumber(language, value)` as the parameter.
