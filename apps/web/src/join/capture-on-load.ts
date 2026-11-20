import { captureJoinToken } from "./join-token";

// Imported first by `main.tsx`: it runs when the page document loads, before `./router` is loaded (the
// router reads the address when its module loads) and before any request (TOKI-097 R26). ES modules
// run in the order of the imports, so nothing may be imported before this file.
captureJoinToken(window);
