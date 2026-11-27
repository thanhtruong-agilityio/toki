import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import "../../src/app.css";
import "@toki/ui-web/utilities.css";
import { applyAppearance } from "@toki/ui-web";
import { createRoot } from "react-dom/client";
import { appearanceFromAddress } from "./address";
import { Fixture } from "./Fixture";

// The shell fixture (TOKI-015 R32): a development-only page that draws the
// shell with made-up data, read from the address. It sets no storage and calls
// no network API. `?look=calm|focus|classic` and `?scheme=light|dark|device` are applied before the
// page is mounted (TOKI-143 R11).
const params = new URLSearchParams(window.location.search);
applyAppearance(appearanceFromAddress(params));

createRoot(document.getElementById("root")!).render(
  <Fixture params={params} />,
);
