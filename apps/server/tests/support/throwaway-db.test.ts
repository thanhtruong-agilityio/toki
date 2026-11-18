import { describe, expect, it } from "vitest";
import { createThrowawayDb } from "./throwaway-db.js";

describe("createThrowawayDb", () => {
  it("refuses a host that is not loopback before any statement (R13)", async () => {
    await expect(
      createThrowawayDb("postgres://fake:fake@db.example.com:5432/fake"),
    ).rejects.toThrow(/not a loopback address/);
  });

  it("fails, not skips, when the variable is unset (R13)", async () => {
    await expect(createThrowawayDb("")).rejects.toThrow(
      /TEST_DATABASE_URL is not set/,
    );
  });
});
