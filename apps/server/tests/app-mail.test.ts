import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { startSmtp } from "./smtp-server.js";
import { fakeMail } from "./fake-mail.js";

const base: Config = {
  server: {
    env: "development",
    port: 3000,
    host: "127.0.0.1",
    logLevel: "error",
  },
  database: { url: "postgres://fake:fake@127.0.0.1:1/fake" },
};
const mailValues = (port: number) => ({
  host: "127.0.0.1",
  port,
  tls: "none" as const,
  fromAddress: "toki@example.com",
  fromName: "Toki",
});
const code = "493027";

describe("the mail layer on the app (R20, R21)", () => {
  it("puts a given layer on the app before the routes, and the routes reach it", async () => {
    const { layer, calls } = fakeMail();
    let seenInRoutes: unknown;
    const app = buildApp({
      config: base,
      mail: layer,
      registerRoutes: (scope) => {
        seenInRoutes = scope.mail;
        scope.post("/send", async () =>
          scope.mail.sendInvitationCode({ to: "sam@example.com", code }),
        );
      },
    });
    const response = await app.inject({ method: "POST", url: "/api/v1/send" });
    expect(response.json()).toEqual({ ok: true });
    expect(seenInRoutes).toBe(layer);
    expect(app.mail).toBe(layer);
    expect(calls).toEqual([
      {
        operation: "sendInvitationCode",
        input: { to: "sam@example.com", code },
      },
    ]);
    await app.close();
  });

  it("throws at once, naming mail, when neither `mail` nor `config.mail` is given", () => {
    expect(() => buildApp({ config: base })).toThrow(/mail/);
  });

  it("builds the real layer from config.mail", async () => {
    const smtp = await startSmtp();
    const app = buildApp({ config: { ...base, mail: mailValues(smtp.port) } });
    await app.ready();
    expect(
      await app.mail.sendInvitationCode({ to: "sam@example.com", code }),
    ).toEqual({ ok: true });
    expect(smtp.rawReceived()).toHaveLength(1);
    await app.close();
    await smtp.close();
  });

  it("leaves no open connection after app.close()", async () => {
    const smtp = await startSmtp({ delayMs: 400 });
    const app = buildApp({ config: { ...base, mail: mailValues(smtp.port) } });
    await app.ready();
    const pending = app.mail.sendInvitationCode({
      to: "sam@example.com",
      code,
    });
    await new Promise((r) => setTimeout(r, 150));
    expect(smtp.openConnections()).toBeGreaterThan(0);
    await app.close();
    await pending;
    await new Promise((r) => setTimeout(r, 100));
    expect(smtp.openConnections()).toBe(0);
    await smtp.close();
  });

  it("does not close a layer it was given", async () => {
    let closed = false;
    const { layer } = fakeMail();
    const given = Object.assign(layer, {
      close: async () => void (closed = true),
    });
    const app = buildApp({ config: base, mail: given });
    await app.close();
    expect(closed).toBe(false);
  });
});
