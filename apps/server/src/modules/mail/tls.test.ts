import { generate } from "selfsigned";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startSmtp } from "../../test/smtp-server.js";
import { createMailLayer } from "./index.js";
import type { MailConfig } from "./config.js";
import { captureLogger, code, mailConfig } from "./test-helpers.js";

// The certificates are made here, in memory, and are never written to a file.
type Pems = { private: string; cert: string };
let rightName: Pems;
let wrongName: Pems;

async function certFor(
  altNames: Array<{ type: number; value?: string; ip?: string }>,
) {
  return generate([{ name: "commonName", value: "test" }], {
    algorithm: "sha256",
    extensions: [{ name: "subjectAltName", altNames }],
  }) as Promise<Pems>;
}

beforeAll(async () => {
  rightName = await certFor([{ type: 7, ip: "127.0.0.1" }]);
  wrongName = await certFor([{ type: 2, value: "other.example.com" }]);
});

const open: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (open.length) await open.pop()!();
});
afterAll(() => undefined);

const to = "sam@example.com";

async function send(
  config: Partial<MailConfig> & Pick<MailConfig, "tls">,
  server: Parameters<typeof startSmtp>[0],
  tlsCa?: string,
) {
  const smtp = await startSmtp(server);
  open.push(smtp.close);
  const log = captureLogger();
  const { layer, close } = createMailLayer({
    config: mailConfig(smtp.port, config),
    logger: log.logger,
    production: true,
    ...(tlsCa ? { tlsCa } : {}),
  });
  open.push(close);
  const result = await layer.sendInvitationCode({ to, code });
  return { smtp, result, log };
}

const starttls = (pems: Pems) => ({
  server: { key: pems.private, cert: pems.cert },
});
const implicit = (pems: Pems) => ({
  server: { secure: true, key: pems.private, cert: pems.cert },
});

describe("TLS (R4)", () => {
  it("sends nothing when starttls is wanted and the server offers none", async () => {
    const { smtp, result, log } = await send(
      { tls: "starttls" },
      { server: { disabledCommands: ["STARTTLS"] } },
    );
    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(smtp.rawReceived()).toHaveLength(0);
    expect(log.lines[0]).toMatchObject({ cause: "tls" });
  });

  it.each([
    ["starttls", starttls],
    ["tls", implicit],
  ] as const)(
    "refuses a certificate it does not trust on %s",
    async (mode, make) => {
      const { smtp, result, log } = await send({ tls: mode }, make(rightName));
      expect(result).toEqual({ ok: false, reason: "unavailable" });
      expect(smtp.rawReceived()).toHaveLength(0);
      expect(log.lines[0]).toMatchObject({ cause: "tls" });
    },
  );

  it.each([
    ["starttls", starttls],
    ["tls", implicit],
  ] as const)(
    "refuses a certificate for another host name, even when trusted, on %s",
    async (mode, make) => {
      const { smtp, result } = await send(
        { tls: mode },
        make(wrongName),
        wrongName.cert,
      );
      expect(result).toEqual({ ok: false, reason: "unavailable" });
      expect(smtp.rawReceived()).toHaveLength(0);
    },
  );

  it.each([
    ["starttls", starttls],
    ["tls", implicit],
  ] as const)(
    "delivers when the certificate is for the right name and trusted, on %s",
    async (mode, make) => {
      const { smtp, result } = await send(
        { tls: mode },
        make(rightName),
        rightName.cert,
      );
      expect(result).toEqual({ ok: true });
      expect(smtp.rawReceived()).toHaveLength(1);
    },
  );

  it("sends the login only over TLS and delivers with the right one", async () => {
    const login = { user: "u", password: "p" };
    const { smtp, result } = await send(
      { tls: "starttls", user: "u", password: "p" },
      { ...starttls(rightName), login },
      rightName.cert,
    );
    expect(result).toEqual({ ok: true });
    expect(smtp.rawReceived()).toHaveLength(1);
  });

  it("returns auth_failed for a refused login", async () => {
    const { smtp, result, log } = await send(
      { tls: "starttls", user: "u", password: "wrong" },
      { ...starttls(rightName), login: { user: "u", password: "right" } },
      rightName.cert,
    );
    expect(result).toEqual({ ok: false, reason: "auth_failed" });
    expect(smtp.rawReceived()).toHaveLength(0);
    expect(log.lines[0]).toMatchObject({ stage: "auth", replyCode: 535 });
    expect(JSON.stringify(log.lines)).not.toContain("wrong");
  });

  it("with none, sends in clear to a server that offers STARTTLS with a certificate nobody trusts", async () => {
    const { smtp, result } = await send({ tls: "none" }, starttls(wrongName));
    expect(result).toEqual({ ok: true });
    expect(smtp.rawReceived()).toHaveLength(1);
  });
});

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "node_modules" ? [] : sources(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe("nothing switches the certificate check off (R4)", () => {
  const root = new URL("../../", import.meta.url).pathname;
  const files = sources(root).map((path) => ({
    path,
    text: readFileSync(path, "utf8"),
  }));

  it("never sets rejectUnauthorized to false or reads NODE_TLS_REJECT_UNAUTHORIZED", () => {
    for (const file of files) {
      expect(file.text, file.path).not.toMatch(
        /rejectUnauthorized\s*:\s*false/,
      );
      expect(file.text, file.path).not.toContain(
        "NODE_TLS_REJECT_UNAUTHORIZED",
      );
    }
  });

  it("lets no configuration variable reach tlsCa", () => {
    const users = files
      .filter((f) => f.text.includes("tlsCa"))
      .map((f) => f.path.replace(root, ""));
    expect(users).toEqual(["modules/mail/layer.ts"]);
    const mailDir = files.filter((f) => f.path.includes("/modules/mail/"));
    for (const file of mailDir)
      expect(file.text, file.path).not.toContain("process.env");
  });
});
