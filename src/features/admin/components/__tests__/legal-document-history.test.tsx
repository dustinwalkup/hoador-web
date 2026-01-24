import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { LegalDocumentHistory } from "../legal-document-history";
import { toast } from "sonner";
import { mockDocumentVersions } from "@/test/fixtures/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Create test query client
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// Wrapper component for React Query
function QueryWrapper({
  children,
  queryClient,
}: {
  children: React.ReactNode;
  queryClient: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

describe("LegalDocumentHistory", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("Rendering", () => {
    it("should render list of document versions", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      expect(screen.getByText("Version 2.0")).toBeInTheDocument();
      expect(screen.getByText("Version 1.0")).toBeInTheDocument();
    });

    it("should render version number for each version", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      expect(screen.getByText("Version 2.0")).toBeInTheDocument();
      expect(screen.getByText("Version 1.0")).toBeInTheDocument();
    });

    it("should render published date for each version", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      // Published dates should be rendered for each version
      const publishedTexts = screen.getAllByText(/Published/);
      expect(publishedTexts).toHaveLength(mockDocumentVersions.length);

      // Check for formatted dates (format: "Jan 15, 2024", "Feb 1, 2024", etc.)
      // Match any month abbreviation followed by day and year
      const dateTexts = screen.getAllByText(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, 2024/,
      );
      expect(dateTexts).toHaveLength(mockDocumentVersions.length);
    });

    it("should render 'Current' badge for current version", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const currentBadges = screen.getAllByText("Current");
      expect(currentBadges.length).toBeGreaterThan(0);
    });

    it("should render download button for each version", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const downloadButtons = screen.getAllByRole("button", {
        name: /download/i,
      });
      expect(downloadButtons).toHaveLength(mockDocumentVersions.length);
    });

    it("should render delete button for non-current versions", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      // Version 1.0 is not current, so should have delete button
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it("should not render delete button for current version", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      // Find all delete buttons
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });

      // Current version (2.0) should not have delete button
      // Only non-current versions should have delete buttons
      expect(deleteButtons.length).toBeLessThan(mockDocumentVersions.length);
    });

    it("should show empty state message when no versions", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={[]}
            currentVersion=""
          />
        </QueryWrapper>,
      );

      expect(screen.getByText("No versions found")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should open document URL when download button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const downloadButtons = screen.getAllByRole("button", {
        name: /download/i,
      });
      await user.click(downloadButtons[0]);

      expect(mockWindowOpen).toHaveBeenCalledWith(
        mockDocumentVersions[0].url,
        "_blank",
      );
    });

    it("should show confirmation dialog when delete button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(
        screen.getByText(/are you sure you want to delete version/i),
      ).toBeInTheDocument();
    });

    it("should call delete mutation when delete is confirmed", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/admin/legal-documents/"),
          expect.objectContaining({
            method: "DELETE",
          }),
        );
      });
    });

    it("should close dialog without action when cancel is clicked", async () => {
      const user = userEvent.setup();
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Cancel deletion
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    it("should show loading state during delete", async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValue(pendingPromise);

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      const clickPromise = user.click(confirmButton);

      // Button should be disabled during deletion
      await waitFor(() => {
        expect(deleteButtons[0]).toBeDisabled();
      });

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: async () => ({ success: true }),
      });

      await clickPromise;
    });
  });

  describe("Success/Error Handling", () => {
    it("should show success toast on successful delete", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Version 1.0 deleted successfully",
        );
      });
    });

    it("should show error toast on delete failure", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Failed to delete version" }),
      });

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to delete version",
          expect.objectContaining({ duration: 5000 }),
        );
      });
    });

    it("should call onDelete callback when provided", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
            onDelete={onDelete}
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalled();
      });
    });

    it("should invalidate queries on successful delete", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={mockDocumentVersions}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(invalidateQueriesSpy).toHaveBeenCalledWith({
          queryKey: ["admin", "legal-documents"],
        });
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty versions array", () => {
      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={[]}
            currentVersion=""
          />
        </QueryWrapper>,
      );

      expect(screen.getByText("No versions found")).toBeInTheDocument();
    });

    it("should handle missing blob pathname", async () => {
      const user = userEvent.setup();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const versionsWithoutPathname = [
        {
          ...mockDocumentVersions[0],
          version: "1.0", // Not current version
          url: "invalid-url", // Invalid URL that can't be parsed
        },
      ];

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={versionsWithoutPathname}
            currentVersion="2.0" // Different from the version we're testing
          />
        </QueryWrapper>,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons).toHaveLength(1); // Should have one delete button

      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });

    it("should handle invalid URLs gracefully", () => {
      const versionsWithInvalidUrl = [
        {
          ...mockDocumentVersions[0],
          url: "not-a-valid-url",
        },
      ];

      render(
        <QueryWrapper queryClient={queryClient}>
          <LegalDocumentHistory
            documentId={LEGAL_DOCUMENT_IDS.TOS}
            versions={versionsWithInvalidUrl}
            currentVersion="2.0"
          />
        </QueryWrapper>,
      );

      // Should still render the version
      expect(screen.getByText("Version 2.0")).toBeInTheDocument();
    });
  });
});
