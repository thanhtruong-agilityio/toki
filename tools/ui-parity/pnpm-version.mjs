import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The pnpm that the repository declares in `packageManager` ("pnpm@12.21.0", with a hash that
// corepack may add). The container installs this one, so that it follows the repository when it
// moves to another pnpm (TOKI-109).
export function pnpmVersion(packageManager) {
  if (!packageManager)
    throw new Error("package.json has no packageManager field");
  const match = /^pnpm@([0-9][0-9.]*)(?:\+.*)?$/.exec(packageManager);
  if (!match)
    throw new Error(`the packageManager field is not pnpm: ${packageManager}`);
  return match[1];
}

// The command line: prints the version of the package.json of the current folder.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    console.log(pnpmVersion(pkg.packageManager));
  } catch (error) {
    console.error(`parity: ${error.message}`);
    process.exit(1);
  }
}
