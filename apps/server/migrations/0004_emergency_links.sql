CREATE TABLE "emergency_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"session_id" uuid,
	CONSTRAINT "emergency_links_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "emergency_links_token_hash_check" CHECK ("emergency_links"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "emergency_links_expires_at_check" CHECK ("emergency_links"."expires_at" > "emergency_links"."created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "emergency_links_user_id_open_key" ON "emergency_links" USING btree ("user_id") WHERE "emergency_links"."used_at" is null and "emergency_links"."cancelled_at" is null;
--> statement-breakpoint
-- Written by hand (TOKI-026): the foreign keys across modules, as in 0001. A regenerated migration loses them.
ALTER TABLE "emergency_links" ADD CONSTRAINT "emergency_links_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "emergency_links" ADD CONSTRAINT "emergency_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
