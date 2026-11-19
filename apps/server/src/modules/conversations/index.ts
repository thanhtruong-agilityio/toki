// The public surface of this module (R18). No table is exported from here:
// other modules reach conversations and members through these functions.
export { buildDmKey, type DmKey } from "./dm-key.js";
export {
  getConversationFacts,
  isConversationMember,
  listMemberIds,
} from "./facts.js";
export {
  addMemberToGeneral,
  createGeneralChannel,
  getGeneralConversationId,
} from "./general.js";
export { channelRoutes } from "./channel-routes.js";
export type { ChannelDepsInput } from "./deps.js";
