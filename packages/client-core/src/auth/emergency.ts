import {
  EmergencyResponseSchema,
  ErrorCodes,
  type Transport,
  type User,
} from "@toki/shared";
import type { ApiRequest, ApiResult } from "./sign-in";

// The one call of the emergency link page (TOKI-026 R26, R45). Like the sign-in calls it has no
// request layer, no DOM and no timer, and it changes no session state: the page calls
// `markSignedIn` with the user of an `ok` outcome. The token is only in the body of the request.

export type EmergencyOutcome =
  | { kind: "ok"; user: User }
  | { kind: "invalid" }
  | { kind: "deactivated" }
  | { kind: "rateLimited"; retryAfterSeconds: number }
  | { kind: "network" }
  | { kind: "failed" };

export type EmergencyCalls = {
  signInWithLink(
    token: string,
    transport?: Transport,
  ): Promise<EmergencyOutcome>;
};

function retryAfter(result: ApiResult): number | null {
  if (result.ok || result.kind !== "http") return null;
  const details = result.details;
  if (typeof details !== "object" || details === null) return null;
  const seconds = (details as Record<string, unknown>).retryAfterSeconds;
  return typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0
    ? seconds
    : null;
}

export function createEmergencyCalls(api: ApiRequest): EmergencyCalls {
  return {
    async signInWithLink(token, transport = "cookie") {
      let result: ApiResult;
      try {
        result = await api("/auth/emergency-sessions", {
          method: "POST",
          body: { token, transport },
        });
      } catch {
        return { kind: "failed" };
      }
      if (result.ok) {
        const parsed = EmergencyResponseSchema.safeParse(result.data);
        return parsed.success
          ? { kind: "ok", user: parsed.data.user }
          : { kind: "failed" };
      }
      if (result.kind === "network" || result.kind === "timeout") {
        return { kind: "network" };
      }
      if (result.kind !== "http") return { kind: "failed" };
      switch (result.code) {
        case ErrorCodes.emergencyLinkInvalid:
        case ErrorCodes.validationFailed:
          return { kind: "invalid" };
        case ErrorCodes.accountDeactivated:
          return { kind: "deactivated" };
        case ErrorCodes.rateLimited: {
          const seconds = retryAfter(result);
          return seconds === null
            ? { kind: "failed" }
            : { kind: "rateLimited", retryAfterSeconds: seconds };
        }
        default:
          return { kind: "failed" };
      }
    },
  };
}
