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

// Local types for the answers of docs/specs/2026-11-16-sign-in-api-design.md, until the shared schemas
// of TOKI-022 are on `main` (plan, decision 4).
export type SignInUser = {
  id: string;
  email: string;
  displayName: string;
  role: "member" | "admin";
  language: "en" | "vi";
};

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

const SESSION_CODES = [
  "unauthenticated",
  "session_ended",
  "account_deactivated",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSeconds(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

// A field the shape does not know is dropped (as the shared client does).
function readUser(value: unknown): SignInUser | null {
  if (!isRecord(value)) return null;
  const { id, email, displayName, role, language } = value;
  if (
    typeof id !== "string" ||
    typeof email !== "string" ||
    typeof displayName !== "string" ||
    (role !== "member" && role !== "admin") ||
    (language !== "en" && language !== "vi")
  ) {
    return null;
  }
  return { id, email, displayName, role, language };
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
        const d = result.data;
        if (
          isRecord(d) &&
          typeof d.requestId === "string" &&
          isSeconds(d.expiresInSeconds) &&
          isSeconds(d.resendAfterSeconds)
        ) {
          return {
            kind: "ok",
            requestId: d.requestId,
            expiresInSeconds: d.expiresInSeconds,
            resendAfterSeconds: d.resendAfterSeconds,
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
        case "validation_failed":
          return { kind: "invalid" };
        case "code_request_limit":
        case "rate_limited":
          return isSeconds(retry)
            ? { kind: "limit", retryAfterSeconds: retry }
            : { kind: "failed" };
        case "code_resend_too_soon":
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
        const user = isRecord(result.data) ? readUser(result.data.user) : null;
        return user ? { kind: "ok", user } : { kind: "failed" };
      }
      if (result.kind === "network" || result.kind === "timeout") {
        return { kind: "network" };
      }
      if (result.kind !== "http") return { kind: "failed" };
      switch (result.code) {
        case "code_incorrect": {
          const tries = detail(result, "triesLeft");
          return isSeconds(tries)
            ? { kind: "incorrect", triesLeft: tries }
            : { kind: "failed" };
        }
        case "code_locked":
          return { kind: "locked" };
        case "code_expired":
          return { kind: "expired" };
        case "account_deactivated":
          return { kind: "deactivated" };
        default:
          return { kind: "failed" };
      }
    },

    async readSession() {
      const result = await run("/auth/session", { method: "GET" });
      if (result.ok) {
        const user = isRecord(result.data) ? readUser(result.data.user) : null;
        return user ? { kind: "ok", user } : { kind: "failed" };
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
      if (result.ok && isRecord(result.data)) {
        const name = result.data.name;
        if (typeof name === "string") return name;
      }
      return null;
    },
  };
}
