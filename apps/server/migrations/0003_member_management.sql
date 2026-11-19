CREATE TABLE "admin_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_user_id" uuid,
	"target_email" text,
	"detail" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "admin_actions_action_check" CHECK ("admin_actions"."action" in ('invitation_created', 'invitation_resent', 'invitation_revoked', 'role_changed', 'account_deactivated', 'account_reactivated')),
	CONSTRAINT "admin_actions_target_email_check" CHECK ("admin_actions"."target_email" = lower("admin_actions"."target_email") and "admin_actions"."target_email" !~ '[[:space:]]'),
	CONSTRAINT "admin_actions_target_email_length_check" CHECK (char_length("admin_actions"."target_email") <= 254),
	CONSTRAINT "admin_actions_detail_check" CHECK (jsonb_typeof("admin_actions"."detail") = 'object')
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"user_id" uuid,
	"invited_by" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"code_serial" integer NOT NULL,
	"code_issued_at" timestamp with time zone NOT NULL,
	"mail_status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" uuid,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "invitations_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "invitations_email_check" CHECK ("invitations"."email" = lower("invitations"."email") and "invitations"."email" !~ '[[:space:]]'),
	CONSTRAINT "invitations_email_length_check" CHECK (char_length("invitations"."email") <= 254),
	CONSTRAINT "invitations_role_check" CHECK ("invitations"."role" in ('member', 'admin')),
	CONSTRAINT "invitations_token_hash_check" CHECK ("invitations"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "invitations_code_serial_check" CHECK ("invitations"."code_serial" >= 0),
	CONSTRAINT "invitations_mail_status_check" CHECK ("invitations"."mail_status" in ('sent', 'failed')),
	CONSTRAINT "invitations_expires_at_check" CHECK ("invitations"."expires_at" > "invitations"."sent_at"),
	CONSTRAINT "invitations_closed_check" CHECK ("invitations"."used_at" is null or "invitations"."revoked_at" is null)
);
--> statement-breakpoint
CREATE TABLE "member_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"request_key" text NOT NULL,
	"action" text NOT NULL,
	"request_hash" text NOT NULL,
	"state" text NOT NULL,
	"claim_id" uuid NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "member_requests_user_id_request_key_key" UNIQUE("user_id","request_key"),
	CONSTRAINT "member_requests_request_key_check" CHECK ("member_requests"."request_key" ~ '^[A-Za-z0-9_-]{1,64}$'),
	CONSTRAINT "member_requests_action_check" CHECK ("member_requests"."action" in ('invite', 'resend')),
	CONSTRAINT "member_requests_request_hash_check" CHECK ("member_requests"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "member_requests_state_check" CHECK ("member_requests"."state" in ('pending', 'done')),
	CONSTRAINT "member_requests_done_check" CHECK (("member_requests"."state" = 'done') = ("member_requests"."response_status" is not null) and ("member_requests"."state" = 'done') = ("member_requests"."response_body" is not null))
);
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_requests" ADD CONSTRAINT "member_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_open_email_key" ON "invitations" USING btree ("workspace_id","email") WHERE "invitations"."used_at" is null and "invitations"."revoked_at" is null;
--> statement-breakpoint
-- Written by hand (R36): the keys that leave the module, ON DELETE RESTRICT.
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "admin_actions" ADD CONSTRAINT "admin_actions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "member_requests" ADD CONSTRAINT "member_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
-- Written by hand (R31): the record is append-only. TRUNCATE is not blocked.
CREATE FUNCTION "admin_actions_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_actions: a recorded action is never changed or deleted'
    USING ERRCODE = '23514', CONSTRAINT = 'admin_actions_append_only_trg';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "admin_actions_append_only_trg" BEFORE UPDATE OR DELETE ON "admin_actions"
FOR EACH ROW EXECUTE FUNCTION "admin_actions_append_only"();
