// The one ESLint configuration of the repository: ignores, base style, and
// the three package boundary rules. A boundary is changed only here.
// tools/lint-fixtures/check.mjs (pnpm lint:boundaries) proves each rule.
import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";
import path from "node:path";
import tseslint from "typescript-eslint";
import clientCoreGlobals from "./tools/lint-rules/client-core-globals.js";
import moduleEntry from "./tools/lint-rules/module-entry.js";
import platformApis from "./tools/lint-rules/platform-apis.js";

// The three local rules, used as toki/<name>.
const toki = {
  rules: {
    "client-core-globals": clientCoreGlobals,
    "module-entry": moduleEntry,
    "platform-apis": platformApis,
  },
};

// A source file of a boundary is any file under src/ with one of these
// extensions that is not a test file (<name>.test.<extension>).
const sourceFiles = "*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}";
const testFiles = `**/*.test.${sourceFiles.slice(2)}`;
// The four packages of rule 1.
const portableSrc = "packages/{client-core,shared,i18n,tokens}/src";

// Rule 1. The only globals that client-core, shared, i18n and tokens may use
// as a value: the ES2022 language built-ins plus this list. React Native has
// all of them. Every other global (window, document, localStorage, ...) is an
// error, so a browser global that nobody thought to list still fails.
// globalThis is left out on purpose: it reaches every browser global.
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

// The DOM types that the same packages may not name. A type alone loads
// nothing, so only these are banned: the three names, and every name with one
// of the prefixes (HTMLElement, SVGSVGElement). Other types that the file does
// not declare (RequestInit, MessageEvent, Storage) pass and rely on review.
const domTypes = ["Window", "Document", "Element"];
const domTypePrefixes = ["HTML", "SVG"];

// Imports that need the DOM: react-dom, and ui-web by its package name
// (@toki/ui-web) or by a relative path, which always holds the "ui-web"
// segment. Matching the import text is enough. A pattern also matches every
// path below it (react-dom/client, @toki/ui-web/button).
const domImports = ["react-dom", "**/ui-web"];
// The same two targets for import("...") and import(`...`), which the import
// rule does not see.
const domImportSource = "/^react-dom(\\/|$)|(^|\\/)ui-web(\\/|$)/";
const domImportMessage =
  "client-core boundary: client-core, shared, i18n and tokens import nothing that needs the DOM, so React Native can reuse them.";

// Rule 3. The platform APIs that ui-web may not use directly: these globals,
// bare or as a property of window, globalThis or self, and these properties
// of the global navigator and document.
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
    // Tooling and configuration files run in Node. The source files of rule
    // 1 are left out: their globals are the allow list and nothing else.
    files: ["**/*.{js,mjs,cjs}"],
    ignores: [`${portableSrc}/**`],
    languageOptions: { globals: globals.node },
  },
  prettier,
  {
    // Rule 1: client-core, and the packages it imports, touch no DOM or
    // browser API. Test files and package-root configuration files are
    // outside the block.
    files: [
      `${portableSrc}/**/${sourceFiles}`,
      "tools/lint-fixtures/client-core/**",
    ],
    ignores: [testFiles],
    linterOptions: { noInlineConfig: true },
    languageOptions: { ecmaVersion: 2022, globals: allowedGlobals },
    plugins: { toki },
    rules: {
      // Reports every value use of a global outside the allow list (also
      // `typeof window` in a type), and a type-only use of a DOM type name.
      "toki/client-core-globals": ["error", { domTypes, domTypePrefixes }],
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
          selector: `:matches(ImportExpression, TSImportType)[source.value=${domImportSource}]`,
          message: domImportMessage,
        },
        {
          // The same with a template literal: import(`react-dom`).
          selector: `:matches(ImportExpression, TSImportType) > TemplateLiteral > TemplateElement[value.cooked=${domImportSource}]`,
          message: domImportMessage,
        },
        {
          // `declare const window: any` would hide a browser global from the
          // rule above, the way a /* global */ comment would.
          selector:
            ":matches(VariableDeclaration, TSDeclareFunction, TSModuleDeclaration, ClassDeclaration, TSEnumDeclaration)[declare=true]",
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
      `apps/server/src/**/${sourceFiles}`,
      "tools/lint-fixtures/server-modules/**",
    ],
    linterOptions: { noInlineConfig: true },
    plugins: { toki },
    rules: {
      "toki/module-entry": [
        "error",
        {
          // Absolute folders, so the rule gives the same result when ESLint
          // starts in a package folder (an editor, pnpm --filter).
          modulesDirs: [
            "apps/server/src/modules",
            "tools/lint-fixtures/server-modules/modules",
          ].map((dir) => path.join(import.meta.dirname, dir)),
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
      `packages/ui-web/src/**/${sourceFiles}`,
      "tools/lint-fixtures/ui-web/**",
    ],
    ignores: [testFiles],
    linterOptions: { noInlineConfig: true },
    plugins: { toki },
    rules: {
      // Reports the bare name, member access and destructuring, also through
      // a cast, a non-null assertion, a computed name or window.window, and
      // only when the object really is the global (tools/lint-rules).
      "toki/platform-apis": [
        "error",
        { globals: platformGlobals, properties: platformProperties },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name='audio']",
          message:
            "ui-web boundary: ui-web plays audio only through the platform package, not with an <audio> element.",
        },
      ],
    },
  },
);
