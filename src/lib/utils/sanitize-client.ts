/**
 * Client-side sanitization utilities
 * Uses DOMPurify for browser environments, falls back to regex for server-side
 */

/**
 * Checks if code is running in a browser environment
 */
function isBrowser(): boolean {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined"
  );
}

/**
 * Server-side sanitization using regex (safe fallback when DOMPurify is unavailable)
 * @param text - The text string to sanitize
 * @returns Sanitized plain text string
 */
function sanitizeServerSide(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Remove all HTML tags
  let sanitized = text.replace(/<[^>]*>/g, "");

  // Remove common event handler attributes that might be in attributes
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "");

  // Decode HTML entities for display
  sanitized = sanitized
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");

  return sanitized.trim();
}

/**
 * Lazy-loads DOMPurify only in browser environments
 * Uses a pattern that prevents Next.js from bundling on server-side
 */
let DOMPurifyCache: {
  sanitize: (dirty: string, config?: unknown) => string;
} | null = null;

function getDOMPurify(): {
  sanitize: (dirty: string, config?: unknown) => string;
} | null {
  if (!isBrowser()) {
    return null;
  }

  // Return cached instance if available
  if (DOMPurifyCache) {
    return DOMPurifyCache;
  }

  try {
    // Only attempt to load DOMPurify in browser environment
    // Direct require (not using variable) to avoid webpack warning
    // This won't execute on server-side due to isBrowser() check above
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const dompurify = require("dompurify");
    const instance = dompurify?.default || dompurify;

    if (instance && typeof instance.sanitize === "function") {
      DOMPurifyCache = instance;
      return instance;
    }
    return null;
  } catch {
    // DOMPurify not available, return null to use fallback
    return null;
  }
}

/**
 * Sanitizes text content for safe display
 * Removes all HTML tags and attributes
 * Uses DOMPurify in browser environments, regex fallback for server-side
 * @param text - The text string to sanitize
 * @returns Sanitized plain text string safe for display
 */
export function sanitizeForDisplay(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // If running on server-side, use regex-based sanitization
  if (!isBrowser()) {
    return sanitizeServerSide(text);
  }

  // Browser-side: try to use DOMPurify for robust sanitization
  const DOMPurify = getDOMPurify();
  if (DOMPurify && typeof DOMPurify.sanitize === "function") {
    try {
      const result = DOMPurify.sanitize(text, {
        ALLOWED_TAGS: [], // No HTML tags allowed
        ALLOWED_ATTR: [],
        FORBID_TAGS: ["script", "iframe", "object", "embed", "form"], // Explicitly forbid dangerous tags
        FORBID_ATTR: ["onerror", "onload", "onclick", "onfocus", "onmouseover"], // Explicitly forbid event handlers
      });

      // DOMPurify may return HTML string even with ALLOWED_TAGS: [] in some environments
      // Strip any remaining tags manually as a fallback to ensure complete sanitization
      return result.replace(/<[^>]*>/g, "");
    } catch {
      // Fallback to regex-based sanitization if DOMPurify fails
      return sanitizeServerSide(text);
    }
  }

  // Fallback to regex-based sanitization
  return sanitizeServerSide(text);
}

/**
 * Sanitizes text content and truncates to a maximum length
 * @param text - The text string to sanitize
 * @param maxLength - Maximum length allowed
 * @returns Sanitized text string truncated to maxLength
 */
export function sanitizeAndTruncate(text: string, maxLength: number): string {
  const sanitized = sanitizeForDisplay(text);
  return sanitized.slice(0, maxLength);
}
