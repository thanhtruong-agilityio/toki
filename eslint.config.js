// The one ESLint configuration of the repository: ignores, base style, and
// the three package boundary rules. A boundary is changed only here.
// tools/lint-fixtures/check.mjs (pnpm lint:boundaries) proves each rule.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";
import clientCoreGlobals from "./tools/lint-rules/client-core-globals.js";
import moduleEntry from "./tools/lint-rules/module-entry.js";

// The two local rules, used as toki/<name>.
const toki = {
  rules: {
    "client-core-globals": clientCoreGlobals,
    "module-entry": moduleEntry,
  },
};

// Rule 1. The only globals that client-core, shared, i18n and tokens may use:
// the ES2022 language built-ins plus this list. React Native has all of them.
// Every other global (window, document, localStorage, ...) is an error, so a
// browser global that nobody thought to list still fails. globalThis is left
// out on purpose: it reaches every browser global.
// A global is added only here, and in tools/lint-fixtures/check.mjs.
const allowedGlobals = {
  ...globals.es2022,
  globalThis: "off",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  fetch: "readonly",
  Headers: "readonly",
  Request: "readonly",
  Response: "readonly",
  WebSocket: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
};

// Imports that need the DOM: react-dom, and ui-web by its package name
// (@toki/ui-web) or by a relative path, which always holds the "ui-web"
// segment. Matching the import text is enough. A pattern also matches every
// path below it (react-dom/client, @toki/ui-web/button).
const domImports = ["react-dom", "**/ui-web"];
const domImportMessage =
  "client-core boundary: client-core, shared, i18n and tokens import nothing that needs the DOM, so React Native can reuse them.";

// Rule 3. The platform APIs that ui-web may not use directly.
const platformGlobals = [
  "Notification",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "Audio",
  "AudioContext",
  "caches",
];
const platformProperties = [
  ["navigator", "serviceWorker"],
  ["document", "cookie"],
];
const platformMessage =
  "ui-web boundary: ui-web reaches notifications, storage, the service worker and audio only through the platform package.";

export default tseslint.config(
  {
    // Build output, and the fixture folders: they hold violations on purpose
    // and are linted by check.mjs only. check.mjs itself is linted.
    ignores: [
      "**/node_modules/",
      "**/dist/",
      "**/build/",
      "**/coverage/",
      "tools/lint-fixtures/*/",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Tooling and configuration files run in Node.
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
  },
  prettier,
  {
    // Rule 1: client-core, and the packages it imports, touch no DOM or
    // browser API. Test files and package-root configuration files are
    // outside the block.
    files: [
      "packages/{client-core,shared,i18n,tokens}/src/**/*.{ts,tsx}",
      "tools/lint-fixtures/client-core/**",
    ],
    ignores: ["**/*.test.{ts,tsx}"],
    linterOptions: { noInlineConfig: true },
    languageOptions: { ecmaVersion: 2022, globals: allowedGlobals },
    plugins: { toki },
    rules: {
      // Reports every global outside the allow list, DOM types included
      // (Window, Document, Element, HTMLElement, SVGElement, ...).
      "toki/client-core-globals": "error",
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [{ group: domImports, message: domImportMessage }],
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          // import("...") as a call or as a type is not an import declaration.
          selector:
            ":matches(ImportExpression, TSImportType)[source.value=/^react-dom(\\/|$)|(^|\\/)ui-web(\\/|$)/]",
          message: domImportMessage,
        },
        {
          // `declare const window: any` would hide a browser global from the
          // rule above, the way a /* global */ comment would.
          selector:
            ":matches(VariableDeclaration, TSDeclareFunction, TSModuleDeclaration, ClassDeclaration)[declare=true]",
          message:
            "client-core boundary: an ambient declaration can hide a browser global from lint. Declare types in a module, or add the global to the allow list in eslint.config.js.",
        },
      ],
    },
  },
  {
    // Rule 2: server modules call each other only through their public entry
    // (index.ts), never each other's internals or tables. The same holds for
    // a file outside modules/ (for example the database client), so it cannot
    // pass a module's tables on to another module.
    files: [
      "apps/server/src/**/*.{ts,tsx}",
      "tools/lint-fixtures/server-modules/**",
    ],
    linterOptions: { noInlineConfig: true },
    plugins: { toki },
    rules: {
      "toki/module-entry": [
        "error",
        {
          modulesDirs: [
            "apps/server/src/modules",
            "tools/lint-fixtures/server-modules/modules",
          ],
        },
      ],
    },
  },
  {
    // Rule 3: ui-web reaches platform features (notifications, storage,
    // service worker, audio) only through the platform package.
    // File picking in ui-web is not checked by lint and relies on review: an
    // <input type="file"> cannot be told apart from any other input here.
    // Reaching an API through a renamed copy of window also relies on review.
    files: [
      "packages/ui-web/src/**/*.{ts,tsx}",
      "tools/lint-fixtures/ui-web/**",
    ],
    ignores: ["**/*.test.{ts,tsx}"],
    linterOptions: { noInlineConfig: true },
    rules: {
      "no-restricted-globals": [
        "error",
        ...platformGlobals.map((name) => ({ name, message: platformMessage })),
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].flatMap((object) =>
          platformGlobals.map((property) => ({
            object,
            property,
            message: platformMessage,
          })),
        ),
        ...platformProperties.map(([object, property]) => ({
          object,
          property,
          message: platformMessage,
        })),
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='audio']",
          message: platformMessage,
        },
        // navigator.serviceWorker and document.cookie reached through
        // window, globalThis or self, or by destructuring.
        ...platformProperties
          .flatMap(([object, property]) => [
            `MemberExpression[object.type='MemberExpression'][object.property.name='${object}'][property.name='${property}']`,
            `VariableDeclarator[init.type='MemberExpression'][init.property.name='${object}'] > ObjectPattern > Property[key.name='${property}']`,
            `Property[key.name='${object}'] > ObjectPattern > Property[key.name='${property}']`,
          ])
          .map((selector) => ({ selector, message: platformMessage })),
      ],
    },
  },
);
