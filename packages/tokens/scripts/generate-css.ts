import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { toCss } from "../src/css";

// Writes src/tokens.css. Run: pnpm --filter @toki/tokens generate
const target = fileURLToPath(new URL("../src/tokens.css", import.meta.url));
writeFileSync(target, toCss());
console.log(`wrote ${target}`);
