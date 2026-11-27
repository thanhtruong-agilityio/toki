import type { ExpoConfig } from "expo/config";

// The app's names and identifiers (TOKI-146, R5). `dev.toki.mobile` is a
// placeholder used only by development builds; the final identifiers are
// chosen before the first store upload. No key or secret belongs here.
const config: ExpoConfig = {
  name: "Toki",
  slug: "toki",
  scheme: "toki",
  ios: { bundleIdentifier: "dev.toki.mobile" },
  android: { package: "dev.toki.mobile" },
  plugins: ["expo-router"],
};

export default config;
