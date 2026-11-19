import { z } from "zod";
import {
  IDEMPOTENCY_KEY_PATTERN,
  MEMBER_LIST_LIMIT_DEFAULT,
  MEMBER_LIST_LIMIT_MAX,
} from "./limits.js";

// The requests and responses of member management (TOKI-024 R4 to R30). Not
// strict: a field added later breaks no client.

export const MemberRoleSchema = z.enum(["member", "admin"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const IdParamSchema = z.uuid();
export const IdempotencyKeySchema = z.string().regex(IDEMPOTENCY_KEY_PATTERN);

const invitationFields = {
  id: z.string(),
  role: MemberRoleSchema,
  mailStatus: z.enum(["sent", "failed"]),
  invitedBy: z.object({ id: z.string(), displayName: z.string() }),
  createdAt: z.string(),
  sentAt: z.string(),
  expiresAt: z.string(),
};

// An invitation as the list and the invite routes return it (R22).
export const InvitationSchema = z.object({
  ...invitationFields,
  state: z.enum(["pending", "expired"]),
});
export type Invitation = z.infer<typeof InvitationSchema>;

// The upper limit of `emails` is the route's: 51 entries are answered with
// `batch_too_large`, not with a validation error (R4).
export const InviteBodySchema = z.object({
  emails: z.array(z.string()).min(1),
  role: MemberRoleSchema.default("member"),
});
export type InviteBody = z.infer<typeof InviteBodySchema>;

export const InviteResultSchema = z.object({
  email: z.string(),
  result: z.enum([
    "invited",
    "mail_not_sent",
    "already_member",
    "already_invited",
    "invalid_email",
  ]),
  invitation: InvitationSchema.optional(),
});
export type InviteResult = z.infer<typeof InviteResultSchema>;

export const InviteResponseSchema = z.object({
  results: z.array(InviteResultSchema),
});
export type InviteResponse = z.infer<typeof InviteResponseSchema>;

export const ResendResponseSchema = z.object({
  result: z.enum(["invited", "mail_not_sent"]),
  invitation: InvitationSchema,
});
export type ResendResponse = z.infer<typeof ResendResponseSchema>;

export const RevokeResponseSchema = z.object({
  invitation: z.object({ ...invitationFields, state: z.literal("revoked") }),
});
export type RevokeResponse = z.infer<typeof RevokeResponseSchema>;

export const MemberStatusSchema = z.enum([
  "invited",
  "expired",
  "active",
  "deactivated",
]);
export type MemberStatus = z.infer<typeof MemberStatusSchema>;

export const MemberListQuerySchema = z.object({
  search: z.string().optional(),
  status: MemberStatusSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MEMBER_LIST_LIMIT_MAX)
    .default(MEMBER_LIST_LIMIT_DEFAULT),
  cursor: z.string().optional(),
});
export type MemberListQuery = z.infer<typeof MemberListQuerySchema>;

export const MemberRowSchema = z.object({
  kind: z.enum(["account", "invitation"]),
  userId: z.string().nullable(),
  email: z.string(),
  displayName: z.string().nullable(),
  role: MemberRoleSchema,
  status: MemberStatusSchema,
  lastActiveAt: z.string().nullable(),
  invitation: InvitationSchema.nullable(),
});
export type MemberRow = z.infer<typeof MemberRowSchema>;

export const MemberListResponseSchema = z.object({
  members: z.array(MemberRowSchema),
  counts: z.object({
    invited: z.number(),
    expired: z.number(),
    active: z.number(),
    deactivated: z.number(),
  }),
  activeAdminCount: z.number(),
  nextCursor: z.string().nullable(),
});
export type MemberListResponse = z.infer<typeof MemberListResponseSchema>;

export const ChangeRoleBodySchema = z.object({ role: MemberRoleSchema });
export type ChangeRoleBody = z.infer<typeof ChangeRoleBodySchema>;

export const MemberAccountSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: MemberRoleSchema,
  status: z.enum(["active", "deactivated"]),
});
export type MemberAccount = z.infer<typeof MemberAccountSchema>;

export const AccountResponseSchema = z.object({ member: MemberAccountSchema });
export type AccountResponse = z.infer<typeof AccountResponseSchema>;
