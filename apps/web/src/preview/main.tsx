import "@toki/tokens/tokens.css";
import "@toki/ui-web/base.css";
import "./preview.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyControls, readControls } from "./controls";
import { PreviewPage } from "./PreviewPage";

// The attributes are set before the first render, from the address.
applyControls(document.documentElement, readControls(window.location.search));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PreviewPage />
  </StrictMode>,
);
