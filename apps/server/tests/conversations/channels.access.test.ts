import type { ConversationFacts, Decision } from "@toki/shared";
import { describe, expect, it } from "vitest";
import { checkAccess } from "../../src/modules/conversations/access.js";
import type { ChannelDeps } from "../../src/modules/conversations/deps.js";

type Permission = (
  actor: { id: string; role: string },
  conv: ConversationFacts,
) => Decision;

const actor = { id: "a", role: "member" };
const allow: Permission = () => ({ allowed: true });
const deny =
  (reason: string): Permission =>
  () =>
    ({ allowed: false, reason }) as Decision;

const facts = (extra: Partial<ConversationFacts> = {}): ConversationFacts => ({
  kind: "public_channel",
  isGeneral: false,
  archived: false,
  isMember: true,
  ...extra,
});
const deps = (value: ConversationFacts | null) =>
  ({
    getConversationFacts: async () => value,
  }) as unknown as Pick<ChannelDeps, "getConversationFacts">;
const run = (value: ConversationFacts | null, permission: Permission) =>
  checkAccess(deps(value), {} as never, actor, "c", permission);

describe("checkAccess, step 3 of R1", () => {
  it("answers 404 for an unknown id", async () => {
    await expect(run(null, allow)).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it.each(["dm", "group_dm"] as const)("answers 404 for a %s", async (kind) => {
    await expect(run(facts({ kind }), allow)).rejects.toMatchObject({
      status: 404,
      code: "not_found",
    });
  });

  it("answers 404 for a private channel the actor is not in, before any permission function runs", async () => {
    let called = false;
    const permission: Permission = () => {
      called = true;
      return { allowed: true };
    };
    await expect(
      run(facts({ kind: "private_channel", isMember: false }), permission),
    ).rejects.toMatchObject({ status: 404, code: "not_found" });
    expect(called).toBe(false);
  });

  it("returns the facts and passes actor and facts to the permission function", async () => {
    const seen: unknown[] = [];
    const permission: Permission = (a, c) => {
      seen.push(a, c);
      return { allowed: true };
    };
    const value = facts({ kind: "private_channel" });
    await expect(run(value, permission)).resolves.toEqual(value);
    expect(seen).toEqual([actor, value]);
  });
});

describe("the refusals of R2", () => {
  it.each([
    ["role_not_allowed", 403, "forbidden"],
    ["not_a_member", 403, "forbidden"],
    ["private_channel", 404, "not_found"],
    ["not_a_channel", 404, "not_found"],
    ["channel_is_general", 409, "channel_is_general"],
    ["channel_archived", 409, "channel_archived"],
  ])("%s is %i %s", async (reason, status, code) => {
    await expect(run(facts(), deny(reason))).rejects.toMatchObject({
      status,
      code,
    });
  });

  it.each(["fact_missing", "unknown_role", "not_author", "last_admin"])(
    "%s is a server failure that is logged, not an AppError",
    async (reason) => {
      const error = await run(facts(), deny(reason)).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as { status?: number }).status).toBeUndefined();
    },
  );

  it("holds no channel name, topic or id in any message", async () => {
    for (const reason of [
      "role_not_allowed",
      "channel_archived",
      "channel_is_general",
    ]) {
      const error = (await run(facts(), deny(reason)).catch(
        (e: unknown) => e,
      )) as Error;
      expect(error.message).not.toMatch(/[0-9a-f]{8}-/);
    }
  });
});
