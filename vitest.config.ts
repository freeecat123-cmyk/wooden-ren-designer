import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, ".claude/**", ".tmp/**"],
    include: ["**/__tests__/**/*.test.ts", "**/*.test.ts"],
  },
});
