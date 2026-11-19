import { ErrorCodes } from "@toki/shared";
import { ZodError } from "zod";
import { AppError } from "../../errors.js";

// A failed query of Drizzle carries its parameters in the message, and the
// shared handler logs the error: a channel name, topic or id list would reach
// the log (TOKI-029 R20). A known error passes. A name that is taken
// (the unique key, or the check that only #general is named general)
// becomes 409 channel_name_taken. Any other failure becomes an error that
// holds the Postgres code and the constraint name and nothing else.
const NAME_TAKEN = new Set([
  "conversations_workspace_id_name_key",
  "conversations_general_name_check",
]);

type PostgresFailure = { code?: unknown; constraint_name?: unknown };

function postgresFailure(error: unknown): PostgresFailure | null {
  for (let e: unknown = error, depth = 0; e && depth < 4; depth += 1) {
    if (typeof e !== "object") return null;
    const failure = e as PostgresFailure;
    if (typeof failure.code === "string") return failure;
    e = (e as { cause?: unknown }).cause;
  }
  return null;
}

export function toSafeError(error: unknown): Error {
  if (error instanceof AppError || error instanceof ZodError) return error;
  const failure = postgresFailure(error);
  const code = typeof failure?.code === "string" ? failure.code : null;
  const constraint =
    typeof failure?.constraint_name === "string"
      ? failure.constraint_name
      : null;
  if (constraint && NAME_TAKEN.has(constraint)) {
    return new AppError(
      409,
      ErrorCodes.channelNameTaken,
      "A channel with this name already exists.",
    );
  }
  if (code) {
    return new Error(
      `The channel request failed (${code}${constraint ? `, ${constraint}` : ""}).`,
    );
  }
  const kind = error instanceof Error ? error.name : "error";
  return new Error(`The channel request failed (${kind}).`);
}
