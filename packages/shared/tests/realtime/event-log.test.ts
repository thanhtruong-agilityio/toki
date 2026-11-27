import { describe, expect, it } from "vitest";
import {
  EVENT_PRUNE_INTERVAL_MS,
  EVENT_RETENTION_DAYS,
  EVENT_SCOPES,
} from "../../src/index.js";

describe("the shared values of the event log (TOKI-036 R22)", () => {
  it("exports the three scopes", () => {
    expect(EVENT_SCOPES).toEqual(["workspace", "conversation", "user"]);
  });

  it("keeps events 7 days and prunes every hour", () => {
    expect(EVENT_RETENTION_DAYS).toBe(7);
    expect(EVENT_PRUNE_INTERVAL_MS).toBe(3_600_000);
  });
});
