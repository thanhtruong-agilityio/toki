import "./fonts/fonts.css";
import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import "./app.css";
import "@toki/ui-web/utilities.css";
import { applyAppearance } from "@toki/ui-web";
import { setPlatform } from "@toki/platform";
import { createWebPlatform } from "@toki/platform/web";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { queryClient } from "./query-client";
import { router } from "./router";

// The web build of platform, chosen once before anything is mounted. The sound
// address is passed here by the ticket that adds the file (TOKI-075).
setPlatform(createWebPlatform());

// Look, accent and density of the device, before the app is mounted. TOKI-078
// calls the same function with the values saved to the account.
applyAppearance({ look: "device" });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
