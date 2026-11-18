-- Written by hand: the order check of conversations calls this function, so it
-- comes before CREATE TABLE. True when the ids of a key are in strictly
-- increasing byte order, which means sorted and with no id repeated (R10).
CREATE FUNCTION "conversations_dm_key_sorted"(key text) RETURNS boolean
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT coalesce(bool_and(s.prev IS NULL OR s.prev COLLATE "C" < s.cur COLLATE "C"), true)
  FROM (
    SELECT t.cur, lag(t.cur) OVER (ORDER BY t.ord) AS prev
    FROM unnest(string_to_array($1, ',')) WITH ORDINALITY AS t(cur, ord)
  ) s
$$;
--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"notification_level" text,
	"is_muted" boolean DEFAULT false NOT NULL,
	"is_starred" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "conversation_members_pkey" PRIMARY KEY("conversation_id","user_id"),
	CONSTRAINT "conversation_members_notification_level_check" CHECK ("conversation_members"."notification_level" is null or "conversation_members"."notification_level" in ('all', 'mentions', 'none'))
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text,
	"topic" text,
	"description" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_general" boolean DEFAULT false NOT NULL,
	"dm_key" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"archived_at" timestamp with time zone,
	CONSTRAINT "conversations_workspace_id_name_key" UNIQUE("workspace_id","name"),
	CONSTRAINT "conversations_workspace_id_dm_key_key" UNIQUE("workspace_id","dm_key"),
	CONSTRAINT "conversations_id_workspace_id_key" UNIQUE("id","workspace_id"),
	CONSTRAINT "conversations_kind_check" CHECK ("conversations"."kind" in ('channel', 'dm', 'group_dm')),
	CONSTRAINT "conversations_channel_shape_check" CHECK ("conversations"."kind" <> 'channel' or "conversations"."dm_key" is null),
	CONSTRAINT "conversations_dm_shape_check" CHECK ("conversations"."kind" = 'channel' or ("conversations"."name" is null and "conversations"."topic" is null and "conversations"."description" is null and "conversations"."is_private" and "conversations"."archived_at" is null)),
	CONSTRAINT "conversations_name_check" CHECK ("conversations"."kind" <> 'channel' or ("conversations"."name" is not null and "conversations"."name" ~ '^[a-z0-9-]{1,80}$')),
	CONSTRAINT "conversations_topic_check" CHECK ("conversations"."topic" is null or char_length("conversations"."topic") between 1 and 250),
	CONSTRAINT "conversations_description_check" CHECK ("conversations"."description" is null or char_length("conversations"."description") between 1 and 500),
	CONSTRAINT "conversations_general_shape_check" CHECK (not "conversations"."is_general" or ("conversations"."kind" = 'channel' and not "conversations"."is_private" and "conversations"."archived_at" is null)),
	CONSTRAINT "conversations_general_name_check" CHECK ("conversations"."kind" <> 'channel' or "conversations"."is_general" = ("conversations"."name" = 'general')),
	CONSTRAINT "conversations_dm_key_shape_check" CHECK ("conversations"."kind" = 'channel' or ("conversations"."dm_key" is not null and "conversations"."dm_key" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(,[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*$')),
	CONSTRAINT "conversations_dm_key_order_check" CHECK ("conversations"."kind" = 'channel' or conversations_dm_key_sorted("conversations"."dm_key")),
	CONSTRAINT "conversations_dm_key_size_check" CHECK ("conversations"."kind" not in ('dm', 'group_dm') or ("conversations"."dm_key" is not null and (("conversations"."kind" = 'dm' and cardinality(string_to_array("conversations"."dm_key", ',')) = 2) or ("conversations"."kind" = 'group_dm' and cardinality(string_to_array("conversations"."dm_key", ',')) between 3 and 8))))
);
--> statement-breakpoint
CREATE INDEX "conversation_members_user_id_idx" ON "conversation_members" USING btree ("user_id");
--> statement-breakpoint
-- Written by hand (R16): the keys that leave the module, ON DELETE RESTRICT.
-- conversation_members_workspace_id_fkey comes before the composite key, so
-- an unknown workspace id names the key under test.
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id","workspace_id") REFERENCES "conversations"("id","workspace_id") ON DELETE RESTRICT;
--> statement-breakpoint
-- Written by hand (R8): kind, privacy, general flag, key and workspace never change.
CREATE FUNCTION "conversations_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'conversations: kind, is_private, is_general, dm_key and workspace_id cannot change'
    USING ERRCODE = '23514', CONSTRAINT = 'conversations_immutable_trg';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "conversations_immutable_trg" BEFORE UPDATE ON "conversations"
FOR EACH ROW
WHEN (OLD.kind IS DISTINCT FROM NEW.kind
  OR OLD.is_private IS DISTINCT FROM NEW.is_private
  OR OLD.is_general IS DISTINCT FROM NEW.is_general
  OR OLD.dm_key IS DISTINCT FROM NEW.dm_key
  OR OLD.workspace_id IS DISTINCT FROM NEW.workspace_id)
EXECUTE FUNCTION "conversations_immutable"();
--> statement-breakpoint
-- Written by hand (R22): a conversation is never deleted. TRUNCATE is not blocked.
CREATE FUNCTION "conversations_no_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'conversations: a conversation is archived, never deleted'
    USING ERRCODE = '23514', CONSTRAINT = 'conversations_no_delete_trg';
END
$$;
--> statement-breakpoint
CREATE TRIGGER "conversations_no_delete_trg" BEFORE DELETE ON "conversations"
FOR EACH ROW EXECUTE FUNCTION "conversations_no_delete"();
--> statement-breakpoint
-- Written by hand (R21): the members of a direct message or group are the people
-- of its key and never change. When the conversation row is missing the insert
-- goes on, so the foreign key names the problem.
CREATE FUNCTION "conversation_members_fixed"() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_kind text;
  v_key text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT c.kind, c.dm_key INTO v_kind, v_key
    FROM conversations c WHERE c.id = NEW.conversation_id;
    IF FOUND AND v_kind IN ('dm', 'group_dm')
       AND NOT (NEW.user_id::text = ANY (string_to_array(v_key, ','))) THEN
      RAISE EXCEPTION 'conversation_members: % is not a person of the key of this conversation', NEW.user_id
        USING ERRCODE = '23514', CONSTRAINT = 'conversation_members_fixed_trg';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id THEN
      RAISE EXCEPTION 'conversation_members: conversation_id, user_id and workspace_id cannot change'
        USING ERRCODE = '23514', CONSTRAINT = 'conversation_members_fixed_trg';
    END IF;
    RETURN NEW;
  ELSE
    SELECT c.kind INTO v_kind FROM conversations c WHERE c.id = OLD.conversation_id;
    IF FOUND AND v_kind IN ('dm', 'group_dm') THEN
      RAISE EXCEPTION 'conversation_members: the members of a direct message or group are never removed'
        USING ERRCODE = '23514', CONSTRAINT = 'conversation_members_fixed_trg';
    END IF;
    RETURN OLD;
  END IF;
END
$$;
--> statement-breakpoint
CREATE TRIGGER "conversation_members_fixed_trg" BEFORE INSERT OR UPDATE OR DELETE ON "conversation_members"
FOR EACH ROW EXECUTE FUNCTION "conversation_members_fixed"();
--> statement-breakpoint
-- Written by hand (R21): at the end of the transaction a direct message or group
-- has exactly one member row for each person of its key.
CREATE FUNCTION "conversations_members_complete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT count(*) FROM conversation_members m WHERE m.conversation_id = NEW.id)
     <> cardinality(string_to_array(NEW.dm_key, ',')) THEN
    RAISE EXCEPTION 'conversations: the member rows of % do not match its key', NEW.id
      USING ERRCODE = '23514', CONSTRAINT = 'conversations_members_complete_trg';
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "conversations_members_complete_trg" AFTER INSERT ON "conversations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW WHEN (NEW.kind <> 'channel')
EXECUTE FUNCTION "conversations_members_complete"();
