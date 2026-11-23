import { ErrorCodes } from "@toki/shared";
import { ApiError } from "../deps";

export type StartResult =
  | { kind: "started"; id: string }
  // The connection is down: the helper's toast explained, nothing was sent.
  | { kind: "blocked" }
  // 409 `person_deactivated`: the ids the server named, which the dialog drops from the chips.
  | { kind: "deactivated"; userIds: string[] }
  // 400 `group_too_large`: a safeguard, the screen sends no more than seven ids.
  | { kind: "tooLarge" }
  | { kind: "failed" };

export type StartInput = {
  ensureOnline: () => boolean;
  openDirect: (userIds: string[]) => Promise<{ id: string; created: boolean }>;
  onClose: () => void;
  onOpenConversation: (id: string) => void;
  userIds: readonly string[];
};

function namedIds(details: unknown): string[] {
  if (typeof details !== "object" || details === null) return [];
  const ids = (details as { userIds?: unknown }).userIds;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === "string")
    : [];
}

// The steps of R22 as a plain function: it calls no hook, so it does not depend on the dialog being
// mounted. The server decides between a direct message and a group; a 200 and a 201 are the same.
export async function startDirect({
  ensureOnline,
  openDirect,
  onClose,
  onOpenConversation,
  userIds,
}: StartInput): Promise<StartResult> {
  if (!ensureOnline()) return { kind: "blocked" };
  try {
    const { id } = await openDirect([...userIds]);
    onClose();
    onOpenConversation(id);
    return { kind: "started", id };
  } catch (error) {
    if (error instanceof ApiError && error.kind === "http") {
      if (error.status === 409 && error.code === ErrorCodes.personDeactivated) {
        return { kind: "deactivated", userIds: namedIds(error.details) };
      }
      if (error.status === 400 && error.code === ErrorCodes.groupTooLarge) {
        return { kind: "tooLarge" };
      }
    }
    return { kind: "failed" };
  }
}
