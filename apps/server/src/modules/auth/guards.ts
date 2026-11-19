import { ErrorCodes } from "@toki/shared";
import type { FastifyRequest } from "fastify";
import { API_PREFIX } from "../../api/index.js";
import { AppError } from "../../errors.js";

export const isApiPath = (url: string) =>
  url.startsWith(`${API_PREFIX}/`) || url === API_PREFIX;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// R46: a request of any method except GET, HEAD and OPTIONS that carries an
// Origin different from the app's own is refused. The list names the exempt
// methods, so a verb nobody thought of is covered. No Origin: not refused.
export function checkOrigin(request: FastifyRequest, appOrigin: string) {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.origin;
  if (origin === undefined) return;
  if (origin !== appOrigin) {
    throw new AppError(
      403,
      ErrorCodes.originNotAllowed,
      "The request comes from another origin.",
    );
  }
}

// R45: a request with a body is accepted only as application/json. A body
// exists when content-length is above 0 or transfer-encoding is present; a
// request with no body is not refused, whatever its type.
export function checkJsonBody(request: FastifyRequest) {
  const length = request.headers["content-length"];
  const hasBody =
    request.headers["transfer-encoding"] !== undefined ||
    (length !== undefined && Number(length) > 0);
  if (!hasBody) return;
  const type = (request.headers["content-type"] ?? "")
    .split(";")[0]!
    .trim()
    .toLowerCase();
  if (type !== "application/json") {
    throw new AppError(
      415,
      ErrorCodes.unsupportedMediaType,
      "The content type is not supported.",
    );
  }
}
