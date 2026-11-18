import { afterEach, describe, expect, it } from "vitest";
import { startSmtp } from "../../test/smtp-server.js";
import { createMailLayer } from "./index.js";
import { captureLogger, code, joinUrl, mailConfig } from "./test-helpers.js";

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()!();
});

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

const invitation = {
  to: "sam@example.com",
  code,
  workspaceName: "Acme",
  inviterName: "Sam",
  joinUrl,
};

describe("sending the three mails (R6, R7, R9, R11, R24)", () => {
  it("delivers the sign-in mail, in Vietnamese with intact letters", async () => {
    const { smtp, layer } = await setup();
    const result = await layer.sendSignInMail({
      to: "an@example.com",
      code,
      language: "vi",
    });
    expect(result).toEqual({ ok: true });
    const [mail] = await smtp.received();
    expect(mail?.from?.value[0]).toMatchObject({
      name: "Toki",
      address: "toki@example.com",
    });
    expect(mail?.to).toMatchObject({ value: [{ address: "an@example.com" }] });
    expect(mail?.subject).toBe("Mã đăng nhập Toki của bạn");
    expect(mail?.text).toContain("Dùng mã này để đăng nhập vào Toki:");
    expect(mail?.text).toContain(code);
    expect(mail?.html).toContain("Mã có hiệu lực trong 10 phút");
    expect(mail?.headers.get("auto-submitted")).toBe("auto-generated");
    expect(mail?.html).not.toContain("href");
  });

  it("delivers the invitation mail in English, with the Join link whole", async () => {
    const { smtp, layer } = await setup();
    expect(await layer.sendInvitationMail(invitation)).toEqual({ ok: true });
    const [mail] = await smtp.received();
    expect(mail?.subject).toBe("Sam invited you to Acme on Toki");
    expect(mail?.text?.split("\n")).toContain(joinUrl);
    expect(mail?.html).toContain(`href="${joinUrl}"`);
    expect(mail?.html).toContain(">Join</a>");
    expect(mail?.headers.get("auto-submitted")).toBe("auto-generated");
  });

  it("delivers the new-code mail in English with no link", async () => {
    const { smtp, layer } = await setup();
    expect(
      await layer.sendInvitationCode({ to: "sam@example.com", code }),
    ).toEqual({ ok: true });
    const [mail] = await smtp.received();
    expect(mail?.subject).toBe("Your new Toki code");
    expect(mail?.text).toContain(code);
    expect(mail?.html).not.toContain("href");
  });

  it("puts a name that tries to add a recipient or header into the text only", async () => {
    const { smtp, layer } = await setup();
    await layer.sendInvitationMail({
      ...invitation,
      inviterName: "Sam\r\nBcc: x@example.com",
      workspaceName: "<script>alert(1)</script>",
    });
    const [mail] = await smtp.received();
    expect(mail?.headers.get("bcc")).toBeUndefined();
    expect(mail?.html).not.toContain("<script");
    expect(mail?.html).toContain("&lt;script&gt;");
  });
});

describe("input that is refused before any connection (R6, R9)", () => {
  const bad: Array<
    [
      string,
      (l: Awaited<ReturnType<typeof setup>>["layer"]) => Promise<unknown>,
    ]
  > = [
    [
      "a code of 5 digits",
      (l) => l.sendSignInMail({ to: "a@b.c", code: "12345", language: "en" }),
    ],
    [
      "a code with a letter",
      (l) => l.sendSignInMail({ to: "a@b.c", code: "12345a", language: "en" }),
    ],
    [
      "a code of 7 digits",
      (l) => l.sendInvitationCode({ to: "a@b.c", code: "1234567" }),
    ],
    [
      "an unknown language",
      (l) => l.sendSignInMail({ to: "a@b.c", code, language: "fr" as "en" }),
    ],
    [
      "two addresses",
      (l) => l.sendSignInMail({ to: "a@b.c, d@e.f", code, language: "en" }),
    ],
    [
      "a name and angle brackets",
      (l) => l.sendSignInMail({ to: "Sam <a@b.c>", code, language: "en" }),
    ],
    ["no address", (l) => l.sendInvitationCode({ to: "", code })],
    [
      "an empty workspace name",
      (l) => l.sendInvitationMail({ ...invitation, workspaceName: "  " }),
    ],
    [
      "a name of 201 characters",
      (l) =>
        l.sendInvitationMail({ ...invitation, inviterName: "x".repeat(201) }),
    ],
    [
      "an http address in production-like check",
      (l) =>
        l.sendInvitationMail({
          ...invitation,
          joinUrl: "ftp://toki.example.com/join#t",
        }),
    ],
    [
      "a relative address",
      (l) => l.sendInvitationMail({ ...invitation, joinUrl: "/join#t" }),
    ],
    [
      "an address with a line break",
      (l) =>
        l.sendInvitationMail({
          ...invitation,
          joinUrl: "https://t.example.com/a\nb",
        }),
    ],
  ];
  it.each(bad)(
    "returns invalid_input for %s and opens no connection",
    async (_name, call) => {
      const { smtp, layer } = await setup();
      expect(await call(layer)).toEqual({ ok: false, reason: "invalid_input" });
      expect(smtp.totalConnections()).toBe(0);
    },
  );

  it("accepts an http address outside production and refuses it in production", async () => {
    const smtp = await startSmtp();
    open.push(smtp.close);
    const dev = createMailLayer({
      config: mailConfig(smtp.port),
      logger: captureLogger().logger,
      production: false,
    });
    const prod = createMailLayer({
      config: mailConfig(smtp.port),
      logger: captureLogger().logger,
      production: true,
    });
    open.push(dev.close, prod.close);
    const http = { ...invitation, joinUrl: "http://localhost:5173/join#tok" };
    expect(await dev.layer.sendInvitationMail(http)).toEqual({ ok: true });
    expect(await prod.layer.sendInvitationMail(http)).toEqual({
      ok: false,
      reason: "invalid_input",
    });
  });
});

