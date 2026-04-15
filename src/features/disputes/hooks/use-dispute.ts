import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { DisputeWithRelations } from "@/dal/types";
import { disputeKeys } from "./use-disputes";

const disputeInternalNoteFromApiSchema = z.object({
  id: z.string(),
  disputeId: z.string(),
  adminId: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Coerces `internalNotes` timestamps from JSON strings to `Date` (fetch JSON has no Date type).
 *
 * @param json - Parsed response body from `GET /api/disputes/[id]`
 * @returns Same shape with `internalNotes` dates coerced when valid
 */
function parseDisputeJsonWithInternalNoteDates(
  json: unknown,
): DisputeWithRelations {
  if (typeof json !== "object" || json === null) {
    throw new Error("Invalid dispute response");
  }
  const body = json as Record<string, unknown>;
  const rawNotes = body.internalNotes;
  if (!Array.isArray(rawNotes)) {
    return json as DisputeWithRelations;
  }
  const parsed = z.array(disputeInternalNoteFromApiSchema).safeParse(rawNotes);
  return {
    ...body,
    internalNotes: parsed.success ? parsed.data : rawNotes,
  } as DisputeWithRelations;
}

/**
 * Hook for fetching a single dispute by ID
 * Accessible by renter, provider, or admin
 */
export function useDispute(disputeId: string | null) {
  return useQuery({
    queryKey: disputeKeys.detail(disputeId || ""),
    queryFn: async (): Promise<DisputeWithRelations> => {
      if (!disputeId) {
        throw new Error("Dispute ID is required");
      }

      const response = await fetch(`/api/disputes/${disputeId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch dispute");
      }

      const json: unknown = await response.json();
      return parseDisputeJsonWithInternalNoteDates(json);
    },
    enabled: !!disputeId,
    staleTime: 5 * 60 * 1000, // 5 minutes - dispute details change less frequently
    refetchOnWindowFocus: false,
  });
}
