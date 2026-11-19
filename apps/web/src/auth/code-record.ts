import type { StorageArea } from "@toki/platform";

// The record of the code step, kept for the tab (R15, R35, "Code step state"). It holds the address,
// the requestId, the time of the answer to the latest accepted code request and the two numbers of that
// answer. The code itself is never kept.
export type CodeRecord = {
  address: string;
  requestId: string;
  /** `clock.now()` at the answer, in epoch milliseconds. */
  answeredAt: number;
  resendAfterSeconds: number;
  expiresInSeconds: number;
};

export const CODE_RECORD_KEY = "signIn.code";

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function readCodeRecord(tab: StorageArea): CodeRecord | null {
  const raw = tab.get(CODE_RECORD_KEY);
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v === "object" && v !== null) {
      const r = v as Record<string, unknown>;
      if (
        typeof r.address === "string" &&
        typeof r.requestId === "string" &&
        isNumber(r.answeredAt) &&
        isNumber(r.resendAfterSeconds) &&
        isNumber(r.expiresInSeconds)
      ) {
        return {
          address: r.address,
          requestId: r.requestId,
          answeredAt: r.answeredAt,
          resendAfterSeconds: r.resendAfterSeconds,
          expiresInSeconds: r.expiresInSeconds,
        };
      }
    }
  } catch {
    // not readable: treated as none
  }
  tab.remove(CODE_RECORD_KEY);
  return null;
}

export function writeCodeRecord(tab: StorageArea, record: CodeRecord): void {
  tab.set(CODE_RECORD_KEY, JSON.stringify(record));
}

export function removeCodeRecord(tab: StorageArea): void {
  tab.remove(CODE_RECORD_KEY);
}
