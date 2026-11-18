import type { FastifyInstance } from "fastify";

export const API_PREFIX = "/api/v1";

export type RegisterRoutes = (scope: FastifyInstance) => void | Promise<void>;

// Every module's routes are registered here, inside the /api/v1 scope, so no
// module can leave the prefix. No module exists yet; a later ticket adds its
// own register call from modules/<name>/index.ts. `extra` lets a test add
// routes before the app is ready.
export function registerApi(app: FastifyInstance, extra?: RegisterRoutes) {
  app.register(
    async (scope) => {
      await extra?.(scope);
    },
    { prefix: API_PREFIX },
  );
}
