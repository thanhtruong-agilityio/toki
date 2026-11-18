import Fastify, { LogController } from "fastify";
import { randomUUID } from "node:crypto";
import type { Writable } from "node:stream";
import { API_PREFIX, registerApi, type RegisterRoutes } from "./api/index.js";
import type { Config } from "./config.js";
import {
  clientErrorHandler,
  frameworkErrors,
  registerErrorHandling,
} from "./errors.js";
import { registerHealth } from "./health.js";

export type BuildAppOptions = {
  // Passed in; a module receives it from the app and never imports it.
  config: Config;
  // Lets a test capture the log.
  logStream?: Writable;
  // Runs inside the /api/v1 scope before the app is ready.
  registerRoutes?: RegisterRoutes;
};

export function buildApp({
  config,
  logStream,
  registerRoutes,
}: BuildAppOptions) {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
      ...(logStream ? { stream: logStream } : {}),
    },
    logController: new LogController({ disableRequestLogging: true }),
    genReqId: () => randomUUID(),
    frameworkErrors,
    clientErrorHandler,
  });

  // Every route is under /api/v1, except /healthz.
  app.addHook("onRoute", (route) => {
    if (route.url !== "/healthz" && !route.url.startsWith(`${API_PREFIX}/`)) {
      throw new Error(`Route ${route.url} is outside ${API_PREFIX}`);
    }
  });

  // One completion line per request: method, path without query, status,
  // duration and request id (bound by the request logger). Nothing else.
  app.addHook("onResponse", async (request, reply) => {
    const path = request.url.split("?")[0];
    const level = path === "/healthz" ? "debug" : "info";
    request.log[level](
      {
        method: request.method,
        path,
        status: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });

  registerErrorHandling(app);
  registerHealth(app);
  registerApi(app, registerRoutes);
  return app;
}
