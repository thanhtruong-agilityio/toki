import { z } from "zod";

// The closed value lists of a row of "Signed-in devices" (TOKI-026 R6). A value
// added later is additive: a client reads an unknown one as `unknown`.
export const DEVICE_KINDS = ["desktop", "phone", "tablet", "unknown"] as const;
export const BROWSERS = [
  "chrome",
  "edge",
  "safari",
  "firefox",
  "other",
  "unknown",
] as const;

export type DeviceKind = (typeof DEVICE_KINDS)[number];
export type Browser = (typeof BROWSERS)[number];

// Not strict: a field added later breaks no client (TOKI-026 R1, R37).
export const SessionItemSchema = z.object({
  id: z.string(),
  current: z.boolean(),
  deviceKind: z.enum(DEVICE_KINDS),
  browser: z.enum(BROWSERS),
  lastUsedAt: z.string(),
});
export type SessionItem = z.infer<typeof SessionItemSchema>;

export const SessionsResponseSchema = z.object({
  sessions: z.array(SessionItemSchema),
});
export type SessionsResponse = z.infer<typeof SessionsResponseSchema>;
