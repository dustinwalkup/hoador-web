import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { disputeKeys } from "./use-disputes";

/**
 * Hook for creating an internal note (admin only)
 */
export function useCreateInternalNote(disputeId: string) {
  return useCreateMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/disputes/${disputeId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create note");
      }

      return response.json();
    },
    successMessage: "Note created successfully",
    invalidateQueryKeys: [disputeKeys.detail(disputeId)],
  });
}

/**
 * Hook for updating an internal note (admin only)
 */
export function useUpdateInternalNote(disputeId: string) {
  return useCreateMutation({
    mutationFn: async ({
      noteId,
      content,
    }: {
      noteId: string;
      content: string;
    }) => {
      const response = await fetch(`/api/disputes/${disputeId}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, content }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update note");
      }

      return response.json();
    },
    successMessage: "Note updated successfully",
    invalidateQueryKeys: [disputeKeys.detail(disputeId)],
  });
}

/**
 * Hook for deleting an internal note (admin only)
 */
export function useDeleteInternalNote(disputeId: string) {
  return useCreateMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/disputes/${disputeId}/notes`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete note");
      }

      return response.json();
    },
    successMessage: "Note deleted successfully",
    invalidateQueryKeys: [disputeKeys.detail(disputeId)],
  });
}
