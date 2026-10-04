import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
    },
  },
  test: {
    environment: "node",
    exclude: ["tests/integration/**", "tests/e2e/**", "node_modules/**"],
    include: ["src/**/*.test.ts"],
  },
});
