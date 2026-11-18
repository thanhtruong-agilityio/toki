import type { MailConfig } from "./config.js";

// Shared by the mail tests. Fake values only.
export const code = "493027";
export const joinUrl =
  "https://toki.example.com/join#AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde";

export function mailConfig(
  port: number,
  extra: Partial<MailConfig> = {},
): MailConfig {
  return {
    host: "127.0.0.1",
    port,
    tls: "none",
    fromAddress: "toki@example.com",
    fromName: "Toki",
    ...extra,
  };
}

export type Line = Record<string, unknown> & {
  msg?: string;
  level: "info" | "warn";
};

// A logger that keeps what it is given, as the app logger would write it.
export function captureLogger() {
  const lines: Line[] = [];
  const write = (level: "info" | "warn") => (obj: object, msg?: string) => {
    lines.push({ ...obj, msg, level } as Line);
  };
  return { logger: { info: write("info"), warn: write("warn") }, lines };
}
