import { systemClock, type Clock } from "@toki/shared";

// What the exported functions of this module need and the spec's signatures
// (R29, R30, R52) do not carry: the clock, the environment and the key of the code hash. registerAuth
// sets them when the app is built; the defaults are the system clock and
// production, the safe side (R21).
export const runtime: {
  clock: Clock;
  development: boolean;
  codeSecret: string;
} = {
  clock: systemClock,
  development: false,
  codeSecret: "",
};
