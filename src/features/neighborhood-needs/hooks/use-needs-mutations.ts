import { useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { NeighborhoodNeed } from "@/db/schemas/neighborhood-needs.schema";
import type {
  CreateNeedInput,
  UpdateNeedInput,
} from "@/features/neighborhood-needs/services/neighborhood-needs-service";
import { needsKeys } from "./use-needs";

export function useCreateNeed() {
  return useCreateMutation<NeighborhoodNeed, CreateNeedInput>({
    mutationFn: async (input) => {
      const response = await fetch("/api/needs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { error?: string }).error ?? "Failed to create need",
        );
      }
      return response.json();
    },
    invalidateQueryKeys: [needsKeys.feed()],
  });
}

export function useUpdateNeed() {
  const queryClient = useQueryClient();

  return useCreateMutation<
    NeighborhoodNeed,
    { id: string; input: UpdateNeedInput }
  >({
    mutationFn: async ({ id, input }) => {
      const response = await fetch(`/api/needs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { error?: string }).error ?? "Failed to update need",
        );
      }
      return response.json();
    },
    invalidateQueryKeys: [needsKeys.feed()],
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: needsKeys.detail(id) });
    },
  });
}

export function useCloseNeed() {
  const queryClient = useQueryClient();

  return useCreateMutation<NeighborhoodNeed, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/needs/${id}/close`, {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { error?: string }).error ?? "Failed to close need",
        );
      }
      return response.json();
    },
    invalidateQueryKeys: [needsKeys.feed()],
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: needsKeys.detail(id) });
    },
  });
}

export function useDeleteNeed() {
  const queryClient = useQueryClient();

  return useCreateMutation<{ success: true }, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/needs/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(
          (error as { error?: string }).error ?? "Failed to delete need",
        );
      }
      return response.json();
    },
    invalidateQueryKeys: [needsKeys.feed()],
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: needsKeys.detail(id) });
    },
  });
}
