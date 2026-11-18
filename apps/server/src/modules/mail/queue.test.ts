import { afterEach, describe, expect, it } from "vitest";
import { startSilentServer, startSmtp } from "../../test/smtp-server.js";
import { createMailLayer, type Limits } from "./index.js";
import { captureLogger, code, mailConfig } from "./test-helpers.js";

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()!();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const to = "sam@example.com";

function layerFor(port: number, limits: Partial<Limits>) {
  const log = captureLogger();
  const { layer, close } = createMailLayer({
    config: mailConfig(port),
    logger: log.logger,
    production: false,
    limits,
  });
  open.push(close);
  const causes = () =>
    log.lines.filter((l) => l.event === "mail_send_failed").map((l) => l.cause);
  return { layer, log, causes };
}

describe("the queue, the wait and the cooldown (R25)", () => {
  it("fails 50 sends to a silent server in about one greeting limit, over 2 connections", async () => {
    const silent = await startSilentServer();
    open.push(silent.close);
    const { layer, causes } = layerFor(silent.port, {
      greetingTimeoutMs: 300,
      connectionTimeoutMs: 300,
    });
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 50 }, () => layer.sendInvitationCode({ to, code })),
    );
    expect(Date.now() - started).toBeLessThan(2000);
    expect(results.every((r) => !r.ok && r.reason === "unavailable")).toBe(
      true,
    );
    expect(silent.maxOpenConnections()).toBeLessThanOrEqual(2);
    expect(
      causes().filter((c) => c === "cooldown").length,
    ).toBeGreaterThanOrEqual(46);
  });

  it("refuses the sends past the queue limit at once", async () => {
    const smtp = await startSmtp({ delayMs: 300 });
    open.push(smtp.close);
    const { layer, causes } = layerFor(smtp.port, { queueLimit: 3 });
    const results = await Promise.all(
      Array.from({ length: 10 }, () => layer.sendInvitationCode({ to, code })),
    );
    expect(causes().filter((c) => c === "queue_full")).toHaveLength(5);
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(smtp.maxOpenConnections()).toBeLessThanOrEqual(2);
  });

  it("removes a send that waited past the wait limit and never delivers it", async () => {
    const smtp = await startSmtp({ delayMs: 600 });
    open.push(smtp.close);
    const { layer, causes } = layerFor(smtp.port, { queueWaitMs: 200 });
    const results = await Promise.all(
      Array.from({ length: 3 }, () => layer.sendInvitationCode({ to, code })),
    );
    expect(causes()).toEqual(["queue_wait"]);
    expect(results.filter((r) => r.ok)).toHaveLength(2);
    await wait(500);
    expect(smtp.rawReceived()).toHaveLength(2);
  });

  it("opens no connection during the cooldown and tries the server again after it", async () => {
    const probe = await startSmtp();
    const port = probe.port;
    await probe.close();
    const { layer, causes } = layerFor(port, { cooldownMs: 600 });
    expect(await layer.sendInvitationCode({ to, code })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    const server = await startSmtp({ listenPort: port });
    open.push(server.close);
    // Still cooling down: refused at once, no connection although the server is back.
    expect(await layer.sendInvitationCode({ to, code })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(server.totalConnections()).toBe(0);
    expect(causes()).toEqual(["connect", "cooldown"]);
    await wait(700);
    expect(await layer.sendInvitationCode({ to, code })).toEqual({ ok: true });
    expect(server.totalConnections()).toBe(1);
  });
});
