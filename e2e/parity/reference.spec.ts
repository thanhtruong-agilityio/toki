import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { captureReference, expandScreens } from "../support/parity";
import { loadScreens } from "./load-screens";

// `pnpm ui:reference <screen-id>... | --all [--update]` (R8): the reference images are made from
// the prototype, never from the app. This file does nothing in an ordinary run.
test.skip(
  process.env.PARITY_REFERENCE !== "1",
  "run through pnpm ui:reference",
);

const REFERENCE_DIR =
  process.env.PARITY_REFERENCE_DIR ??
  fileURLToPath(new URL("./reference", import.meta.url));
const ids = (process.env.PARITY_REFERENCE_IDS ?? "").split(",").filter(Boolean);
const all = ids.includes("all");
const update = process.env.PARITY_UPDATE === "1";

const decls = await loadScreens();
const wanted = all ? decls : decls.filter((decl) => ids.includes(decl.id));

// An id that no declaration has is a mistake of the person who typed it.
for (const id of all ? [] : ids) {
  if (decls.some((decl) => decl.id === id)) continue;
  test(`reference ${id}`, () => {
    throw new Error(`no screen with id ${id} under e2e/parity/screens/`);
  });
}

for (const { decl, look, width, name, run } of expandScreens(wanted)) {
  test(`reference ${name}`, async ({ page }) => {
    test.skip(!run, "needs seeded data: made by the ticket that runs it");
    const file = `${decl.id}-${look}-${width}-chromium-linux.png`;
    // An existing image is kept unless --update is given, and the run then fails (R8).
    if (existsSync(`${REFERENCE_DIR}/${file}`) && !update) {
      console.log(`kept e2e/parity/reference/${file}`);
      expect.soft(false, `${file} exists; use --update`).toBe(true);
      return;
    }
    const image = await captureReference(page, decl, look, width);
    mkdirSync(REFERENCE_DIR, { recursive: true });
    writeFileSync(`${REFERENCE_DIR}/${file}`, image);
    console.log(`wrote e2e/parity/reference/${file}`);
  });
}
