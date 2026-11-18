// The one function that tells whether the connection is up (R17). TOKI-082 owns
// the state of the connection and calls `setConnectionCheck` with it; until then
// the default is the browser's own flag, which does not see a network that is up
// but cut off from the server.

type Check = () => boolean;

let check: Check | null = null;

export function setConnectionCheck(fn: Check | null): void {
  check = fn;
}

function defaultCheck(): boolean {
  return !(typeof navigator !== "undefined" && navigator.onLine === false);
}

// A check that throws never blocks the person.
export function isOnline(): boolean {
  try {
    return (check ?? defaultCheck)() !== false;
  } catch {
    return true;
  }
}
