import { systemClock, type Clock } from "@toki/shared";

// The web app's one system clock (TOKI-023 R45; TOKI-099 R15 uses the same file). Everything that
// needs the time takes this as a parameter; nothing else in apps/web reads the system time.
export const clock: Clock = { now: () => systemClock.now() };
