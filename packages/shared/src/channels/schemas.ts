import { z } from "zod";
import {
  CHANNEL_NAME_PATTERN,
  NOTIFICATION_LEVELS,
  isValidChannelDescription,
  isValidChannelTopic,
} from "../conversations.js";
import {
  CHANNEL_BROWSE_PAGE_DEFAULT,
  CHANNEL_BROWSE_PAGE_MAX,
  CHANNEL_MEMBERS_ADD_MAX,
  CHANNEL_SEARCH_MAX,
  UUID_PATTERN,
  UUID_V7_PATTERN,
} from "./limits.js";

// Every object is strict: an added key fails, which is right for the server's
// tests. A client that must survive an added field reads with a non-strict
// form of these (TOKI-032 R3).

export const ChannelIdSchema = z.string().regex(UUID_PATTERN);
const PersonIdSchema = z.string().regex(UUID_PATTERN);
const NotificationLevelSchema = z.enum(NOTIFICATION_LEVELS);

// A text is trimmed, an empty result becomes null, and the rest is 1 to the
// limit in code points (R4, R9).
function trimmedText(isValid: (value: string | null) => boolean) {
  return z
    .string()
    .nullable()
    .transform((value) => {
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    })
    .refine(isValid);
}
const TopicSchema = trimmedText(isValidChannelTopic);
const DescriptionSchema = trimmedText(isValidChannelDescription);

// ---- requests

export const CreateChannelBodySchema = z.strictObject({
  id: z.string().regex(UUID_V7_PATTERN),
  name: z.string().regex(CHANNEL_NAME_PATTERN),
  isPrivate: z.boolean().optional(),
  topic: TopicSchema.optional(),
  memberIds: z.array(PersonIdSchema).max(CHANNEL_MEMBERS_ADD_MAX).optional(),
});

export const EditChannelBodySchema = z
  .strictObject({
    topic: TopicSchema.optional(),
    description: DescriptionSchema.optional(),
  })
  .refine((body) => body.topic !== undefined || body.description !== undefined);

const LimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(CHANNEL_BROWSE_PAGE_MAX)
  .default(CHANNEL_BROWSE_PAGE_DEFAULT);

export const BrowseChannelsQuerySchema = z.strictObject({
  search: z.string().max(CHANNEL_SEARCH_MAX).optional(),
  limit: LimitSchema,
  cursor: z.string().min(1).optional(),
});

export const ChannelMembersQuerySchema = z.strictObject({
  limit: LimitSchema,
  cursor: z.string().min(1).optional(),
});

export const AddMembersBodySchema = z.strictObject({
  userIds: z.array(PersonIdSchema).min(1).max(CHANNEL_MEMBERS_ADD_MAX),
});

// A person's own settings of a conversation (R10, R22).
const SettingsPatchShape = {
  notificationLevel: NotificationLevelSchema.optional(),
  isMuted: z.boolean().optional(),
  isStarred: z.boolean().optional(),
};
export const SettingsPatchSchema = z.strictObject(SettingsPatchShape);
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>;

// The three routes with no body also take `{}`; join also takes the values
// that Undo of a leave gives back (R10).
export const JoinChannelBodySchema = z.strictObject({
  settings: SettingsPatchSchema.optional(),
});

export const UpdateSettingsBodySchema = SettingsPatchSchema.refine(
  (body) => Object.keys(body).length > 0,
);

// ---- responses

export const ChannelSummarySchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  topic: z.string().nullable(),
  isPrivate: z.boolean(),
  isGeneral: z.boolean(),
  archived: z.boolean(),
  memberCount: z.number().int().min(0),
  isMember: z.boolean(),
});
export type ChannelSummary = z.infer<typeof ChannelSummarySchema>;

export const ChannelDetailSchema = ChannelSummarySchema.extend({
  description: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
});
export type ChannelDetail = z.infer<typeof ChannelDetailSchema>;

// A member reads the detail; a person outside a public channel the summary.
export const ChannelResponseSchema = z.union([
  ChannelDetailSchema,
  ChannelSummarySchema,
]);

export const CreateChannelResponseSchema = z.strictObject({
  channel: ChannelDetailSchema,
});
export const GetChannelResponseSchema = z.strictObject({
  channel: ChannelResponseSchema,
});
export const ChangeChannelResponseSchema = z.strictObject({
  channel: ChannelDetailSchema,
  changed: z.boolean(),
});
export const BrowseChannelsResponseSchema = z.strictObject({
  channels: z.array(ChannelSummarySchema),
  nextCursor: z.string().nullable(),
});
export const ChannelMembersResponseSchema = z.strictObject({
  members: z.array(
    z.strictObject({ userId: z.string(), joinedAt: z.string() }),
  ),
  nextCursor: z.string().nullable(),
});
export const AddMembersResponseSchema = z.strictObject({
  added: z.array(z.string()),
  alreadyMembers: z.array(z.string()),
});
export const LeaveChannelResponseSchema = z.strictObject({
  changed: z.boolean(),
  archived: z.boolean(),
});
export const RemoveMemberResponseSchema = z.strictObject({
  changed: z.boolean(),
});
export const UpdateSettingsResponseSchema = z.strictObject({
  settings: z.strictObject({
    notificationLevel: NotificationLevelSchema,
    isMuted: z.boolean(),
    isStarred: z.boolean(),
  }),
  changed: z.boolean(),
});
