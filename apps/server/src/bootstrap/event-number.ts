import type { Tx } from "../db/client.js";

// The number of the last event of the log at the moment of the snapshot
// (TOKI-031 R11). There is no log yet, so it is 0, "no event", and nothing is
// read. TOKI-036 replaces the body so that it reads the last number with the
// transaction it is given; it owns the numbering and the two conditions of
// the spec (an event is written in the transaction of its change; no gap that
// an open transaction can still fill).
export async function readEventNumber(tx: Tx): Promise<number> {
  void tx; // read nothing until the log exists
  return 0;
}
