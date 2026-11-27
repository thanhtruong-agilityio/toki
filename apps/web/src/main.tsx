import "../assets/fonts/fonts.css";
import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import "./app.css";
import "@toki/ui-web/utilities.css";
// The first import that is not a style sheet: it takes the token of a Join link from the address before
// anything else loads (TOKI-097 R26). The router reads the address when its module loads, so nothing
// may come between the style sheets and this line.
import "./join/capture-on-load";
import { applyAppearance } from "@toki/ui-web";
import { setPlatform } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppProviders } from "./app-providers";
import { router } from "./router";

// The web build of platform, chosen once before anything is mounted. The sound
// address is passed here by the ticket that adds the file (TOKI-075).
setPlatform(createWebPlatform());

// The default look and scheme, before the app is mounted: Calm, in the scheme of the device.
// TOKI-078 calls the same function with the values saved to the account (TOKI-143 R7).
applyAppearance({ look: "calm", scheme: "device" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
