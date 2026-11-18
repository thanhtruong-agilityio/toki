CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "users_workspace_id_email_key" UNIQUE("workspace_id","email"),
	CONSTRAINT "users_email_check" CHECK ("users"."email" = lower("users"."email") and "users"."email" !~ '[[:space:]]'),
	CONSTRAINT "users_email_length_check" CHECK (char_length("users"."email") <= 254),
	CONSTRAINT "users_display_name_length_check" CHECK (char_length("users"."display_name") between 1 and 80),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('member', 'admin')),
	CONSTRAINT "users_status_check" CHECK ("users"."status" in ('active', 'deactivated')),
	CONSTRAINT "users_language_check" CHECK ("users"."language" in ('en', 'vi'))
);
--> statement-breakpoint
CREATE TABLE "login_codes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"purpose" text NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"request_hash" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"wrong_tries" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "login_codes_request_hash_key" UNIQUE("request_hash"),
	CONSTRAINT "login_codes_purpose_check" CHECK ("login_codes"."purpose" in ('sign_in', 'invitation')),
	CONSTRAINT "login_codes_email_check" CHECK ("login_codes"."email" = lower("login_codes"."email") and "login_codes"."email" !~ '[[:space:]]'),
	CONSTRAINT "login_codes_email_length_check" CHECK (char_length("login_codes"."email") <= 254),
	CONSTRAINT "login_codes_request_hash_check" CHECK ("login_codes"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "login_codes_code_hash_check" CHECK ("login_codes"."code_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "login_codes_wrong_tries_check" CHECK ("login_codes"."wrong_tries" between 0 and 5),
	CONSTRAINT "login_codes_expires_at_check" CHECK ("login_codes"."expires_at" > "login_codes"."created_at")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"secret_hash" text NOT NULL,
	"kind" text NOT NULL,
	"user_agent" text,
	"last_used_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	CONSTRAINT "sessions_secret_hash_key" UNIQUE("secret_hash"),
	CONSTRAINT "sessions_secret_hash_check" CHECK ("sessions"."secret_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "sessions_kind_check" CHECK ("sessions"."kind" in ('cookie', 'token')),
	CONSTRAINT "sessions_user_agent_length_check" CHECK (char_length("sessions"."user_agent") <= 512),
	CONSTRAINT "sessions_ended_check" CHECK (("sessions"."ended_at" is null) = ("sessions"."ended_reason" is null)),
	CONSTRAINT "sessions_ended_reason_check" CHECK ("sessions"."ended_reason" in ('signed_out', 'replaced', 'revoked', 'deactivated'))
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"push_channel" text NOT NULL,
	"push_address" jsonb NOT NULL,
	CONSTRAINT "devices_session_id_key" UNIQUE("session_id"),
	CONSTRAINT "devices_push_channel_check" CHECK ("devices"."push_channel" in ('web_push', 'apns', 'fcm')),
	CONSTRAINT "devices_push_address_check" CHECK (jsonb_typeof("devices"."push_address") = 'object')
);
--> statement-breakpoint
CREATE INDEX "login_codes_sign_in_email_created_at_idx" ON "login_codes" USING btree ("email","created_at") WHERE "login_codes"."purpose" = 'sign_in';--> statement-breakpoint
CREATE INDEX "login_codes_sign_in_created_at_idx" ON "login_codes" USING btree ("created_at") WHERE "login_codes"."purpose" = 'sign_in';--> statement-breakpoint
CREATE INDEX "sessions_user_id_live_idx" ON "sessions" USING btree ("user_id") WHERE "sessions"."ended_at" is null;--> statement-breakpoint
CREATE INDEX "devices_user_id_idx" ON "devices" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT;
