/**
 * Escapes HTML special characters in a string to prevent XSS in email templates.
 *
 * An `&lt;` or `&gt;` already in the input is kept rather than escaped again:
 * stored user text keeps a typed `<` / `>` in that form (SEC-12 in
 * sanitize.ts), and escaping its `&` would show the reader "&lt;3" instead of
 * "<3" (UAT SEC-009). A raw `<` or `>` is always escaped, so no tag gets in.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&(?!(?:lt|gt);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
