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
 * Approve a pending HOA service listing (admin).
 */
export function useApproveServiceListing() {
  return useCreateMutation({
    mutationFn: async ({
      listingId,
      note,
    }: {
      listingId: string;
      note?: string;
    }) => {
      const response = await fetch(
        `/api/admin/services/listings/${listingId}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note ?? undefined }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to approve service listing");
      }

      return response.json();
    },
    successMessage: undefined,
    invalidateQueryKeys: [
      ["admin", "pending-service-review-count"],
      ["admin", "service-review-history"],
    ],
  });
}

/**
 * Reject a pending HOA service listing (admin).
 */
export function useRejectServiceListing() {
  return useCreateMutation({
    mutationFn: async ({
      listingId,
      reason,
    }: {
      listingId: string;
      reason: string;
    }) => {
      const response = await fetch(
        `/api/admin/services/listings/${listingId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to reject service listing");
      }

      return response.json();
    },
    successMessage: undefined,
    invalidateQueryKeys: [
      ["admin", "pending-service-review-count"],
      ["admin", "service-review-history"],
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

/**
 * Delete a user permanently (superadmin only).
 */
export function useDeleteAdminUser() {
  return useCreateMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }

      return response.json();
    },
    successMessage: "User deleted",
    invalidateQueryKeys: [["admin", "users"]],
  });
}

export interface UpdateAdminUserVariables {
  userId: string;
  status?: import("@/dal/types").UserStatus;
  userType?: import("@/dal/types").UserType;
}

/**
 * Update a user's status and/or role (admin only). Only superadmin can set userType to admin/superadmin.
 */
export function useUpdateAdminUser() {
  return useCreateMutation({
    mutationFn: async ({
      userId,
      status,
      userType,
    }: UpdateAdminUserVariables) => {
      const body: Record<string, string> = {};
      if (status !== undefined) body.status = status;
      if (userType !== undefined) body.userType = userType;

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update user");
      }

      return response.json();
    },
    successMessage: "User updated",
    invalidateQueryKeys: [
      ["admin", "users"],
      ["admin", "user"],
    ],
  });
}
