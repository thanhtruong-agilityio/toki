import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

// The web dev port is fixed: a stale or second process fails the start.
const WEB_PORT = 5173;
const DEFAULT_SERVER_PORT = "3000";

export default defineConfig(({ mode }) => {
  // The server port comes from the .env file at the repository root, the
  // same file the server uses. The empty prefix is needed because the
  // variable has no VITE_ prefix. The value stays in this config and never
  // reaches browser code.
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const env = loadEnv(mode, root, "");
  const target = `http://127.0.0.1:${env.SERVER_PORT || DEFAULT_SERVER_PORT}`;

  return {
    plugins: [react()],
    server: {
      port: WEB_PORT,
      strictPort: true,
      proxy: {
        "/api/v1": target,
        "/healthz": target,
      },
    },
  };
});
