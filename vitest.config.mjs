/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    onConsoleLog(log) {
      if (log.includes("NotSupportedError")) return false;
      if (log.includes("non-boolean attribute `fill`")) return false;
    },
    onConsoleError(error) {
      // Suppress DOMException errors from XSS sanitization tests
      // These occur when happy-dom tries to fetch javascript: URLs before DOMPurify removes them
      if (
        error?.message?.includes("Failed to fetch from") &&
        error?.message?.includes("javascript:alert")
      ) {
        return false; // Suppress the error
      }
      if (
        error?.message?.includes('URL scheme "javascript" is not supported')
      ) {
        return false; // Suppress the error
      }
    },
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    env: {
      OPENCAGE_API_KEY: "test-dummy-api-key-for-vitest",
      RESEND_API_KEY: "test-dummy-resend-api-key",
    },
    // Note: Uncaught exceptions from XSS sanitization tests are handled in src/test/setup.ts
    // via process.on('uncaughtException'). These occur when happy-dom tries to execute
    // malicious scripts in eval contexts before DOMPurify removes them.
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      // thresholds: {
      //   global: {
      //     lines: 70,
      //   },
      //   "src/features/**": {
      //     lines: 80,
      //   },
      //   "src/components/**": {
      //     lines: 75,
      //   },
      //   "src/dal/**": {
      //     lines: 50,
      //   },
      // },
      exclude: [
        "node_modules/",
        "src/lib/utils/__tests__/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
        "src/db/**",
        "**/*.schema.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
