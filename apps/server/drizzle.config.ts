import { defineConfig } from "drizzle-kit";

// Table files live inside their module; the migrations folder is committed whole.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/modules/*/schema.ts",
  out: "./migrations",
});
