CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"system_type" text,
	"system_user_ids" uuid[],
	"body" text NOT NULL,
	"parent_id" uuid,
	"also_in_channel" boolean DEFAULT false NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "messages_id_conversation_id_key" UNIQUE("id","conversation_id"),
	CONSTRAINT "messages_kind_check" CHECK ("messages"."kind" in ('user', 'system')),
	CONSTRAINT "messages_system_shape_check" CHECK ("messages"."kind" <> 'system' or ("messages"."system_type" is not null and "messages"."system_type" ~ '^[a-z][a-z0-9_]{0,63}$' and "messages"."system_user_ids" is not null and "messages"."body" = '' and "messages"."parent_id" is null and not "messages"."also_in_channel" and "messages"."edited_at" is null and "messages"."deleted_at" is null and "messages"."deleted_by" is null)),
	CONSTRAINT "messages_user_shape_check" CHECK ("messages"."kind" <> 'user' or ("messages"."system_type" is null and "messages"."system_user_ids" is null)),
	CONSTRAINT "messages_body_check" CHECK (char_length("messages"."body") <= 10000),
	CONSTRAINT "messages_also_in_channel_check" CHECK (not "messages"."also_in_channel" or "messages"."parent_id" is not null),
	CONSTRAINT "messages_deleted_check" CHECK (("messages"."deleted_at" is null) = ("messages"."deleted_by" is null))
);
--> statement-breakpoint
CREATE TABLE "event_counters" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"last_number" bigint NOT NULL,
	CONSTRAINT "event_counters_last_number_check" CHECK ("event_counters"."last_number" between 0 and 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "events" (
	"workspace_id" uuid NOT NULL,
	"number" bigint NOT NULL,
	"scope" text NOT NULL,
	"conversation_id" uuid,
	"user_id" uuid,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "events_pkey" PRIMARY KEY("workspace_id","number"),
	CONSTRAINT "events_number_check" CHECK ("events"."number" between 1 and 9007199254740991),
	CONSTRAINT "events_scope_check" CHECK ("events"."scope" in ('workspace', 'conversation', 'user')),
	CONSTRAINT "events_scope_shape_check" CHECK (("events"."scope" = 'workspace' and "events"."conversation_id" is null and "events"."user_id" is null) or ("events"."scope" = 'conversation' and "events"."conversation_id" is not null and "events"."user_id" is null) or ("events"."scope" = 'user' and "events"."user_id" is not null and "events"."conversation_id" is null)),
	CONSTRAINT "events_type_check" CHECK ("events"."type" ~ '^[a-z][a-z0-9_.]{0,63}$'),
	CONSTRAINT "events_payload_check" CHECK (jsonb_typeof("events"."payload") = 'object')
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_id_fkey" FOREIGN KEY ("parent_id","conversation_id") REFERENCES "public"."messages"("id","conversation_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_conversation_main_idx" ON "messages" USING btree ("conversation_id","created_at","id") WHERE "messages"."parent_id" is null or "messages"."also_in_channel";--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("parent_id","created_at","id") WHERE "messages"."parent_id" is not null;--> statement-breakpoint
CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");--> statement-breakpoint
-- Written by hand (R9, R13, R14): the keys that leave the module, ON DELETE
-- RESTRICT. Each workspace key comes before the composite key, so an unknown
-- workspace id names the key under test.
ALTER TABLE "messages" ADD CONSTRAINT "messages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id","workspace_id") REFERENCES "conversations"("id","workspace_id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_conversation_id_fkey" FOREIGN KEY ("conversation_id","workspace_id") REFERENCES "conversations"("id","workspace_id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "event_counters" ADD CONSTRAINT "event_counters_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
-- Written by hand (R5): a thread is one level deep. A parent that is not found
-- is refused too, so a row cannot be its own parent. The parent is looked up by
-- id alone: the composite key names a parent of another conversation. No lock is
-- taken, because the kind and the parent of a message never change (R7) and no
-- row is deleted (R8).
CREATE FUNCTION "messages_thread_depth"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM messages p
    WHERE p.id = NEW.parent_id AND p.parent_id IS NULL AND p.kind = 'user';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'messages: a reply needs a root message as its parent'
      USING ERRCODE = '23514', CONSTRAINT = 'messages_thread_depth_trg';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "messages_thread_depth_trg" BEFORE INSERT ON "messages"
FOR EACH ROW WHEN (NEW.parent_id IS NOT NULL)
EXECUTE FUNCTION "messages_thread_depth"();
--> statement-breakpoint
-- Written by hand (R7): the columns that fix a message's place and origin.
CREATE FUNCTION "messages_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'messages: the place and the origin of a message cannot change'
    USING ERRCODE = '23514', CONSTRAINT = 'messages_immutable_trg';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "messages_immutable_trg" BEFORE UPDATE ON "messages"
FOR EACH ROW
WHEN (OLD.workspace_id IS DISTINCT FROM NEW.workspace_id
  OR OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
  OR OLD.author_id IS DISTINCT FROM NEW.author_id
  OR OLD.kind IS DISTINCT FROM NEW.kind
  OR OLD.system_type IS DISTINCT FROM NEW.system_type
  OR OLD.system_user_ids IS DISTINCT FROM NEW.system_user_ids
  OR OLD.parent_id IS DISTINCT FROM NEW.parent_id
  OR OLD.created_at IS DISTINCT FROM NEW.created_at)
EXECUTE FUNCTION "messages_immutable"();
--> statement-breakpoint
-- Written by hand (R8): history is kept. TRUNCATE is not blocked.
CREATE FUNCTION "messages_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'messages: a message is soft deleted, never removed'
    USING ERRCODE = '23514', CONSTRAINT = 'messages_no_delete_trg';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "messages_no_delete_trg" BEFORE DELETE ON "messages"
FOR EACH ROW EXECUTE FUNCTION "messages_no_delete"();
--> statement-breakpoint
-- Written by hand (R13): an event never changes. Pruning deletes.
CREATE FUNCTION "events_no_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'events: an event cannot change'
    USING ERRCODE = '23514', CONSTRAINT = 'events_no_update_trg';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "events_no_update_trg" BEFORE UPDATE ON "events"
FOR EACH ROW EXECUTE FUNCTION "events_no_update"();
--> statement-breakpoint
-- Written by hand (R14): the number of a new event is the counter of its
-- workspace.
CREATE FUNCTION "events_number"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM event_counters c
    WHERE c.workspace_id = NEW.workspace_id AND c.last_number = NEW.number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'events: the number does not come from the counter'
      USING ERRCODE = '23514', CONSTRAINT = 'events_number_trg';
  END IF;
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "events_number_trg" BEFORE INSERT ON "events"
FOR EACH ROW EXECUTE FUNCTION "events_number"();
--> statement-breakpoint
-- Written by hand (R14): the counter starts at 0 or 1, rises by exactly 1 and
-- is never deleted. For `insert ... on conflict` this fires on the proposed row
-- too, which is 1 in appendEvent and 0 in lockEventCounter.
CREATE FUNCTION "event_counters_step"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.last_number IN (0, 1) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.last_number = OLD.last_number + 1 THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'event_counters: the counter starts at 0 or 1, rises by 1 and is never deleted'
    USING ERRCODE = '23514', CONSTRAINT = 'event_counters_step_trg';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "event_counters_step_trg" BEFORE INSERT OR UPDATE OR DELETE ON "event_counters"
FOR EACH ROW EXECUTE FUNCTION "event_counters_step"();
