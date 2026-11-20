import { z } from "zod";
import { TransportSchema, UserSchema } from "./schemas.js";

// 32 random bytes in base64url are 43 characters (TOKI-026 R19, R29).
export const EMERGENCY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const EmergencyBodySchema = z.object({
  token: z.string().regex(EMERGENCY_TOKEN_PATTERN),
  transport: TransportSchema.optional(),
});
export type EmergencyBody = z.infer<typeof EmergencyBodySchema>;

export const EmergencyResponseSchema = z.object({
  user: UserSchema,
  token: z.string().optional(),
});
export type EmergencyResponse = z.infer<typeof EmergencyResponseSchema>;
