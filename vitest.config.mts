import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    // Même alias que tsconfig.json ("@/*" -> racine du projet)
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
