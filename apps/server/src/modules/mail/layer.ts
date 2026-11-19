import { createTranslator, type Language } from "@toki/i18n";
import nodemailer from "nodemailer";
import { isWellFormedAddress } from "./address.js";
import { controlToSpace, hasControl } from "./chars.js";
import { classify, type Cause, type Reason, type Stage } from "./classify.js";
import type { MailConfig } from "./config.js";
import {
  renderInvitationCodeMail,
  renderInvitationMail,
  renderSignInMail,
  type RenderedMail,
} from "./render.js";

export type MailResult = { ok: true } | { ok: false; reason: Reason };

export type MailLogger = {
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
};

export type CallOptions = { log?: MailLogger };

export type MailLayer = {
  sendSignInMail(
    input: { to: string; code: string; language: Language },
    options?: CallOptions,
  ): Promise<MailResult>;
  sendInvitationMail(
    input: {
      to: string;
      code: string;
      workspaceName: string;
      inviterName: string;
      joinUrl: string;
    },
    options?: CallOptions,
  ): Promise<MailResult>;
  sendInvitationCode(
    input: { to: string; code: string },
    options?: CallOptions,
  ): Promise<MailResult>;
};

// The numbers of R15 and R25, inputs so a test can shorten them.
export type Limits = {
  connectionTimeoutMs: number;
  greetingTimeoutMs: number;
  dnsTimeoutMs: number;
  socketTimeoutMs: number;
  sendTimeoutMs: number;
  maxConnections: number;
  queueLimit: number;
  queueWaitMs: number;
  cooldownMs: number;
};

export const defaultLimits: Limits = {
  connectionTimeoutMs: 5000,
  greetingTimeoutMs: 5000,
  dnsTimeoutMs: 5000,
  socketTimeoutMs: 10000,
  sendTimeoutMs: 30000,
  maxConnections: 2,
  queueLimit: 100,
  queueWaitMs: 30000,
  cooldownMs: 30000,
};

export type CreateMailLayerOptions = {
  config: MailConfig;
  logger: MailLogger;
  // The environment name is `production`: Join addresses must then be https.
  production: boolean;
  limits?: Partial<Limits>;
  // For tests only: one more trusted certificate authority. The certificate
  // and host-name check stay on; no configuration variable reaches this.
  tlsCa?: string | Buffer;
};

type Template = "sign_in" | "invitation" | "invitation_code";
type Failure = {
  reason: Exclude<Reason, "invalid_input">;
  cause: Cause;
  stage?: Stage;
  replyCode?: number;
};

const invalid: MailResult = { ok: false, reason: "invalid_input" };
const CODE = /^\d{6}$/;
const NAME_LIMIT = 200;

function validName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const shown = controlToSpace(name).trim();
  return shown.length > 0 && shown.length <= NAME_LIMIT;
}

function validCode(code: unknown): code is string {
  return typeof code === "string" && CODE.test(code);
}

function validTo(to: unknown): to is string {
  return typeof to === "string" && isWellFormedAddress(to);
}

function validJoinUrl(url: unknown, production: boolean): url is string {
  if (typeof url !== "string" || /\s/.test(url) || hasControl(url))
    return false;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || (!production && protocol === "http:");
  } catch {
    return false;
  }
}

type Waiter = {
  resolve: (outcome: Failure | "go") => void;
  timer: NodeJS.Timeout;
};

