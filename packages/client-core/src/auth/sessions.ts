import {
  BROWSERS,
  DEVICE_KINDS,
  type Browser,
  type DeviceKind,
  type SessionItem,
} from "@toki/shared";
import { z } from "zod";
import type { ApiClient } from "../api/client";

// The calls of the session routes (TOKI-022 R28, TOKI-026 R1 to R16), all
// through the client of TOKI-032: its credentials, its 10-second rule and its
// errors, and no text of its own.

// The codes are read as strings, not as the shared enums: a browser added to
// the server's list later is a compatible change (TOKI-026 R6), and an enum
// would turn it into "invalid_response" on every read. A value that is not in
// the lists becomes `unknown`, so the list that `list()` returns always holds
// codes of TOKI-026 R6.
const RowSchema = z.object({
  id: z.string(),
  current: z.boolean(),
  deviceKind: z.string(),
  browser: z.string(),
  lastUsedAt: z.string(),
});
const ListSchema = z.object({ sessions: z.array(RowSchema) });

function code<T extends string>(
  list: readonly T[],
  value: string,
): T | "unknown" {
  return (list as readonly string[]).includes(value) ? (value as T) : "unknown";
}

export type SessionsApi = {
  list(): Promise<SessionItem[]>;
  endOne(id: string): Promise<void>;
  endOthers(): Promise<void>;
  signOut(): Promise<void>;
};

export function createSessionsApi(api: ApiClient): SessionsApi {
  // 204 with no body: `undefined` is what the client returns for it.
  const remove = async (path: string): Promise<void> => {
    await api.request({ method: "DELETE", path, schema: z.undefined() });
  };
  return {
    async list() {
      const { sessions } = await api.request({
        method: "GET",
        path: "/auth/sessions",
        schema: ListSchema,
      });
      return sessions.map((row) => ({
        id: row.id,
        current: row.current,
        deviceKind: code<DeviceKind>(DEVICE_KINDS, row.deviceKind),
        browser: code<Browser>(BROWSERS, row.browser),
        lastUsedAt: row.lastUsedAt,
      }));
    },
    endOne: (id) => remove(`/auth/sessions/${encodeURIComponent(id)}`),
    endOthers: () => remove("/auth/sessions"),
    signOut: () => remove("/auth/session"),
  };
}
