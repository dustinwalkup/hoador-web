/**
 * Client-side sanitization utilities
 * Uses DOMPurify for browser environments
 */

import DOMPurify from "dompurify";

/**
 * Sanitizes text content for safe display in the browser
 * Removes all HTML tags and attributes
 * @param text - The text string to sanitize
 * @returns Sanitized plain text string safe for display
 */
export function sanitizeForDisplay(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  const result = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [],
    FORBID_TAGS: ["script", "iframe", "object", "embed", "form"], // Explicitly forbid dangerous tags
    FORBID_ATTR: ["onerror", "onload", "onclick", "onfocus", "onmouseover"], // Explicitly forbid event handlers
  });
  
  // DOMPurify may return HTML string even with ALLOWED_TAGS: [] in some environments
  // Strip any remaining tags manually as a fallback to ensure complete sanitization
  return result.replace(/<[^>]*>/g, "");
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

