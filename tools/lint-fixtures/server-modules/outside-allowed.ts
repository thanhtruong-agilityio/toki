// Fixture for R17: a file outside the modules folder may import a module
// through its entry file, so no line may be reported.
import "./modules/module-a";
import "./modules/module-a/index.js";
import "./modules/module-b/index";
import "./db/client";
