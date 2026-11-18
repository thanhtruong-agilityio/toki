import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { loadProcessConfig } from "../config.js";
import { createDb } from "./client.js";

async function freePort() {
  return new Promise<number>((resolve) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

describe("createDb", () => {
  // The only test that uses DATABASE_URL; it reads and writes nothing (R1).
  it("connects with the value of the configuration module and runs select 1", async () => {
    const { database } = loadProcessConfig(["database"]);
    const { db, close } = createDb(database.url);
    try {
      const rows = await db.execute<{ one: number }>("select 1 as one");
      expect(rows[0]?.one).toBe(1);
    } finally {
      await close();
    }
  });

  it("builds without throwing when nothing listens, and a query rejects (R16)", async () => {
    const port = await freePort();
    const { db, close } = createDb(
      `postgres://fake:fake@127.0.0.1:${port}/fake`,
    );
    try {
      await expect(db.execute("select 1")).rejects.toThrow();
    } finally {
      await close();
    }
  });
});
