// The narrow entry of the `auth` module for the command `emergency:link` (TOKI-026 R23). The index of
// this module reaches the mail layer, which the command must not import, so a command reaches
// `issueEmergencyLink` here and nothing else.
export { issueEmergencyLink } from "./emergency.js";
