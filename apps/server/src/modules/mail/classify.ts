// Sorts an error from the SMTP client into the result of R16 and the fields of
// the log line (R14). It reads the error's `code`, `command` and `responseCode`
// and a few fixed phrases of the client's own messages for the cases where the
// code is shared; it never copies the message, which can carry the address.
export type Reason =
  | "invalid_input"
  | "recipient_rejected"
  | "auth_failed"
  | "unavailable"
  | "rejected";

export type Cause =
  | "connect"
  | "dns"
  | "tls"
  | "timeout"
  | "reply"
  | "queue_full"
  | "queue_wait"
  | "cooldown"
  | "internal";

export type Stage = "connect" | "auth" | "mail_from" | "rcpt_to" | "data";

export type Classified = {
  reason: Exclude<Reason, "invalid_input">;
  cause: Cause;
  stage?: Stage;
  replyCode?: number;
  // True only for a failure at the level of the connection (R25): no
  // connection, DNS, TLS, a connect or greeting timeout.
  startsCooldown: boolean;
};

type Shape = {
  code?: unknown;
  command?: unknown;
  responseCode?: unknown;
  message?: unknown;
};

const AUTH_REPLIES = new Set([530, 534, 535, 538]);
const RECIPIENT_REPLIES = new Set([550, 551, 553]);

function stageOf(command: unknown): Stage {
  const name = typeof command === "string" ? command.toUpperCase() : "";
  if (name.startsWith("AUTH")) return "auth";
  if (name.startsWith("MAIL")) return "mail_from";
  if (name.startsWith("RCPT")) return "rcpt_to";
  if (name === "DATA") return "data";
  return "connect";
}

export function classify(error: unknown): Classified {
  if (typeof error !== "object" || error === null) {
    return { reason: "unavailable", cause: "internal", startsCooldown: false };
  }
  const e = error as Shape;
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message : "";
  const stage = stageOf(e.command);
  const reply = typeof e.responseCode === "number" ? e.responseCode : undefined;

  // The client sends STARTTLS even when the server did not offer it; a server
  // that answers 500 to it is a TLS failure, not a refused mail.
  if (code === "ETLS" || /^STARTTLS$/i.test(String(e.command))) {
    return {
      reason: "unavailable",
      cause: "tls",
      stage: "connect",
      startsCooldown: true,
    };
  }

  if (reply !== undefined) {
    const base = {
      cause: "reply" as const,
      stage,
      replyCode: reply,
      startsCooldown: false,
    };
    if (AUTH_REPLIES.has(reply) || (code === "EAUTH" && reply >= 500))
      return { ...base, reason: "auth_failed" };
    if (reply >= 500) {
      return RECIPIENT_REPLIES.has(reply) && stage === "rcpt_to"
        ? { ...base, reason: "recipient_rejected" }
        : { ...base, reason: "rejected" };
    }
    return { ...base, reason: "unavailable" };
  }

  if (code === "EAUTH") {
    return {
      reason: "auth_failed",
      cause: "reply",
      stage: "auth",
      startsCooldown: false,
    };
  }
  if (code === "EDNS") {
    return {
      reason: "unavailable",
      cause: "dns",
      stage: "connect",
      startsCooldown: true,
    };
  }
  if (code === "ETIMEDOUT") {
    // The client says "Greeting never received" or "Connection timeout" before
    // the connection works, and plain "Timeout" for a socket that went quiet.
    const connectLevel = /greeting|connection timeout/i.test(message);
    return {
      reason: "unavailable",
      cause: "timeout",
      stage: "connect",
      startsCooldown: connectLevel,
    };
  }
  if (code === "ESOCKET" || code === "ECONNECTION" || code === "ETLS") {
    const tls =
      /certificate|ssl|tls|self.signed|altnames|handshake|starttls|wrong version/i.test(
        message,
      );
    return {
      reason: "unavailable",
      cause: tls ? "tls" : "connect",
      stage: "connect",
      startsCooldown: true,
    };
  }
  return { reason: "unavailable", cause: "internal", startsCooldown: false };
}
