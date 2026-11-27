import {
  ErrorCodes,
  effectiveNotificationLevel,
  type BootstrapConversation,
  type BootstrapResponse,
  type BootstrapUser,
} from "@toki/shared";
import type { Db, Tx } from "../db/client.js";
import { AppError } from "../errors.js";
import { listConversationSummaries } from "../modules/conversations/index.js";
import {
  getAccountById,
  getAccountsByIds,
  listPeople,
} from "../modules/members/index.js";
import { getWorkspace } from "../modules/workspace/index.js";
import { readEventNumber } from "./event-number.js";
import { inReadSnapshot } from "./read-tx.js";

// The reads of the answer, each replaceable by a test (TOKI-031 R4, R10, R11).
// The route passes none.
export type BootstrapDeps = {
  getAccountById?: typeof getAccountById;
  // Called once with the transaction, right after the account is read.
  afterAccount?: (tx: Tx) => Promise<void>;
  getAccountsByIds?: typeof getAccountsByIds;
  getWorkspace?: typeof getWorkspace;
  readEventNumber?: (tx: Tx, workspaceId: string) => Promise<number>;
};

const internal = (message: string) => new Error(message);

// A column the table checks keep non-null; a null here is a broken row, not
// something to hide behind a default.
function required<T>(value: T | null, what: string): T {
  if (value === null) throw internal(`A conversation has no ${what}.`);
  return value;
}

// The six parts of the answer from one snapshot (R10). Only the id of the
// account is used: the account itself is read again inside the snapshot.
export async function buildBootstrap(
  db: Db,
  account: { id: string },
  deps: BootstrapDeps = {},
): Promise<BootstrapResponse> {
  const readAccount = deps.getAccountById ?? getAccountById;
  const readAccountsByIds = deps.getAccountsByIds ?? getAccountsByIds;
  const readWorkspace = deps.getWorkspace ?? getWorkspace;
  const readNumber = deps.readEventNumber ?? readEventNumber;

  return inReadSnapshot(db, async (tx) => {
    const me = await readAccount(tx, account.id);
    if (!me) {
      throw new AppError(
        401,
        ErrorCodes.unauthenticated,
        "A session is required.",
      );
    }
    if (me.status === "deactivated") {
      throw new AppError(
        401,
        ErrorCodes.accountDeactivated,
        "This account is deactivated.",
      );
    }
    await deps.afterAccount?.(tx);

    // The workspace every other read filters on comes from the account, as in
    // TOKI-029 and TOKI-030; the two ids must agree (R4). No lock: a
    // read-only transaction cannot take one.
    const [facts] = await readAccountsByIds(tx, [me.id]);
    const workspace = await readWorkspace(tx);
    if (!facts || !workspace || workspace.id !== facts.workspaceId) {
      throw internal("The workspace of the account was not found.");
    }
    const members = await listPeople(tx, facts.workspaceId);
    const summaries = await listConversationSummaries(
      tx,
      facts.workspaceId,
      me.id,
    );
    const eventNumber = await readNumber(tx, facts.workspaceId);

    const user: BootstrapUser = {
      id: me.id,
      email: me.email,
      displayName: me.displayName,
      role: me.role,
      language: me.language,
    };
    const conversations = summaries.map((s): BootstrapConversation => {
      const level = effectiveNotificationLevel(s.kind, s.notificationLevel);
      if (s.kind === "channel") {
        return {
          id: s.id,
          kind: "channel",
          name: required(s.name, "channel name"),
          topic: s.topic,
          isPrivate: s.isPrivate,
          isGeneral: s.isGeneral,
          notificationLevel: level,
          isMuted: s.isMuted,
          isStarred: s.isStarred,
          memberIds: null,
        };
      }
      return {
        id: s.id,
        kind: s.kind,
        name: null,
        topic: null,
        isPrivate: true,
        isGeneral: false,
        notificationLevel: level,
        isMuted: s.isMuted,
        isStarred: s.isStarred,
        memberIds: required(s.memberIds, "direct message members"),
      };
    });
    return {
      user,
      workspace: { id: workspace.id, name: workspace.name },
      members,
      conversations,
      eventNumber,
    };
  });
}
