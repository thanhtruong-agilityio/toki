import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ScreenDecl } from "../support/parity";

const SCREENS_DIR = fileURLToPath(new URL("./screens/", import.meta.url));

// R5: every file under `screens/` exports one or more declarations; a file added there is picked
// up with no other edit.
export async function loadScreens(): Promise<ScreenDecl[]> {
  const files = existsSync(SCREENS_DIR)
    ? readdirSync(SCREENS_DIR)
        .filter((file) => file.endsWith(".ts"))
        .sort()
    : [];
  const modules = await Promise.all(
    files.map((file) => import(`./screens/${file}`)),
  );
  return modules.flatMap((module) => Object.values(module) as ScreenDecl[]);
}
