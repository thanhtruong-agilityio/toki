import {
  AcceptInvitationResponseSchema,
  ErrorCodes,
  InvitationLookupResponseSchema,
  ResendInvitationCodeResponseSchema,
  type User,
} from "@toki/shared";
import type { ApiRequest, ApiResult } from "./sign-in";

export type { ApiRequest, ApiResult };

// The three calls of the Join page (TOKI-097 R49, "Calls"). Like the sign-in calls, the client is an
// argument: no request layer, no DOM, no timer, no clock. The token is an argument too: it goes in the
// body of a request and never in a path or a query string (R26), and nothing here reads or keeps it.

// The state of a link that a call found it in, when the call could not do what it was asked.
export type ClosedState = "used" | "revoked" | "expired" | "unknown";

// What the lookup says (R1): the fields of each state and no other.
export type InvitationLookup =
  | {
      state: "pending";
      email: string;
      workspaceName: string;
      codeExpiresInSeconds: number;
      resendAfterSeconds: number;
    }
  | { state: "expired" | "revoked"; workspaceName: string }
  | { state: "used"; email: string }
  | { state: "unknown" };

export type LookupOutcome =
  | { kind: "ok"; lookup: InvitationLookup }
  // 400: a body the server refused; the page shows what it shows for an unknown link (R2, R35).
  | { kind: "invalid" }
  | { kind: "failed" }
  | { kind: "network" };

export type JoinResendOutcome =
  | { kind: "ok"; resendAfterSeconds: number; expiresInSeconds: number }
  | { kind: "tooSoon"; retryAfterSeconds: number }
  | { kind: "limit"; retryAfterSeconds: number }
  | { kind: "closed"; state: ClosedState }
  | { kind: "failed" }
  | { kind: "network" };

export type JoinSendOutcome =
  | { kind: "ok"; user: User; generalConversationId: string }
  | { kind: "incorrect"; triesLeft: number }
  | { kind: "locked" }
  | { kind: "expired" }
  | { kind: "closed"; state: ClosedState }
  | { kind: "failed" }
  | { kind: "network" };

export type InvitationCalls = {
  lookupInvitation(token: string): Promise<LookupOutcome>;
  resendInvitationCode(token: string): Promise<JoinResendOutcome>;
  acceptInvitation(token: string, code: string): Promise<JoinSendOutcome>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isSeconds = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

function detail(result: ApiResult, name: string): unknown {
  if (result.ok || result.kind !== "http" || !isRecord(result.details)) {
    return undefined;
  }
  return result.details[name];
}

// The answers that say the link cannot be used (R8, R16): 409 with the state, 404 for no invitation.
function closedState(result: ApiResult): ClosedState | null {
  if (result.ok || result.kind !== "http") return null;
  switch (result.code) {
    case ErrorCodes.invitationUsed:
      return "used";
    case ErrorCodes.invitationRevoked:
      return "revoked";
    case ErrorCodes.invitationExpired:
      return "expired";
    case ErrorCodes.invitationNotFound:
      return "unknown";
    default:
      return null;
  }
}

export function createInvitationCalls(api: ApiRequest): InvitationCalls {
  // The api should not reject; if it does the answer is the general failure.
  const run = async (
    path: string,
    body: Record<string, string>,
  ): Promise<ApiResult> => {
    try {
      return await api(path, { method: "POST", body });
    } catch {
      return { ok: false, kind: "invalid_response" };
    }
  };
  const noAnswer = (result: ApiResult) =>
    !result.ok && (result.kind === "network" || result.kind === "timeout");

  return {
    async lookupInvitation(token) {
      const result = await run("/invitations/lookup", { token });
      if (result.ok) {
        // The shared schema: a field added later is dropped, a missing or mistyped one is the failure.
        const parsed = InvitationLookupResponseSchema.safeParse(result.data);
        return parsed.success
          ? { kind: "ok", lookup: parsed.data }
          : { kind: "failed" };
      }
      if (noAnswer(result)) return { kind: "network" };
      if (
        result.kind === "http" &&
        result.code === ErrorCodes.validationFailed
      ) {
        return { kind: "invalid" };
      }
      return { kind: "failed" };
    },

    async resendInvitationCode(token) {
      const result = await run("/invitations/codes", { token });
      if (result.ok) {
        const parsed = ResendInvitationCodeResponseSchema.safeParse(
          result.data,
        );
        return parsed.success
          ? { kind: "ok", ...parsed.data }
          : { kind: "failed" };
      }
      if (noAnswer(result)) return { kind: "network" };
      const state = closedState(result);
      if (state) return { kind: "closed", state };
      if (result.kind !== "http") return { kind: "failed" };
      const retry = detail(result, "retryAfterSeconds");
      if (result.code === ErrorCodes.codeResendTooSoon && isSeconds(retry)) {
        return { kind: "tooSoon", retryAfterSeconds: retry };
      }
      if (result.code === ErrorCodes.codeRequestLimit && isSeconds(retry)) {
        return { kind: "limit", retryAfterSeconds: retry };
      }
      return { kind: "failed" };
    },

    async acceptInvitation(token, code) {
      const result = await run("/invitations/sessions", { token, code });
      if (result.ok) {
        const parsed = AcceptInvitationResponseSchema.safeParse(result.data);
        return parsed.success
          ? { kind: "ok", ...parsed.data }
          : { kind: "failed" };
      }
      if (noAnswer(result)) return { kind: "network" };
      const state = closedState(result);
      if (state) return { kind: "closed", state };
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
        default:
          return { kind: "failed" };
      }
    },
  };
}
