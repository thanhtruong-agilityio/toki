import type { Clock, Decision } from "@toki/shared";
import type { Db, DbClient } from "../../db/client.js";
import type { RecordChange } from "./changes.js";
import type { getConversationFacts } from "./facts.js";

// What the channel code needs to know about a person. The `members` module
// builds it; this module never imports `members` (TOKI-029 R18).
export type AccountFacts = {
  id: string;
  workspaceId: string;
  role: string;
  status: "active" | "deactivated";
};

export type GetAccountsByIds = (
  client: DbClient,
  ids: readonly string[],
  options?: { lock?: "share" },
) => Promise<AccountFacts[]>;

// The dependencies of the routes. The last two have real defaults; a test
// replaces them to record a change, to force a failure or to give a fact the
// database cannot hold.
export type ChannelDeps = {
  db: DbClient;
  clock: Clock;
  getAccountsByIds: GetAccountsByIds;
  recordChange: RecordChange;
  getConversationFacts: typeof getConversationFacts;
};

export type ChannelDepsInput = Pick<
  ChannelDeps,
  "db" | "clock" | "getAccountsByIds"
> &
  Partial<Pick<ChannelDeps, "recordChange" | "getConversationFacts">>;

// The dependencies of `POST /api/v1/direct-conversations` (TOKI-030). The
// permission function has a real default; a test replaces it (R4, R7).
export type DirectDeps = Pick<ChannelDeps, "clock" | "getAccountsByIds"> & {
  // The database, not a transaction: the request opens its own transaction
  // and sets its isolation level, which a nested one cannot (R22).
  db: Db;
  canCreateDirectConversation?: (person: {
    id: string;
    role: string;
  }) => Decision;
};
