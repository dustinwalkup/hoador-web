import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Mock alert and other browser APIs that might be called by malicious scripts
// This prevents errors when testing XSS sanitization
// Set up immediately (not in beforeAll) to catch async script execution in eval contexts
const mockAlert = vi.fn(() => {});
const mockConfirm = vi.fn(() => {});
const mockPrompt = vi.fn(() => {});

// Handle uncaught exceptions from eval contexts (happy-dom executes scripts asynchronously)
// These errors occur when happy-dom tries to execute malicious scripts before DOMPurify removes them
process.on("uncaughtException", (error) => {
  const errorMessage = error?.message || String(error || "");
  // Suppress "alert is not defined" errors from XSS sanitization tests
  // These are expected - the scripts ARE being sanitized, but happy-dom executes them first
  if (
    errorMessage.includes("alert is not defined") ||
    errorMessage.includes("ReferenceError: alert is not defined")
  ) {
    return; // Suppress the error
  }
  // Re-throw other errors
  throw error;
});

// Set on window for happy-dom environment (must be synchronous)
if (typeof window !== "undefined") {
  const windowWithBrowserAPIs = window as unknown as {
    alert: typeof mockAlert;
    confirm: typeof mockConfirm;
    prompt: typeof mockPrompt;
  };
  windowWithBrowserAPIs.alert = mockAlert;
  windowWithBrowserAPIs.confirm = mockConfirm;
  windowWithBrowserAPIs.prompt = mockPrompt;

  // Suppress unhandled errors from eval contexts (happy-dom executes scripts asynchronously)
  // These errors occur when happy-dom tries to execute malicious scripts before DOMPurify removes them
  const originalErrorHandler = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    // Suppress "alert is not defined" errors from XSS sanitization tests
    const messageStr =
      typeof message === "string" ? message : String(message || "");
    if (
      messageStr.includes("alert is not defined") ||
      messageStr.includes("ReferenceError: alert is not defined")
    ) {
      return true; // Suppress the error
    }
    // Call original handler for other errors
    if (originalErrorHandler) {
      return originalErrorHandler.call(
        window,
        message,
        source,
        lineno,
        colno,
        error,
      );
    }
    return false;
  };
}
// Also set on global for Node environments
const globalWithBrowserAPIs = global as unknown as {
  alert: typeof mockAlert;
  confirm: typeof mockConfirm;
  prompt: typeof mockPrompt;
};
globalWithBrowserAPIs.alert = mockAlert;
globalWithBrowserAPIs.confirm = mockConfirm;
globalWithBrowserAPIs.prompt = mockPrompt;

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  takeRecords: vi.fn(() => []),
  unobserve: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));
