import { describe, expect, it } from "vitest";
import { GuardError, checkTestDatabase } from "./guard.js";

const dev = "postgres://toki:secret@127.0.0.1:5432/toki";
const valid = "postgres://toki:secret@127.0.0.1:5432/toki_test";

function refusedWith(input: Parameters<typeof checkTestDatabase>[0]) {
  try {
    checkTestDatabase(input);
  } catch (error) {
    expect(error).toBeInstanceOf(GuardError);
    return (error as GuardError).check;
  }
  throw new Error("the guard did not refuse");
}

describe("checkTestDatabase (R5)", () => {
  it("passes a valid test value and returns host and name only", () => {
    expect(
      checkTestDatabase({
        testUrl: valid,
        developmentUrl: dev,
        environments: ["development"],
      }),
    ).toEqual({ host: "127.0.0.1", database: "toki_test" });
  });

  it("passes with no development value (CI)", () => {
    expect(() =>
      checkTestDatabase({ testUrl: valid, environments: [] }),
    ).not.toThrow();
  });

  it("refuses a missing value", () => {
    expect(refusedWith({ testUrl: undefined, environments: [] })).toBe("set");
    expect(refusedWith({ testUrl: "  ", environments: [] })).toBe("set");
  });

  it("refuses a value that is not a URL", () => {
    expect(refusedWith({ testUrl: "not a url", environments: [] })).toBe(
      "valid",
    );
  });

  it("refuses a non-loopback host", () => {
    expect(
      refusedWith({
        testUrl: "postgres://u:p@db.example.com:5432/toki_test",
        environments: [],
      }),
    ).toBe("loopback");
  });

  it("refuses a name without the _test suffix", () => {
    expect(
      refusedWith({
        testUrl: "postgres://toki:secret@127.0.0.1:5432/toki",
        environments: [],
      }),
    ).toBe("suffix");
  });

  it("refuses the development database reached through localhost", () => {
    expect(
      refusedWith({
        testUrl: "postgres://toki:secret@localhost:5432/toki_dev_test",
        developmentUrl: "postgres://toki:secret@127.0.0.1:5432/toki_dev_test",
        environments: [],
      }),
    ).toBe("development");
  });

  it("refuses the development value with ?sslmode=disable added", () => {
    expect(
      refusedWith({
        testUrl: `${dev}?sslmode=disable`,
        developmentUrl: dev,
        environments: [],
      }),
    ).toBe("suffix");
    const devTest = "postgres://toki:secret@127.0.0.1:5432/app_test";
    expect(
      refusedWith({
        testUrl: `${devTest}?sslmode=disable`,
        developmentUrl: devTest,
        environments: [],
      }),
    ).toBe("development");
  });

  it("refuses when the environment name is production in any source", () => {
    expect(
      refusedWith({
        testUrl: valid,
        environments: ["development", "production"],
      }),
    ).toBe("environment");
  });

  it("never prints a user or password", () => {
    try {
      checkTestDatabase({
        testUrl: "postgres://bob:hunter2@db.example.com/x_test",
        environments: [],
      });
    } catch (error) {
      expect((error as Error).message).not.toMatch(/bob|hunter2/);
    }
  });
});
