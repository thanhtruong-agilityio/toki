import { ErrorCodes } from "@toki/shared";
import { ApiError, classifyApiError } from "./deps";

// The body of R11 without the id.
export type CreateBody = {
  name: string;
  isPrivate: boolean;
  topic?: string;
  memberIds?: string[];
};

// The one attempt of an open dialog (R15), empty when it opens.
export type Attempt = { id: string; body: CreateBody } | null;
export type AttemptHolder = { current: Attempt };

export type FormValues = {
  name: string;
  isPrivate: boolean;
  // As typed: trimmed here.
  topic: string;
  memberIds: readonly string[];
};

export type SubmitResult =
  | { kind: "created"; id: string }
  | { kind: "blocked" }
  | { kind: "nameTaken" }
  | { kind: "invalidMember" }
  // An aborted call or a session that ended: nothing to say (R14).
  | { kind: "silent" }
  | { kind: "failed" };

function sameBody(a: CreateBody, b: CreateBody): boolean {
  return (
    a.name === b.name &&
    a.isPrivate === b.isPrivate &&
    a.topic === b.topic &&
    a.memberIds?.length === b.memberIds?.length &&
    (a.memberIds ?? []).every((id, i) => id === b.memberIds?.[i])
  );
}

// The id of the attempt when the whole form is unchanged, otherwise a new id
// that becomes the attempt (R15).
export function idFor(
  attempt: AttemptHolder,
  body: CreateBody,
  newId: () => string,
): string {
  if (attempt.current && sameBody(attempt.current.body, body)) {
    return attempt.current.id;
  }
  const id = newId();
  attempt.current = { id, body };
  return id;
}

export function buildBody(values: FormValues): CreateBody {
  const topic = values.topic.trim();
  return {
    name: values.name,
    isPrivate: values.isPrivate,
    ...(topic === "" ? {} : { topic }),
    ...(values.memberIds.length === 0
      ? {}
      : { memberIds: [...values.memberIds] }),
  };
}

export type SubmitInput = {
  ensureOnline: () => boolean;
  createChannel: (
    body: CreateBody & { id: string },
  ) => Promise<{ id: string; created: boolean }>;
  newId: () => string;
  values: FormValues;
  attempt: AttemptHolder;
};

// A plain function: it calls no hook. The dialog binds the arguments (R11).
export async function submitCreateChannel({
  ensureOnline,
  createChannel,
  newId,
  values,
  attempt,
}: SubmitInput): Promise<SubmitResult> {
  if (!ensureOnline()) return { kind: "blocked" };
  const body = buildBody(values);
  const id = idFor(attempt, body, newId);
  try {
    const answer = await createChannel({ id, ...body });
    return { kind: "created", id: answer.id };
  } catch (error) {
    if (error instanceof ApiError && error.kind === "http") {
      if (error.status === 409 && error.code === ErrorCodes.channelNameTaken)
        return { kind: "nameTaken" };
      if (error.status === 400 && error.code === ErrorCodes.invalidMember)
        return { kind: "invalidMember" };
      if (error.status === 409 && error.code === ErrorCodes.channelIdInUse) {
        attempt.current = null;
        return { kind: "failed" };
      }
    }
    const screen = classifyApiError(error);
    return screen === "unauthenticated" || screen === "ignore"
      ? { kind: "silent" }
      : { kind: "failed" };
  }
}
