// Application code takes a Clock as a parameter and never reads the system
// time itself (TOKI-008 R19). This file holds the one allowed reader.
export interface Clock {
  /** The current instant in epoch milliseconds. */
  now(): number;
}

export const systemClock: Clock = {
  now: () => Date.now(),
};
