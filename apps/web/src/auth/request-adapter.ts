import {
  ApiError,
  anyAnswer,
  type ApiClient,
  type ApiRequest,
  type ApiResult,
} from "@toki/client-core";

// The request the sign-in and emergency calls take (`ApiRequest`) made from the
// shared client (TOKI-032 R25): one request layer, one 10-second rule and one
// report of every 401 for the whole app. The calls read their own answers with
// the shared schemas, so the client passes the body through as it is. It never
// rejects: whatever the client ends with becomes one of the results the calls
// map to what the screens show.
export function toApiRequest(
  api: Pick<ApiClient, "requestWithStatus">,
): ApiRequest {
  return async (path, init): Promise<ApiResult> => {
    try {
      const { status, data } = await api.requestWithStatus({
        method: init.method,
        path,
        body: init.body,
        schema: anyAnswer,
      });
      return { ok: true, status, data };
    } catch (error) {
      if (!(error instanceof ApiError)) return { ok: false, kind: "network" };
      if (error.kind === "http") {
        const result: ApiResult = {
          ok: false,
          kind: "http",
          status: error.status ?? 0,
          code: error.code,
        };
        return error.details === null
          ? result
          : { ...result, details: error.details };
      }
      if (error.kind === "invalid_response") {
        return { ok: false, kind: "invalid_response" };
      }
      return {
        ok: false,
        kind: error.kind === "timeout" ? "timeout" : "network",
      };
    }
  };
}
