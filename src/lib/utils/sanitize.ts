/**
 * Server-side sanitization utilities
 * Uses custom wrapper for dompurify with jsdom for Node.js compatibility
 */

import DOMPurify from "dompurify";
// @ts-expect-error - jsdom types may not be available, but it's a dev dependency
import { JSDOM } from "jsdom";
import type { Config } from "dompurify";

/**
 * Internal wrapper function that handles server/client-side DOMPurify initialization
 * @param dirty - The HTML string to sanitize
 * @param config - DOMPurify configuration options
 * @returns Sanitized HTML string
 */
function sanitize(dirty: string, config?: Config): string {
  if (typeof window === "undefined") {
    // Server-side: Create JSDOM window and initialize DOMPurify
    const { window: jsdomWindow } = new JSDOM("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const purify = DOMPurify(jsdomWindow as any);
    return purify.sanitize(dirty, config);
  }
  // Client-side: Use DOMPurify directly
  return DOMPurify.sanitize(dirty, config);
}

/**
 * Sanitizes HTML content by removing all HTML tags and attributes
 * @param html - The HTML string to sanitize
 * @returns Sanitized plain text string
 */
export function sanitizeHtml(html: string): string {
  const result = sanitize(html, {
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
 * Sanitizes text content by removing HTML and trimming whitespace
 * @param text - The text string to sanitize
 * @returns Sanitized plain text string
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }
  // Remove HTML tags and encode special characters
  return sanitizeHtml(text).trim();
}

/**
 * Sanitizes search query input
 * Removes HTML, limits length, and removes potentially dangerous characters
 * @param query - The search query string
 * @param maxLength - Maximum length allowed (default: 200)
 * @returns Sanitized search query string
 */
export function sanitizeSearchQuery(
  query: string,
  maxLength: number = 200,
): string {
  if (!query || typeof query !== "string") {
    return "";
  }
  // Remove HTML tags and encode special characters
  const sanitized = sanitizeText(query);
  // Limit length to prevent abuse
  return sanitized.slice(0, maxLength);
}

/**
 * Sanitizes a string with a maximum length constraint
 * @param text - The text string to sanitize
 * @param maxLength - Maximum length allowed
 * @returns Sanitized text string truncated to maxLength
 */
export function sanitizeTextWithMaxLength(
  text: string,
  maxLength: number,
): string {
  if (!text || typeof text !== "string") {
    return "";
  }
  const sanitized = sanitizeText(text);
  return sanitized.slice(0, maxLength);
}

/**
 * Validates and sanitizes message content
 * @param content - The message content
 * @param maxLength - Maximum length allowed (default: 5000)
 * @returns Sanitized message content
 * @throws Error if content is invalid or exceeds maxLength
 */
export function sanitizeMessageContent(
  content: string,
  maxLength: number = 5000,
): string {
  if (!content || typeof content !== "string") {
    throw new Error("Message content is required");
  }

  const sanitized = sanitizeText(content);

  if (!sanitized || sanitized.length === 0) {
    throw new Error("Message content cannot be empty");
  }

  if (sanitized.length > maxLength) {
    throw new Error(
      `Message content exceeds maximum length of ${maxLength} characters`,
    );
  }

  return sanitized;
}
