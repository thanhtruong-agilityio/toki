import { ErrorCodes, type Clock } from "@toki/shared";
import type { FastifyInstance } from "fastify";
import { API_PREFIX } from "../../api/index.js";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import type { AuthConfig } from "./config.js";
import { sessionCookie } from "./cookies.js";
import { checkJsonBody, checkOrigin, isApiPath } from "./guards.js";
import { createAddressLimiter } from "./limiter.js";
import { runtime } from "./runtime.js";
import { checkSession } from "./sessions.js";

const LIMITED = new Set([
  `${API_PREFIX}/auth/codes`,
  `${API_PREFIX}/auth/sessions`,
]);

// One hook on every /api/v1 request, registered on the root so it also runs for
// a path that matches no route (R44). Order: the address limit (R56), the
// Origin rule (R46), the JSON rule (R45), then the session check (R24).
export function registerAuthHooks(
  app: FastifyInstance,
  deps: { db: Db; clock: Clock; config: AuthConfig },
) {
  const { db, clock, config } = deps;
  runtime.clock = clock;
  runtime.development = config.development;
  const limiter = createAddressLimiter(clock);

  app.addHook("onRequest", async (request, reply) => {
    if (!isApiPath(request.url.split("?")[0]!)) return;
    const route = request.routeOptions;
    if (request.method === "POST" && route.url && LIMITED.has(route.url)) {
      const wait = limiter.hit(`${route.url}|${request.ip}`);
      if (wait !== null) {
        throw new AppError(
          429,
          ErrorCodes.rateLimited,
          "Too many requests from this address.",
          { retryAfterSeconds: wait },
        );
      }
    }
    checkOrigin(request, config.appOrigin);
    checkJsonBody(request);
    if (route.config?.public) return;
    const checked = await checkSession(db, request);
    request.account = checked.account;
    // The cookie lives as long as the session (R26).
    if (checked.via === "cookie") {
      reply.header(
        "set-cookie",
        sessionCookie(checked.secret, config.development),
      );
    }
  });
}
