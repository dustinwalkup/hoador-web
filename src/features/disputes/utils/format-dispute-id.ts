/**
 * Format dispute reference number as DSP-XXXX
 * @param referenceNumber - The sequential reference number (may be null for unmigrated disputes)
 * @returns Formatted dispute ID (e.g., "DSP-0042") or fallback to "DSP-0000" if null
 */
export function formatDisputeId(referenceNumber: number | null): string {
  if (referenceNumber === null) {
    return "DSP-0000";
  }
  return `DSP-${String(referenceNumber).padStart(4, "0")}`;
}

/**
 * Format dispute identifier with optional tool name
 * @param referenceNumber - The sequential reference number (may be null for unmigrated disputes)
 * @param toolName - Optional tool/listing name
 * @returns Formatted dispute identifier (e.g., "DSP-0042: Power Drill")
 */
export function formatDisputeIdentifier(
  referenceNumber: number | null,
  toolName?: string,
): string {
  const id = formatDisputeId(referenceNumber);
  return toolName ? `${id}: ${toolName}` : id;
}
