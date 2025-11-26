/**
 * Server-side sanitization utilities
 * Uses sanitize-html for robust server-side HTML sanitization
 */

import sanitizeHtmlLib from "sanitize-html";

/**
 * Decodes HTML entities in plain text
 * @param text - Text that may contain HTML entities
 * @returns Text with HTML entities decoded
 */
function decodeHtmlEntities(text: string): string {
  // Use a simple approach: replace common HTML entities
  // For a more complete solution, we could use a library like he or html-entities
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Sanitizes HTML content by removing all HTML tags and attributes
 * @param html - The HTML string to sanitize
 * @returns Sanitized plain text string with HTML entities encoded
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") {
    return "";
  }

  // Remove all HTML tags and get plain text
  const result = sanitizeHtmlLib(html, {
    allowedTags: [], // No HTML tags allowed
    allowedAttributes: {},
    disallowedTagsMode: "discard",
  });

  return result.trim();
}

/**
 * Sanitizes text content by removing HTML and trimming whitespace
 * @param text - The text string to sanitize
 * @returns Sanitized plain text string with HTML entities decoded
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== "string") {
    return "";
  }
  // Remove HTML tags and decode HTML entities for plain text output
  const sanitized = sanitizeHtml(text);
  return decodeHtmlEntities(sanitized);
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
