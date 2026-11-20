import { ErrorResponseSchema } from "@toki/shared";
import type { z } from "zod";
import { isSessionCode } from "./classify";
import { ApiError } from "./errors";
import { buildMethods } from "./methods";
import { readAnswer } from "./parse";

// The API client (TOKI-032 R2, R5 to R7). One request core, no retry, no
// browser API beyond the globals the lint rule allows (fetch, AbortController,
// URLSearchParams, Headers). The clock and timers are parameters.

// `after(ms, fn)` calls `fn` once after `ms` milliseconds and returns the way
// to cancel it. The web app lends the one timer function (R25).
export type Timers = {
  after(ms: number, fn: () => void): () => void;
};

export type ApiClientOptions = {
  timers: Timers;
  baseUrl?: string;
  fetch?: typeof fetch;
  requestTimeoutMs?: number;
  onUnauthenticated?: (code: string) => void;
};

export type QueryValue = string | number | boolean | undefined;

export type RequestOptions<S extends z.ZodType> = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  schema: S;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 10_000;
// The client's own headers: a caller's header of these names is ignored.
const OWN_HEADERS = new Set(["accept", "content-type", "origin"]);

function validTimeout(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function createApiClient(options: ApiClientOptions) {
  const baseUrl = options.baseUrl ?? "/api/v1";
  const defaultTimeout = validTimeout(options.requestTimeoutMs)
    ? options.requestTimeoutMs
    : DEFAULT_TIMEOUT_MS;
  let onUnauthenticated = options.onUnauthenticated ?? null;

  async function send<S extends z.ZodType>(
    request: RequestOptions<S>,
  ): Promise<{ status: number; data: z.output<S> }> {
    const { signal: callerSignal } = request;
    if (callerSignal?.aborted) throw new ApiError({ kind: "aborted" });

    const controller = new AbortController();
    let timedOut = false;
    let callerAborted = false;
    const onCallerAbort = () => {
      callerAborted = true;
      controller.abort();
    };
    callerSignal?.addEventListener("abort", onCallerAbort);
    const timeout = validTimeout(request.timeoutMs)
      ? request.timeoutMs
      : defaultTimeout;
    const cancelTimer = options.timers.after(timeout, () => {
      timedOut = true;
      controller.abort();
    });
    const endedWith = (): ApiError =>
      new ApiError({
        kind: timedOut ? "timeout" : callerAborted ? "aborted" : "network",
      });

    try {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(request.query ?? {})) {
        if (value !== undefined) query.append(key, String(value));
      }
      const queryText = query.toString();
      const url = baseUrl + request.path + (queryText ? `?${queryText}` : "");

      const headers: Record<string, string> = { Accept: "application/json" };
      for (const [name, value] of Object.entries(request.headers ?? {})) {
        if (!OWN_HEADERS.has(name.toLowerCase())) headers[name] = value;
      }
      const hasBody = request.body !== undefined;
      if (hasBody) headers["Content-Type"] = "application/json";

      const send = options.fetch ?? globalThis.fetch;
      let response: Response;
      let text: string | undefined;
      try {
        response = await send(url, {
          method: request.method,
          headers,
          body: hasBody ? JSON.stringify(request.body) : undefined,
          credentials: "same-origin",
          signal: controller.signal,
        });
        // A body that is not wanted is not read: a route declared with
        // `z.undefined()` and a 204 carry nothing the client uses.
        const wanted =
          !response.ok ||
          (response.status !== 204 && !isUndefinedSchema(request.schema));
        if (wanted) text = await response.text();
      } catch {
        throw endedWith();
      }

      if (response.ok) {
        if (response.status === 204 || isUndefinedSchema(request.schema)) {
          return { status: response.status, data: undefined as z.output<S> };
        }
        let value: unknown;
        try {
          value = JSON.parse(text ?? "");
        } catch {
          throw new ApiError({
            kind: "invalid_response",
            status: response.status,
          });
        }
        const read = readAnswer(request.schema, value);
        if (!read.ok) {
          throw new ApiError({
            kind: "invalid_response",
            status: response.status,
          });
        }
        return { status: response.status, data: read.data as z.output<S> };
      }

      const error = errorOf(response.status, text ?? "");
      if (response.status === 401 && isSessionCode(error.code)) {
        try {
          onUnauthenticated?.(error.code as string);
        } catch {
          // a hook that throws does not change what the caller receives
        }
      }
      throw error;
    } finally {
      cancelTimer();
      callerSignal?.removeEventListener("abort", onCallerAbort);
    }
  }

  const api = {
    // The core, for routes that have no typed method.
    request: async <S extends z.ZodType>(
      request: RequestOptions<S>,
    ): Promise<z.output<S>> => (await send(request)).data,
    // The same call with the status of the answer (201 against 200).
    requestWithStatus: send,
    setOnUnauthenticated(hook: ((code: string) => void) | null): void {
      onUnauthenticated = hook;
    },
    ...buildMethods(send),
  };
  return api;
}

export type ApiClient = ReturnType<typeof createApiClient>;

function isUndefinedSchema(schema: z.ZodType): boolean {
  return (
    (schema as unknown as { _zod: { def: { type: string } } })._zod.def.type ===
    "undefined"
  );
}

// A non-2xx answer: the error of TOKI-004 when the body has that form, else an
// http error with no code. The body is never copied into the error.
function errorOf(status: number, text: string): ApiError {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return new ApiError({ kind: "http", status });
  }
  const parsed = ErrorResponseSchema.safeParse(value);
  if (!parsed.success) return new ApiError({ kind: "http", status });
  const { code, message, details } = parsed.data.error;
  return new ApiError({ kind: "http", status, code, message, details });
}
