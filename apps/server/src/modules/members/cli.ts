// The narrow entry of the `members` module for the command `emergency:link` (TOKI-026 R23). The index of
// this module reaches the mail layer (its routes and invitations), which the command must not import, so
// a command reaches the one read it needs here and nothing else.
export { findAccountForEmergencyLink } from "./lookup.js";
