import {
  CreateSessionResponseSchema,
  CurrentSessionResponseSchema,
  ErrorCodes,
  RequestCodeResponseSchema,
  WorkspaceNameResponseSchema,
  type User,
} from "@toki/shared";

// The four calls of the sign-in screens (TOKI-023, R43). The client is an argument: this file has no
// request layer, no DOM, no timer and no clock. It maps what a request ended with to the outcomes the
// screens show, and it changes no session state: a 401 is reported to the session store by the hook of
// the client (`reportUnauthenticated`), not here.

// The shape of the shared client's `api.request`, as the calls need it (plan, decision 3). Until the
// client of TOKI-032 is passed in, a function of this type is the stand-in. `path` is relative to
// `/api/v1`. A request never rejects: it ends in one of these results.
export type ApiResult =
  | { ok: true; status: number; data: unknown }
  | {
      ok: false;
      kind: "http";
      status: number;
      code: string | null;
      details?: unknown;
    }
  | { ok: false; kind: "network" | "timeout" | "invalid_response" };

export type ApiRequest = (
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
) => Promise<ApiResult>;

// The user of the answers is the shared `User` (TOKI-022); kept under its old name for the callers.
export type SignInUser = User;

export type CodeRequestOutcome =
  | {
      kind: "ok";
      requestId: string;
      expiresInSeconds: number;
      resendAfterSeconds: number;
    }
  | { kind: "invalid" }
  | { kind: "limit"; retryAfterSeconds: number }
  | { kind: "tooSoon"; retryAfterSeconds: number }
  | { kind: "failed" }
  | { kind: "network" };

export type CodeSubmitOutcome =
  | { kind: "ok"; user: SignInUser }
  | { kind: "incorrect"; triesLeft: number }
  | { kind: "locked" }
  | { kind: "expired" }
  | { kind: "deactivated" }
  | { kind: "failed" }
  | { kind: "network" };

export type SessionReadOutcome =
  | { kind: "ok"; user: SignInUser }
  | { kind: "unauthenticated"; code: string }
  | { kind: "failed" }
  | { kind: "network" };

export type SignInCalls = {
  requestCode(email: string): Promise<CodeRequestOutcome>;
  submitCode(input: {
    requestId: string;
    code: string;
  }): Promise<CodeSubmitOutcome>;
  readSession(): Promise<SessionReadOutcome>;
  /** The name for the sign-in card, or null on any failure (R38). */
  readWorkspaceName(): Promise<string | null>;
};

// The codes of a 401 that end a session (R1, R24, R26), from the shared registry.
const SESSION_CODES: readonly string[] = [
  ErrorCodes.unauthenticated,
  ErrorCodes.sessionEnded,
  ErrorCodes.accountDeactivated,
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function detail(result: ApiResult, name: string): unknown {
  if (result.ok || result.kind !== "http" || !isRecord(result.details)) {
    return undefined;
  }
  return result.details[name];
}

export function createSignInCalls(api: ApiRequest): SignInCalls {
  // The api should not reject; if it does the answer is the general failure.
  const run = async (
    path: string,
    init: { method: "GET" | "POST"; body?: unknown },
  ): Promise<ApiResult> => {
    try {
      return await api(path, init);
    } catch {
      return { ok: false, kind: "invalid_response" };
    }
  };

  return {
    async requestCode(email) {
      const result = await run("/auth/codes", {
        method: "POST",
        body: { email },
      });
      if (result.ok) {
        // A 200 body that does not fit the shared schema is `invalid_response` (R22).
        const parsed = RequestCodeResponseSchema.safeParse(result.data);
        if (
          parsed.success &&
          isSeconds(parsed.data.expiresInSeconds) &&
          isSeconds(parsed.data.resendAfterSeconds)
        ) {
          const { requestId, expiresInSeconds, resendAfterSeconds } =
            parsed.data;
          return {
            kind: "ok",
            requestId,
            expiresInSeconds,
            resendAfterSeconds,
          };
        }
        return { kind: "failed" };
      }
      if (result.kind === "network" || result.kind === "timeout") {
        return { kind: "network" };
      }
      if (result.kind !== "http") return { kind: "failed" };
      const retry = detail(result, "retryAfterSeconds");
      switch (result.code) {
        case ErrorCodes.validationFailed:
          return { kind: "invalid" };
        case ErrorCodes.codeRequestLimit:
        case ErrorCodes.rateLimited:
          return isSeconds(retry)
            ? { kind: "limit", retryAfterSeconds: retry }
            : { kind: "failed" };
        case ErrorCodes.codeResendTooSoon:
          return isSeconds(retry)
            ? { kind: "tooSoon", retryAfterSeconds: retry }
            : { kind: "failed" };
        default:
          return { kind: "failed" };
      }
    },

    async submitCode({ requestId, code }) {
      const result = await run("/auth/sessions", {
        method: "POST",
        body: { requestId, code },
      });
      if (result.ok) {
        const parsed = CreateSessionResponseSchema.safeParse(result.data);
        return parsed.success
          ? { kind: "ok", user: parsed.data.user }
          : { kind: "failed" };
      }
      if (result.kind === "network" || result.kind === "timeout") {
        return { kind: "network" };
      }
      if (result.kind !== "http") return { kind: "failed" };
      switch (result.code) {
        case ErrorCodes.codeIncorrect: {
          const tries = detail(result, "triesLeft");
          return isSeconds(tries)
            ? { kind: "incorrect", triesLeft: tries }
            : { kind: "failed" };
        }
        case ErrorCodes.codeLocked:
          return { kind: "locked" };
        case ErrorCodes.codeExpired:
          return { kind: "expired" };
        case ErrorCodes.accountDeactivated:
          return { kind: "deactivated" };
        default:
          return { kind: "failed" };
      }
    },

    async readSession() {
      const result = await run("/auth/session", { method: "GET" });
      if (result.ok) {
        const parsed = CurrentSessionResponseSchema.safeParse(result.data);
        return parsed.success
          ? { kind: "ok", user: parsed.data.user }
          : { kind: "failed" };
      }
      if (result.kind === "network" || result.kind === "timeout") {
        return { kind: "network" };
      }
      if (
        result.kind === "http" &&
        result.status === 401 &&
        result.code !== null &&
        SESSION_CODES.includes(result.code)
      ) {
        return { kind: "unauthenticated", code: result.code };
      }
      return { kind: "failed" };
    },

    async readWorkspaceName() {
      const result = await run("/auth/workspace", { method: "GET" });
      if (!result.ok) return null;
      const parsed = WorkspaceNameResponseSchema.safeParse(result.data);
      return parsed.success ? parsed.data.name : null;
    },
  };
}
