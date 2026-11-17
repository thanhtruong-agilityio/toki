// Fixture for rule 1: client-core, shared, i18n and tokens use no browser
// global and import nothing that needs the DOM (R5, R6).
// Every marked line must be reported; see ../check.mjs.

import "react-dom"; // expect: @typescript-eslint/no-restricted-imports
import "react-dom/client"; // expect: @typescript-eslint/no-restricted-imports
import "@toki/ui-web"; // expect: @typescript-eslint/no-restricted-imports
import "@toki/ui-web/button"; // expect: @typescript-eslint/no-restricted-imports
import "../../../packages/ui-web/src/index"; // expect: @typescript-eslint/no-restricted-imports
export * from "react-dom"; // expect: @typescript-eslint/no-restricted-imports
export const lazyDom = () => import("react-dom"); // expect: no-restricted-syntax
export const lazyUi = () => import("@toki/ui-web/x"); // expect: no-restricted-syntax
export const lazyPath = () => import("../ui-web/src"); // expect: no-restricted-syntax
export type LazyType = import("react-dom").Root; // expect: no-restricted-syntax
export const lazyRaw = () => import(`react-dom`); // expect: no-restricted-syntax
export const lazyRawUi = () => import(`../ui-web/src`); // expect: no-restricted-syntax
export type LazyRawType = import(`react-dom`).Root; // expect: no-restricted-syntax
import legacyDom = require("react-dom"); // expect: @typescript-eslint/no-restricted-imports, @typescript-eslint/no-require-imports
export { legacyDom };

// A bare name.
export const a1 = window; // expect: toki/client-core-globals
export const a2 = document; // expect: toki/client-core-globals
export const a3 = localStorage; // expect: toki/client-core-globals
export const a4 = navigator; // expect: toki/client-core-globals
export const a5 = location; // expect: toki/client-core-globals
export const a6 = matchMedia; // expect: toki/client-core-globals
export const a7 = structuredClone; // expect: toki/client-core-globals
export const a8 = require; // expect: toki/client-core-globals

// Through window, globalThis or self.
export const b1 = window.document; // expect: toki/client-core-globals
export const b2 = globalThis.document; // expect: toki/client-core-globals
export const b3 = self.document; // expect: toki/client-core-globals
export const b4 = globalThis.fetch; // expect: toki/client-core-globals

// By destructuring one of them.
export const { document: c1 } = window; // expect: toki/client-core-globals
export const { localStorage: c2 } = globalThis; // expect: toki/client-core-globals
export const { navigator: c3 } = self; // expect: toki/client-core-globals

// A DOM type.
export type D1 = Window; // expect: toki/client-core-globals
export type D2 = Document; // expect: toki/client-core-globals
export type D3 = Element; // expect: toki/client-core-globals
export type D4 = HTMLElement; // expect: toki/client-core-globals
export type D5 = SVGElement; // expect: toki/client-core-globals
export type D6 = HTMLInputElement[]; // expect: toki/client-core-globals
export const d7 = (x: unknown) => x as SVGSVGElement; // expect: toki/client-core-globals
export const d8 = typeof window; // expect: toki/client-core-globals
export type D9 = typeof window; // expect: toki/client-core-globals
export { history }; // expect: toki/client-core-globals

// An ambient declaration that would hide a browser global.
declare const sessionStorage: unknown; // expect: no-restricted-syntax
declare function alert(text: string): void; // expect: no-restricted-syntax
// prettier-ignore
declare global { var indexedDB: unknown } // expect: no-restricted-syntax
declare class Notification {} // expect: no-restricted-syntax
// prettier-ignore
declare enum caches { A } // expect: no-restricted-syntax
export const e1 = [sessionStorage, alert, Notification, caches];
