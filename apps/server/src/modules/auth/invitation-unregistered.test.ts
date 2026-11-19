import { describe, expect, it } from "vitest";
import { checkInvitationCode, createInvitationCode } from "./index.js";

// No app is built in this file, so registerAuthHooks never ran: the code hash
// has no key yet. The calls refuse before they touch the client.
describe("the invitation functions before the module is registered", () => {
  it("throw instead of hashing with an empty key", async () => {
    const never = {} as never;
    await expect(
      createInvitationCode(never, { email: "a@example.com", secret: "s" }),
    ).rejects.toThrow(/not registered/);
    await expect(
      checkInvitationCode(never, { secret: "s", code: "123456" }),
    ).rejects.toThrow(/not registered/);
  });
});
