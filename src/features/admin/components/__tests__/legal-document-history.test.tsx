import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LegalDocumentHistory } from "../legal-document-history";
import { deleteVersionAction } from "../../actions/legal-documents";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mockDocumentVersions } from "@/test/fixtures/legal-documents";
import { LEGAL_DOCUMENT_IDS } from "@/constants/legal-documents";

// Mock dependencies
vi.mock("../../actions/legal-documents", () => ({
  deleteVersionAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock window.open
const mockWindowOpen = vi.fn();
window.open = mockWindowOpen;

describe("LegalDocumentHistory", () => {
  const mockRouter = {
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    pathname: "/admin/dashboard/legal",
    query: {},
    asPath: "/admin/dashboard/legal",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue(mockRouter as any);
  });

  describe("Rendering", () => {
    it("should render list of document versions", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      expect(screen.getByText("Version 2.0")).toBeInTheDocument();
      expect(screen.getByText("Version 1.0")).toBeInTheDocument();
    });

    it("should render version number for each version", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      expect(screen.getByText("Version 2.0")).toBeInTheDocument();
      expect(screen.getByText("Version 1.0")).toBeInTheDocument();
    });

    it("should render published date for each version", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
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
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      const currentBadges = screen.getAllByText("Current");
      expect(currentBadges.length).toBeGreaterThan(0);
    });

    it("should render download button for each version", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      const downloadButtons = screen.getAllByRole("button", {
        name: /download/i,
      });
      expect(downloadButtons).toHaveLength(mockDocumentVersions.length);
    });

    it("should render delete button for non-current versions", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      // Version 1.0 is not current, so should have delete button
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });

    it("should not render delete button for current version", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      // Find all delete buttons
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });

      // Current version (2.0) should not have delete button
      // Only non-current versions should have delete buttons
      expect(deleteButtons.length).toBeLessThan(mockDocumentVersions.length);
    });

    it("should show empty state message when no versions", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={[]}
          currentVersion=""
        />,
      );

      expect(screen.getByText("No versions found")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("should open document URL when download button is clicked", async () => {
      const user = userEvent.setup();
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
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
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      expect(
        screen.getByText(/are you sure you want to delete version/i),
      ).toBeInTheDocument();
    });

    it("should call delete action when delete is confirmed", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteVersionAction).mockResolvedValue({
        success: true,
      });

      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Confirm deletion
      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(deleteVersionAction).toHaveBeenCalled();
      });
    });

    it("should close dialog without action when cancel is clicked", async () => {
      const user = userEvent.setup();
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      // Cancel deletion
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(deleteVersionAction).not.toHaveBeenCalled();
      });
    });

    it("should show loading state during delete", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteVersionAction).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({ success: true });
            }, 100);
          }),
      );

      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
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

      await clickPromise;
    });
  });

  describe("Success/Error Handling", () => {
    it("should show success toast on successful delete", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteVersionAction).mockResolvedValue({
        success: true,
      });

      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
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
      vi.mocked(deleteVersionAction).mockResolvedValue({
        error: "Failed to delete version",
      });

      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to delete version");
      });
    });

    it("should call onDelete callback when provided", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      vi.mocked(deleteVersionAction).mockResolvedValue({
        success: true,
      });

      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
          onDelete={onDelete}
        />,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalled();
      });
    });

    it("should refresh router on successful delete", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteVersionAction).mockResolvedValue({
        success: true,
      });

      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={mockDocumentVersions}
          currentVersion="2.0"
        />,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(mockRouter.refresh).toHaveBeenCalled();
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty versions array", () => {
      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={[]}
          currentVersion=""
        />,
      );

      expect(screen.getByText("No versions found")).toBeInTheDocument();
    });

    it("should handle missing blob pathname", async () => {
      const user = userEvent.setup();
      vi.mocked(deleteVersionAction).mockResolvedValue({
        success: true,
      });

      const versionsWithoutPathname = [
        {
          ...mockDocumentVersions[0],
          version: "1.0", // Not current version
          url: "invalid-url", // Invalid URL that can't be parsed
        },
      ];

      render(
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={versionsWithoutPathname}
          currentVersion="2.0" // Different from the version we're testing
        />,
      );

      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      expect(deleteButtons).toHaveLength(1); // Should have one delete button

      await user.click(deleteButtons[0]);

      const confirmButton = screen.getByRole("button", { name: /^delete$/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(deleteVersionAction).toHaveBeenCalled();
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
        <LegalDocumentHistory
          documentId={LEGAL_DOCUMENT_IDS.TOS}
          versions={versionsWithInvalidUrl}
          currentVersion="2.0"
        />,
      );

      // Should still render the version
      expect(screen.getByText("Version 2.0")).toBeInTheDocument();
    });
  });
});
