// STAND-IN for `api.request` of the shared client (TOKI-032), which is not on `main` yet. It has the
// shape `createSignInCalls` takes (`ApiRequest`): 10-second abort through `timers.after`, the kinds
// network / timeout / invalid_response, and one call of the 401 hook per refusal that carries one of
// the three session codes. Step 7 of docs/plans/TOKI-023.md deletes this file and passes the client's
// own request, with the line `api.setOnUnauthenticated(reportUnauthenticated)`.
import type { ApiRequest, ApiResult } from "@toki/client-core";
import type { Timers } from "./timers";

const BASE_URL = "/api/v1";
const TIMEOUT_MS = 10_000;
const SESSION_CODES = [
  "unauthenticated",
  "session_ended",
  "account_deactivated",
];

export type FetchApiOptions = {
  timers: Timers;
  /** Read when a request is sent; defaults to the global `fetch`. */
  fetchFn?: typeof fetch;
  onUnauthenticated?: (code: string) => void;
};

export function createFetchApi(options: FetchApiOptions): ApiRequest {
  const { timers, onUnauthenticated } = options;
  return async (path, init): Promise<ApiResult> => {
    const fetchFn = options.fetchFn ?? fetch;
    const controller = new AbortController();
    let timedOut = false;
    const cancel = timers.after(TIMEOUT_MS, () => {
      timedOut = true;
      controller.abort();
    });
    try {
      const hasBody = init.body !== undefined;
      let response: Response;
      try {
        response = await fetchFn(BASE_URL + path, {
          method: init.method,
          headers: hasBody ? { "content-type": "application/json" } : undefined,
          body: hasBody ? JSON.stringify(init.body) : undefined,
          credentials: "same-origin",
          signal: controller.signal,
        });
      } catch {
        return { ok: false, kind: timedOut ? "timeout" : "network" };
      }
      let text: string;
      try {
        text = await response.text();
      } catch {
        return { ok: false, kind: timedOut ? "timeout" : "network" };
      }
      if (response.ok) {
        if (response.status === 204 || text === "") {
          return { ok: true, status: response.status, data: undefined };
        }
        try {
          return { ok: true, status: response.status, data: JSON.parse(text) };
        } catch {
          return { ok: false, kind: "invalid_response" };
        }
      }
      let code: string | null = null;
      let details: unknown;
      try {
        const body: unknown = JSON.parse(text);
        const error =
          typeof body === "object" && body !== null
            ? (body as { error?: unknown }).error
            : undefined;
        if (typeof error === "object" && error !== null) {
          const e = error as { code?: unknown; details?: unknown };
          if (typeof e.code === "string") {
            code = e.code;
            details = e.details;
          }
        }
      } catch {
        // not the error body: no code
      }
      if (
        response.status === 401 &&
        code !== null &&
        SESSION_CODES.includes(code)
      ) {
        try {
          onUnauthenticated?.(code);
        } catch {
          // a hook that throws does not change what the caller receives
        }
      }
      const result: ApiResult = {
        ok: false,
        kind: "http",
        status: response.status,
        code,
      };
      return details === undefined ? result : { ...result, details };
    } finally {
      cancel();
    }
  };
}
