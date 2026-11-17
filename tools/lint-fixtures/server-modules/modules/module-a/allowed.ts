// Fixture for rule 2: everything here is allowed (R8), so no line may be
// reported.

// Another module, through its entry file, in every import form.
import "../module-b";
import "../module-b/";
import "../module-b/index";
import "../module-b/index.js";
import "../module-b/index.ts";
export * from "../module-b";
export const lazy = () => import("../module-b/index.js");

// The same module, at any depth.
import "./db/tables";
import "./db/index";
import "../module-a/db/tables";

// Not a module.
import "../../outside-allowed";
import "@toki/shared";
import "node:path";
