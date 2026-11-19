import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { recordChange as defaultRecordChange } from "./changes.js";
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
  void deps;
  return async (scope) => {
    scope.post("/channels", guarded(notBuilt));
    scope.get("/channels", guarded(notBuilt));
    scope.get("/channels/:id", guarded(notBuilt));
    scope.get("/channels/:id/members", guarded(notBuilt));
    scope.patch("/channels/:id", guarded(notBuilt));
    scope.post("/channels/:id/join", guarded(notBuilt));
    scope.post("/channels/:id/members", guarded(notBuilt));
    scope.post("/channels/:id/leave", guarded(notBuilt));
    scope.delete("/channels/:id/members/:userId", guarded(notBuilt));
    scope.post("/channels/:id/archive", guarded(notBuilt));
    scope.post("/channels/:id/restore", guarded(notBuilt));
    scope.patch("/conversations/:id/settings", guarded(notBuilt));
  };
}
