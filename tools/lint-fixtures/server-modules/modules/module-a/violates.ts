// Fixture for rule 2: a file in one server module imports another module only
// through that module's entry file (R7). Every marked line must be reported.

import "../module-b/db/tables"; // expect: toki/module-entry
import "../module-b/db/tables.js"; // expect: toki/module-entry
import "../module-b/db/index"; // expect: toki/module-entry
import "../module-b/db"; // expect: toki/module-entry
import "./../module-b/db/tables"; // expect: toki/module-entry
import "../../modules/module-b/db/tables"; // expect: toki/module-entry
import "../MODULE-B/db/tables"; // expect: toki/module-entry
import { rows } from "../module-b/db/tables"; // expect: toki/module-entry
import type { Row } from "../module-b/db/tables"; // expect: toki/module-entry
export { rows as moreRows } from "../module-b/db/tables"; // expect: toki/module-entry
export * from "../module-b/db/tables"; // expect: toki/module-entry
export const lazy = () => import("../module-b/db/tables"); // expect: toki/module-entry
export type Lazy = import("../module-b/db/tables").Row; // expect: toki/module-entry
import legacy = require("../module-b/db/tables"); // expect: toki/module-entry, @typescript-eslint/no-require-imports
export const loaded = require("../module-b/db/tables"); // expect: toki/module-entry, @typescript-eslint/no-require-imports
export const lazyRaw = () => import(`../module-b/db/tables`); // expect: toki/module-entry
export type LazyRaw = import(`../module-b/db/tables`).Row; // expect: toki/module-entry
// prettier-ignore
export const loadedRaw = require(`../module-b/db/tables`); // expect: toki/module-entry, @typescript-eslint/no-require-imports
export { legacy };

export const first: Row | undefined = rows[0];
