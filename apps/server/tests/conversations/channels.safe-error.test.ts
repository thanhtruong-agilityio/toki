import { describe, expect, it } from "vitest";
import { ZodError, z } from "zod";
import { AppError } from "../../src/errors.js";
import { toSafeError } from "../../src/modules/conversations/safe-error.js";

// Drizzle wraps a failure in an error whose message holds the query and its
// parameters; the Postgres error with the code and the constraint is its cause.
const drizzleFailure = (code: string, constraint: string | undefined) =>
  Object.assign(
    new Error(
      'Failed query: insert into "conversations" values ($1)\nparams: secret-launch-plan',
    ),
    {
      name: "DrizzleQueryError",
      cause: Object.assign(
        new Error("duplicate key value (secret-launch-plan)"),
        {
          code,
          constraint_name: constraint,
        },
      ),
    },
  );

describe("toSafeError (R20)", () => {
  it("lets an AppError and a ZodError through as they are", () => {
    const app = new AppError(409, "channel_archived", "x");
    expect(toSafeError(app)).toBe(app);
    const zod = (() => {
      try {
        z.string().parse(1);
      } catch (e) {
        return e as ZodError;
      }
      throw new Error("unreachable");
    })();
    expect(toSafeError(zod)).toBe(zod);
  });

  it.each([
    ["23505", "conversations_workspace_id_name_key"],
    ["23514", "conversations_general_name_check"],
  ])("maps %s on %s to 409 channel_name_taken", (code, constraint) => {
    expect(toSafeError(drizzleFailure(code, constraint))).toMatchObject({
      status: 409,
      code: "channel_name_taken",
    });
  });

  it("keeps the Postgres code and the constraint name and nothing else of another failure", () => {
    const safe = toSafeError(
      drizzleFailure("23514", "conversations_topic_check"),
    );
    expect(safe).not.toBeInstanceOf(AppError);
    expect(safe.message).toContain("23514");
    expect(safe.message).toContain("conversations_topic_check");
    expect(safe.message).not.toContain("secret-launch-plan");
    expect(safe.message).not.toContain("insert into");
    expect((safe as { cause?: unknown }).cause).toBeUndefined();
  });

  it("names only the kind of an error that has no Postgres cause", () => {
    const safe = toSafeError(
      Object.assign(new Error("secret-launch-plan"), { name: "TypeError" }),
    );
    expect(safe.message).toContain("TypeError");
    expect(safe.message).not.toContain("secret-launch-plan");
    expect(toSafeError("secret-launch-plan").message).not.toContain(
      "secret-launch-plan",
    );
  });
});
