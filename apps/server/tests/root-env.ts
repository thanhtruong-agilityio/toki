import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const rootEnv = new URL("../../../.env", import.meta.url);

// The values of the root .env file, or none when there is no file.
export function readRootEnv(): Record<string, string | undefined> {
  try {
    return parseEnv(readFileSync(rootEnv, "utf8"));
  } catch {
    return {};
  }
}

// Puts the root .env values into the process; a value already in the
// environment (CI) is kept.
export function loadRootEnv() {
  for (const [name, value] of Object.entries(readRootEnv())) {
    if (process.env[name] === undefined && value !== undefined) {
      process.env[name] = value;
    }
  }
}
