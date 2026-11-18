import { z } from "zod";
import { isWellFormedAddress } from "./address.js";

// The mail area of the server configuration (R2 to R4). The root config.ts
// composes it and stays the one reader of the environment. NODE_ENV is read
// here as a plain string so that rule R4 can fail closed through SMTP_TLS.
export const mailVariableNames = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_TLS",
  "SMTP_USER",
  "SMTP_PASSWORD",
  "MAIL_FROM_ADDRESS",
  "MAIL_FROM_NAME",
  "NODE_ENV",
];

export const mailConfigSchema = z
  .object({
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535),
    SMTP_TLS: z.enum(["none", "starttls", "tls"]).default("starttls"),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM_ADDRESS: z.string().refine(isWellFormedAddress),
    MAIL_FROM_NAME: z
      .string()
      .refine((name) => !/[\r\n]/.test(name))
      .default("Toki"),
    NODE_ENV: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (name: string) =>
      ctx.addIssue({ code: "custom", path: [name], message: "invalid" });
    if (v.SMTP_USER !== undefined && v.SMTP_PASSWORD === undefined)
      issue("SMTP_PASSWORD");
    if (v.SMTP_PASSWORD !== undefined && v.SMTP_USER === undefined)
      issue("SMTP_USER");
    if (v.SMTP_TLS === "none") {
      if (v.NODE_ENV !== "development") issue("SMTP_TLS");
      else if (v.SMTP_USER !== undefined) issue("SMTP_TLS");
    }
  })
  .transform((v) => ({
    host: v.SMTP_HOST,
    port: v.SMTP_PORT,
    tls: v.SMTP_TLS,
    ...(v.SMTP_USER !== undefined ? { user: v.SMTP_USER } : {}),
    ...(v.SMTP_PASSWORD !== undefined ? { password: v.SMTP_PASSWORD } : {}),
    fromAddress: v.MAIL_FROM_ADDRESS,
    fromName: v.MAIL_FROM_NAME,
  }));

export type MailConfig = z.output<typeof mailConfigSchema>;
