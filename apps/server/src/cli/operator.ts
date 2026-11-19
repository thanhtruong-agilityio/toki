import os from "node:os";

// The name of the operating-system user that ran the command, for the log line (TOKI-026 R35).
// `os.userInfo()` throws when the user id has no passwd entry, as in a container run with
// `docker exec --user <uid>`: the one place the command is meant to run, so it falls back to the
// environment, then the user id, and never fails.
export function operatorName(
  deps: {
    userInfo?: () => { username: string };
    env?: Record<string, string | undefined>;
    uid?: () => number;
  } = {},
): string {
  const userInfo = deps.userInfo ?? (() => os.userInfo());
  const env = deps.env ?? process.env;
  try {
    const name = userInfo().username;
    if (name) return name;
  } catch {
    // No passwd entry: try the environment.
  }
  const named = env.USER || env.LOGNAME;
  if (named) return named;
  try {
    return `uid:${(deps.uid ?? (() => process.getuid!()))()}`;
  } catch {
    return "unknown";
  }
}
