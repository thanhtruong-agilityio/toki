import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../../src/config.js";

// Fake values only. The base is the development setup of .env.example.
const base = {
  NODE_ENV: "development",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_TLS: "none",
  MAIL_FROM_ADDRESS: "toki@example.com",
};

function names(env: Record<string, string | undefined>): string[] | "ok" {
  try {
    loadConfig(env, ["mail"]);
    return "ok";
  } catch (error) {
    if (error instanceof ConfigError) return error.names;
    throw error;
  }
}

describe("mail configuration (R2, R3, R4)", () => {
  it("reads the development values", () => {
    expect(loadConfig(base, ["mail"]).mail).toEqual({
      host: "127.0.0.1",
      port: 1025,
      tls: "none",
      fromAddress: "toki@example.com",
      fromName: "Toki",
    });
  });

  it("defaults SMTP_TLS to starttls and the sender name to Toki", () => {
    const rest: Record<string, string | undefined> = {
      ...base,
      SMTP_TLS: undefined,
      NODE_ENV: "production",
    };
    const mail = loadConfig(rest, ["mail"]).mail;
    expect(mail.tls).toBe("starttls");
    expect(mail.fromName).toBe("Toki");
  });

  it.each(["SMTP_HOST", "SMTP_PORT", "MAIL_FROM_ADDRESS"])(
    "names %s when it is missing or empty",
    (name) => {
      expect(names({ ...base, [name]: undefined })).toEqual([name]);
      expect(names({ ...base, [name]: "" })).toEqual([name]);
    },
  );

  it.each(["0", "65536", "25.5", "abc"])("refuses SMTP_PORT %s", (port) => {
    expect(names({ ...base, SMTP_PORT: port })).toEqual(["SMTP_PORT"]);
  });

  it("refuses an unknown SMTP_TLS", () => {
    expect(names({ ...base, SMTP_TLS: "ssl" })).toEqual(["SMTP_TLS"]);
  });

  it.each([
    "a@b,c@d",
    "a@b c",
    "Name <a@b.c>",
    "a@b;c@d",
    "a@@b",
    "@b",
    "a@",
    'a"@b',
    "a\\@b",
    "a@b\nBcc: x@y",
  ])("refuses MAIL_FROM_ADDRESS %j", (address) => {
    expect(names({ ...base, MAIL_FROM_ADDRESS: address })).toEqual([
      "MAIL_FROM_ADDRESS",
    ]);
  });

  it("refuses a sender name with a line break", () => {
    expect(names({ ...base, MAIL_FROM_NAME: "To\nki" })).toEqual([
      "MAIL_FROM_NAME",
    ]);
  });

  it("wants the login pair whole", () => {
    const tls = { SMTP_TLS: "starttls" };
    expect(names({ ...base, ...tls, SMTP_USER: "u" })).toEqual([
      "SMTP_PASSWORD",
    ]);
    expect(names({ ...base, ...tls, SMTP_PASSWORD: "p" })).toEqual([
      "SMTP_USER",
    ]);
    expect(names({ ...base, ...tls, SMTP_USER: "u", SMTP_PASSWORD: "p" })).toBe(
      "ok",
    );
  });

  it("accepts none only when NODE_ENV is exactly development", () => {
    expect(names(base)).toBe("ok");
    expect(names({ ...base, NODE_ENV: "production" })).toEqual(["SMTP_TLS"]);
    expect(names({ ...base, NODE_ENV: undefined })).toEqual(["SMTP_TLS"]);
    expect(names({ ...base, NODE_ENV: "Development" })).toEqual(["SMTP_TLS"]);
  });

  it("refuses none with a login in every environment", () => {
    expect(names({ ...base, SMTP_USER: "u", SMTP_PASSWORD: "p" })).toEqual([
      "SMTP_TLS",
    ]);
  });

  it("never puts a submitted value into the error", () => {
    try {
      loadConfig(
        { ...base, SMTP_PORT: "secret-port-value", SMTP_PASSWORD: "hunter2" },
        ["mail"],
      );
      expect.unreachable();
    } catch (error) {
      expect(String((error as Error).message)).not.toContain("secret");
      expect(String((error as Error).message)).not.toContain("hunter2");
    }
  });
});
