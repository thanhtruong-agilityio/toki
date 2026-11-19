import {
  CreateSessionBodySchema,
  ErrorCodes,
  RequestCodeBodySchema,
  CODE_RESEND_SECONDS,
  CODE_TTL_SECONDS,
  parseEmail,
  type User,
} from "@toki/shared";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { Db } from "../../db/client.js";
import { AppError } from "../../errors.js";
import type { MailLayer } from "../mail/index.js";
import type { Account } from "../members/index.js";
import { getWorkspace } from "../workspace/index.js";
import { exchangeCode, requestCode } from "./codes.js";
import type { AuthConfig } from "./config.js";
import { clearedCookie, sessionCookie } from "./cookies.js";
import { endSessionOfRequest } from "./sessions.js";

declare module "fastify" {
  interface FastifyContextConfig {
    // A route that needs no session says so itself (R24).
    public?: boolean;
  }
  interface FastifyRequest {
    // The account of the session, set by the session check (R55).
    account?: Account;
  }
}

// A failed query of Drizzle carries its parameters in the message, and the
// shared handler logs it: an email address would reach the log (R37). A known
// error passes; any other becomes an error that names only its kind.
function guarded<T>(work: () => Promise<T>): Promise<T> {
  return work().catch((error: unknown) => {
    if (error instanceof AppError || error instanceof ZodError) throw error;
    // No `cause`: the original error is the one that carries the parameters.
    const kind = error instanceof Error ? error.name : "error";
    throw new Error(`The sign-in request failed (${kind}).`);
  });
}

export const toUser = (a: Account): User => ({
  id: a.id,
  email: a.email,
  displayName: a.displayName,
  role: a.role,
  language: a.language,
});

const invalid = (field: string, code: string) =>
  new AppError(
    400,
    ErrorCodes.validationFailed,
    "The request failed validation.",
    {
      issues: [{ path: [field], code }],
    },
  );

// The five routes (R1, R10, R28, R32, R33, R39). Each says whether it needs a
// session; the check itself is the hook of register.ts.
export function registerAuthRoutes(
  scope: FastifyInstance,
  deps: { db: Db; mail: MailLayer; config: AuthConfig },
) {
  const { db, mail, config } = deps;
  const development = config.development;
  const pub = { config: { public: true } };

  scope.post("/auth/codes", pub, (request, reply) =>
    guarded(async () => {
      const body = RequestCodeBodySchema.parse(request.body ?? {});
      const email = parseEmail(body.email);
      if (email === null) throw invalid("email", "invalid_format");
      const result = await requestCode(db, config.codeSecret, email);
      // After the answer, and never awaited: a failing or silent mail layer
      // changes nothing the client sees (R8).
      if (result.mail) {
        const mailInput = result.mail;
        reply.raw.once("finish", () => {
          void mail.sendSignInMail(mailInput).catch(() => {});
        });
      }
      return {
        requestId: result.requestId,
        expiresInSeconds: CODE_TTL_SECONDS,
        resendAfterSeconds: CODE_RESEND_SECONDS,
      };
    }),
  );

  scope.post("/auth/sessions", pub, (request, reply) =>
    guarded(async () => {
      const body = CreateSessionBodySchema.parse(request.body ?? {});
      const transport = body.transport ?? "cookie";
      const result = await exchangeCode(db, config.codeSecret, {
        requestId: body.requestId,
        code: body.code,
        transport,
        userAgent: request.headers["user-agent"],
        request,
      });
      if (transport === "cookie") {
        reply.header(
          "set-cookie",
          sessionCookie(result.session.secret, development),
        );
        return { user: result.user };
      }
      return { user: result.user, token: result.session.secret };
    }),
  );

  scope.get("/auth/session", async (request) => ({
    user: toUser(request.account!),
  }));

  scope.delete("/auth/session", pub, async (request, reply) => {
    await endSessionOfRequest(db, request, "signed_out");
    reply.header("set-cookie", clearedCookie(development));
    return reply.code(204).send();
  });

  scope.get("/auth/workspace", pub, async () => {
    const workspace = await getWorkspace(db);
    if (!workspace)
      throw new AppError(404, ErrorCodes.notFound, "No such workspace.");
    return { name: workspace.name };
  });
}
