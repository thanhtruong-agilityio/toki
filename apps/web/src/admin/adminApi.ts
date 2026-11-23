import {
  AccountResponseSchema,
  InviteResponseSchema,
  MemberListResponseSchema,
  ResendResponseSchema,
  RevokeResponseSchema,
  type Invitation,
  type MemberListQuery,
  type MemberListResponse,
  type MemberRole,
  type MemberRow,
} from "@toki/shared";
import { api } from "../client";

// The calls of the Admin page, one for each route of TOKI-024 (TOKI-025 R5). Each goes through
// `api.request`; nothing here keeps state. The idempotency keys are made by the callers (they
// follow the key rules of R20 and R22) and come in as arguments.

// The two routes that send mail may run longer than the client's 10 s: a batch of 50 can wait
// 30 s for a mail slot and 30 s for the send (TOKI-024 R13), so they get 75 s (R5).
const MAIL_ROUTE_TIMEOUT_MS = 75_000;

// Dates are converted here, at the API boundary, and nowhere else: the server answers ISO 8601
// strings and `formatDate` and `formatDateTime` take epoch milliseconds. A null or a string that is
// not a date gives null (R5, R30).
function toInstant(value: string | null): number | null {
  if (value === null) return null;
  const at = Date.parse(value);
  return Number.isFinite(at) ? at : null;
}

export type InvitationView = Omit<
  Invitation,
  "createdAt" | "sentAt" | "expiresAt"
> & {
  createdAt: number | null;
  sentAt: number | null;
  expiresAt: number | null;
};

export type MemberRowView = Omit<MemberRow, "lastActiveAt" | "invitation"> & {
  lastActiveAt: number | null;
  invitation: InvitationView | null;
};

export type MemberListView = Omit<MemberListResponse, "members"> & {
  members: MemberRowView[];
};

function viewInvitation(invitation: Invitation): InvitationView {
  return {
    ...invitation,
    createdAt: toInstant(invitation.createdAt),
    sentAt: toInstant(invitation.sentAt),
    expiresAt: toInstant(invitation.expiresAt),
  };
}

export type ListMembersQuery = {
  search?: string;
  status?: MemberListQuery["status"];
  limit?: number;
  cursor?: string;
};

const encode = encodeURIComponent;

export async function listMembers(
  query: ListMembersQuery,
  signal?: AbortSignal,
): Promise<MemberListView> {
  const answer = await api.request({
    method: "GET",
    path: "/members",
    query: {
      // An empty search and an unset status are left out of the query.
      search: query.search === "" ? undefined : query.search,
      status: query.status,
      limit: query.limit,
      cursor: query.cursor,
    },
    schema: MemberListResponseSchema,
    signal,
  });
  return {
    ...answer,
    members: answer.members.map((row) => ({
      ...row,
      lastActiveAt: toInstant(row.lastActiveAt),
      invitation: row.invitation ? viewInvitation(row.invitation) : null,
    })),
  };
}

export function inviteMembers(
  body: { emails: string[]; role: MemberRole },
  key: string,
  signal?: AbortSignal,
) {
  return api.request({
    method: "POST",
    path: "/invitations",
    body,
    schema: InviteResponseSchema,
    headers: { "Idempotency-Key": key },
    timeoutMs: MAIL_ROUTE_TIMEOUT_MS,
    signal,
  });
}

export function resendInvitation(id: string, key: string) {
  return api.request({
    method: "POST",
    path: `/invitations/${encode(id)}/resend`,
    schema: ResendResponseSchema,
    headers: { "Idempotency-Key": key },
    timeoutMs: MAIL_ROUTE_TIMEOUT_MS,
  });
}

export function revokeInvitation(id: string) {
  return api.request({
    method: "POST",
    path: `/invitations/${encode(id)}/revoke`,
    schema: RevokeResponseSchema,
  });
}

export function changeRole(userId: string, role: MemberRole) {
  return api.request({
    method: "POST",
    path: `/members/${encode(userId)}/role`,
    body: { role },
    schema: AccountResponseSchema,
  });
}

export function deactivateMember(userId: string) {
  return api.request({
    method: "POST",
    path: `/members/${encode(userId)}/deactivate`,
    schema: AccountResponseSchema,
  });
}

export function reactivateMember(userId: string) {
  return api.request({
    method: "POST",
    path: `/members/${encode(userId)}/reactivate`,
    schema: AccountResponseSchema,
  });
}
