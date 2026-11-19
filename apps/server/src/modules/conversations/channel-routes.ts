import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import {
  BrowseChannelsQuerySchema,
  ChannelIdSchema,
  ChannelMembersQuerySchema,
  CreateChannelBodySchema,
  EditChannelBodySchema,
  canReadConversation,
  ErrorCodes,
  canCreateChannel,
} from "@toki/shared";
import { AppError } from "../../errors.js";
import { checkAccess, refusal } from "./access.js";
import {
  listChannelMembers,
  listChannels,
  readChannelDetail,
  toSummary,
} from "./browse.js";
import { recordChange as defaultRecordChange } from "./changes.js";
import { createChannel, editChannelDetails } from "./channels.js";
import type { ChannelDeps, ChannelDepsInput } from "./deps.js";
import { getConversationFacts as defaultGetConversationFacts } from "./facts.js";
import { toSafeError } from "./safe-error.js";

type Handler = (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<unknown>;

// Every handler runs inside this guard (R20).
const guarded =
  (work: Handler): Handler =>
  async (request, reply) => {
    try {
      return await work(request, reply);
    } catch (error) {
      throw toSafeError(error);
    }
  };

// A route whose step is not built yet.
const notBuilt: Handler = async () => {
  throw new Error("This channel route is not built yet.");
};

// The twelve routes of the channel API (TOKI-029). Registered in the /api/v1
// scope, so the session hook of the app has already put the account on every
// request.
export function channelRoutes(input: ChannelDepsInput): FastifyPluginAsync {
  const deps: ChannelDeps = {
    recordChange: defaultRecordChange,
    getConversationFacts: defaultGetConversationFacts,
    ...input,
  };
  return async (scope) => {
    scope.post(
      "/channels",
      guarded(async (request, reply) => {
        const account = request.account!;
        // R1 step 1: the role is checked before the body is read, so a Member
        // gets 403 whatever the body is.
        const decision = canCreateChannel({
          id: account.id,
          role: account.role,
        });
        if (!decision.allowed) throw refusal(decision.reason);
        const body = CreateChannelBodySchema.parse(request.body ?? {});
        // Never reaches the check constraint of TOKI-028 R9.
        if (body.name === "general") {
          throw new AppError(
            409,
            ErrorCodes.channelNameTaken,
            "A channel with this name already exists.",
          );
        }
        const { created, channel } = await createChannel(
          deps,
          account.id,
          body,
        );
        reply.code(created ? 201 : 200);
        return { channel };
      }),
    );
    scope.get(
      "/channels",
      guarded(async (request) => {
        const account = request.account!;
        const query = BrowseChannelsQuerySchema.parse(request.query);
        return listChannels(deps, deps.db, account, query);
      }),
    );
    scope.get(
      "/channels/:id",
      guarded(async (request) => {
        const account = request.account!;
        const id = ChannelIdSchema.parse((request.params as { id: string }).id);
        // Anyone may read a public channel; the answer holds only what a
        // non-member may see (D-116). Unknown, DM and hidden private: 404.
        const facts = await checkAccess(
          deps,
          deps.db,
          { id: account.id, role: account.role },
          id,
          () => ({ allowed: true }),
        );
        const detail = await readChannelDetail(deps, deps.db, account.id, id);
        if (!detail) throw refusal("not_a_channel");
        return { channel: facts.isMember ? detail : toSummary(detail) };
      }),
    );
    scope.get(
      "/channels/:id/members",
      guarded(async (request) => {
        const account = request.account!;
        const id = ChannelIdSchema.parse((request.params as { id: string }).id);
        const query = ChannelMembersQuerySchema.parse(request.query);
        await checkAccess(
          deps,
          deps.db,
          { id: account.id, role: account.role },
          id,
          canReadConversation,
        );
        return listChannelMembers(deps.db, id, query);
      }),
    );
    scope.patch(
      "/channels/:id",
      guarded(async (request) => {
        const account = request.account!;
        const id = ChannelIdSchema.parse((request.params as { id: string }).id);
        const body = EditChannelBodySchema.parse(request.body ?? {});
        return editChannelDetails(
          deps,
          { id: account.id, role: account.role },
          id,
          body,
        );
      }),
    );
    scope.post("/channels/:id/join", guarded(notBuilt));
    scope.post("/channels/:id/members", guarded(notBuilt));
    scope.post("/channels/:id/leave", guarded(notBuilt));
    scope.delete("/channels/:id/members/:userId", guarded(notBuilt));
    scope.post("/channels/:id/archive", guarded(notBuilt));
    scope.post("/channels/:id/restore", guarded(notBuilt));
    scope.patch("/conversations/:id/settings", guarded(notBuilt));
  };
}
