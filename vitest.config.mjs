/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      OPENCAGE_API_KEY: "test-dummy-api-key-for-vitest",
    },
    // Note: Uncaught exceptions from XSS sanitization tests are handled in src/test/setup.ts
    // via process.on('uncaughtException'). These occur when happy-dom tries to execute
    // malicious scripts in eval contexts before DOMPurify removes them.
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/lib/utils/__tests__/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
