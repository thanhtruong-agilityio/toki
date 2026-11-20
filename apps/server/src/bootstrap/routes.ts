import type { FastifyPluginAsync } from "fastify";
import type { Db } from "../db/client.js";
import { buildBootstrap, type BootstrapDeps } from "./build.js";

export type BootstrapRouteDeps = { db: Db } & BootstrapDeps;

// GET /api/v1/bootstrap (TOKI-031 R1, R13). The session check has already
// run (every /api/v1 route needs a session unless it says otherwise) and put
// the account on the request; the build uses only its id. The answer is
// personal, so no cache keeps it. The route logs nothing about the content.
export function bootstrapRoutes({
  db,
  ...deps
}: BootstrapRouteDeps): FastifyPluginAsync {
  return async (scope) => {
    scope.get("/bootstrap", async (request, reply) => {
      const answer = await buildBootstrap(db, request.account!, deps);
      reply.header("cache-control", "no-store");
      return answer;
    });
  };
}
