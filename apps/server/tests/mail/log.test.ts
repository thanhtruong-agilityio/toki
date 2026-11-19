import { afterEach, describe, expect, it, vi } from "vitest";
import { startSmtp } from "../smtp-server.js";
import { createMailLayer } from "../../src/modules/mail/index.js";
import { captureLogger, code, joinUrl, mailConfig } from "./test-helpers.js";

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  vi.restoreAllMocks();
  while (open.length) await open.pop()!();
});

const address = "sam@example.com";
const secrets = [code, address, joinUrl, "Acme", "Sam"];

function watchStreams() {
  const out: string[] = [];
  for (const stream of [process.stdout, process.stderr]) {
    vi.spyOn(stream, "write").mockImplementation(((
      chunk: string | Uint8Array,
    ) => {
      out.push(String(chunk));
      return true;
    }) as never);
  }
  return out;
}

async function setup(behaviour: Parameters<typeof startSmtp>[0] = {}) {
  const smtp = await startSmtp(behaviour);
  open.push(smtp.close);
  const log = captureLogger();
  const { layer, close } = createMailLayer({
    config: mailConfig(smtp.port),
    logger: log.logger,
    production: false,
  });
  open.push(close);
  return { smtp, layer, log };
}

describe("one log line per send, and nothing secret in it (R13, R14)", () => {
  it("writes mail_sent with the template and the duration on success", async () => {
    const out = watchStreams();
    const { layer, log } = await setup();
    await layer.sendInvitationMail({
      to: address,
      code,
      workspaceName: "Acme",
      inviterName: "Sam",
      joinUrl,
    });
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatchObject({
      level: "info",
      event: "mail_sent",
      template: "invitation",
    });
    expect(typeof log.lines[0]?.durationMs).toBe("number");
    const everything = JSON.stringify(log.lines) + out.join("");
    for (const secret of secrets) expect(everything).not.toContain(secret);
  });

  it.each([
    [
      "recipient refused",
      {
        rcptTo: {
          code: 550,
          message: `no such user ${address} for code ${code}`,
        },
      },
      "recipient_rejected",
      "rcpt_to",
      550,
    ],
    [
      "sender refused",
      {
        mailFrom: {
          code: 553,
          message: `sender not allowed, ${address} ${code}`,
        },
      },
      "rejected",
      "mail_from",
      553,
    ],
    [
      "data deferred",
      { data: { code: 451, message: `try later ${address} ${code}` } },
      "unavailable",
      "data",
      451,
    ],
  ] as const)(
    "writes mail_send_failed with the reason, stage and reply code: %s",
    async (_name, fail, reason, stage, replyCode) => {
      const out = watchStreams();
      const { layer, log } = await setup({ fail });
      const result = await layer.sendInvitationMail({
        to: address,
        code,
        workspaceName: "Acme",
        inviterName: "Sam",
        joinUrl,
      });
      expect(result).toEqual({ ok: false, reason });
      expect(log.lines).toHaveLength(1);
      expect(log.lines[0]).toMatchObject({
        level: "warn",
        event: "mail_send_failed",
        template: "invitation",
        reason,
        cause: "reply",
        stage,
        replyCode,
      });
      const everything = JSON.stringify(log.lines) + out.join("");
      for (const secret of secrets) expect(everything).not.toContain(secret);
    },
  );

  it("writes mail_send_failed with the cause connect when nothing listens", async () => {
    const smtp = await startSmtp();
    await smtp.close();
    const log = captureLogger();
    const { layer, close } = createMailLayer({
      config: mailConfig(smtp.port),
      logger: log.logger,
      production: false,
    });
    open.push(close);
    await layer.sendSignInMail({ to: address, code, language: "en" });
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatchObject({
      event: "mail_send_failed",
      template: "sign_in",
      reason: "unavailable",
      cause: "connect",
      stage: "connect",
    });
    expect(JSON.stringify(log.lines)).not.toContain(address);
  });

  it("writes one mail_invalid_input line for a refused input", async () => {
    const { layer, log } = await setup();
    await layer.sendInvitationCode({ to: "a@b.c, d@e.f", code });
    expect(log.lines).toHaveLength(1);
    expect(log.lines[0]).toMatchObject({
      level: "warn",
      event: "mail_invalid_input",
      template: "invitation_code",
    });
    expect(JSON.stringify(log.lines)).not.toContain("d@e.f");
  });

  it("writes to the logger of the caller when it gives one", async () => {
    const { layer, log } = await setup();
    const mine = captureLogger();
    await layer.sendInvitationCode({ to: address, code }, { log: mine.logger });
    expect(mine.lines).toHaveLength(1);
    expect(log.lines).toHaveLength(0);
  });
});
