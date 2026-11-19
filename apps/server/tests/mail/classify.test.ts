import { describe, expect, it } from "vitest";
import { classify } from "../../src/modules/mail/classify.js";

// The shapes are the ones Nodemailer produced against the test SMTP server.
const err = (
  code: string,
  command: string,
  message: string,
  responseCode?: number,
) => Object.assign(new Error(message), { code, command, responseCode });

describe("classify (R16, R25)", () => {
  it.each([
    [
      "no connection",
      err("ESOCKET", "CONN", "connect ECONNREFUSED 127.0.0.1:1"),
      "unavailable",
      "connect",
      "connect",
      true,
    ],
    [
      "dns",
      err("EDNS", "CONN", "getaddrinfo ENOTFOUND x.invalid"),
      "unavailable",
      "dns",
      "connect",
      true,
    ],
    [
      "tls",
      err("ESOCKET", "CONN", "certificate has expired"),
      "unavailable",
      "tls",
      "connect",
      true,
    ],
    [
      "no starttls",
      err("ECONNECTION", "STARTTLS", "Server does not support STARTTLS"),
      "unavailable",
      "tls",
      "connect",
      true,
    ],
    [
      "reset in the middle of a send",
      err("ECONNECTION", "CONN", "read ECONNRESET"),
      "unavailable",
      "connect",
      "connect",
      false,
    ],
    [
      "connection closed early",
      err("ECONNECTION", "CONN", "Connection closed unexpectedly"),
      "unavailable",
      "connect",
      "connect",
      false,
    ],
    [
      "greeting timeout",
      err("ETIMEDOUT", "CONN", "Greeting never received"),
      "unavailable",
      "timeout",
      "connect",
      true,
    ],
    [
      "connection timeout",
      err("ETIMEDOUT", "CONN", "Connection timeout"),
      "unavailable",
      "timeout",
      "connect",
      true,
    ],
    [
      "socket timeout",
      err("ETIMEDOUT", "CONN", "Timeout"),
      "unavailable",
      "timeout",
      "connect",
      false,
    ],
    [
      "4xx at data",
      err("EMESSAGE", "DATA", "try later", 451),
      "unavailable",
      "reply",
      "data",
      false,
    ],
    [
      "4xx at rcpt",
      err("EENVELOPE", "RCPT TO", "greylisted", 450),
      "unavailable",
      "reply",
      "rcpt_to",
      false,
    ],
    [
      "login refused",
      err("EAUTH", "AUTH PLAIN", "Invalid login", 535),
      "auth_failed",
      "reply",
      "auth",
      false,
    ],
    [
      "530 at mail from",
      err("EENVELOPE", "MAIL FROM", "auth required", 530),
      "auth_failed",
      "reply",
      "mail_from",
      false,
    ],
    [
      "550 at rcpt",
      err("EENVELOPE", "RCPT TO", "no such user", 550),
      "recipient_rejected",
      "reply",
      "rcpt_to",
      false,
    ],
    [
      "551 at rcpt",
      err("EENVELOPE", "RCPT TO", "user not local", 551),
      "recipient_rejected",
      "reply",
      "rcpt_to",
      false,
    ],
    [
      "553 at rcpt",
      err("EENVELOPE", "RCPT TO", "bad mailbox", 553),
      "recipient_rejected",
      "reply",
      "rcpt_to",
      false,
    ],
    [
      "553 at mail from",
      err("EENVELOPE", "MAIL FROM", "sender not allowed", 553),
      "rejected",
      "reply",
      "mail_from",
      false,
    ],
    [
      "554 at rcpt",
      err("EENVELOPE", "RCPT TO", "refused", 554),
      "rejected",
      "reply",
      "rcpt_to",
      false,
    ],
    [
      "554 at data",
      err("EMESSAGE", "DATA", "rejected", 554),
      "rejected",
      "reply",
      "data",
      false,
    ],
  ])("%s", (_name, error, reason, cause, stage, cooldown) => {
    const result = classify(error);
    expect(result.reason).toBe(reason);
    expect(result.cause).toBe(cause);
    expect(result.stage).toBe(stage);
    expect(result.startsCooldown).toBe(cooldown);
  });

  it("keeps the reply code", () => {
    expect(classify(err("EENVELOPE", "RCPT TO", "x", 550)).replyCode).toBe(550);
  });

  it("sorts anything else as unavailable with the cause internal", () => {
    for (const odd of [new Error("boom"), "text", null, undefined, {}]) {
      const result = classify(odd);
      expect(result).toMatchObject({
        reason: "unavailable",
        cause: "internal",
        startsCooldown: false,
      });
    }
  });

  it("never carries the error text", () => {
    expect(
      JSON.stringify(
        classify(
          err("EENVELOPE", "RCPT TO", "no such user sam@example.com", 550),
        ),
      ),
    ).not.toContain("sam@");
  });
});
