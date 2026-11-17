import { ErrorResponseSchema } from "@toki/shared";
import { spawn } from "node:child_process";
import { createServer, connect } from "node:net";
import { describe, expect, it } from "vitest";

// Starts the real main.ts with Node directly, not through pnpm, so every
// stdout line is the server's own (R6). Fake values only.
const entry = new URL("./main.ts", import.meta.url).pathname;
const cwd = new URL("..", import.meta.url).pathname;

async function freePort() {
  return new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

function start(env: Record<string, string>) {
  const child = spawn(process.execPath, ["--import", "tsx", entry], {
    cwd,
    env: { ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  const exited = new Promise<number | null>((resolve) =>
    child.on("exit", (code) => resolve(code)),
  );
  return { child, out: () => out, err: () => err, exited };
}

async function until(check: () => boolean, ms = 15000) {
  const stop = Date.now() + ms;
  while (!check()) {
    if (Date.now() > stop) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 25));
  }
}

const validEnv = (port: number) => ({
  NODE_ENV: "development",
  SERVER_PORT: String(port),
  // Points at no running Postgres (R20).
  DATABASE_URL: "postgres://fake:fake@127.0.0.1:1/fake",
});

describe("the started process", () => {
  it("listens once, answers /healthz, answers a bad request in the one format, stops on SIGTERM", async () => {
    const port = await freePort();
    const proc = start(validEnv(port));
    await until(() => proc.out().includes("listening"));

    // R1: exactly one line with the address; R6: every line is JSON.
    const lines = proc.out().split("\n").filter(Boolean);
    expect(lines.filter((l) => l.includes("listening"))).toHaveLength(1);
    expect(lines.filter((l) => l.includes("listening"))[0]).toContain(
      `127.0.0.1:${port}`,
    );
    for (const line of lines) expect(() => JSON.parse(line)).not.toThrow();

    // R5 and R20: ok although Postgres is not there.
    const health = await fetch(`http://127.0.0.1:${port}/healthz`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    // R8: a request Node cannot parse (clientError).
    const raw = await new Promise<string>((resolve) => {
      const socket = connect(port, "127.0.0.1", () =>
        socket.write("NOT A REQUEST\r\n\r\n"),
      );
      let data = "";
      socket.on("data", (d) => (data += d));
      socket.on("close", () => resolve(data));
    });
    expect(raw).toMatch(/^HTTP\/1\.1 400/);
    ErrorResponseSchema.parse(
      JSON.parse(raw.slice(raw.indexOf("\r\n\r\n") + 4)),
    );

    // R15
    proc.child.kill("SIGTERM");
    expect(await proc.exited).toBe(0);
  });

  it.each([
    ["missing", { NODE_ENV: undefined }],
    ["empty", { NODE_ENV: "" }],
  ])(
    "does not start when a required variable is %s (R3)",
    async (_label, patch) => {
      const env: Record<string, string> = { ...validEnv(await freePort()) };
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete env[k];
        else env[k] = v;
      }
      const proc = start(env);
      expect(await proc.exited).toBe(1);
      expect(proc.err()).toContain("NODE_ENV");
      expect(proc.out()).toBe("");
    },
  );

  it("does not start on an invalid value and never prints it (R4)", async () => {
    const secret = "bad-value-7c1e";
    const proc = start({ ...validEnv(await freePort()), LOG_LEVEL: secret });
    expect(await proc.exited).toBe(1);
    expect(proc.err()).toContain("LOG_LEVEL");
    expect(proc.err() + proc.out()).not.toContain(secret);
  });
});
