import type { DbClient } from "../../db/client.js";

// The seam for what a change causes (TOKI-029 R16). Every effective change
// calls `recordChange` once per thing that changed, inside its transaction,
// after the write and before the commit. Here it does nothing: TOKI-037 adds
// the system lines, TOKI-038 the events and TOKI-065 the Activity item, each
// editing this function only.
export type Change = {
  type:
    | "channel_created"
    | "member_joined"
    | "member_left"
    | "members_added"
    | "member_removed"
    | "details_changed"
    | "channel_archived"
    | "channel_restored"
    | "settings_changed";
  actorId: string;
  conversationId: string;
  // The people the change is about.
  userIds: readonly string[];
  at: Date;
};

export type RecordChange = (tx: DbClient, change: Change) => Promise<void>;

export const recordChange: RecordChange = async () => {};
