// The error every call of the client ends with (TOKI-032 R4). It holds what a
// screen needs to choose a message and nothing of the request: no body, no
// cookie, no header.
export type ApiErrorKind =
  "http" | "network" | "timeout" | "aborted" | "invalid_response";

export type ApiErrorInit = {
  kind: ApiErrorKind;
  status?: number | null;
  code?: string | null;
  message?: string;
  details?: unknown;
};

const FIXED_MESSAGES: Record<ApiErrorKind, string> = {
  http: "The server answered with an error.",
  network: "The request could not reach the server.",
  timeout: "The server did not answer in time.",
  aborted: "The request was cancelled.",
  invalid_response: "The answer does not have the expected shape.",
};

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly code: string | null;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(init: ApiErrorInit) {
    super(init.message ?? FIXED_MESSAGES[init.kind]);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status ?? null;
    this.code = init.code ?? null;
    this.details = init.details ?? null;
    const id =
      typeof this.details === "object" && this.details !== null
        ? (this.details as { requestId?: unknown }).requestId
        : undefined;
    this.requestId = typeof id === "string" ? id : null;
  }

  // Only the six fields: a stack or a cause is not part of what is logged or
  // sent anywhere.
  toJSON() {
    return {
      kind: this.kind,
      status: this.status,
      code: this.code,
      message: this.message,
      details: this.details,
      requestId: this.requestId,
    };
  }
}
