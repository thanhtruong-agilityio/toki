import { describe, expect, it } from "vitest";
import { ErrorCodes } from "../../src/error.js";

describe("error registry (R17)", () => {
  it("has the codes of the channel API once each", () => {
    expect(ErrorCodes.channelNameTaken).toBe("channel_name_taken");
    expect(ErrorCodes.channelIdInUse).toBe("channel_id_in_use");
    expect(ErrorCodes.channelArchived).toBe("channel_archived");
    expect(ErrorCodes.channelIsGeneral).toBe("channel_is_general");
    expect(ErrorCodes.invalidMember).toBe("invalid_member");
    expect(ErrorCodes.selfTarget).toBe("self_target");
  });
  it("repeats no value and no key", () => {
    const values = Object.values(ErrorCodes);
    expect(new Set(values).size).toBe(values.length);
  });
  it("keeps every code in snake case", () => {
    for (const value of Object.values(ErrorCodes)) {
      expect(value).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});
