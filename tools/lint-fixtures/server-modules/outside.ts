// Fixture for R17: a file outside the modules folder (for example the
// database client) imports a module only through its entry file.

import "./modules/module-a/db/tables"; // expect: toki/module-entry
import "./modules/module-b/db"; // expect: toki/module-entry
export * from "./modules/module-b/db/tables"; // expect: toki/module-entry

// expect-next: inline-config
// eslint-disable-next-line toki/module-entry
import "./modules/module-b/db/index"; // expect: toki/module-entry
