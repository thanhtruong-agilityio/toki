import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// One row per person who has an account. Not exported from the module's
// index.ts, so no other module reads the table. The foreign key to
// workspaces is written as SQL in the migration (R22): a schema file may not
// import another module's table. No time column has a database default; the
// server writes the time (R6).
export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull(),
    language: text("language").notNull().default("en"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    unique("users_workspace_id_email_key").on(t.workspaceId, t.email),
    check(
      "users_email_check",
      sql`${t.email} = lower(${t.email}) and ${t.email} !~ '[[:space:]]'`,
    ),
    check("users_email_length_check", sql`char_length(${t.email}) <= 254`),
    check(
      "users_display_name_length_check",
      sql`char_length(${t.displayName}) between 1 and 80`,
    ),
    check("users_role_check", sql`${t.role} in ('member', 'admin')`),
    check("users_status_check", sql`${t.status} in ('active', 'deactivated')`),
    check("users_language_check", sql`${t.language} in ('en', 'vi')`),
  ],
);

const time = (name: string) => timestamp(name, { withTimezone: true });
const HEX_64 = "^[0-9a-f]{64}$";

// One row per invitation (TOKI-024 R36, R38). The state is not stored: it is
// worked out from used_at, revoked_at, expires_at and the clock (R18). The
// keys to users are inside the module, so Drizzle writes them; the key to
// workspaces is SQL in the migration.
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    // The deactivated account this invitation brings back (R9).
    userId: uuid("user_id"),
    invitedBy: uuid("invited_by").notNull(),
    tokenHash: text("token_hash").notNull(),
    codeSerial: integer("code_serial").notNull(),
    codeIssuedAt: time("code_issued_at").notNull(),
    mailStatus: text("mail_status").notNull(),
    createdAt: time("created_at").notNull(),
    sentAt: time("sent_at").notNull(),
    expiresAt: time("expires_at").notNull(),
    usedAt: time("used_at"),
    usedBy: uuid("used_by"),
    revokedAt: time("revoked_at"),
  },
  (t) => [
    unique("invitations_token_hash_key").on(t.tokenHash),
    // One unclosed invitation per address (R7, R18).
    uniqueIndex("invitations_open_email_key")
      .on(t.workspaceId, t.email)
      .where(sql`${t.usedAt} is null and ${t.revokedAt} is null`),
    check(
      "invitations_email_check",
      sql`${t.email} = lower(${t.email}) and ${t.email} !~ '[[:space:]]'`,
    ),
    check(
      "invitations_email_length_check",
      sql`char_length(${t.email}) <= 254`,
    ),
    check("invitations_role_check", sql`${t.role} in ('member', 'admin')`),
    check(
      "invitations_token_hash_check",
      sql`${t.tokenHash} ~ ${sql.raw(`'${HEX_64}'`)}`,
    ),
    check("invitations_code_serial_check", sql`${t.codeSerial} >= 0`),
    check(
      "invitations_mail_status_check",
      sql`${t.mailStatus} in ('sent', 'failed')`,
    ),
    check("invitations_expires_at_check", sql`${t.expiresAt} > ${t.sentAt}`),
    check(
      "invitations_closed_check",
      sql`${t.usedAt} is null or ${t.revokedAt} is null`,
    ),
    foreignKey({
      name: "invitations_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "invitations_invited_by_fkey",
      columns: [t.invitedBy],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "invitations_used_by_fkey",
      columns: [t.usedBy],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
  ],
);

// The record of administrative actions (R31, D-110). Append-only: a trigger
// written in the migration refuses UPDATE and DELETE.
export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    actorId: uuid("actor_id").notNull(),
    action: text("action").notNull(),
    targetUserId: uuid("target_user_id"),
    targetEmail: text("target_email"),
    detail: jsonb("detail").notNull(),
    createdAt: time("created_at").notNull(),
  },
  (t) => [
    check(
      "admin_actions_action_check",
      sql`${t.action} in ('invitation_created', 'invitation_resent', 'invitation_revoked', 'role_changed', 'account_deactivated', 'account_reactivated')`,
    ),
    check(
      "admin_actions_target_email_check",
      sql`${t.targetEmail} = lower(${t.targetEmail}) and ${t.targetEmail} !~ '[[:space:]]'`,
    ),
    check(
      "admin_actions_target_email_length_check",
      sql`char_length(${t.targetEmail}) <= 254`,
    ),
    check(
      "admin_actions_detail_check",
      sql`jsonb_typeof(${t.detail}) = 'object'`,
    ),
    foreignKey({
      name: "admin_actions_actor_id_fkey",
      columns: [t.actorId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "admin_actions_target_user_id_fkey",
      columns: [t.targetUserId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
  ],
);

// The stored answer of a batch or a resend, by person and key (R13, D-111).
export const memberRequests = pgTable(
  "member_requests",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    userId: uuid("user_id").notNull(),
    requestKey: text("request_key").notNull(),
    action: text("action").notNull(),
    requestHash: text("request_hash").notNull(),
    state: text("state").notNull(),
    claimId: uuid("claim_id").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: time("created_at").notNull(),
    claimedAt: time("claimed_at").notNull(),
    completedAt: time("completed_at"),
  },
  (t) => [
    unique("member_requests_user_id_request_key_key").on(
      t.userId,
      t.requestKey,
    ),
    check(
      "member_requests_request_key_check",
      sql`${t.requestKey} ~ '^[A-Za-z0-9_-]{1,64}$'`,
    ),
    check(
      "member_requests_action_check",
      sql`${t.action} in ('invite', 'resend')`,
    ),
    check(
      "member_requests_request_hash_check",
      sql`${t.requestHash} ~ ${sql.raw(`'${HEX_64}'`)}`,
    ),
    check(
      "member_requests_state_check",
      sql`${t.state} in ('pending', 'done')`,
    ),
    check(
      "member_requests_done_check",
      sql`(${t.state} = 'done') = (${t.responseStatus} is not null) and (${t.state} = 'done') = (${t.responseBody} is not null)`,
    ),
    foreignKey({
      name: "member_requests_user_id_fkey",
      columns: [t.userId],
      foreignColumns: [users.id],
    }).onDelete("restrict"),
  ],
);
