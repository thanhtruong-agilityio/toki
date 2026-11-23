import type { ChannelSummary } from "@toki/shared";

export type BrowseRowAction = "open" | "join" | "none";

// What a row offers (TOKI-034 R7). A member opens, also an archived channel (F26); a person who is not
// a member joins a channel that is not archived; the server refuses the join of an archived channel
// (409), so there is no button for it. TOKI-101's "Restore" is a second button that reaches the row
// through `extra`; this function does not change when it lands.
export function browseRowAction(
  channel: Pick<ChannelSummary, "isMember" | "archived">,
): BrowseRowAction {
  if (channel.isMember) return "open";
  return channel.archived ? "none" : "join";
}
