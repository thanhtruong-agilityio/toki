// The first-load answer (TOKI-031). A folder outside modules/: it reads the
// workspace, members and conversations modules through their index.ts only,
// and no module imports it.
export { bootstrapRoutes } from "./routes.js";
export type { BootstrapDeps } from "./build.js";
