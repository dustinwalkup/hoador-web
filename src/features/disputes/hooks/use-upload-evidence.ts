import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import { disputeKeys } from "./use-disputes";

export interface UploadEvidenceData {
  file?: File;
  text?: string;
}

/**
 * Hook for uploading evidence to a dispute
 * Supports both image file uploads and text evidence
 */
export function useUploadEvidence(disputeId: string) {
  return useCreateMutation({
    mutationFn: async (data: UploadEvidenceData) => {
      const formData = new FormData();

      if (data.file) {
        formData.append("file", data.file);
      } else if (data.text) {
        formData.append("text", data.text);
      } else {
        throw new Error("Either file or text content is required");
      }

      const response = await fetch(`/api/disputes/${disputeId}/evidence`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload evidence");
      }

      return response.json();
    },
    successMessage: "Evidence uploaded successfully",
    invalidateQueryKeys: [disputeKeys.detail(disputeId)],
  });
}
