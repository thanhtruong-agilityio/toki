export const account = {
  menu: { label: "Your account menu" },
  signingOut: "Signing out…",
  entry: { signOut: "Sign out" },
  devices: {
    title: "Signed-in devices",
    thisDevice: "This device",
    lastUsed: "Last used {time}",
    row: {
      name: "{browser} · {device}",
      described: "{name} (last used {time})",
      position: "{description}, {n} of {count}",
    },
    kind: {
      desktop: "Desktop",
      phone: "Phone",
      tablet: "Tablet",
      unknown: "Unknown device",
    },
    browser: {
      chrome: "Chrome",
      edge: "Edge",
      safari: "Safari",
      firefox: "Firefox",
      otherBrowser: "Other browser",
      unknown: "Unknown browser",
    },
    signOut: "Sign out",
    signOutLabel: "Sign out {device}",
    signOutOthers: "Sign out all other devices",
    noOthers: "No other devices are signed in.",
    loading: "Loading devices",
    loadError: "Could not load the devices.",
    retry: "Try again",
    confirmOne: {
      title: "Sign out this device?",
      description: "It will need a new code to sign in again.",
    },
    confirmAll: {
      title: "Sign out all other devices?",
      description: {
        one: "{count} other device will be signed out. This device stays signed in.",
        other:
          "{count} other devices will be signed out. This device stays signed in.",
      },
      target: {
        one: "{count} other device",
        other: "{count} other devices",
      },
    },
  },
};
