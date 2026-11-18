// Lists the namespace files of this language (R13). A new namespace is added here and in en/index.ts.
import type { Catalog } from "../../catalog";
import { common } from "./common";
import { nav } from "./nav";

export const vi: Catalog = { common, nav };
