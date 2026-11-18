import type { FastifyInstance } from "fastify";

// Process liveness only: no database call, so it answers the same when
// Postgres is unreachable. A readiness check would be a separate /readyz.
export function registerHealth(app: FastifyInstance) {
  app.get("/healthz", async () => ({ status: "ok" }));
}
