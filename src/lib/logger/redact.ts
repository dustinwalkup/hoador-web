/**
 * Sensitive keys that must never appear in logs (LOG-PRIV-001 through LOG-PRIV-004).
 * Used to redact metadata before logging and to configure Pino's redact option.
 */
export const SENSITIVE_KEYS = [
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "api_key",
  "secret",
  "authorization",
  "cookie",
  "cookieHeader",
  "card",
  "cardNumber",
  "card_number",
  "cvv",
  "cvc",
  "creditCard",
  "credit_card",
  "paymentMethod",
  "payment_method",
  "stripeToken",
  "stripe_token",
  "ssn",
  "socialSecurityNumber",
] as const;

const SENSITIVE_KEYS_SET = new Set<string>(
  SENSITIVE_KEYS.map((k) => k.toLowerCase()),
);

const REDACTED_VALUE = "[REDACTED]";

/**
 * Redacts sensitive keys from a metadata object. Returns a new object with
 * matching keys (case-insensitive) replaced by [REDACTED]. Nested objects
 * are shallow-checked by key only (one level deep).
 *
 * @param obj - Metadata object that may contain sensitive fields
 * @returns New object safe for logging; never mutates input
 */
export function redactMetadata<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  if (obj === null || typeof obj !== "object") {
    return obj as Record<string, unknown>;
  }

  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();

    if (SENSITIVE_KEYS_SET.has(keyLower)) {
      out[key] = REDACTED_VALUE;
      continue;
    }

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redactMetadata(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }

  return out;
}

/**
 * Pino redact paths for the base logger. Covers common key names at any depth.
 */
export const PINO_REDACT_PATHS = SENSITIVE_KEYS.flatMap((key) => [
  key,
  `*.${key}`,
  `*.*.${key}`,
]);
