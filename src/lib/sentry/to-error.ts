export function toError(
  value: unknown,
  fallbackMessage = "Unknown error",
): Error {
  if (value instanceof Error) return value;

  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const message =
      (typeof obj.message === "string" && obj.message) ||
      (typeof obj.statusText === "string" && typeof obj.status === "number"
        ? `HTTP ${obj.status} ${obj.statusText}`
        : undefined) ||
      fallbackMessage;
    return new Error(message, { cause: value });
  }

  if (typeof value === "string") return new Error(value);

  return new Error(fallbackMessage, { cause: value });
}
