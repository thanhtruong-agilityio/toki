// The exports of the module, listed here so index.ts names no table (R21 of TOKI-019).
export { sessionCookie } from "./cookies.js";
export { authConfigSchema, authVariableNames } from "./config.js";
export type { AuthConfig } from "./config.js";
export { registerAuthHooks } from "./register.js";
export { registerAuthRoutes } from "./routes.js";
export {
  AccountNotActiveError,
  createSession,
  endSessionOfRequest,
  endSessionsOfUser,
  getLastUsedAtByUser,
  onSessionsEnded,
  reportSessionsEnded,
} from "./sessions.js";
export type { EndReason } from "./sessions.js";
export {
  checkCodeRequestLimits,
  checkInvitationCode,
  createInvitationCode,
  pruneInvitationCodes,
} from "./codes.js";
export type { CodeRequestLimits, InvitationCheck } from "./codes.js";
