import { z } from "zod";
import { CODE_LENGTH } from "./limits.js";

// Not strict: a field added later breaks no client (TOKI-022 R38).
export const UserSchema = z.object({
  id: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(["member", "admin"]),
  language: z.enum(["en", "vi"]),
});
export type User = z.infer<typeof UserSchema>;

export const TransportSchema = z.enum(["cookie", "token"]);
export type Transport = z.infer<typeof TransportSchema>;

export const RequestCodeBodySchema = z.object({ email: z.string() });
export const RequestCodeResponseSchema = z.object({
  requestId: z.string(),
  expiresInSeconds: z.number(),
  resendAfterSeconds: z.number(),
});

export const CreateSessionBodySchema = z.object({
  requestId: z.string().min(1),
  code: z.string().regex(new RegExp(`^[0-9]{${CODE_LENGTH}}$`)),
  transport: TransportSchema.optional(),
});
export const CreateSessionResponseSchema = z.object({
  user: UserSchema,
  token: z.string().optional(),
});

export const CurrentSessionResponseSchema = z.object({ user: UserSchema });
export const WorkspaceNameResponseSchema = z.object({ name: z.string() });
