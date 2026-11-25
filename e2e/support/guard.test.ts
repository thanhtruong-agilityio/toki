import { describe, expect, it } from "vitest";
import { assertInContainer } from "./guard";

describe("assertInContainer", () => {
  it("throws outside the container", () => {
    expect(() => assertInContainer({})).toThrow(/Playwright container/);
  });

  it("names the command to run instead", () => {
    expect(() => assertInContainer({ TOKI_PARITY_CONTAINER: "0" })).toThrow(
      /pnpm test:e2e:parity/,
    );
  });

  it("passes inside the container", () => {
    expect(() =>
      assertInContainer({ TOKI_PARITY_CONTAINER: "1" }),
    ).not.toThrow();
  });
});
