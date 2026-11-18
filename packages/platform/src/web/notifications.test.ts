import { afterEach, describe, expect, test, vi } from "vitest";
import { createWebPlatform } from "./index";
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

describe("only requestPermission makes the browser ask (R11)", () => {
  test("no other call of the package asks, and requestPermission asks once", async () => {
    const request = fakeNotification("default", async () => "granted");
    const platform = createWebPlatform({ sounds: { notification: "/x.mp3" } });
    platform.notifications.permission();
    platform.storage.device.set("a.b", "1");
    platform.storage.device.get("a.b");
    platform.storage.device.remove("a.b");
    platform.storage.device.clear();
    platform.storage.tab.set("a.b", "1");
    platform.storage.tab.clear();
    void platform.files.pick();
    document.querySelector("input")?.dispatchEvent(new Event("cancel"));
    await platform.sound.play("notification");
    expect(request).not.toHaveBeenCalled();
    await platform.notifications.requestPermission();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
