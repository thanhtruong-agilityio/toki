import { afterEach, describe, expect, test, vi } from "vitest";
import { createNotifications } from "./notifications";

function fakeNotification(
  permission: NotificationPermission,
  request: () => Promise<NotificationPermission>,
) {
  const requestPermission = vi.fn(request);
  vi.stubGlobal("Notification", { permission, requestPermission });
  return requestPermission;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notifications.permission (R10)", () => {
  test("is unsupported when the browser has no Notification object", () => {
    vi.stubGlobal("Notification", undefined);
    expect(createNotifications().permission()).toBe("unsupported");
  });

  test.each(["default", "granted", "denied"] as const)(
    "returns the browser's own value %s",
    (value) => {
      fakeNotification(value, async () => value);
      expect(createNotifications().permission()).toBe(value);
    },
  );
});

describe("notifications.requestPermission (R11, R12)", () => {
  test("asks the browser and resolves with the answer", async () => {
    const request = fakeNotification("default", async () => "granted");
    await expect(createNotifications().requestPermission()).resolves.toBe(
      "granted",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("with no Notification object resolves unsupported and calls nothing", async () => {
    vi.stubGlobal("Notification", undefined);
    await expect(createNotifications().requestPermission()).resolves.toBe(
      "unsupported",
    );
  });

  test("a request that throws resolves with permission()", async () => {
    fakeNotification("denied", () => {
      throw new Error("no");
    });
    await expect(createNotifications().requestPermission()).resolves.toBe(
      "denied",
    );
  });

  test("a request that rejects resolves with permission()", async () => {
    fakeNotification("default", () => Promise.reject(new Error("no")));
    await expect(createNotifications().requestPermission()).resolves.toBe(
      "default",
    );
  });

  test("permission() never makes the browser ask", () => {
    const request = fakeNotification("default", async () => "granted");
    createNotifications().permission();
    expect(request).not.toHaveBeenCalled();
  });
});
