import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
