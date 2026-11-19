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
import { createMailLayer, type MailLayer } from "./modules/mail/index.js";

declare module "fastify" {
  interface FastifyInstance {
    // The mail layer (TOKI-021). Modules that send mail call it through the app.
    mail: MailLayer;
  }
}

export type BuildAppOptions = {
  // Passed in; a module receives it from the app and never imports it.
  config: Config;
  // Lets a test capture the log.
  logStream?: Writable;
  // Runs inside the /api/v1 scope before the app is ready.
  registerRoutes?: RegisterRoutes;
  // A mail layer to use instead of the real one; a test passes a fake so that
  // no test of another module needs an SMTP server or mail values (R21).
  mail?: MailLayer;
};

export function buildApp({
  config,
  logStream,
  registerRoutes,
  mail,
}: BuildAppOptions) {
  if (!mail && !config.mail) {
    throw new Error("buildApp needs `mail` or `config.mail`");
  }
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

  // The layer is on the app before any route is registered. A layer built here
  // is closed with the app (no connection stays open after SIGTERM); a layer
  // passed in belongs to the caller.
  if (mail) {
    app.decorate("mail", mail);
  } else if (config.mail) {
    const built = createMailLayer({
      config: config.mail,
      logger: {
        info: (obj, msg) => app.log.info(obj, msg),
        warn: (obj, msg) => app.log.warn(obj, msg),
      },
      production: config.server.env === "production",
    });
    app.decorate("mail", built.layer);
    app.addHook("onClose", async () => {
      await built.close();
    });
  }

  registerErrorHandling(app);
  registerHealth(app);
  registerApi(app, registerRoutes);
  return app;
}
