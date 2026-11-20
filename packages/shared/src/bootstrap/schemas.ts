import { z } from "zod";
import { NOTIFICATION_LEVELS } from "../conversations.js";
import { DirectConversationEntrySchema } from "../direct-conversations.js";
import { UserSchema } from "../auth/schemas.js";

// The answer of `GET /api/v1/bootstrap` (TOKI-031 R2, R3, R5, R7, R17).
// Every object is strict, as the server's tests want; a client that must
// survive a field added within a version reads with a form that ignores
// unknown keys (TOKI-032 R3), derived in its own package, not exported here.

// The `User` of sign-in, which strips unknown keys, made strict (R3).
export const BootstrapUser = UserSchema.strict();
export type BootstrapUser = z.infer<typeof BootstrapUser>;

export const BootstrapWorkspace = z.strictObject({
  id: z.string(),
  name: z.string(),
});
export type BootstrapWorkspace = z.infer<typeof BootstrapWorkspace>;

// A person of the workspace: no address, no session data (R5).
export const BootstrapPerson = z.strictObject({
  id: z.string(),
  displayName: z.string(),
  role: z.enum(["member", "admin"]),
  status: z.enum(["active", "deactivated"]),
});
export type BootstrapPerson = z.infer<typeof BootstrapPerson>;

// A channel has the same keys as a direct message so the client reads one
// list (R7); `memberIds` is null here.
export const BootstrapChannelEntry = z.strictObject({
  id: z.string(),
  kind: z.literal("channel"),
  name: z.string(),
  topic: z.string().nullable(),
  isPrivate: z.boolean(),
  isGeneral: z.boolean(),
  notificationLevel: z.enum(NOTIFICATION_LEVELS),
  isMuted: z.boolean(),
  isStarred: z.boolean(),
  memberIds: z.null(),
});
export type BootstrapChannelEntry = z.infer<typeof BootstrapChannelEntry>;

export const BootstrapConversation = z.union([
  BootstrapChannelEntry,
  DirectConversationEntrySchema,
]);
export type BootstrapConversation = z.infer<typeof BootstrapConversation>;

export const BootstrapResponse = z.strictObject({
  user: BootstrapUser,
  workspace: BootstrapWorkspace,
  members: z.array(BootstrapPerson),
  conversations: z.array(BootstrapConversation),
  eventNumber: z.number().int().nonnegative(),
});
export type BootstrapResponse = z.infer<typeof BootstrapResponse>;
