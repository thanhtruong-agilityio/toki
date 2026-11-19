import { ErrorCodes, type ErrorResponse } from "@toki/shared";
import type {
  FastifyError,
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { Socket } from "node:net";
import { ZodError } from "zod";

// A known error raised by a route or a module: the status, the code from the
// registry in packages/shared, a fixed English message for developers.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

function body(code: string, message: string, details?: unknown): ErrorResponse {
  return {
    error: { code, message, ...(details === undefined ? {} : { details }) },
  };
}

const notFound = body(ErrorCodes.notFound, "No such route.");
const badRequest = body(ErrorCodes.badRequest, "The request is malformed.");

// Status of an error that Fastify raises itself -> the code and message.
const framework: Record<number, [string, string]> = {
  401: [ErrorCodes.unauthorized, "Authentication is required."],
  403: [ErrorCodes.forbidden, "Access to this resource is not allowed."],
  404: [ErrorCodes.notFound, "No such route."],
  413: [ErrorCodes.payloadTooLarge, "The request body is too large."],
  415: [ErrorCodes.unsupportedMediaType, "The content type is not supported."],
  429: [ErrorCodes.tooManyRequests, "Too many requests."],
};

function validationFailed(
  issues: { path: (string | number)[]; code: string }[],
) {
  return body(ErrorCodes.validationFailed, "The request failed validation.", {
    issues,
  });
}

// Registers the one handler for every error response (R8, R9).
export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) => reply.code(404).send(notFound));

  app.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      if (error instanceof AppError) {
        const wait = (
          error.details as { retryAfterSeconds?: unknown } | undefined
        )?.retryAfterSeconds;
        if (error.status === 429 && typeof wait === "number") {
          reply.header("retry-after", String(wait));
        }
        return reply
          .code(error.status)
          .send(body(error.code, error.message, error.details));
      }
      if (error instanceof ZodError) {
        // Path and code only: a submitted value never goes back to the client.
        return reply.code(400).send(
          validationFailed(
            error.issues.map((i) => ({
              path: i.path.map((p) => (typeof p === "symbol" ? String(p) : p)),
              code: i.code,
            })),
          ),
        );
      }
      if (error.validation) {
        return reply.code(400).send(
          validationFailed(
            error.validation.map((v) => ({
              path: v.instancePath.split("/").filter(Boolean),
              code: v.keyword,
            })),
          ),
        );
      }
      const status = error.statusCode;
      if (status !== undefined && status >= 400 && status < 500) {
        const [code, message] = framework[status] ?? [
          ErrorCodes.badRequest,
          badRequest.error.message,
        ];
        return reply.code(status).send(body(code, message));
      }
      request.log.error({ err: error }, "unexpected error");
      return reply.code(500).send(
        body(ErrorCodes.internalError, "An unexpected error occurred.", {
          requestId: request.id,
        }),
      );
    },
  );
}

// Errors that never reach the handler: a malformed URL.
export function frameworkErrors(
  _error: FastifyError,
  _request: unknown,
  reply: FastifyReply,
) {
  return reply.code(400).send(badRequest);
}

// Node's clientError: the request could not be parsed. Answer in the one format.
export function clientErrorHandler(_error: Error, socket: Socket) {
  if (!socket.writable) {
    socket.destroy();
    return;
  }
  const payload = JSON.stringify(badRequest);
  socket.end(
    `HTTP/1.1 400 Bad Request\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${Buffer.byteLength(payload)}\r\nConnection: close\r\n\r\n${payload}`,
  );
}
