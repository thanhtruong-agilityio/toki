import { z } from "zod";
import { GROUP_DM_MAX_PEOPLE, NOTIFICATION_LEVELS } from "./conversations.js";

// The request and the answer of `POST /api/v1/direct-conversations`
// (TOKI-030 R2, R17, R18). Strict objects, as the server's tests want; a
// client that must survive an added field reads with a non-strict form
// (TOKI-032 R3).

// The people to message, not counting the caller, who is added by the server.
export const DIRECT_CONVERSATION_MAX_OTHERS = GROUP_DM_MAX_PEOPLE - 1;

// An id in any letter case; the key is built from the lower-case form.
const PersonIdSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  );

// More than 7 others is `group_too_large`, an answer of its own with
// `details` (R5), so the schema allows up to the workspace size (NFR-04) and
// stops a longer list before anything is checked per item.
const USER_IDS_MAX = 200;
export const OpenDirectBodySchema = z.strictObject({
  userIds: z
    .array(PersonIdSchema)
    .min(1)
    .max(USER_IDS_MAX)
    .refine(
      (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
    ),
});
export type OpenDirectBody = z.infer<typeof OpenDirectBodySchema>;

// The entry of the bootstrap call for a direct message or group (TOKI-031 R7),
// written once here. The level, mute and star are the caller's own.
export const DirectConversationEntrySchema = z.strictObject({
  id: z.string(),
  kind: z.enum(["dm", "group_dm"]),
  name: z.null(),
  topic: z.null(),
  isPrivate: z.literal(true),
  isGeneral: z.literal(false),
  notificationLevel: z.enum(NOTIFICATION_LEVELS),
  isMuted: z.boolean(),
  isStarred: z.boolean(),
  memberIds: z.array(z.string()),
});
export type DirectConversationEntry = z.infer<
  typeof DirectConversationEntrySchema
>;

export const OpenDirectResponseSchema = z.strictObject({
  conversation: DirectConversationEntrySchema,
});
