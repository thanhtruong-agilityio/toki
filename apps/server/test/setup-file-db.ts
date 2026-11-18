import postgres from "postgres";
import { beforeAll, inject } from "vitest";

// Runs before each *.db.test.ts file: fails the file when the global setup
// failed (R7), checks that the connection reaches the test database (R5), and
// empties every table so each file starts empty (R6).
beforeAll(async () => {
  const failure = inject("dbSetupError");
  if (failure) throw new Error(failure);

  const sql = postgres(process.env.DATABASE_URL!, {
    max: 1,
    onnotice: () => {},
  });
  try {
    const [current] = await sql<{ name: string }[]>`
      select current_database() as name`;
    if (current?.name !== inject("testDatabaseName")) {
      throw new Error(
        `connected to '${current?.name}', not the test database: refusing to empty tables`,
      );
    }
    const tables = await sql<{ tablename: string }[]>`
      select tablename from pg_tables where schemaname = 'public'`;
    if (tables.length > 0) {
      const list = tables
        .map((t) => `"${t.tablename.replaceAll('"', '""')}"`)
        .join(", ");
      await sql.unsafe(`truncate ${list} restart identity cascade`);
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
});
