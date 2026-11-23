import { ErrorCodes } from "@toki/shared";
import { ApiError, classifyApiError } from "./deps";

export type AddResult =
  | { kind: "added" }
  // Offline: the explanation toast was shown, nothing was sent (R8).
  | { kind: "blocked" }
  // 400 `invalid_member`: a chosen person was deactivated since the list was read (R9).
  | { kind: "inactive" }
  // 409: the screen is stale, the channel is read again (R9).
  | { kind: "stale" }
  // 403 or 404: the person is no longer a member or allowed; the shared page of D-131 (R9).
  | { kind: "no_access"; error: unknown }
  // An aborted call or an ended session: nothing to say.
  | { kind: "silent" }
  | { kind: "failed" };

export type AddInput = {
  conversationId: string;
  userIds: readonly string[];
  ensureOnline: () => boolean;
  addMembers: (
    id: string,
    userIds: string[],
  ) => Promise<{ added: string[]; alreadyMembers: string[] }>;
};

// A plain function: it calls no hook. The dialog binds the arguments (R8).
export async function addPeople({
  conversationId,
  userIds,
  ensureOnline,
  addMembers,
}: AddInput): Promise<AddResult> {
  if (!ensureOnline()) return { kind: "blocked" };
  try {
    await addMembers(conversationId, [...userIds]);
    return { kind: "added" };
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.kind === "http" &&
      error.status === 400 &&
      error.code === ErrorCodes.invalidMember
    ) {
      return { kind: "inactive" };
    }
    switch (classifyApiError(error)) {
      case "fresh_copy":
        return { kind: "stale" };
      case "no_access":
        return { kind: "no_access", error };
      case "unauthenticated":
      case "ignore":
        return { kind: "silent" };
      default:
        return { kind: "failed" };
    }
  }
}
