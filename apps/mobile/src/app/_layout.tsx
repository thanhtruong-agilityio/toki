import { Stack } from "expo-router";

// The root of Expo Router: a stack with the one screen (TOKI-146, R6).
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
