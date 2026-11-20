// Test-only: a printed link for a member, made by the function the command calls, so the route tests
// start from the same row the command writes (TOKI-026).
import { issueEmergencyLink } from "../../src/modules/auth/emergency.js";
import type { Harness } from "./test-harness.js";

export const URL_USE = "/api/v1/auth/emergency-sessions";

export async function printLink(h: Harness, userId: string) {
  const issued = await issueEmergencyLink(
    h.db,
    { id: userId, workspaceId: h.workspaceId },
    new Date(h.clock.now()),
  );
  if (issued === "concurrent") throw new Error("unexpected concurrent issue");
  return issued;
}

export const useLink = (
  h: Harness,
  token: string,
  extra: {
    transport?: "cookie" | "token";
    headers?: Record<string, string>;
    remoteAddress?: string;
  } = {},
) =>
  h.call({
    method: "POST",
    url: URL_USE,
    payload: extra.transport
      ? { token, transport: extra.transport }
      : { token },
    headers: extra.headers ?? {},
    ...(extra.remoteAddress ? { remoteAddress: extra.remoteAddress } : {}),
  });

// A string of 43 characters that decodes to the same 32 bytes as `token` but is not `token`: the last
// character of a base64url string of 32 bytes carries 4 bits of data and 2 bits that are ignored.
export function sameBytesOtherText(token: string): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const last = alphabet.indexOf(token.at(-1)!);
  return token.slice(0, -1) + alphabet[last ^ 1];
}
