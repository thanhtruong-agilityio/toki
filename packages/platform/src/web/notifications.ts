import type { NotificationPermissionState, Platform } from "../types";

// Reads the browser's value each time: it changes when the person answers.
function permission(): NotificationPermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function createNotifications(): Platform["notifications"] {
  return {
    permission,
    // The only call of this package that makes the browser show its prompt
    // (R11). The caller makes it from a press of 'Turn on' (journey F36).
    async requestPermission() {
      if (typeof Notification === "undefined") return "unsupported";
      try {
        const answer = await Notification.requestPermission();
        if (answer) return answer;
      } catch {
        // fall through: report the browser's current value
      }
      return permission();
    },
  };
}
