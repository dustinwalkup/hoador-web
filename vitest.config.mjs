/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["e2e/**", "**/node_modules/**"],
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
    // Explicit pool configuration to prevent worker crashes
    pool: "threads",
    singleThread: false,
    isolate: true,
    // Limit concurrent workers to prevent memory exhaustion
    maxWorkers: 4,
    minWorkers: 1,
    // Increase test timeout for slower tests
    testTimeout: 10000,
    // Note: Uncaught exceptions from XSS sanitization tests are handled in src/test/setup.ts
    // via process.on('uncaughtException'). These occur when happy-dom tries to execute
    // malicious scripts in eval contexts before DOMPurify removes them.
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      all: true, // include files even if never imported by tests
      include: ["src/**/*.{ts,tsx}"], // include all TypeScript files for coverage
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
        "src/test/",
        "src/**/__tests__/**",
        "src/**/*.test.{ts,tsx}",
        "src/**/*.spec.{ts,tsx}",
        "**/*.d.ts",
        "**/*.config.*",
        "src/db/**",
        "**/*.schema.ts",
        "src/app/**/*.tsx", // Next.js page files - just wrappers
        "src/app/**/*.ts", // layouts, loading, not-found files
        "src/components/ui/**", // shadcn primitives, not your logic
        "src/services/better-auth/**", // third-party auth config
        "src/instrumentation*.ts", // observability setup
        "src/proxy.ts", // infra config
        "src/**/index.ts", // barrel files, no logic
        "src/**/*.schema.ts",
        "src/**/*.types.ts",
        "src/**/types.ts",
        "src/**/*.d.ts",
        "src/**/*.config.*",
        "src/db/**",
        "src/test/",
        "src/lib/sentry/**", // observability glue
        "src/services/vercel-blob/**", // thin SDK wrapper
        "src/services/resend/**", // thin SDK wrapper
        "src/app/api/test*/**", // test/dev routes
        "src/app/test*/**",
        "src/**/mock-*.ts", // mock data files
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
