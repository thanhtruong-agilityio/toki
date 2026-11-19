// The public surface of this module. No table is exported from here.
export { authConfigSchema, authVariableNames } from "./config.js";
export type { AuthConfig } from "./config.js";
export { registerAuthHooks } from "./register.js";
export { registerAuthRoutes } from "./routes.js";
export {
  AccountNotActiveError,
  createSession,
  endSessionOfRequest,
  endSessionsOfUser,
  onSessionsEnded,
  reportSessionsEnded,
} from "./sessions.js";
export type { EndReason } from "./sessions.js";
