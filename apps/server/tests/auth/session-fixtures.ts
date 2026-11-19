// Test-only: sessions made straight through the one creating function of
// TOKI-022, so a test can have many sessions for one person without asking for
// a code each time (the sign-in limits of TOKI-022 R4 would stop it).
import { createSession } from "../../src/modules/auth/index.js";
import type { Harness } from "./test-harness.js";

export const DAY = 86_400_000;

export async function makeSession(
  h: Harness,
  userId: string,
  options: {
    transport?: "cookie" | "token";
    userAgent?: string;
    idleMs?: number;
    endedAs?: "signed_out" | "revoked" | "replaced" | "deactivated";
  } = {},
): Promise<{ id: string; secret: string }> {
  const { id, secret } = await createSession(
    h.db,
    { id: userId, workspaceId: h.workspaceId, status: "active" },
    options.transport ?? "token",
    options.userAgent === undefined ? {} : { userAgent: options.userAgent },
  );
  if (options.idleMs !== undefined) {
    const at = new Date(h.clock.now() - options.idleMs);
    await h.sql`update sessions set last_used_at = ${at} where id = ${id}`;
  }
  if (options.endedAs) {
    await h.sql`update sessions set ended_at = ${new Date(h.clock.now())}, ended_reason = ${options.endedAs} where id = ${id}`;
  }
  return { id, secret };
}

export const bearer = (secret: string) => ({
  authorization: `Bearer ${secret}`,
});

export const UUID_NOT_IN_USE = "0190f6a0-0000-7000-8000-0000000000aa";
