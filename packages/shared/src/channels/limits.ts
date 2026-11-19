import { CHANNEL_NAME_MAX } from "../conversations.js";

// Paging and batch limits of the channel API (TOKI-029 R6, R8, R11).
export const CHANNEL_BROWSE_PAGE_DEFAULT = 50; // D-109
export const CHANNEL_BROWSE_PAGE_MAX = 100;
// About 200 people in a workspace (NFR-04).
export const CHANNEL_MEMBERS_ADD_MAX = 200;
// The longest search is the longest name.
export const CHANNEL_SEARCH_MAX = CHANNEL_NAME_MAX;

// Lower case only: the permission functions compare ids as they are
// (TOKI-027 R4).
export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// The id of a new channel is made by the client (R4).
export const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
