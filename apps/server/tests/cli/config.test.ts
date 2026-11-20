import { describe, expect, it } from "vitest";
import { CliConfigError, readCliConfig } from "../../src/cli/config.js";

// Fake values only (TOKI-026 R22).
const base = {
  DATABASE_URL: "postgres://user:secret@127.0.0.1:5432/toki",
  APP_ORIGIN: "https://toki.example.com",
  NODE_ENV: "production",
};

const names = (env: Record<string, string | undefined>): string[] => {
  try {
    readCliConfig(env);
  } catch (error) {
    if (error instanceof CliConfigError) return error.names;
    throw error;
  }
  return [];
};

describe("readCliConfig (TOKI-026 R22)", () => {
  it("reads the three values it needs", () => {
    expect(readCliConfig(base)).toEqual({
      databaseUrl: base.DATABASE_URL,
      origin: "https://toki.example.com",
      production: true,
    });
  });

  it("is not stopped by an unrelated missing variable", () => {
    expect(names({ ...base })).toEqual([]);
    expect(
      names({ ...base, SMTP_HOST: undefined, FIRST_ADMIN_EMAIL: undefined }),
    ).toEqual([]);
  });

  it("names a missing or invalid database URL and never its value", () => {
    expect(names({ ...base, DATABASE_URL: undefined })).toEqual([
      "DATABASE_URL",
    ]);
    expect(names({ ...base, DATABASE_URL: "  " })).toEqual(["DATABASE_URL"]);
    expect(names({ ...base, DATABASE_URL: "not a url" })).toEqual([
      "DATABASE_URL",
    ]);
  });

  it("names a missing or invalid origin", () => {
    expect(names({ ...base, APP_ORIGIN: undefined })).toEqual(["APP_ORIGIN"]);
    expect(names({ ...base, APP_ORIGIN: "toki.example.com" })).toEqual([
      "APP_ORIGIN",
    ]);
    expect(names({ ...base, APP_ORIGIN: "ftp://toki.example.com" })).toEqual([
      "APP_ORIGIN",
    ]);
  });

  it("refuses an origin with a path, a query, a fragment or credentials", () => {
    for (const origin of [
      "https://toki.example.com/app",
      "https://toki.example.com/?x=1",
      "https://toki.example.com/#a",
      "https://user:pw@toki.example.com",
    ]) {
      expect(names({ ...base, APP_ORIGIN: origin }), origin).toEqual([
        "APP_ORIGIN",
      ]);
    }
  });

  it("accepts an origin the server accepts: an explicit default port or capital letters", () => {
    expect(
      readCliConfig({ ...base, APP_ORIGIN: "https://toki.example.com:443" })
        .origin,
    ).toBe("https://toki.example.com");
    expect(
      readCliConfig({ ...base, APP_ORIGIN: "HTTPS://Toki.Example.com/" })
        .origin,
    ).toBe("https://toki.example.com");
  });

  it("accepts a trailing slash and keeps the port", () => {
    expect(
      readCliConfig({ ...base, APP_ORIGIN: "https://toki.example.com:8443/" })
        .origin,
    ).toBe("https://toki.example.com:8443");
  });

  it("accepts http:// only when the environment name is exactly development", () => {
    const http = { ...base, APP_ORIGIN: "http://localhost:5173" };
    expect(names({ ...http, NODE_ENV: "development" })).toEqual([]);
    expect(readCliConfig({ ...http, NODE_ENV: "development" }).production).toBe(
      false,
    );
    for (const env of [
      "production",
      "staging",
      "Development",
      "devel",
      undefined,
    ]) {
      expect(names({ ...http, NODE_ENV: env }), String(env)).toEqual([
        "APP_ORIGIN",
      ]);
    }
  });

  it("counts a missing or unknown environment name as production and accepts https://", () => {
    expect(readCliConfig({ ...base, NODE_ENV: undefined }).production).toBe(
      true,
    );
    expect(readCliConfig({ ...base, NODE_ENV: "staging" }).production).toBe(
      true,
    );
  });

  it("puts no value in the error", () => {
    try {
      readCliConfig({ ...base, DATABASE_URL: "hunter2 is not a url" });
    } catch (error) {
      expect((error as Error).message).not.toContain("hunter2");
      return;
    }
    throw new Error("expected an error");
  });
});
