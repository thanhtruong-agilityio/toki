import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

// Not exported from the module's index.ts. Foreign keys to workspaces and
// users are written as SQL in the migration (R22). No time column has a
// database default (R6).
const hash = (column: unknown) => sql`${column} ~ '^[0-9a-f]{64}$'`;

export const loginCodes = pgTable(
  "login_codes",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    purpose: text("purpose").notNull(),
    email: text("email").notNull(),
    userId: uuid("user_id"),
    requestHash: text("request_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    wrongTries: integer("wrong_tries").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (t) => [
    unique("login_codes_request_hash_key").on(t.requestHash),
    check(
      "login_codes_purpose_check",
      sql`${t.purpose} in ('sign_in', 'invitation')`,
    ),
    check(
      "login_codes_email_check",
      sql`${t.email} = lower(${t.email}) and ${t.email} !~ '[[:space:]]'`,
    ),
    check(
      "login_codes_email_length_check",
      sql`char_length(${t.email}) <= 254`,
    ),
    check("login_codes_request_hash_check", hash(t.requestHash)),
    check("login_codes_code_hash_check", hash(t.codeHash)),
    check(
      "login_codes_wrong_tries_check",
      sql`${t.wrongTries} between 0 and 5`,
    ),
    check("login_codes_expires_at_check", sql`${t.expiresAt} > ${t.createdAt}`),
    index("login_codes_sign_in_email_created_at_idx")
      .on(t.email, t.createdAt)
      .where(sql`${t.purpose} = 'sign_in'`),
    index("login_codes_sign_in_created_at_idx")
      .on(t.createdAt)
      .where(sql`${t.purpose} = 'sign_in'`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    workspaceId: uuid("workspace_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    userId: uuid("user_id").notNull(),
    secretHash: text("secret_hash").notNull(),
    kind: text("kind").notNull(),
    userAgent: text("user_agent"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedReason: text("ended_reason"),
  },
  (t) => [
    unique("sessions_secret_hash_key").on(t.secretHash),
    check("sessions_secret_hash_check", hash(t.secretHash)),
    check("sessions_kind_check", sql`${t.kind} in ('cookie', 'token')`),
    check(
      "sessions_user_agent_length_check",
      sql`char_length(${t.userAgent}) <= 512`,
    ),
    check(
      "sessions_ended_check",
      sql`(${t.endedAt} is null) = (${t.endedReason} is null)`,
    ),
    check(
      "sessions_ended_reason_check",
      sql`${t.endedReason} in ('signed_out', 'replaced', 'revoked', 'deactivated')`,
    ),
    index("sessions_user_id_live_idx")
      .on(t.userId)
      .where(sql`${t.endedAt} is null`),
  ],
);