describe("where the mail goes (R5)", () => {
  it("follows the configuration with no change of code", async () => {
    const a = await startSmtp();
    const b = await startSmtp();
    open.push(a.close, b.close);
    const first = createMailLayer({
      config: mailConfig(a.port, {
        fromAddress: "one@example.com",
        fromName: "One",
      }),
      logger: captureLogger().logger,
      production: false,
    });
    const second = createMailLayer({
      config: mailConfig(b.port, {
        fromAddress: "two@example.com",
        fromName: "Two",
      }),
      logger: captureLogger().logger,
      production: false,
    });
    open.push(first.close, second.close);
    await first.layer.sendInvitationCode({ to: "sam@example.com", code });
    await second.layer.sendInvitationCode({ to: "sam@example.com", code });
    const [ma] = await a.received();
    const [mb] = await b.received();
    expect((await a.received()).length + (await b.received()).length).toBe(2);
    expect(ma?.from?.value[0]).toMatchObject({
      name: "One",
      address: "one@example.com",
    });
    expect(mb?.from?.value[0]).toMatchObject({
      name: "Two",
      address: "two@example.com",
    });
  });
});

describe("failures are sorted (R16) and not retried (R17)", () => {
  const cases: Array<[string, Parameters<typeof startSmtp>[0], string]> = [
    [
      "550 to the recipient",
      { fail: { rcptTo: { code: 550, message: "no such user" } } },
      "recipient_rejected",
    ],
    [
      "553 to the sender",
      { fail: { mailFrom: { code: 553, message: "sender not allowed" } } },
      "rejected",
    ],
    [
      "554 to the data",
      { fail: { data: { code: 554, message: "rejected" } } },
      "rejected",
    ],
    [
      "451 to the data",
      { fail: { data: { code: 451, message: "try later" } } },
      "unavailable",
    ],
    [
      "450 to the recipient",
      { fail: { rcptTo: { code: 450, message: "greylisted" } } },
      "unavailable",
    ],
  ];
  it.each(cases)("%s", async (_name, behaviour, reason) => {
    const { smtp, layer } = await setup(behaviour);
    expect(
      await layer.sendInvitationCode({ to: "sam@example.com", code }),
    ).toEqual({ ok: false, reason });
    expect(smtp.attemptedData() <= 1).toBe(true);
    expect(smtp.totalConnections()).toBe(1);
  });

  it("returns auth_failed for a refused login", async () => {
    const smtp = await startSmtp({ login: { user: "u", password: "right" } });
    open.push(smtp.close);
    const { layer, close } = createMailLayer({
      config: mailConfig(smtp.port, {
        user: "u",
        password: "wrong",
        tls: "starttls",
      }),
      logger: captureLogger().logger,
      production: false,
    });
    open.push(close);
    // Over a plain server the STARTTLS requirement fails first; see tls.test.ts for the login over TLS.
    const result = await layer.sendInvitationCode({
      to: "sam@example.com",
      code,
    });
    expect(result.ok).toBe(false);
  });

  it("returns unavailable when nothing listens", async () => {
    const smtp = await startSmtp();
    await smtp.close();
    const { layer, close } = createMailLayer({
      config: mailConfig(smtp.port),
      logger: captureLogger().logger,
      production: false,
    });
    open.push(close);
    expect(
      await layer.sendInvitationCode({ to: "sam@example.com", code }),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  it("makes exactly one attempt after a 451", async () => {
    const { smtp, layer } = await setup({
      fail: { data: { code: 451, message: "try later" } },
    });
    await layer.sendSignInMail({ to: "sam@example.com", code, language: "en" });
    expect(smtp.attemptedData()).toBe(1);
    expect(smtp.totalConnections()).toBe(1);
  });
});

describe("two connections at most (R19) and a clean close (R20)", () => {
  it("sends 10 mails started together over at most 2 connections", async () => {
    const { smtp, layer } = await setup({ delayMs: 30 });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        layer.sendInvitationCode({ to: `p${i}@example.com`, code }),
      ),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect((await smtp.received()).length).toBe(10);
    expect(smtp.maxOpenConnections()).toBeLessThanOrEqual(2);
  });

  it("leaves no open connection after close", async () => {
    const smtp = await startSmtp({ delayMs: 300 });
    open.push(smtp.close);
    const { layer, close } = createMailLayer({
      config: mailConfig(smtp.port),
      logger: captureLogger().logger,
      production: false,
    });
    const pending = layer.sendInvitationCode({ to: "sam@example.com", code });
    await new Promise((r) => setTimeout(r, 100));
    await close();
    expect(await pending).toEqual({ ok: false, reason: "unavailable" });
    await new Promise((r) => setTimeout(r, 100));
    expect(smtp.openConnections()).toBe(0);
    expect(
      await layer.sendInvitationCode({ to: "sam@example.com", code }),
    ).toEqual({ ok: false, reason: "unavailable" });
  });
});
