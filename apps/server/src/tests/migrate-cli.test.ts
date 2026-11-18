import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";

const entry = new URL("../db/migrate-cli.ts", import.meta.url).pathname;
const cwd = new URL("../..", import.meta.url).pathname;

function run(env: Record<string, string>) {
  return new Promise<{ code: number | null; out: string; err: string }>(
    (resolve) => {
      const child = spawn(process.execPath, ["--import", "tsx", entry], {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr.on("data", (d) => (err += d));
      child.on("close", (code) => resolve({ code, out, err }));
    },
  );
}

async function freePort() {
  return new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

describe("db:migrate failures (R14)", () => {
  it("names DATABASE_URL when it is missing", async () => {
    const { code, err } = await run({});
    expect(code).not.toBe(0);
    expect(err).toContain("DATABASE_URL");
  });

  it("says the database cannot be reached, with no password or URL", async () => {
    const port = await freePort();
    const { code, err } = await run({
      DATABASE_URL: `postgres://fakeuser:fakesecret@127.0.0.1:${port}/fakedb`,
    });
    expect(code).not.toBe(0);
    expect(err).toContain(`127.0.0.1:${port}/fakedb`);
    expect(err).not.toContain("fakesecret");
    expect(err).not.toContain("postgres://");
  });
});
