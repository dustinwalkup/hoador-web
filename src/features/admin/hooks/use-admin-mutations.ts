import { useCreateMutation } from "@/lib/react-query/mutation-helpers";

/**
 * Approve a listing
 */
export function useApproveListing() {
  return useCreateMutation({
    mutationFn: async (listingId: string) => {
      const response = await fetch(`/api/admin/listings/${listingId}/approve`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve listing");
      }

      return response.json();
    },
    // Success message will be customized in component
    successMessage: undefined,
    invalidateQueryKeys: [
      ["admin", "pending-reviews"],
      ["admin", "review-history"],
      ["admin", "pending-review-count"],
    ],
  });
}

/**
 * Reject a listing
 */
export function useRejectListing() {
  return useCreateMutation({
    mutationFn: async ({
      listingId,
      rejectionReason,
    }: {
      listingId: string;
      rejectionReason: string;
    }) => {
      const formData = new FormData();
      formData.append("rejectionReason", rejectionReason);

      const response = await fetch(`/api/admin/listings/${listingId}/reject`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject listing");
      }

      return response.json();
    },
    // Success message will be customized in component
    successMessage: undefined,
    invalidateQueryKeys: [
      ["admin", "pending-reviews"],
      ["admin", "review-history"],
      ["admin", "pending-review-count"],
    ],
  });
}

/**
 * Upload a legal document version
 */
export function useUploadLegalDocument() {
  return useCreateMutation({
    mutationFn: async (data: {
      documentId: string;
      version: string;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("documentId", data.documentId);
      formData.append("version", data.version);
      formData.append("file", data.file);

      const response = await fetch("/api/admin/legal-documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to upload document");
      }

      return response.json();
    },
    // Success message will be customized in component
    successMessage: undefined,
    invalidateQueryKeys: [["admin", "legal-documents"]],
  });
}

/**
 * Delete a document version
 */
export function useDeleteDocumentVersion() {
  return useCreateMutation({
    mutationFn: async ({
      documentId,
      version,
      blobPathname,
    }: {
      documentId: string;
      version: string;
      blobPathname?: string;
    }) => {
      const formData = new FormData();
      if (blobPathname) {
        formData.append("blobPathname", blobPathname);
      }

      const response = await fetch(
        `/api/admin/legal-documents/${documentId}/${version}`,
        {
          method: "DELETE",
          body: formData,
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete version");
      }

      return response.json();
    },
    // Success message will be customized in component
    successMessage: undefined,
    invalidateQueryKeys: [["admin", "legal-documents"]],
  });
}
