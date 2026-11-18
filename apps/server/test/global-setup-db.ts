import postgres from "postgres";
import type { TestProject } from "vitest/node";
import { migrationsFolder, runMigrations } from "../src/db/migrate.js";
import { checkTestDatabase } from "./guard.js";
import { readRootEnv } from "./root-env.js";

declare module "vitest" {
  export interface ProvidedContext {
    dbSetupError: string | null;
    testDatabaseName: string;
  }
}

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

// Guard, then drop and create the test database, then migrate it (R3, R5, R17).
// On a failure the message goes to the tests of this project, which fail with
// it: nothing is skipped, and the tests that need no database still run (R7).
export default async function setup(project: TestProject) {
  project.provide("dbSetupError", null);
  project.provide("testDatabaseName", "");
  const rootEnv = readRootEnv();
  try {
    const testUrl = process.env.TEST_DATABASE_URL;
    const { host, database } = checkTestDatabase({
      testUrl,
      developmentUrl: process.env.DATABASE_URL ?? rootEnv.DATABASE_URL,
      environments: [process.env.NODE_ENV, rootEnv.NODE_ENV],
    });
    project.provide("testDatabaseName", database);

    // Only after the guard: a connection to the maintenance database of the
    // same server, and two statements for the name that passed (R17).
    const maintenance = new URL(testUrl!);
    maintenance.pathname = "/postgres";
    const admin = postgres(maintenance.toString(), {
      max: 1,
      onnotice: () => {},
    });
    try {
      await admin.unsafe(
        `drop database if exists ${quote(database)} with (force)`,
      );
      await admin.unsafe(`create database ${quote(database)}`);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "error";
      const unreachable = ["ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(
        code,
      );
      throw new Error(
        unreachable
          ? `cannot reach the test database ${host}/${database} (${code})`
          : `the test database server at ${host} refused the request for ${database} (${code})`,
        { cause: error },
      );
    } finally {
      await admin.end({ timeout: 1 });
    }

    await runMigrations(testUrl!, migrationsFolder);
  } catch (error) {
    const message = (error as Error).message;
    console.error(`[test database] ${message}`);
    project.provide("dbSetupError", message);
  }
}