export function createMailLayer({
  config,
  logger,
  production,
  limits: given,
  tlsCa,
}: CreateMailLayerOptions): { layer: MailLayer; close: () => Promise<void> } {
  const limits: Limits = { ...defaultLimits, ...given };

  // One connection per send, never kept: the gate below lets at most
  // `maxConnections` sends run, so at most that many connections exist.
  // `socketCloseTimeout` makes a closed connection end quickly.
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.tls === "tls",
    requireTLS: config.tls === "starttls",
    ignoreTLS: config.tls === "none",
    ...(config.user !== undefined
      ? { auth: { user: config.user, pass: config.password ?? "" } }
      : {}),
    connectionTimeout: limits.connectionTimeoutMs,
    greetingTimeout: limits.greetingTimeoutMs,
    dnsTimeout: limits.dnsTimeoutMs,
    socketTimeout: limits.socketTimeoutMs,
    socketCloseTimeout: 500,
    tls: { rejectUnauthorized: true, ...(tlsCa ? { ca: tlsCa } : {}) },
    // Nodemailer's own logging would put the message, and so the code, in the log.
    logger: false,
    debug: false,
  });
  // An error event with no listener would crash the process (R6).
  transport.on("error", () => {});

  let active = 0;
  let closed = false;
  let cooldownUntil = 0;
  const waiters: Waiter[] = [];
  const inFlight = new Set<AbortController>();

  const cooldownFailure: Failure = { reason: "unavailable", cause: "cooldown" };

  function flushWaiters(failure: Failure) {
    for (const waiter of waiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.resolve(failure);
    }
  }

  function acquire(): Promise<Failure | "go"> {
    if (closed)
      return Promise.resolve({ reason: "unavailable", cause: "internal" });
    if (Date.now() < cooldownUntil) return Promise.resolve(cooldownFailure);
    if (active < limits.maxConnections && waiters.length === 0) {
      active += 1;
      return Promise.resolve("go");
    }
    if (waiters.length >= limits.queueLimit)
      return Promise.resolve({ reason: "unavailable", cause: "queue_full" });
    return new Promise((resolve) => {
      const waiter: Waiter = {
        resolve,
        timer: setTimeout(() => {
          const at = waiters.indexOf(waiter);
          if (at >= 0) waiters.splice(at, 1);
          resolve({ reason: "unavailable", cause: "queue_wait" });
        }, limits.queueWaitMs),
      };
      waiter.timer.unref();
      waiters.push(waiter);
    });
  }

  function release() {
    active -= 1;
    const next = waiters.shift();
    if (next) {
      clearTimeout(next.timer);
      active += 1;
      next.resolve("go");
    }
  }

  async function attempt(
    message: RenderedMail & { to: string },
  ): Promise<Failure | "sent"> {
    const controller = new AbortController();
    inFlight.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, limits.sendTimeoutMs);
    try {
      await transport.sendMail({
        from: { name: config.fromName, address: config.fromAddress },
        to: { name: "", address: message.to },
        subject: message.subject,
        text: message.text,
        html: message.html,
        headers: { "Auto-Submitted": "auto-generated" },
        signal: controller.signal,
      });
      return "sent";
    } catch (error) {
      if (timedOut || closed)
        return {
          reason: "unavailable",
          cause: timedOut ? "timeout" : "internal",
        };
      const result = classify(error);
      if (result.startsCooldown) {
        cooldownUntil = Date.now() + limits.cooldownMs;
        // Every waiting send fails at once instead of waiting on a dead server.
        flushWaiters(cooldownFailure);
      }
      return {
        reason: result.reason,
        cause: result.cause,
        ...(result.stage !== undefined ? { stage: result.stage } : {}),
        ...(result.replyCode !== undefined
          ? { replyCode: result.replyCode }
          : {}),
      };
    } finally {
      clearTimeout(timer);
      inFlight.delete(controller);
    }
  }

  function write(
    log: MailLogger,
    level: "info" | "warn",
    obj: object,
    msg: string,
  ) {
    try {
      log[level](obj, msg);
    } catch {
      // A broken logger must not turn a sent mail into an error.
    }
  }

  async function run(
    template: Template,
    build: () => (RenderedMail & { to: string }) | undefined,
    options: CallOptions | undefined,
  ): Promise<MailResult> {
    const log = options?.log ?? logger;
    const started = Date.now();
    try {
      const message = build();
      if (!message) {
        write(
          log,
          "warn",
          { event: "mail_invalid_input", template },
          "mail input refused",
        );
        return invalid;
      }
      const slot = await acquire();
      let outcome: Failure | "sent";
      if (slot === "go") {
        try {
          outcome = await attempt(message);
        } finally {
          // One turn of the loop, so the peer sees the old connection end
          // before the next send opens one.
          await new Promise((resolve) => setImmediate(resolve));
          release();
        }
      } else {
        outcome = slot;
      }
      const durationMs = Date.now() - started;
      if (outcome === "sent") {
        write(
          log,
          "info",
          { event: "mail_sent", template, durationMs },
          "mail sent",
        );
        return { ok: true };
      }
      write(
        log,
        "warn",
        {
          event: "mail_send_failed",
          template,
          reason: outcome.reason,
          cause: outcome.cause,
          ...(outcome.replyCode !== undefined
            ? { replyCode: outcome.replyCode }
            : {}),
          ...(outcome.stage !== undefined ? { stage: outcome.stage } : {}),
          durationMs,
        },
        "mail send failed",
      );
      return { ok: false, reason: outcome.reason };
    } catch {
      // A bug here never throws or rejects (R6); no error text is logged (R13).
      write(
        log,
        "warn",
        {
          event: "mail_send_failed",
          template,
          reason: "unavailable",
          cause: "internal",
          durationMs: Date.now() - started,
        },
        "mail send failed",
      );
      return { ok: false, reason: "unavailable" };
    }
  }

  const layer: MailLayer = {
    sendSignInMail(input, options) {
      return run(
        "sign_in",
        () => {
          const { to, code, language } = input ?? {};
          if (!validTo(to) || !validCode(code)) return undefined;
          if (language !== "en" && language !== "vi") return undefined;
          return {
            to,
            ...renderSignInMail({
              t: createTranslator(language),
              language,
              code,
            }),
          };
        },
        options,
      );
    },
    sendInvitationMail(input, options) {
      return run(
        "invitation",
        () => {
          const { to, code, workspaceName, inviterName, joinUrl } = input ?? {};
          if (!validTo(to) || !validCode(code)) return undefined;
          if (!validName(workspaceName) || !validName(inviterName))
            return undefined;
          if (!validJoinUrl(joinUrl, production)) return undefined;
          return {
            to,
            ...renderInvitationMail({
              t: createTranslator("en"),
              language: "en",
              code,
              workspaceName: workspaceName.trim(),
              inviterName: inviterName.trim(),
              joinUrl,
            }),
          };
        },
        options,
      );
    },
    sendInvitationCode(input, options) {
      return run(
        "invitation_code",
        () => {
          const { to, code } = input ?? {};
          if (!validTo(to) || !validCode(code)) return undefined;
          return {
            to,
            ...renderInvitationCodeMail({
              t: createTranslator("en"),
              language: "en",
              code,
            }),
          };
        },
        options,
      );
    },
  };

  async function close() {
    closed = true;
    flushWaiters({ reason: "unavailable", cause: "internal" });
    for (const controller of inFlight) controller.abort();
    // Sends in flight end as soon as their connection is gone.
    while (inFlight.size > 0)
      await new Promise((resolve) => setTimeout(resolve, 5));
    transport.close();
  }

  return { layer, close };
}
