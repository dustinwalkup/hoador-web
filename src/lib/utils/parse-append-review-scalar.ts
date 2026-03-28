export interface ParsedAppendReviewScalarChunk {
  /**
   * The label part stored by `appendReviewScalar`, e.g. "Rejection reason".
   */
  label?: string;
  /**
   * ISO timestamp stored in parentheses after the label.
   */
  timestamp?: string;
  /**
   * The free-form text provided by the user/admin.
   */
  message: string;
}

export interface ParsedAppendReviewScalarResult {
  chunks: ParsedAppendReviewScalarChunk[];
}

/**
 * Parse a blob produced by `appendReviewScalar` into per-entry chunks.
 *
 * The writer format is:
 * - chunks separated by `\n\n---\n`
 * - each chunk formatted as `${label} (${timestamp}): ${text}`
 *
 * Some legacy/edge cases may not match the pattern; those segments are
 * returned as a single chunk with `message` set to the raw segment.
 *
 * @param input - The stored append-only scalar blob.
 * @returns Parsed chunks (possibly empty).
 */
export function parseAppendReviewScalar(
  input: string | null | undefined,
): ParsedAppendReviewScalarResult {
  const text = input?.trim();
  if (!text) return { chunks: [] };

  // Primary separator matches the current DAL/service-layer writers.
  let segments = text.split(/\n\n---\n/);
  // Fallback for already-collapsed content or legacy storage.
  if (segments.length === 1) segments = text.split(/\s*---\s*/);

  const chunks: ParsedAppendReviewScalarChunk[] = segments
    .map((s) => s.trim())
    .filter(Boolean)
    .map((segment) => {
      // Label is a single-line hardcoded string; restrict to non-newline chars
      // so a multiline message body cannot be mistaken for part of the label.
      const match = segment.match(/^([^\n(]+?) \(([^)]+)\):\s*([\s\S]*)$/);

      if (!match) {
        return { message: segment };
      }

      const [, label, timestamp, messageRaw] = match;
      const message = messageRaw.trim();

      return {
        label: label.trim(),
        timestamp: timestamp.trim(),
        message,
      };
    });

  return { chunks };
}
