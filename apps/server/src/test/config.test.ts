import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ConfigError, configVariableNames, loadConfig } from "../config.js";

const valid = {
  NODE_ENV: "development",
  DATABASE_URL: "postgres://fake:fake@127.0.0.1:5432/fake",
};

function failure(env: Record<string, string | undefined>) {
  try {
    loadConfig(env, ["server", "database"]);
  } catch (error) {
    return error as ConfigError;
  }
  throw new Error("loadConfig did not throw");
}

describe("loadConfig", () => {
  it("reads valid values", () => {
    const config = loadConfig(
      {
        ...valid,
        SERVER_PORT: "4000",
        SERVER_HOST: "0.0.0.0",
        LOG_LEVEL: "debug",
      },
      ["server", "database"],
    );
    expect(config.server).toEqual({
      env: "development",
      port: 4000,
      host: "0.0.0.0",
      logLevel: "debug",
    });
    expect(config.database.url).toBe(valid.DATABASE_URL);
  });

  it("applies the defaults of R18 when nothing optional is set", () => {
    const { server } = loadConfig(valid, ["server"]);
    expect(server.host).toBe("127.0.0.1");
    expect(server.port).toBe(3000);
    expect(server.logLevel).toBe("info");
  });

  it("reports a missing required variable by name", () => {
    const env: Record<string, string | undefined> = { ...valid };
    delete env.NODE_ENV;
    expect(failure(env).names).toEqual(["NODE_ENV"]);
  });

  it("treats an empty and a whitespace-only value as missing", () => {
    expect(failure({ ...valid, NODE_ENV: "" }).names).toEqual(["NODE_ENV"]);
    expect(failure({ ...valid, DATABASE_URL: "   " }).names).toEqual([
      "DATABASE_URL",
    ]);
  });

  it("reports every failing variable in one run", () => {
    expect(failure({}).names.sort()).toEqual(["DATABASE_URL", "NODE_ENV"]);
  });

  it("names an invalid variable and never shows its value", () => {
    const secret = "not-a-port-9f3a";
    const error = failure({ ...valid, SERVER_PORT: secret });
    expect(error.names).toEqual(["SERVER_PORT"]);
    expect(error.message).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
  });

  it("loads only the areas asked for", () => {
    expect(() =>
      loadConfig({ DATABASE_URL: valid.DATABASE_URL }, ["database"]),
    ).not.toThrow();
    expect(() =>
      loadConfig({ NODE_ENV: "development" }, ["server"]),
    ).not.toThrow();
  });

  it("reads one database variable and no other (R19)", () => {
    expect(configVariableNames.database).toEqual(["DATABASE_URL"]);
  });
});

describe("configuration names and .env.example (R13)", () => {
  it("every name the schema reads is in .env.example", () => {
    const example = readFileSync(
      new URL("../../../../.env.example", import.meta.url),
      "utf8",
    );
    const listed = new Set(
      example
        .split("\n")
        .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
        .filter(Boolean),
    );
    for (const name of Object.values(configVariableNames).flat()) {
      expect(listed.has(name), name).toBe(true);
    }
  });
});
