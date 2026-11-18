import { afterEach, describe, expect, it } from "vitest";
import { startSilentServer, startSmtp } from "../../tests/smtp-server.js";
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
  return { layer, log };
}

describe("a send is bounded in time (R15)", () => {
  it("(a) gives up on a server that never greets within the greeting limit", async () => {
    const silent = await startSilentServer();
    open.push(silent.close);
    const { layer, log } = layerFor(silent.port, {
      greetingTimeoutMs: 300,
      connectionTimeoutMs: 300,
      sendTimeoutMs: 5000,
    });
    const started = Date.now();
    expect(await layer.sendInvitationCode({ to, code })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(log.lines[0]).toMatchObject({ cause: "timeout" });
  });

  it("(b) the whole-send limit ends a slow send, nothing arrives late, and no cooldown starts", async () => {
    // Every command is answered after 250 ms, under the socket limit of 2 s;
    // only the whole-send limit of 400 ms can end this send, before DATA ends.
    const smtp = await startSmtp({ delayMs: 250 });
    open.push(smtp.close);
    const { layer, log } = layerFor(smtp.port, {
      socketTimeoutMs: 2000,
      sendTimeoutMs: 400,
    });
    const started = Date.now();
    expect(await layer.sendInvitationCode({ to, code })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(Date.now() - started).toBeLessThan(1500);
    expect(log.lines[0]).toMatchObject({
      event: "mail_send_failed",
      cause: "timeout",
    });
    await wait(1500);
    expect(smtp.rawReceived()).toHaveLength(0);
    expect(smtp.openConnections()).toBe(0);
    // No cooldown: the next send reaches the server again.
    await layer.sendInvitationCode({ to, code });
    expect(smtp.totalConnections()).toBe(2);
    expect(smtp.maxOpenConnections()).toBeLessThanOrEqual(2);
  });
});
