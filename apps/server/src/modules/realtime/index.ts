// The public surface of this module (TOKI-036 R24): the event log. No table and
// not appendEvent: code that changes data does not write events itself.
export type { EventInput, StoredEvent } from "./append.js";
export { recordEvent } from "./record.js";
