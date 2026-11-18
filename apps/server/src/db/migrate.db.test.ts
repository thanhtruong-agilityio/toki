import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createThrowawayDb } from "../tests/throwaway-db.js";
import { migrationsFolder, runMigrations } from "./migrate.js";

let throwaway: Awaited<ReturnType<typeof createThrowawayDb>>;
beforeAll(async () => {
  throwaway = await createThrowawayDb();
});
afterAll(async () => {
  await throwaway?.drop();
});

async function tables(url: string) {
  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`;
    return rows.map((r) => r.table_name);
  } finally {
    await sql.end();
  }
}

// A migrations folder the way Drizzle Kit writes it: SQL files plus meta/_journal.json.
function folderOf(sqlByTag: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "toki-migrations-"));
  mkdirSync(join(dir, "meta"));
  const entries = Object.keys(sqlByTag).map((tag, idx) => ({
    idx,
    version: "7",
    when: 1_700_000_000_000 + idx,
    tag,
    breakpoints: true,
  }));
  writeFileSync(
    join(dir, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries }),
  );
  for (const [tag, text] of Object.entries(sqlByTag)) {
    writeFileSync(join(dir, `${tag}.sql`), text);
  }
  return dir;
}

describe("runMigrations", () => {
  it("points at the committed folder as a file path, not a percent-encoded one", () => {
    expect(migrationsFolder).not.toMatch(/%[0-9A-Fa-f]{2}/);
    expect(existsSync(join(migrationsFolder, "meta", "_journal.json"))).toBe(
      true,
    );
  });

  it("creates workspaces on an empty database (R4)", async () => {
    await runMigrations(throwaway.url, migrationsFolder);
    expect(await tables(throwaway.url)).toContain("workspaces");
  });

  it("is safe to run twice and leaves the schema as it was (R5)", async () => {
    const before = await tables(throwaway.url);
    await runMigrations(throwaway.url, migrationsFolder);
    expect(await tables(throwaway.url)).toEqual(before);
  });

  it("stops on a broken migration and leaves the database as it was (R7)", async () => {
    const other = await createThrowawayDb();
    const folder = folderOf({
      "0000_valid": 'CREATE TABLE "valid_one" ("id" integer);',
      "0001_broken": 'CREATE TABLE "broken_one" ("id" not_a_type);',
    });
    try {
      const error = await runMigrations(other.url, folder).then(
        () => null,
        (e: unknown) => e as Error,
      );
      expect(error).not.toBeNull();
      const text = [error, (error as Error & { cause?: Error }).cause]
        .map((e) => e?.message ?? "")
        .join(" ");
      expect(text).toMatch(/not_a_type/);
      expect(await tables(other.url)).not.toContain("valid_one");
    } finally {
      rmSync(folder, { recursive: true });
      await other.drop();
    }
  });
});
