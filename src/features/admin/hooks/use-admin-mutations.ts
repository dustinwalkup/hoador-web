import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCreateMutation } from "@/lib/react-query/mutation-helpers";
import type { PaginatedResult } from "@/dal/types";
import type { MembershipWithUserAndAddress } from "@/db/schemas/communities.schema";

/**
 * Approve a listing
 */
export function useApproveListing() {
  const queryClient = useQueryClient();

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
      ["admin", "badges"],
    ],
    // On network error (e.g. Mobile Safari "Load failed") the server may have
    // already applied the action. Refetch so the card disappears if processed.
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "badges"],
      });
    },
  });
}

/**
 * Reject a listing
 */
export function useRejectListing() {
  const queryClient = useQueryClient();

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
      ["admin", "badges"],
    ],
    // On network error the server may have already applied the rejection — refetch
    // so the card disappears if the listing was already processed.
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "pending-reviews"] });
      queryClient.invalidateQueries({
        queryKey: ["admin", "badges"],
      });
    },
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
      ["admin", "badges"],
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
      ["admin", "badges"],
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

// ============================
// Community-membership verification queue (R9)
// ============================

const PENDING_VERIFICATIONS_KEY = ["admin", "pending-verifications"] as const;

export type AdminPendingVerificationsResponse =
  PaginatedResult<MembershipWithUserAndAddress>;

/**
 * Paginated queue of community memberships awaiting residency verification.
 */
export function useAdminPendingVerifications({
  page = 1,
  limit = 25,
  communityId,
}: { page?: number; limit?: number; communityId?: string } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (communityId) params.set("communityId", communityId);

  return useQuery<AdminPendingVerificationsResponse>({
    queryKey: [...PENDING_VERIFICATIONS_KEY, page, limit, communityId ?? ""],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/community-memberships/pending?${params.toString()}`,
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to load pending verifications");
      }
      return response.json();
    },
    staleTime: 15 * 1000,
  });
}

/**
 * Approve a pending residency claim (admin). Optional notes.
 */
export function useVerifyMembership() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      membershipId,
      adminNotes,
    }: {
      membershipId: string;
      adminNotes?: string;
    }) => {
      const formData = new FormData();
      if (adminNotes && adminNotes.trim()) {
        formData.append("adminNotes", adminNotes.trim());
      }
      const response = await fetch(
        `/api/admin/community-memberships/${membershipId}/verify`,
        { method: "POST", body: formData },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to verify membership");
      }
      return response.json();
    },
    successMessage: "Membership verified",
    invalidateQueryKeys: [PENDING_VERIFICATIONS_KEY],
    onError: () => {
      // Network errors may still have applied server-side; refetch the queue.
      queryClient.invalidateQueries({ queryKey: PENDING_VERIFICATIONS_KEY });
    },
  });
}

/**
 * Deny a pending residency claim (admin). Notes are required.
 */
export function useDenyMembership() {
  const queryClient = useQueryClient();

  return useCreateMutation({
    mutationFn: async ({
      membershipId,
      adminNotes,
    }: {
      membershipId: string;
      adminNotes: string;
    }) => {
      const formData = new FormData();
      formData.append("adminNotes", adminNotes);
      const response = await fetch(
        `/api/admin/community-memberships/${membershipId}/deny`,
        { method: "POST", body: formData },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to deny membership");
      }
      return response.json();
    },
    successMessage: "Membership denied",
    invalidateQueryKeys: [PENDING_VERIFICATIONS_KEY],
    onError: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_VERIFICATIONS_KEY });
    },
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
