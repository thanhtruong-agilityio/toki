import { z } from "zod";

// The auth area of the server configuration (TOKI-022, concern 7). The root
// config.ts composes it and stays the one reader of the environment.
export const authVariableNames = [
  "AUTH_CODE_SECRET",
  "APP_ORIGIN",
  "TRUSTED_PROXY",
  "NODE_ENV",
];

export const authConfigSchema = z
  .object({
    AUTH_CODE_SECRET: z.string().min(32),
    APP_ORIGIN: z.url().refine((v) => /^https?:\/\//.test(v)),
    TRUSTED_PROXY: z.string().min(1).optional(),
    NODE_ENV: z.string().optional(),
  })
  .transform((v) => ({
    codeSecret: v.AUTH_CODE_SECRET,
    // Compared with the Origin header: a trailing slash or a default port in
    // the value must not cause a false refusal.
    appOrigin: new URL(v.APP_ORIGIN).origin,
    trustedProxy: v.TRUSTED_PROXY,
    // Anything but an explicit "development" counts as production (R21).
    development: v.NODE_ENV === "development",
  }));

export type AuthConfig = z.output<typeof authConfigSchema>;
